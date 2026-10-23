#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HttpBackend, InMemoryBackend, type Backend } from './backend.js';
import { createServer } from './server.js';

const backend: Backend = process.env.API_BASE_URL
  ? new HttpBackend(process.env.API_BASE_URL, process.env.API_TOKEN)
  : new InMemoryBackend([
      { id: 'T-1', title: 'Set up CI', status: 'done', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'T-2', title: 'Write onboarding guide', status: 'open', description: 'Cover local setup and conventions', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);

const server = createServer(backend);
await server.connect(new StdioServerTransport());
// stdout carries the protocol; logs must go to stderr.
console.error(`mcp-server-template running on stdio (${process.env.API_BASE_URL ? 'http' : 'in-memory'} backend)`);
