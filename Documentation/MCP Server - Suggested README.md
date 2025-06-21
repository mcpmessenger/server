# MCP Server - Suggested README.md

## Vision

A unified backend service for the Model Context Protocol (MCP), enabling API-driven, multi-provider AI and automation command execution, workflow chaining, and seamless integration with services like GitHub and Google. MCP Server acts as the core engine for orchestrating commands and workflows across apps and protocols.

## Tech Stack

**Backend:**
- Node.js (Express, ES modules)
- AI Providers: OpenAI, Anthropic, Google Generative AI (Gemini)
- Integrations: Google (OAuth), GitHub (token-based)
- Session management: express-session
- Database: SQLite (per-user integration tokens)
- Security: CORS, dotenv, multer

**Frontend (Admin/Optional):**
- React 18 (TypeScript), Vite, Tailwind CSS (dark mode)
- Custom UI components, lucide-react icons
- State management with custom React hooks

## Core Features

**API/Backend**
- API endpoints: `/api/chat`, `/api/workflow`, `/api/github`, `/api/google`, `/api/health`
- Modular provider/command registry for extensibility
- Multi-step workflow execution and error handling
- File upload and summarization
- Smart intent parsing: routes commands to the correct provider or integration
- Chained command parsing: users/apps can enter multi-step instructions in one message
- Session management and per-user integration tokens
- Secure OAuth flows for Google
- Token-based authentication for GitHub
- Real-time health check endpoint for server status

**(Optional) Admin Frontend**
- Settings modal for API key entry, provider connection, command reference
- Request history and command palette
- Provider status indicators (connected/disconnected, last used, request count)
- Modern, responsive UI with dark/light mode

## User Workflows

- **Multi-provider AI chat:** Apps or users can send chat, summarize, or code commands to OpenAI, Anthropic, or Gemini using their own API keys.
- **Command registry:** Supports chat, summarize, code search, repo summary, explain, translate, and more.
- **Integrations:** Google Drive, Gmail, and GitHub via OAuth or token-based credentials.
- **Smart intent parsing:** Natural language commands are routed to the correct provider or integration.
- **Chained commands:** Apps or users can enter multi-step instructions in one message (e.g., "Summarize this PDF and translate to Spanish").
- **Workflow builder:** (Optional) Visual builder for multi-step, multi-provider workflows.
- **File upload:** Summarize or process uploaded files.
- **Session-based authentication:** Secure, per-user integration tokens.

## Security & Best Practices

- TypeScript everywhere
- Tailwind CSS for utility-first, responsive design (frontend)
- OAuth for secure integrations
- Environment variables for secrets/config
- API error handling and user feedback
- CORS restricted to local dev ports
- Per-user token storage in SQLite

## Roadmap & Next Steps

- Visual workflow builder (drag-and-drop, optional)
- More integrations (Notion, Slack, Jira, etc.)
- Custom command macros and user-defined workflows
- Scheduling and automation
- Contextual memory and chaining across sessions
- Harden OAuth flows, encrypt API keys, audit CORS
- Add unit and integration tests

## Example Use Cases

- "Summarize this PDF and then translate it to Spanish."
- "Fetch the latest GitHub issues, summarize them, and email the summary to my team."
- "Extract text from an image, then run sentiment analysis."

## Chained Commands & API

### Overview
Chained commands allow apps or users to combine multiple actions in a single workflow, where the output of one command becomes the input for the next. This enables complex, multi-step tasks to be performed with a single API call or through a visual builder.

### User Value
- Automates repetitive or multi-step tasks.
- Saves time and reduces manual effort.
- Enables advanced use cases (e.g., summarize a document, then translate the summary).

### Example Use Cases
- "Summarize this PDF and then translate it to Spanish."
- "Fetch the latest GitHub issues, summarize them, and email the summary to my team."
- "Extract text from an image, then run sentiment analysis."

### Supported Chains
- Summarize → Translate
- Fetch Issues → Summarize → Email
- Extract Text → Analyze Sentiment

### Error Handling
- If a step fails, the user/app is notified with a clear error message.
- The user/app can view which step failed and retry or edit the chain.

### Chained Command API/GUI

**Key Features:**
- **API for Chained Commands:**
  - Apps can POST a workflow (array of steps) to `/api/workflow`.
  - Each step specifies provider, command, prompt, and (optionally) API key.
- **(Optional) Command Builder Modal/Panel:**
  - Users can visually add, remove, and reorder steps in a workflow.
  - Each step is represented as a card or block with editable parameters.
- **Inline Chaining in Chat:**
  - Users can type chained commands naturally; the system parses and displays the steps visually above the input.
  - Users can click to edit the chain in the builder modal.
- **Execution Feedback:**
  - Progress bar or step tracker shows which step is running, completed, or failed.
  - Users can expand/collapse to view intermediate results.

**User Flow:**
1. App or user sends a chained command or opens the builder.
2. System parses and displays the steps.
3. User/app reviews/edits the steps.
4. User/app clicks "Run."
5. API/UI shows progress and results for each step.

## MCP API Reference

### List Supported Commands

```
GET /api/commands
```
Returns all commands the MCP server currently exposes. Example response (truncated):

```json
[
  { "id": "chat",           "description": "Conversational AI" },
  { "id": "summarize",      "description": "Summarize text or documents" },
  { "id": "generate-code", "description": "Generate code snippets" },
  { "id": "explain",        "description": "Explain concepts or code" },
  { "id": "translate",      "description": "Translate text" },
  { "id": "list-repos",     "description": "List GitHub repositories",        "providers": ["github"] },
  { "id": "get-file",       "description": "Fetch file content from repository","providers": ["github"] },
  { "id": "repo-summary",   "description": "Summarize repository structure",  "providers": ["github"] },
  { "id": "code-search",    "description": "Search code in repositories",     "providers": ["github"] },
  { "id": "generate-issue", "description": "Create GitHub issue",             "providers": ["github"] },
  { "id": "generate-pr",    "description": "Create GitHub pull-request",      "providers": ["github"] }
]
```

### List Providers & Their Capabilities

```
GET /api/providers
```
Each provider entry lists the commands it supports:

```json
[
  { "id": "openai",    "supportedCommands": ["chat","summarize","generate-code","explain","translate"] },
  { "id": "anthropic", "supportedCommands": ["chat","summarize","generate-code","explain","translate"] },
  { "id": "gemini",    "supportedCommands": ["chat","summarize","generate-code","explain","translate"] },
  { "id": "github",    "supportedCommands": ["list-repos","get-file","repo-summary","code-search","generate-issue","generate-pr"] }
]
```

Use these endpoints to dynamically build command palettes or validate which operations are available without hard-coding them in the front-end. 

## External Automation Connectors (n8n, Make.com, Zapier)

The project now ships with first-class, open-source connectors that let anyone orchestrate MCP commands and workflows in their favorite no-code tools.

| Platform | Location in Repo | What's Included |
|----------|------------------|-----------------|
| **n8n**  | `integrations/n8n-nodes-mcp/` | Custom node **MCP** with `Command` & `Workflow` resources and credential type (Base URL + optional API key). Build via `npm run build` and install inside your n8n instance with `npm i n8n-nodes-mcp`. |
| **Make.com** | `integrations/makecom/mcp-app.json` | Importable JSON definition exposing *Execute Command* & *Execute Workflow* actions. |
| **Zapier** | `integrations/zapier-mcp/` | Zapier Platform CLI app with custom auth, ping trigger, and the same two actions. Deploy with `zapier push`. |

All three connectors share the identical credential model:

* **Base URL** – root of your MCP server (e.g. `https://api.my-mcp.com`)
* **API Key** – optional; include only if your instance enforces key-based auth

### Quickstart

```
# n8n (inside your n8n container / directory)
npm i n8n-nodes-mcp && n8n restart

# Make.com
# 1. Open Make.com ➜ Apps ➜ Create Custom App ➜ Import JSON
# 2. Paste the contents of integrations/makecom/mcp-app.json

# Zapier
npm i -g zapier-platform-cli
cd integrations/zapier-mcp
npm install
zapier login
zapier push   # follow prompts to create a private version
```

See the individual READMEs in each folder for more details.

## Built-in Zapier Provider (AI Actions)

MCP Server now supports Zapier **AI Actions (NLA)** natively via the `/api/command` endpoint.

1. In Zapier, open your Zap ➜ **AI Actions** panel ➜ enable **Expose this Zap to AI** ➜ *Publish* the Zap so it's **On**.
2. Generate an AI-Actions API key (it starts with `sk-nla-` or legacy `sk-ak-`).
3. Call MCP with `provider="zapier"` and the key in the body (`apiKey`) or an `Authorization: Bearer …` header.

```bash
# List AI-enabled Zaps
curl -X POST -H "Content-Type: application/json" \
     -d '{"provider":"zapier","command":"list-zaps","apiKey":"<ZAPIER_NLA_KEY>"}' \
     http://localhost:3001/api/command

# Trigger a Zap (replace <ID> with one returned from list-zaps)
curl -X POST -H "Content-Type: application/json" \
     -d '{"provider":"zapier","command":"trigger zap <ID>","apiKey":"<ZAPIER_NLA_KEY>"}' \
     http://localhost:3001/api/command
```

The server converts both requests into calls to Zapier's NLA endpoints:
* `list-zaps`  → `GET https://nla.zapier.com/api/v1/ai_zaps/`
* `trigger zap <id>` → `POST https://nla.zapier.com/api/v1/ai_zaps/<id>/execute/`

All responses (including errors) are returned as JSON, making them safe to consume from the front-end or other automations.


