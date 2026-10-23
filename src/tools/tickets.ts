import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Backend, Ticket } from '../backend.js';

const status = z.enum(['open', 'in_progress', 'done']);

/** Text for the model, structured content for clients that render or chain results. */
function ok(text: string, structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text }], structuredContent };
}

/**
 * Errors go back as tool results with isError, not thrown: the model sees the
 * message and can correct itself (fix an id, relax a filter) instead of the
 * whole call failing at the protocol level.
 */
function fail(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const summary = (t: Ticket) => `${t.id} [${t.status}] ${t.title}`;

export function registerTicketTools(server: McpServer, backend: Backend): void {
  server.registerTool(
    'list_tickets',
    {
      title: 'List tickets',
      description: 'List tickets, optionally filtered by status or a text query over title and description. Returns at most `limit` results.',
      inputSchema: {
        status: status.optional().describe('Only tickets in this status'),
        query: z.string().min(1).optional().describe('Case-insensitive text to match'),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const tickets = await backend.listTickets(args);
        const text = tickets.length ? tickets.map(summary).join('\n') : 'No tickets match.';
        return ok(text, { tickets });
      } catch (e) {
        return fail(`Could not list tickets: ${(e as Error).message}`);
      }
    },
  );

  server.registerTool(
    'get_ticket',
    {
      title: 'Get ticket',
      description: 'Get one ticket with its full description. Use list_tickets first if you do not know the id.',
      inputSchema: { id: z.string().describe('Ticket id, e.g. T-1') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const ticket = await backend.getTicket(id);
        if (!ticket) return fail(`Ticket ${id} not found. Use list_tickets to find valid ids.`);
        return ok(`${summary(ticket)}\n\n${ticket.description ?? '(no description)'}`, { ticket });
      } catch (e) {
        return fail(`Could not get ticket ${id}: ${(e as Error).message}`);
      }
    },
  );

  server.registerTool(
    'create_ticket',
    {
      title: 'Create ticket',
      description: 'Create a new ticket in status "open". Not idempotent: calling twice creates two tickets.',
      inputSchema: {
        title: z.string().trim().min(3).max(200),
        description: z.string().max(5000).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => {
      try {
        const ticket = await backend.createTicket(args);
        return ok(`Created ${summary(ticket)}`, { ticket });
      } catch (e) {
        return fail(`Could not create ticket: ${(e as Error).message}`);
      }
    },
  );
}
