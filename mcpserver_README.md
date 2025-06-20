# GitHub - sentilabs01/mcpserver

# Slash / MCP Server – Technical Product Requirements Document (PRD)

*   AES-256-GCM encryption for stored tokens & PATs (`encryptValue` / `decryptValue`).
*   Central token manager: auto-refresh for Gmail, Drive, Calendar.
*   Expanded Google OAuth scopes: `drive.file`, `gmail.readonly`, `gmail.send`, `calendar`.
*   CORS allow-list driven by `CORS_ORIGINS` env var.
*   Health & status endpoints (`/health`, `/api/google/status`, `/api/github/status`).
*   Provider list trimmed to core AI + GitHub in settings.

*   Settings modal now shows **only** OpenAI, Anthropic, Gemini, and GitHub.
*   SmartChat starts minimized by default; header toggle restores it.
*   Google Calendar card removed (shares OAuth behind the scenes).

1.  After pulling:
    
    pnpm install # or npm i
    npm run dev  # front-end
    node backend/index.js # backend
    
2.  Set environment:
    
    ENCRYPTION\_KEY\=super-long-random-secret
    CORS\_ORIGINS\=http://localhost:5173
    GOOGLE\_CLIENT\_ID\=...
    GOOGLE\_CLIENT\_SECRET\=...
    
3.  If testing Google locally, add `http://localhost:3001/auth/google/callback` to OAuth client redirect URIs and enable Drive, Gmail, Calendar APIs.

* * *

## Quick Command Cheat-Sheet

Natural-language phrases that MCP's Smart Chat can understand today. Use the words **then**, **and**, **and then**, a period, or a semicolon to chain steps—the parser will split them automatically.

*   "Summarize this article"
*   "Translate the above summary to French"
*   "Explain this code snippet"
*   "Generate a unit test for this function"
*   "List my last 5 GitHub repos"
*   "Get README.md from sentilabs01/alexa"
*   "Send email to [john@example.com]() — Subject: Hello — Body: Here's the weekly report"
*   "List Google Drive files in folder Docs"

### Multi-step / Chained Examples

*   "List my last 2 GitHub repos then summarize the most active one"
*   "Get README of sentilabs01/alexa; summarize it; generate an issue titled 'Documentation improvements' in the same repo"
*   "Fetch today's Gmail inbox, summarize messages, and translate the summary to Spanish"
*   "List files in Google Drive folder Docs and summarize each one"
*   "Extract text from the attached image then run sentiment analysis"
*   "Summarize this PDF and email the summary to my team"
*   "Translate the attached CSV to Japanese and upload it back to Google Drive"
*   "List AI-enabled Zaps and trigger Zap 12345"
*   "Run code search for 'useEffect cleanup' in sentilabs01/alexa then summarize the findings"

These are simply **suggestions**—the intent parser is purposefully lenient, so feel free to phrase commands naturally. If a step maps to an integration (GitHub, Gmail, Google Drive, Zapier, etc.) MCP routes it automatically; otherwise it treats it as an AI prompt.

* * *

A unified backend service for the Model Context Protocol (MCP), enabling API-driven, multi-provider AI and automation command execution, workflow chaining, and seamless integration with services like GitHub and Google. MCP Server acts as the core engine for orchestrating commands and workflows across apps and protocols.

* * *

**Backend:**

*   Node.js (Express, ES modules)
*   AI Providers: OpenAI, Anthropic, Google Generative AI (Gemini)
*   Integrations: Google (OAuth), GitHub (token-based)
*   Session management: express-session
*   Database: SQLite (per-user integration tokens)
*   Security: CORS, dotenv, multer

**Frontend (Admin/Optional):**

*   React 18 (TypeScript), Vite, Tailwind CSS (dark mode)
*   Custom UI components, lucide-react icons
*   State management with custom React hooks

* * *

**API/Backend**

*   API endpoints: `/api/chat`, `/api/workflow`, `/api/github`, `/api/google`, `/api/health`
*   Modular provider/command registry for extensibility
*   Multi-step workflow execution and error handling
*   File upload and summarization
*   Smart intent parsing: routes commands to the correct provider or integration
*   Chained command parsing: users/apps can enter multi-step instructions in one message
*   Session management and per-user integration tokens
*   Secure OAuth flows for Google
*   Token-based authentication for GitHub
*   Real-time health check endpoint for server status

**(Optional) Admin Frontend**

*   Settings modal for API key entry, provider connection, command reference
*   Request history and command palette
*   Provider status indicators (connected/disconnected, last used, request count)
*   Modern, responsive UI with dark/light mode

* * *

*   **Multi-provider AI chat:** Apps or users can send chat, summarize, or code commands to OpenAI, Anthropic, or Gemini using their own API keys.
*   **Command registry:** Supports chat, summarize, code search, repo summary, explain, translate, and more.
*   **Integrations:** Google Drive, Gmail, and GitHub via OAuth or token-based credentials.
*   **Smart intent parsing:** Natural language commands are routed to the correct provider or integration.
*   **Chained commands:** Apps or users can enter multi-step instructions in one message (e.g., "Summarize this PDF and translate to Spanish").
*   **Workflow builder:** (Optional) Visual builder for multi-step, multi-provider workflows.
*   **File upload:** Summarize or process uploaded files.
*   **Session-based authentication:** Secure, per-user integration tokens.

* * *

## 5\. Security & Best Practices

*   TypeScript everywhere
*   Tailwind CSS for utility-first, responsive design (frontend)
*   OAuth for secure integrations
*   Environment variables for secrets/config
*   API error handling and user feedback
*   CORS restricted to local dev ports
*   Per-user token storage in SQLite

* * *

*   Visual workflow builder (drag-and-drop, optional)
*   More integrations (Notion, Slack, Jira, etc.)
*   Custom command macros and user-defined workflows
*   Scheduling and automation
*   Contextual memory and chaining across sessions
*   Harden OAuth flows, encrypt API keys, audit CORS
*   Add unit and integration tests

* * *

*   "Summarize this PDF and then translate it to Spanish."
*   "Fetch the latest GitHub issues, summarize them, and email the summary to my team."
*   "Extract text from an image, then run sentiment analysis."

* * *

## Product Requirements Document (PRD)

**Core Features:**

*   API-driven, multi-provider AI chat (OpenAI, Anthropic, Gemini) with per-user API keys.
*   Command registry: supports chat, summarize, code search, repo summary, explain, translate, and more.
*   Google Drive, Gmail, and GitHub integrations with OAuth or token-based credentials.
*   Real-time provider connection status via API.
*   Smart intent parsing: routes commands to the correct provider or integration.
*   Chained command parsing: apps or users can enter multi-step instructions in one message.
*   Workflow builder (optional): design and run multi-step, multi-provider workflows.
*   File upload and summarization.
*   Session-based authentication for integrations.
*   Modern, responsive (optional) UI for admin/configuration.

**Advanced/Upcoming:**

*   Visual workflow builder (drag-and-drop, optional).
*   More integrations (Notion, Slack, Jira, etc).
*   Custom command macros and user-defined workflows.
*   Scheduling and automation.
*   Contextual memory and chaining across sessions.

* * *

*   **API-driven multi-provider AI chat:** OpenAI, Anthropic, Gemini (per-user API keys)
*   **Command registry:** Chat, summarize, code search, repo summary, explain, translate, and more
*   **Integrations:** Google Drive, Gmail, GitHub (OAuth or token-based credentials)
*   **Smart intent parsing:** Natural language commands routed to the right provider/integration
*   **Chained commands:** Enter multi-step instructions in one message
*   **Workflow builder:** (optional) Visual multi-step, multi-provider workflows
*   **File upload:** Summarize or process uploaded files
*   **Session-based authentication:** Secure, per-user integration tokens
*   **Modern UI (optional):** Responsive design, dark/light mode, settings modal for API key entry and provider connection, request history, command palette, provider status indicators.

## Setup & Development

### Prerequisites

*   Node.js (v18 or higher)
*   npm (v8 or higher) or pnpm
*   Supabase account and project

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/sentilabs01/mcpserver.git
    cd mcpserver
    ```

2.  Install dependencies:

    ```bash
    pnpm install # or npm install
    ```

3.  Environment Variables:

    Create a `.env` file in the root directory and add the following:

    ```
    ENCRYPTION_KEY=your_super_long_random_secret_key
    CORS_ORIGINS=http://localhost:5173,http://localhost:3000
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    ```

    *   `ENCRYPTION_KEY`: Used for encrypting sensitive data like API tokens.
    *   `CORS_ORIGINS`: Comma-separated list of allowed origins for CORS. Include your frontend URL.
    *   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Obtain these from the Google Cloud Console for OAuth.

4.  Supabase Setup:

    Ensure your Supabase project is configured with the necessary tables, especially `mcp_servers` and `user_credentials`. Refer to the `mcphub` repository's `supabase/schema.sql` for the schema.

5.  Running the Server:

    ```bash
    npm run dev # or node backend/index.js
    ```

    The server will typically run on `http://localhost:3001`.

### Project Structure

*   `backend/`: Core server logic, API endpoints, and provider integrations.
*   `integrations/`: Contains specific integration logic for various services (e.g., Google, GitHub).
*   `src/`: (Optional) Frontend admin UI for server configuration and monitoring.

### Key Files

*   `backend/index.js`: Main server entry point.
*   `backend/routes/`: Defines API routes.
*   `backend/providers/`: Contains logic for different MCP providers (e.g., `github.js`, `google.js`).
*   `integrations/google.js`: Google API integration logic.
*   `integrations/github.js`: GitHub API integration logic.

### Adding New Integrations

1.  Create a new file in `integrations/` for the new service.
2.  Implement the necessary API calls and data handling.
3.  Integrate the new service into the `backend/providers/` or `backend/routes/` as appropriate.

### Testing

*   Unit tests are located in the `test/` directory.
*   Run tests using `npm test`.

## License

This project is licensed under the MIT License.


