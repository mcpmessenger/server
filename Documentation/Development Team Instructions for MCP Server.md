# Development Team Instructions for MCP Server

## To the Backend Development Team (MCP Server)

This document outlines key technical details, architectural considerations, and development guidelines for the MCP Server, primarily based on the `mcpserver` GitHub repository and its interaction with the Make MCP Server. The goal is to ensure a clear understanding of the existing system and facilitate future development.

### 1. Overview of MCP Server

The MCP Server acts as the central hub for the Model Context Protocol, enabling API-driven AI and automation command execution. It orchestrates workflows across various applications and integrates with services like GitHub and Google. It is built on Node.js with Express and uses ES modules.

### 2. Core Technologies and Dependencies

*   **Runtime:** Node.js (ensure compatibility with specified versions, e.g., v16+).
*   **Framework:** Express.js for API handling.
*   **AI Providers Integration:** OpenAI, Anthropic, Google Generative AI (Gemini). All LLM requests are proxied through the backend for security and key validation.
*   **External Integrations:** Google (OAuth 2.0) and GitHub (token-based authentication).
*   **Session Management:** `express-session` for handling user sessions.
*   **Database:** SQLite for storing per-user integration tokens. Consider scalability and migration strategies for production environments.
*   **Security:**
    *   **CORS:** Configured via `CORS_ORIGINS` environment variable. Ensure this is properly set for all allowed frontend origins.
    *   **Encryption:** AES-256-GCM for sensitive data like tokens and PATs using `encryptValue` and `decryptValue` functions. Verify the strength and rotation of `ENCRYPTION_KEY`.
    *   `dotenv` for environment variable management.
    *   `multer` for handling file uploads securely.

### 3. API Endpoints and Functionality

Familiarize yourselves with the existing API endpoints and their responsibilities:

*   `/api/chat`: Handles AI chat interactions, routing commands to the appropriate LLM provider.
*   `/api/workflow`: Manages multi-step workflow execution and error handling.
*   `/api/github`: Provides an interface for GitHub-related operations (e.g., `list-repos`, `get-issues`, `create-issue`). This is now a native MCP micro-service within the backend (`backend/providers/github.js`).
*   `/api/google`: Handles Google integrations (Drive, Gmail, Calendar) via OAuth.
*   `/api/health`: A real-time health check endpoint for monitoring server status.

**Key Functionalities to Maintain and Enhance:**

*   **Modular Provider/Command Registry:** The system is designed for extensibility. When adding new AI providers or integrations, ensure they adhere to the `{ id, supportedCommands, executeCommand }` interface in `backend/providers/*.js`.
*   **Smart Intent Parsing:** The backend is responsible for intelligently routing natural language commands to the correct provider or integration. This logic is critical for the system's core functionality.
*   **Chained Command Parsing:** The ability to process multi-step instructions in a single message is a core feature. Ensure robustness and error handling for complex chains.
*   **File Upload and Summarization:** Maintain and improve the secure handling and processing of uploaded files.
*   **Central Token Manager:** The auto-refresh mechanism for Google tokens is vital for continuous integration. Ensure its reliability and consider extending it to other integrations if applicable.

### 4. Development Environment Setup

To set up your local development environment:

1.  **Clone the repository:** `git clone https://github.com/sentilabs01/mcpserver.git`
2.  **Install dependencies:** Navigate to the project root and run `pnpm install` (or `npm install`).
3.  **Configure Environment Variables:** Create a `.env` file in the project root with the following (or similar) variables:
    ```
    ENCRYPTION_KEY=super-long-random-secret-for-aes-256-gcm
    CORS_ORIGINS=http://localhost:5173,http://localhost:3000
    GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
    ```
    *   **`ENCRYPTION_KEY`**: This is crucial for encrypting sensitive user data. Generate a strong, random key and keep it secure.
    *   **`CORS_ORIGINS`**: List all allowed origins for your frontend applications. For local development, include `http://localhost:5173` (for `mcphub` frontend) and any other ports your frontend might use.
    *   **Google API Credentials**: Obtain `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the Google Cloud Console. Enable Drive, Gmail, and Calendar APIs for your project.
4.  **Google OAuth Callback:** For local Google testing, add `http://localhost:3001/auth/google/callback` to the authorized redirect URIs in your Google OAuth client configuration.
5.  **Run the Backend:** From the project root, execute `node backend/index.js`.

### 5. Integration with Make MCP Server

The MCP Server can integrate with Make scenarios. While the `mcpserver` repository primarily focuses on the backend logic, understanding the Make MCP Server's role is crucial:

*   **Scenario Exposure:** Make MCP Server lists your Make scenarios scheduled to run "On Demand" as callable tools for AI. This means your backend might need to interact with Make's API to trigger these scenarios or receive data from them.
*   **Inputs and Outputs:** Make scenarios can be configured with specific inputs (parameters for AI) and outputs (data returned to AI). Ensure your backend is designed to handle these data flows when interacting with Make.
*   **Types of Make MCP Servers:** Be aware of the two types: Make Cloud MCP Server (recommended, SSE-based) and Make Local MCP Server (legacy, for local control). Your backend should be flexible enough to interact with either, though the Cloud version is the primary focus for production.

### 6. Security Best Practices and Considerations

*   **API Key Security:** API keys are never sent directly from the frontend to LLM providers; all requests are proxied through the backend. This is a critical security measure that must be maintained.
*   **Environment Variables:** All secrets and sensitive configurations (e.g., API keys, encryption keys) must be stored as environment variables and never hardcoded.
*   **CORS Restrictions:** Strictly adhere to CORS restrictions to prevent unauthorized access from untrusted origins.
*   **Per-User Token Storage:** Integration tokens are stored in SQLite. Implement robust security measures around this database, including encryption at rest and secure access controls.
*   **OAuth Flows:** Continuously review and harden OAuth flows for Google and other integrations to prevent vulnerabilities.
*   **Input Validation:** Implement comprehensive input validation on all API endpoints to prevent injection attacks and other forms of malicious input.
*   **Error Handling:** Implement detailed but secure error handling to avoid leaking sensitive information in error messages.

### 7. Future Development and Roadmap

Based on the `mcpserver` repository's roadmap, consider these areas for future development:

*   **Workflow Builder:** Explore integrating or building a visual workflow builder to allow users to design multi-step, multi-provider workflows more intuitively.
*   **New Integrations:** Plan for adding more integrations (e.g., Notion, Slack, Jira) by extending the modular provider system.
*   **Custom Command Macros:** Implement functionality for users to define custom command macros and workflows.
*   **Scheduling and Automation:** Develop features for scheduling commands and automating tasks.
*   **Contextual Memory:** Enhance the system with contextual memory and the ability to chain commands across sessions.
*   **Testing:** Prioritize adding comprehensive unit and integration tests to ensure code quality, stability, and prevent regressions.
*   **Containerization:** Consider containerizing the MCP Server (e.g., using Docker) for easier deployment and scalability.


