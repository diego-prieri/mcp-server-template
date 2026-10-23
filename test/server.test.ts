import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { InMemoryBackend, type Backend } from '../src/backend.js';
import { createServer } from '../src/server.js';

const SEED = [
  { id: 'T-1', title: 'Set up CI', status: 'done' as const, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'T-2', title: 'Write onboarding guide', status: 'open' as const, description: 'Local setup', createdAt: '2026-01-02T00:00:00.000Z' },
];

async function connect(backend: Backend = new InMemoryBackend(SEED)) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(backend).connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
}

const text = (r: any) => r.content[0].text as string;

let client: Client;
beforeEach(async () => {
  client = await connect();
});

test('exposes the three tools with read-only hints where they apply', async () => {
  const { tools } = await client.listTools();
  const hints = Object.fromEntries(tools.map((t) => [t.name, t.annotations?.readOnlyHint]));
  assert.deepEqual(hints, { list_tickets: true, get_ticket: true, create_ticket: false });
});

test('list_tickets filters by status and query', async () => {
  const open = await client.callTool({ name: 'list_tickets', arguments: { status: 'open' } });
  assert.equal(text(open), 'T-2 [open] Write onboarding guide');

  const byQuery = await client.callTool({ name: 'list_tickets', arguments: { query: 'ci' } });
  assert.deepEqual((byQuery.structuredContent as any).tickets.map((t: any) => t.id), ['T-1']);
});

test('get_ticket returns an actionable error for unknown ids', async () => {
  const res = await client.callTool({ name: 'get_ticket', arguments: { id: 'T-99' } });
  assert.equal(res.isError, true);
  assert.match(text(res), /not found\. Use list_tickets/);
});

test('create_ticket adds a ticket that list_tickets then returns', async () => {
  const created = await client.callTool({ name: 'create_ticket', arguments: { title: 'Rotate API keys' } });
  assert.equal(text(created), 'Created T-3 [open] Rotate API keys');
  const all = await client.callTool({ name: 'list_tickets', arguments: {} });
  assert.match(text(all), /T-3/);
});

test('rejects invalid input before reaching the backend', async () => {
  const res = await client.callTool({ name: 'create_ticket', arguments: { title: 'x' } });
  assert.equal(res.isError, true);
});

test('backend failures come back as tool errors, not protocol errors', async () => {
  const broken: Backend = {
    listTickets: async () => {
      throw new Error('upstream timeout');
    },
    getTicket: async () => undefined,
    createTicket: async () => {
      throw new Error('unused');
    },
  };
  const res = await (await connect(broken)).callTool({ name: 'list_tickets', arguments: {} });
  assert.equal(res.isError, true);
  assert.match(text(res), /upstream timeout/);
});

test('serves the status guide resource', async () => {
  const res = await client.readResource({ uri: 'guide://ticket-statuses' });
  assert.match((res.contents[0] as any).text, /in_progress/);
});
