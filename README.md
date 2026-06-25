# dummy-nest-mcp

A minimal MCP server built with **[@rekog/mcp-nest](https://github.com/rekog-labs/MCP-Nest)** (NestJS),
instrumented with **[@posthog/mcp](https://posthog.com/docs/mcp-analytics/installation)** to validate
that PostHog's MCP analytics SDK works against a MCP-Nest server.

It exposes two mocked tools — `get_trends` and `get_funnel`

## How the integration works

MCP-Nest creates the underlying `@modelcontextprotocol/sdk` `McpServer` for you. It exposes
that instance through the **`serverMutator`** option on `McpModule.forRoot()`:

```ts
// src/app.module.ts
McpModule.forRoot({
  name: 'dummy-nest-mcp',
  version: '0.1.0',
  // Stateful Streamable HTTP: one McpServer / one session spans the whole
  // connection, so `initialize` and every tool call share an `mcp-session-id`.
  // Without this combo (stateless mode, or no propagated session) each request
  // stands alone — every tool call is its own session and identify() has no
  // stable session to attribute events to.
  transport: McpTransportType.STREAMABLE_HTTP,
  streamableHttp: { enableJsonResponse: true },
  serverMutator: instrumentationMutator, // <- the hook @posthog/mcp plugs into
})
```

```ts
// src/posthog.ts
export const instrumentationMutator = (server) => {
  instrument(server, posthog, { logger, identify });
  return server;
};
```

`instrument()` accepts the high-level `McpServer`, is idempotent per server instance, and wraps
its request handlers so tool calls / listings / initialize / identity get auto-captured.

> ⚠️ Subtle bit: because this server is **stateful**, MCP-Nest builds a fresh `McpServer` for
> every session, so `serverMutator` (and therefore `instrument()`) runs **once per session, not
> once at boot**. Keep the `PostHog` client a shared singleton outside the mutator — see
> [Gotcha 2](#gotcha-2--servermutator-runs-once-per-session) below.

## Setup

```bash
npm install
cp .env.example .env   # then put your key in .env
```

Set in `.env`:

- `POSTHOG_PROJECT_TOKEN` — your **Project token** (`phc_…`), shown under "Project token & ID" in the
  PostHog UI. This is the value the SDK ingests events with. (`POSTHOG_API_KEY` is still accepted as a
  fallback name. Don't use a personal key, `phx_…`.)
- `POSTHOG_HOST` — optional. Defaults to PostHog Cloud US (`https://us.i.posthog.com`).
  EU: `https://eu.i.posthog.com`; local dev stack: `http://localhost:8010`.
- `PORT` — optional, defaults to `3000`.

## Run

```bash
npm start
# -> server.ready http://localhost:3000/mcp
```

Tool-call logs (`get_trends …`) and `[posthog]` capture lines go to stderr — leave it running.

## Test it (curl)

Streamable HTTP is stateful here, so propagate the `mcp-session-id` returned by `initialize`:

```bash
B=http://localhost:3000/mcp
H='Accept: application/json, text/event-stream'

# initialize → grab the session id from the response header
SID=$(curl -s -D /tmp/h.txt -o /dev/null -H "$H" -H 'Content-Type: application/json' -X POST "$B" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'; \
  grep -i '^mcp-session-id:' /tmp/h.txt | awk '{print $2}' | tr -d '\r')

curl -s -H "$H" -H 'Content-Type: application/json' -H "mcp-session-id: $SID" -X POST "$B" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

curl -s -H "$H" -H 'Content-Type: application/json' -H "mcp-session-id: $SID" -X POST "$B" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_trends","arguments":{"event":"pageview","days":3}}}'
```

## Connect from Claude Desktop

Bridge stdio → HTTP with `mcp-remote` (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dummy-nest-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/mcp", "--transport", "http-only"]
    }
  }
}
```
