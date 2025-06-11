# MCP Hub – Technical Product Requirements Document (PRD)

## 1. Vision
A unified AI and automation command center for multi-provider chat, workflow chaining, and seamless integration with services like GitHub and Google, featuring a modern, responsive, and extensible UI.

---

## 2. Tech Stack

**Frontend:**
- React 18 (TypeScript), Vite, Tailwind CSS (dark mode)
- Custom UI components, lucide-react icons
- 3D visuals via @react-three/fiber, three.js
- State management with custom React hooks

**Backend:**
- Node.js (Express, ES modules)
- AI Providers: OpenAI, Anthropic, Google Generative AI (Gemini)
- Integrations: Google (OAuth), GitHub (OAuth, Octokit)
- Session management: express-session
- Database: SQLite (per-user integration tokens)
- Security: CORS, dotenv, multer

---

## 3. Core Features

**Frontend**
- Unified chat/workflow input (supports multi-step chaining)
- Example commands and tips below chat input
- Command palette and quick-insert for MCP commands
- Per-user API key management (Google, GitHub, OpenAI, Anthropic, Gemini)
- OAuth for Google and GitHub
- Provider status indicators (connected/disconnected, last used, request count)
- 3D ChromeGrid background
- Settings modal for API key entry, provider connection, command reference
- Request history

**Backend**
- API endpoints: `/api/chat`, `/api/workflow`, `/api/github`, `/api/google`
- Session management and per-user integration tokens
- Secure OAuth flows for Google and GitHub
- Modular provider/command registry for extensibility
- Multi-step workflow execution and error handling
- File upload and summarization

---

## 4. User Workflows

- **Multi-provider AI chat:** Users can chat with OpenAI, Anthropic, or Gemini using their own API keys.
- **Command registry:** Supports chat, summarize, code search, repo summary, explain, translate, and more.
- **Integrations:** Google Drive, Gmail, and GitHub via OAuth and per-user credentials.
- **Smart intent parsing:** Natural language commands are routed to the correct provider or integration.
- **Chained commands:** Users can enter multi-step instructions in one message (e.g., "Summarize this PDF and translate to Spanish").
- **Workflow builder:** (In progress) Visual builder for multi-step, multi-provider workflows.
- **File upload:** Summarize or process uploaded files.
- **Session-based authentication:** Secure, per-user integration tokens.

---

## 5. Security & Best Practices

- TypeScript everywhere
- Tailwind CSS for utility-first, responsive design
- OAuth for secure integrations
- Environment variables for secrets/config
- API error handling and user feedback
- CORS restricted to local dev ports
- Per-user token storage in SQLite

---

## 6. Roadmap & Next Steps

- Visual workflow builder (drag-and-drop)
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

# MCP Hub

## Product Requirements Document (PRD)

**Core Features:**
- Multi-provider AI chat (OpenAI, Anthropic, Gemini) with per-user API keys.
- Command registry: supports chat, summarize, code search, repo summary, explain, translate, and more.
- Google Drive, Gmail, and GitHub integrations with OAuth and per-user credentials.
- Real-time provider connection status in UI.
- Command List modal for quick command discovery and insertion.
- Smart intent parsing: routes commands to the correct provider or integration.
- Chained command parsing: users can enter multi-step instructions in one message.
- Workflow builder (in progress): design and run multi-step, multi-provider workflows.
- File upload and summarization.
- Session-based authentication for integrations.
- Modern, responsive UI with dark/light mode.

**Advanced/Upcoming:**
- Visual workflow builder (drag-and-drop).
- More integrations (Notion, Slack, Jira, etc).
- Custom command macros and user-defined workflows.
- Scheduling and automation.
- Contextual memory and chaining across sessions.

---

## Features

- **Multi-provider AI chat:** OpenAI, Anthropic, Gemini (per-user API keys)
- **Command registry:** Chat, summarize, code search, repo summary, explain, translate, and more
- **Integrations:** Google Drive, Gmail, GitHub (OAuth, per-user credentials)
- **Command List modal:** Discover and insert commands quickly
- **Smart intent parsing:** Natural language commands routed to the right provider/integration
- **Chained commands:** Enter multi-step instructions in one message
- **Workflow builder:** (in progress) Visual multi-step, multi-provider workflows
- **File upload:** Summarize or process uploaded files
- **Session-based authentication:** Secure, per-user integration tokens
- **Modern UI:** Responsive, dark/light mode, real-time provider status

## Chained Commands & GUI

### Overview
Chained commands allow users to combine multiple actions in a single workflow, where the output of one command becomes the input for the next. This enables complex, multi-step tasks to be performed with a single prompt or through a visual builder.

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
- If a step fails, the user is notified with a clear error message.
- The user can view which step failed and retry or edit the chain.

### Chained Command GUI

**Key Features:**
- **Command Builder Modal/Panel:**
  - Users can visually add, remove, and reorder steps in a workflow.
  - Each step is represented as a card or block with editable parameters.
- **Inline Chaining in Chat:**
  - Users can type chained commands naturally; the system parses and displays the steps visually above the input.
  - Users can click to edit the chain in the builder modal.
- **Execution Feedback:**
  - Progress bar or step tracker shows which step is running, completed, or failed.
  - Users can expand/collapse to view intermediate results.

**User Flow:**
1. User types a chained command or opens the builder.
2. System parses and displays the steps.
3. User reviews/edits the steps.
4. User clicks "Run."
5. UI shows progress and results for each step.

---

**For questions, contributions, or commercial use, contact [automationalien.com](https://automationalien.com)** 