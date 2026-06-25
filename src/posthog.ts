import { PostHog } from 'posthog-node';
import { instrument } from '@posthog/mcp';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// One PostHog client, shared across every session's MCP server instance.
export const posthog = new PostHog(requireKey(), {
  host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
  flushAt: 1, // flush every event immediately so you see them land while testing
});

function requireKey(): string {
  const key = process.env.POSTHOG_PROJECT_TOKEN ?? process.env.POSTHOG_API_KEY;
  if (!key) {
    console.error(
      'Missing POSTHOG_PROJECT_TOKEN. Copy .env.example to .env and set your phc_… project token.',
    );
    process.exit(1);
  }
  return key;
}

// Fake-but-stable person per MCP session, so repeated identify() calls inside one
// session don't keep rewriting the person. Same idea as the dummy-mcp example.
const FIRST = ['Ada', 'Grace', 'Linus', 'Alan', 'Margaret', 'Dennis', 'Barbara', 'Ken'];
const LAST = ['Lovelace', 'Hopper', 'Torvalds', 'Turing', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson'];
function dummyPerson(sessionId: string) {
  const hex = sessionId.replace(/-/g, '');
  const tag = hex.slice(0, 6);
  const first = FIRST[parseInt(hex.slice(0, 8), 16) % FIRST.length];
  const last = LAST[parseInt(hex.slice(8, 16), 16) % LAST.length];
  return {
    id: `user_${tag}`,
    name: `${first} ${last}`,
    email: `${first}.${last}.${tag}@example.com`.toLowerCase(),
  };
}

// The whole PostHog integration: hand MCP-Nest's McpServer to instrument(). One call.
export const instrumentationMutator = (server: McpServer): McpServer => {
  instrument(server, posthog, {
    logger: (msg: string) => console.error('[posthog]', msg),
    identify: async (_request: unknown, extra: any) => {
      const sessionId = extra?.sessionId;
      if (!sessionId) return null;
      const person = dummyPerson(String(sessionId));
      return {
        distinctId: person.id,
        properties: { name: person.name, email: person.email },
      };
    },
  });
  return server;
};
