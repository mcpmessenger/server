# Slack Backend Integration - 2025-06-20

This document outlines the necessary backend changes and considerations for integrating Slack functionality into the MCPServer application. The integration will leverage Slack's Events API, primarily utilizing Socket Mode for real-time communication, and the Web API for sending messages and interacting with Slack.

## 1. Overview of Slack Integration Architecture

Integrating Slack with MCPServer involves establishing a secure and efficient communication channel between the two platforms. The core components of this integration will be:

*   **Slack App:** A custom Slack application configured within the Slack API dashboard to handle events, permissions, and authentication.
*   **MCPServer:** The backend application responsible for processing Slack events, executing MCP commands, and sending responses back to Slack.
*   **WebSocket Connection (Socket Mode):** For real-time, bidirectional communication, allowing MCPServer to receive events from Slack without exposing a public HTTP endpoint.
*   **Slack Web API:** For MCPServer to send messages, update content, and perform other actions within Slack workspaces.

## 2. Slack App Configuration

To begin, a new Slack application must be created and configured within the Slack API dashboard. This involves setting up basic information, features, and permissions.

### 2.1. Create a New Slack App

1.  Navigate to the [Slack API website](https://api.slack.com/apps) and click on "Create New App."
2.  Choose "From scratch" or "From an app manifest" (manifest is recommended for version control and easier configuration).
3.  Provide an "App Name" (e.g., "MCP Integrator") and select the "Development Workspace" where you will test the integration.

### 2.2. App Manifest (Recommended)

Using an app manifest (YAML or JSON) allows for declarative configuration of your Slack app. Here's a basic YAML manifest that includes essential features for MCPServer integration:

```yaml
_metadata:
  major_version: 1
display_information:
  name: MCP Integrator
  description: Integrates MCP commands and AI capabilities with Slack.
  background_color: "#4A154B"
features:
  bot_user:
    display_name: MCP Bot
    always_online: false
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: true
    allow_messages_from_anyone: true
  slash_commands: [] # Will be populated later
  interactivity:
    is_enabled: true
    request_url: "" # Not needed for Socket Mode
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - commands
      - channels:read
      - groups:read
      - im:read
      - mpim:read
      - users:read
      - users:read.email
settings:
  event_subscriptions:
    request_url: "" # Not needed for Socket Mode
    bot_events:
      - app_mention
      - message.channels
      - message.groups
      - message.im
      - message.mpim
  org_deploy_enabled: false
  socket_mode_enabled: true
  token_rotation_enabled: false
```

**Explanation of Key Manifest Fields:**

*   `display_information`: Basic information about your app.
*   `bot_user`: Enables a bot user for your app, allowing it to post messages and be mentioned.
*   `app_home`: Configures the App Home experience for users.
*   `slash_commands`: An array to define slash commands (e.g., `/mcp`). These will be added as needed.
*   `interactivity`: Enables interactive components (buttons, menus) and shortcuts. The `request_url` is left empty as Socket Mode will handle interactivity payloads.
*   `oauth_config.scopes.bot`: Defines the permissions (scopes) your bot user will request. Essential scopes for MCPServer include:
    *   `app_mentions:read`: To receive events when your bot is mentioned.
    *   `chat:write`: To send messages to channels and direct messages.
    *   `commands`: To receive slash command payloads.
    *   `channels:read`, `groups:read`, `im:read`, `mpim:read`: To read information about public channels, private channels, direct messages, and multi-person direct messages, respectively. This is useful for context when processing commands.
    *   `users:read`, `users:read.email`: To read user information, which can be helpful for personalization or user identification.
*   `settings.event_subscriptions`: Configures event subscriptions. The `request_url` is empty for Socket Mode. `bot_events` lists the events your bot will listen to:
    *   `app_mention`: When your bot is mentioned in a message.
    *   `message.channels`, `message.groups`, `message.im`, `message.mpim`: To receive messages in various conversation types. This is crucial for processing natural language commands.
*   `settings.socket_mode_enabled: true`: Crucially enables Socket Mode for your application.

### 2.3. Generate App-Level Token

After creating the app (or enabling Socket Mode), you will need to generate an **App-Level Token**. This token, prefixed with `xapp-`, is used by your MCPServer to establish a WebSocket connection with Slack. It's distinct from bot tokens (`xoxb-`) and user tokens (`xoxp-`).

1.  In your app's settings, navigate to "Basic Information."
2.  Scroll down to the "App-level tokens" section.
3.  Click "Generate Token and Scopes."
4.  Give the token a name (e.g., "MCP Server Socket Token") and assign it the `connections:write` scope.
5.  Copy the generated token. This token should be stored securely in MCPServer's environment variables or a secure configuration store.

## 3. MCPServer Backend Implementation

The MCPServer will need new modules and modifications to existing ones to handle Slack integration. This includes managing WebSocket connections, processing incoming events, and interacting with the Slack Web API.

### 3.1. Environment Variables

Add the following environment variables to your MCPServer configuration:

*   `SLACK_APP_TOKEN`: The `xapp-` token generated in the Slack App settings.
*   `SLACK_BOT_TOKEN`: The `xoxb-` token obtained after installing the Slack App to a workspace. This token is used for Web API calls.
*   `SLACK_SIGNING_SECRET`: Used to verify the authenticity of incoming requests from Slack (for HTTP endpoints, though less critical for Socket Mode, it's good practice to have).

### 3.2. Slack Client Initialization

MCPServer should initialize a Slack client that can handle both Socket Mode connections and Web API calls. Using the `@slack/bolt` (Node.js) or `slack_sdk` (Python) libraries is highly recommended as they abstract away much of the complexity.

**Example (Node.js with `@slack/bolt`):**

```javascript
const { App, ExpressReceiver } = require('@slack/bolt');

// Initialize with Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN, // Bot Token (xoxb-)
  appToken: process.env.SLACK_APP_TOKEN, // App-Level Token (xapp-)
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // Enable Socket Mode
  // For HTTP mode (if Socket Mode is not used, or for fallback):
  // receiver: new ExpressReceiver({
  //   signingSecret: process.env.SLACK_SIGNING_SECRET,
  //   processBeforeResponse: true,
  // }),
});

// Start the app
(async () => {
  try {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Slack app is running in Socket Mode!');
  } catch (error) {
    console.error('Failed to start Slack app:', error);
  }
})();
```

### 3.3. Handling Slack Events (Socket Mode)

With Socket Mode enabled, MCPServer will receive event payloads over the WebSocket connection. You'll need to set up listeners for the events subscribed to in your Slack App manifest.

**Example (Node.js with `@slack/bolt`):**

```javascript
// Listen for app mentions
app.event('app_mention', async ({ event, say }) => {
  console.log('App mentioned:', event.text);
  // Process the mention, extract command, and respond
  const response = await processSlackCommand(event.text, event.user, event.channel);
  await say(response);
});

// Listen for all messages in channels, DMs, etc.
app.message(/.*/, async ({ message, say }) => {
  // Ignore messages from bots to prevent loops
  if (message.subtype === 'bot_message' || message.bot_id) {
    return;
  }
  console.log('Message received:', message.text);
  // Process the message as a natural language command
  const response = await processSlackCommand(message.text, message.user, message.channel);
  await say(response);
});

// Example function to process Slack commands (to be implemented in MCPServer's core logic)
async function processSlackCommand(text, userId, channelId) {
  // Here, integrate with MCPServer's existing command parsing and execution logic.
  // This function should:
  // 1. Parse the 'text' to identify MCP commands or natural language queries.
  // 2. Authenticate/authorize the user (userId) if necessary.
  // 3. Execute the corresponding MCP command or route to an AI provider.
  // 4. Format the result into a Slack-friendly message.

  // Placeholder response
  if (text.toLowerCase().includes('hello')) {
    return `Hello <@${userId}>! How can I assist you today?`;
  } else if (text.toLowerCase().includes('list repos')) {
    // Example: Call GitHub MCP
    // const githubResult = await mcp.executeCommand('github', 'list-repos', { user: userId });
    return `Executing 'list repos' command... (This would call your GitHub MCP)`;
  } else {
    return `I received your message: "${text}". I'm still learning, but I can process some MCP commands.`;
  }
}
```

### 3.4. Implementing Slash Commands

Slash commands provide a structured way for users to interact with your app. You'll need to define them in your Slack App settings and then handle their payloads in MCPServer.

1.  **Define Slash Commands in Slack App:**
    *   In your Slack App settings, go to "Slash Commands."
    *   Click "Create New Command."
    *   **Command:** `/mcp` (or any other desired command)
    *   **Request URL:** Leave empty if using Socket Mode. If using HTTP, this would be your public endpoint.
    *   **Short Description:** "Execute MCP commands"
    *   **Usage Hint:** `[command] [arguments]`
2.  **Handle Slash Command Payloads in MCPServer:**

    **Example (Node.js with `@slack/bolt`):**

    ```javascript
    app.command('/mcp', async ({ ack, body, say }) => {
      await ack(); // Acknowledge the command immediately
      console.log('Slash command received:', body.command, body.text);

      const commandText = body.text;
      const userId = body.user_id;
      const channelId = body.channel_id;

      // Process the command text and respond
      const response = await processSlackCommand(commandText, userId, channelId);
      await say(response);
    });
    ```

### 3.5. Interacting with Slack Web API

MCPServer will use the Slack Web API to send messages, update UI, and perform other actions. The `say` function provided by Bolt automatically uses the Web API to respond to events. For other proactive messages or complex interactions, you'll use the `client` object from the Bolt `App` instance.

**Example (Node.js with `@slack/bolt`):**

```javascript
// Sending a direct message to a user
async function sendDirectMessage(userId, message) {
  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: userId, // For DMs, channel is the user ID
      text: message,
    });
    console.log(`DM sent to ${userId}`);
  } catch (error) {
    console.error(`Error sending DM to ${userId}:`, error);
  }
}

// Updating an existing message (e.g., for progress updates)
async function updateMessage(channelId, ts, newMessage) {
  try {
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      ts: ts, // Timestamp of the message to update
      text: newMessage,
    });
    console.log(`Message updated in ${channelId}`);
  } catch (error) {
    console.error(`Error updating message in ${channelId}:`, error);
  }
}

// Sending a message with Block Kit (rich formatting)
async function sendRichMessage(channelId, blocks) {
  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
      blocks: blocks, // Array of Block Kit blocks
      text: 'Fallback text for notifications',
    });
    console.log(`Rich message sent to ${channelId}`);
  } catch (error) {
    console.error(`Error sending rich message to ${channelId}:`, error);
  }
}
```

### 3.6. Authentication and Authorization

MCPServer will need to manage authentication with Slack and potentially authorize Slack users against its own user base.

*   **OAuth 2.0 (for Workspace Installation):** When a user installs your Slack app to their workspace, Slack's OAuth flow will provide you with a `bot_token` (xoxb-) and potentially a `user_token` (xoxp-). The `bot_token` is essential for your MCPServer to make API calls on behalf of the installed app.
    *   **Implementation:** If you plan to distribute your app to multiple workspaces, you'll need to implement the OAuth flow. The Bolt framework provides built-in OAuth handlers.
    *   **Storage:** Store the `bot_token` securely in your SQLite database, associated with the workspace ID (`team_id`).
*   **User Identification:** When Slack sends an event, it includes `user_id` and `team_id`. MCPServer can use these to identify the Slack user and their workspace. If MCPServer has its own user management, you might link Slack `user_id`s to internal user accounts.

## 4. Integration with Existing MCP Logic

The `processSlackCommand` function (or similar logic) will be the bridge between Slack events and your existing MCP command processing. This function should:

1.  **Parse Input:** Extract the command and arguments from the Slack message text or slash command payload.
2.  **User Context:** Pass the Slack `user_id` and `channel_id` to your MCP execution logic. This allows MCP commands to be context-aware (e.g., listing GitHub repos for the specific Slack user).
3.  **Execute MCP Command:** Call your internal MCP command execution engine, routing to the appropriate provider (GitHub, Google Drive, AI models, etc.).
4.  **Format Response:** Convert the result from the MCP command into a Slack-friendly format using Block Kit for rich messages where appropriate.
5.  **Error Handling:** Implement robust error handling to catch failures during MCP execution and provide informative feedback to the Slack user.

## 5. Deployment Considerations

*   **Hosting:** MCPServer can be hosted anywhere that supports Node.js (or your chosen backend language). Since Socket Mode doesn't require a public HTTP endpoint for events, deployment behind a firewall is feasible.
*   **Scalability:** Consider how MCPServer will scale to handle multiple WebSocket connections and concurrent Slack events.
*   **Logging and Monitoring:** Implement comprehensive logging for Slack events and MCPServer's responses to aid in debugging and monitoring.

This backend documentation provides a comprehensive guide for integrating Slack into your MCPServer. The next step will be to detail the frontend changes required in MCPHub.

