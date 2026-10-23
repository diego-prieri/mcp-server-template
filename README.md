# mcp-server-template

A small, production-minded starting point for a [Model Context Protocol](https://modelcontextprotocol.io) server in TypeScript.

Most MCP examples stop at "hello world". This one shows the decisions that matter once agents call your tools for real:

- **Swappable backend.** Tools depend on a `Backend` interface, not on HTTP. The repo ships an in-memory store (used by default and in tests) and a REST adapter; replace either with your own API client without touching tool code.
- **Errors the model can act on.** Failures come back as tool results with `isError: true` and a message that says what to do next ("not found, use `list_tickets` to find valid ids"), not as protocol errors that end the call.
- **Validated, described inputs.** Zod schemas with bounds (`limit` 1–100, titles of 3–200 characters) and per-field descriptions, so bad calls are rejected before they reach the backend and the model knows what each argument means.
- **Honest tool annotations.** `readOnlyHint`, `idempotentHint` and `destructiveHint` are set per tool, so clients can auto-approve reads and ask before writes.
- **Text and structured output.** Each result carries a short text summary for the model and `structuredContent` for clients that render or chain results.
- **Server instructions and a resource.** The server tells the agent how its tools fit together, and exposes reference docs as an MCP resource.
- **Tests without a network.** The whole client–server round trip runs over the SDK's in-memory transport.

## Layout

```
src/
  backend.ts        Backend interface + InMemoryBackend + HttpBackend
  tools/tickets.ts  Tool definitions: schemas, annotations, error handling
  server.ts         createServer(backend): tools + resources, no transport
  index.ts          stdio entry point; picks the backend from env
test/
  server.test.ts    In-memory client ↔ server tests
```

The example domain is a minimal ticket tracker (`list_tickets`, `get_ticket`, `create_ticket`). Rename it to your domain and keep the structure.

## Run it

```bash
npm install
npm test
npm run inspect   # opens the MCP Inspector against the server
npm run build
```

Use it from Claude Code:

```bash
claude mcp add tickets -- node /absolute/path/to/mcp-server-template/dist/index.js
```

Point it at a real API instead of the in-memory store:

```bash
claude mcp add tickets -e API_BASE_URL=https://api.example.com -e API_TOKEN=… -- node /absolute/path/to/dist/index.js
```

## Adding a tool

1. Add the method to `Backend` and implement it in both adapters.
2. Register the tool in `src/tools/` with a description written for the model, bounded Zod inputs and accurate annotations.
3. Return `ok(text, structured)` or `fail(message)`. Never throw out of a handler.
4. Add a test in `test/server.test.ts` that goes through the client.

## License

MIT
