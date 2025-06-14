# n8n-nodes-mcp

Custom n8n nodes for interacting with an MCP (Multi-provider Command Protocol) Server.

## Features

* Execute a single `command` (e.g. chat, summarize, get-file) on any supported provider.
* Run multi-step `workflow` arrays entirely from n8n.
* Flexible credentials – supply a base URL to your MCP Server and (optionally) an API key.
* Returns either a simplified `data` field or the full raw response for advanced use-cases.

## Installation

```bash
# Inside your n8n instance container / directory
npm install n8n-nodes-mcp
```

The package exposes its compiled code in the `dist` folder along with type declarations so that **n8n** can auto-discover it at runtime. Restart n8n after installation.

## Credentials

1. **Base URL** – Root URL of your MCP Server (e.g. `https://my-mcp.example.com`).
2. **API Key** (optional) – If your MCP instance requires an API key, enter it here (will be sent in the body).

## Nodes

### MCP

* **Resource** — `Command` or `Workflow`.
* **Command Inputs** — `provider`, `command`, `prompt`, optional `context`.
* **Workflow Inputs** — raw JSON array describing the workflow steps (as defined by the MCP Protocol) and optional `context`.
* **Additional Fields** — currently just *Return Raw Response* (boolean).

## Development

```bash
# Install deps
pnpm install

# Build once
pnpm run build

# Watch & rebuild on change
pnpm run watch
```

The output is emitted to `dist/`.

## License

MIT © MCP Team 