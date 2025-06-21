# MCP Protocol Specification

**Developed by [automationalien.com](https://automationalien.com)**

---

## 1. Overview

The MCP Protocol defines a unified, extensible interface for interacting with multiple AI providers and data integrations (e.g., OpenAI, Anthropic, Gemini, Google Drive, Gmail, GitHub) via a single API and workflow system.

---

## 2. Endpoints

### **/api/command**
- **POST**: Execute a single command on a provider.
- **Request:**
  ```json
  {
    "prompt": "string",
    "provider": "openai|anthropic|gemini|github|...",
    "command": "chat|summarize|generate-code|explain|translate|...",
    "apiKey": "string (optional)",
    "context": "string (optional)"
  }
  ```
- **Response:**
  ```json
  {
    "output": "string",
    "tokens_used": "number|null",
    "model_version": "string",
    "provider": "string",
    "command": "string",
    "raw_response": "object"
  }
  ```

### **/api/workflow**
- **POST**: Execute a multi-step workflow (chained commands).
- **Request:**
  ```json
  {
    "workflow": [
      { "provider": "openai", "command": "summarize", "prompt": "...", "apiKey": "..." },
      { "provider": "github", "command": "get-file", "prompt": "", "apiKey": "..." }
    ],
    "context": "string (optional)"
  }
  ```
- **Response:**
  ```json
  {
    "results": [
      { "output": "string", "provider": "string", "command": "string", ... },
      ...
    ]
  }
  ```

### **/api/{integration}**
- **GET/POST**: Integration-specific endpoints (e.g., `/api/google/drive-files`, `/api/github/repos`).

---

## 3. Context Handling
- Context (history, document, or workflow output) can be passed as a string in requests.
- Each step in a workflow can use the previous step's output as its prompt if its own prompt is blank.
- Context can be pinned, reused, or referenced in new workflows.

---

## 4. Workflow Chaining
- Workflows are arrays of steps, each with its own provider, command, prompt, and (optionally) API key.
- The output of each step is available as input for the next step.

---

## 5. Provider Plug-in Interface

Each provider implements the following interface:

```js
class ProviderPlugin {
  constructor(options) { /* ... */ }
  id = 'openai'; // unique string
  name = 'OpenAI';
  supportedCommands = ['chat', 'summarize', 'generate-code', ...];

  async executeCommand({ prompt, command, context, apiKey }) {
    // ...provider-specific logic...
    return { output, tokens_used, model_version, provider: this.id, command, raw_response };
  }

  // Optional: for integrations
  async listResources(params) { /* ... */ }
}
```

---

## 6. Command Registry

Commands are registered with metadata and supported providers:

```js
const commands = [
  { id: 'chat', name: 'Chat', description: 'Conversational AI', providers: ['openai', 'anthropic', 'gemini'] },
  { id: 'summarize', name: 'Summarize', description: 'Summarize text', providers: ['openai', 'anthropic', 'gemini'] },
  { id: 'get-file', name: 'Get File', description: 'Fetch file from repo', providers: ['github'] },
  // ...
];
```

---

## 7. Example: GitHub as a Core Provider

- **OAuth endpoints:** `/auth/github`, `/auth/github/callback`
- **API endpoints:** `/api/github/repos`, `/api/github/files`
- **Provider logic:**
  - `executeCommand` for code search, repo summary, file content, etc.
  - `listResources` for browsing repos/files

**Example Provider:**
```js
class GitHubProvider extends ProviderPlugin {
  id = 'github';
  name = 'GitHub';
  supportedCommands = ['get-file', 'repo-summary', 'code-search'];

  async executeCommand({ prompt, command, apiKey }) {
    // Use Octokit or fetch to call GitHub API
    // e.g., fetch file content, search code, summarize repo
    // Return output and metadata
  }

  async listResources({ apiKey }) {
    // List user repos, files, etc.
  }
}
```

---

## 8. Extending MCP
- To add a new provider, implement the ProviderPlugin interface and register it.
- To add a new command, add it to the command registry and implement logic in relevant providers.
- To add a new integration, add OAuth endpoints and resource APIs as needed.

---

**For questions, contributions, or commercial use, contact [automationalien.com](https://automationalien.com)** 