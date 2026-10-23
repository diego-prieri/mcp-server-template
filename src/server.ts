import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Backend } from './backend.js';
import { registerTicketTools } from './tools/tickets.js';

export const SERVER_INFO = { name: 'mcp-server-template', version: '0.1.0' };

/** Builds the server without a transport, so tests and the CLI share it. */
export function createServer(backend: Backend): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: 'Ticket tracker. Use list_tickets to discover ids before get_ticket. Ask the user before create_ticket.',
  });

  registerTicketTools(server, backend);

  server.registerResource(
    'status-guide',
    'guide://ticket-statuses',
    { title: 'Ticket statuses', description: 'What each ticket status means', mimeType: 'text/markdown' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: '- `open`: not started\n- `in_progress`: someone is working on it\n- `done`: finished, no action needed',
        },
      ],
    }),
  );

  return server;
}
