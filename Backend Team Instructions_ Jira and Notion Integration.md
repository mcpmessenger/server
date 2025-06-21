# Backend Team Instructions: Jira and Notion Integration

This document outlines the responsibilities and implementation steps for the `mcpserver` (backend) team regarding the integration of Jira and Notion into the MCP Messenger app. The core principle is to act as the central hub for all API interactions and token management, adhering to an MCP-first ethos and ensuring persistent token storage.

## 1. Overview of Backend Responsibilities

The backend's primary role is to:

*   **Manage OAuth Flows:** Handle the server-side components of Jira and Notion OAuth 2.0 (3LO) flows, including exchanging authorization codes for access and refresh tokens.
*   **Secure Token Storage:** Encrypt and persistently store Jira and Notion access and refresh tokens.
*   **Implement Token Refresh:** Automatically refresh expired access tokens using stored refresh tokens.
*   **Proxy API Requests:** Act as a secure proxy for all Jira and Notion API requests originating from the `mcphub` (frontend).
*   **Integrate with MCP:** Ensure that Jira and Notion functionalities are exposed through the MCP, allowing for intelligent command parsing and workflow chaining.

## 2. Key Changes and Areas of Focus

### 2.1. OAuth 2.0 (3LO) Implementation

#### Jira (Atlassian OAuth 2.0 (3LO))

1.  **Configuration:**
    *   Obtain `client_id` and `client_secret` from the Atlassian Developer Console for your Jira application. Store these securely (e.g., in environment variables).
    *   Define a `redirect_uri` that points to an endpoint on your `mcpserver` (e.g., `/api/auth/jira/callback`). This `redirect_uri` must be registered in the Atlassian Developer Console.
2.  **Authorization URL Generation Endpoint:** Create an endpoint (e.g., `GET /api/auth/jira/url`) that the frontend can call to get the Atlassian authorization URL. This endpoint will construct the URL with the necessary `client_id`, `scope`, `redirect_uri`, and a dynamically generated `state` parameter.
    *   **Example Scopes:** `read:jira-user`, `read:jira-work`, `write:jira-work`, `offline_access` (for refresh tokens).
3.  **Callback Endpoint:** Implement an endpoint (e.g., `GET /api/auth/jira/callback`) that receives the `code` and `state` from Atlassian after user authorization.
    *   **State Validation:** Crucially, validate the `state` parameter against the one generated in step 2 to prevent CSRF attacks.
    *   **Token Exchange:** Make a `POST` request to `https://auth.atlassian.com/oauth/token` to exchange the `code` for `access_token` and `refresh_token`. Include `client_id`, `client_secret`, `code`, and `redirect_uri` in the request body.
    *   **Secure Storage:** Upon successful token exchange, securely store the `access_token`, `refresh_token`, `expires_in`, and `scope` associated with the user in your database. Ensure encryption for these sensitive credentials.

#### Notion (OAuth)

1.  **Configuration:**
    *   Obtain `client_id` and `client_secret` from your Notion integration settings. Store these securely.
    *   Define a `redirect_uri` that points to an endpoint on your `mcpserver` (e.g., `/api/auth/notion/callback`). This `redirect_uri` must be registered in your Notion integration settings.
2.  **Authorization URL Generation Endpoint:** Create an endpoint (e.g., `GET /api/auth/notion/url`) that the frontend can call to get the Notion authorization URL. This endpoint will construct the URL with the necessary `client_id`, `redirect_uri`, and `state`.
3.  **Callback Endpoint:** Implement an endpoint (e.g., `GET /api/auth/notion/callback`) that receives the `code` and `state` from Notion after user authorization.
    *   **State Validation:** Validate the `state` parameter.
    *   **Token Exchange:** Make a `POST` request to `https://api.notion.com/v1/oauth/token` to exchange the `code` for `access_token`.
    *   **Secure Storage:** Securely store the `access_token` associated with the user in your database, ensuring encryption.

### 2.2. Persistent Token Management

*   **Database Schema:** Update your database schema to include tables/fields for storing Jira and Notion tokens, linked to user accounts. Fields should include `access_token`, `refresh_token` (for Jira), `expires_at`, `scope`, and `user_id`.
*   **Encryption:** Implement strong encryption (e.g., AES-256-GCM) for all stored tokens. The encryption key should be managed securely (e.g., via environment variables or a key management service).
*   **Token Refresh Logic (Jira):**
    *   Implement a mechanism (e.g., a scheduled job or a check before each API call) to detect expired Jira `access_token`s.
    *   When an `access_token` is expired or nearing expiration, use the `refresh_token` to make a `POST` request to `https://auth.atlassian.com/oauth/token` with `grant_type: "refresh_token"`, `client_id`, `client_secret`, and `refresh_token`.
    *   Update the stored `access_token` and `expires_in` with the new values.
*   **Token Provisioning Endpoints:** Create internal endpoints that the `mcphub` can call to obtain a valid, current `access_token` for a given user and integration (Jira or Notion). These endpoints should handle token refresh transparently before returning the token.

### 2.3. API Proxy and MCP Integration

*   **Jira API Proxy Endpoints:** Create endpoints on `mcpserver` (e.g., `POST /api/jira/proxy`) that accept requests from `mcphub` and forward them to the appropriate Jira REST API endpoints.
    *   **Authentication:** Attach the user's valid Jira `access_token` (retrieved from secure storage, potentially refreshed) to the `Authorization: Bearer` header of the proxied request.
    *   **Error Handling:** Translate Jira API errors into a consistent format for the frontend.
*   **Notion API Proxy Endpoints:** Similarly, create endpoints (e.g., `POST /api/notion/proxy`) to proxy requests to the Notion API.
    *   **Authentication:** Attach the user's valid Notion `access_token` to the `Authorization: Bearer` header.
*   **MCP Command Mapping:** Define how specific user commands (e.g., "create Jira issue," "list Notion pages") map to the underlying Jira and Notion API calls. This is where the MCP-first ethos comes into play.
    *   Implement logic to parse MCP commands received from `mcphub`.
    *   Call the appropriate internal proxy functions with the necessary parameters.
    *   Format the results into an MCP-compatible response.

## 3. Implementation Steps (High-Level)

1.  **Update Dependencies:** Ensure all necessary libraries for OAuth, HTTP requests, and encryption are available.
2.  **Database Schema Update:** Modify the database to store Jira and Notion tokens securely.
3.  **Implement OAuth Endpoints:** Develop the authorization URL generation and callback endpoints for both Jira and Notion.
4.  **Develop Token Management Logic:** Implement token storage, encryption, and refresh mechanisms.
5.  **Create API Proxy Endpoints:** Build the proxy endpoints for Jira and Notion API calls.
6.  **Integrate with MCP Core:** Map MCP commands to the new Jira and Notion functionalities.
7.  **Testing:** Thoroughly test the entire authentication and API interaction flow, including token expiry and refresh scenarios.

This robust backend implementation will provide the foundation for a secure, persistent, and MCP-aligned integration of Jira and Notion into the MCP Messenger app.

