# MCP Server – Technical Product Requirements Document (PRD)

## 1. Vision
A unified backend service for the Model Context Protocol (MCP), enabling API-driven, multi-provider AI and automation command execution, workflow chaining, and seamless integration with services like GitHub and Google. MCP Server acts as the core engine for orchestrating commands and workflows across apps and protocols.

---

## 2. Tech Stack

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

---

## 3. Core Features

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

---

## 4. User Workflows

- **Multi-provider AI chat:** Apps or users can send chat, summarize, or code commands to OpenAI, Anthropic, or Gemini using their own API keys.
- **Command registry:** Supports chat, summarize, code search, repo summary, explain, translate, and more.
- **Integrations:** Google Drive, Gmail, and GitHub via OAuth or token-based credentials.
- **Smart intent parsing:** Natural language commands are routed to the correct provider or integration.
- **Chained commands:** Apps or users can enter multi-step instructions in one message (e.g., "Summarize this PDF and translate to Spanish").
- **Workflow builder:** (Optional) Visual builder for multi-step, multi-provider workflows.
- **File upload:** Summarize or process uploaded files.
- **Session-based authentication:** Secure, per-user integration tokens.

---

## 5. Security & Best Practices

- TypeScript everywhere
- Tailwind CSS for utility-first, responsive design (frontend)
- OAuth for secure integrations
- Environment variables for secrets/config
- API error handling and user feedback
- CORS restricted to local dev ports
- Per-user token storage in SQLite

---

## 6. Roadmap & Next Steps

- Visual workflow builder (drag-and-drop, optional)
- More integrations (Notion, Slack, Jira, etc.)
- Custom command macros and user-defined workflows
- Scheduling and automation
- Contextual memory and chaining across sessions
- Harden OAuth flows, encrypt API keys, audit CORS
- Add unit and integration tests

---

## 7. Example Use Cases

- "Summarize this PDF and then translate it to Spanish."
- "Fetch the latest GitHub issues, summarize them, and email the summary to my team."
- "Extract text from an image, then run sentiment analysis."

---

# MCP Server

## Product Requirements Document (PRD)

**Core Features:**
- API-driven, multi-provider AI chat (OpenAI, Anthropic, Gemini) with per-user API keys.
- Command registry: supports chat, summarize, code search, repo summary, explain, translate, and more.
- Google Drive, Gmail, and GitHub integrations with OAuth or token-based credentials.
- Real-time provider connection status via API.
- Smart intent parsing: routes commands to the correct provider or integration.
- Chained command parsing: apps or users can enter multi-step instructions in one message.
- Workflow builder (optional): design and run multi-step, multi-provider workflows.
- File upload and summarization.
- Session-based authentication for integrations.
- Modern, responsive (optional) UI for admin/configuration.

**Advanced/Upcoming:**
- Visual workflow builder (drag-and-drop, optional).
- More integrations (Notion, Slack, Jira, etc).
- Custom command macros and user-defined workflows.
- Scheduling and automation.
- Contextual memory and chaining across sessions.

---

## Features

- **API-driven multi-provider AI chat:** OpenAI, Anthropic, Gemini (per-user API keys)
- **Command registry:** Chat, summarize, code search, repo summary, explain, translate, and more
- **Integrations:** Google Drive, Gmail, GitHub (OAuth or token-based credentials)
- **Smart intent parsing:** Natural language commands routed to the right provider/integration
- **Chained commands:** Enter multi-step instructions in one message
- **Workflow builder:** (optional) Visual multi-step, multi-provider workflows
- **File upload:** Summarize or process uploaded files
- **Session-based authentication:** Secure, per-user integration tokens
- **Modern UI (optional):** Responsive, dark/light mode, real-time provider status

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

---

**For questions, contributions, or commercial use, contact [automationalien.com](https://automationalien.com)**

---

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