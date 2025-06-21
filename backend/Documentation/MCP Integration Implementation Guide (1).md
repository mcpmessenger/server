# MCP Integration Implementation Guide

## Backend Server Implementation

This section provides detailed implementation instructions for creating MCP providers for Slack, Jira, and Notion within the existing `mcpserver` backend infrastructure.

### Slack Provider Implementation

Create a new file `backend/providers/slack.js` in your mcpserver repository:

```javascript
const { WebClient } = require('@slack/web-api');

class SlackProvider {
  constructor() {
    this.id = 'slack';
    this.supportedCommands = [
      'send-message',
      'list-channels',
      'get-user-info',
      'create-channel',
      'invite-user',
      'get-channel-history'
    ];
  }

  async executeCommand(command, params, userToken) {
    const slack = new WebClient(userToken);
    
    try {
      switch (command) {
        case 'send-message':
          return await this.sendMessage(slack, params);
        case 'list-channels':
          return await this.listChannels(slack, params);
        case 'get-user-info':
          return await this.getUserInfo(slack, params);
        case 'create-channel':
          return await this.createChannel(slack, params);
        case 'invite-user':
          return await this.inviteUser(slack, params);
        case 'get-channel-history':
          return await this.getChannelHistory(slack, params);
        default:
          throw new Error(`Unsupported command: ${command}`);
      }
    } catch (error) {
      console.error('Slack API Error:', error);
      throw new Error(`Slack operation failed: ${error.message}`);
    }
  }

  async sendMessage(slack, { channel, text, blocks }) {
    const result = await slack.chat.postMessage({
      channel,
      text,
      blocks
    });
    
    return {
      success: true,
      message: 'Message sent successfully',
      data: {
        timestamp: result.ts,
        channel: result.channel
      }
    };
  }

  async listChannels(slack, { types = 'public_channel,private_channel' }) {
    const result = await slack.conversations.list({
      types,
      exclude_archived: true
    });
    
    return {
      success: true,
      data: result.channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        member_count: channel.num_members
      }))
    };
  }

  async getUserInfo(slack, { user }) {
    const result = await slack.users.info({ user });
    
    return {
      success: true,
      data: {
        id: result.user.id,
        name: result.user.name,
        real_name: result.user.real_name,
        email: result.user.profile.email,
        status: result.user.profile.status_text
      }
    };
  }

  async createChannel(slack, { name, is_private = false }) {
    const result = await slack.conversations.create({
      name,
      is_private
    });
    
    return {
      success: true,
      message: 'Channel created successfully',
      data: {
        id: result.channel.id,
        name: result.channel.name
      }
    };
  }

  async inviteUser(slack, { channel, users }) {
    const result = await slack.conversations.invite({
      channel,
      users: Array.isArray(users) ? users.join(',') : users
    });
    
    return {
      success: true,
      message: 'User(s) invited successfully',
      data: result.channel
    };
  }

  async getChannelHistory(slack, { channel, limit = 10 }) {
    const result = await slack.conversations.history({
      channel,
      limit
    });
    
    return {
      success: true,
      data: result.messages.map(msg => ({
        user: msg.user,
        text: msg.text,
        timestamp: msg.ts,
        type: msg.type
      }))
    };
  }
}

module.exports = new SlackProvider();
```

### Jira Provider Implementation

Create a new file `backend/providers/jira.js`:

```javascript
const axios = require('axios');

class JiraProvider {
  constructor() {
    this.id = 'jira';
    this.supportedCommands = [
      'create-issue',
      'get-issue',
      'update-issue',
      'list-projects',
      'search-issues',
      'add-comment',
      'get-user',
      'assign-issue'
    ];
  }

  async executeCommand(command, params, credentials) {
    const { host, email, apiToken } = credentials;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    
    const apiClient = axios.create({
      baseURL: `https://${host}/rest/api/3`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    try {
      switch (command) {
        case 'create-issue':
          return await this.createIssue(apiClient, params);
        case 'get-issue':
          return await this.getIssue(apiClient, params);
        case 'update-issue':
          return await this.updateIssue(apiClient, params);
        case 'list-projects':
          return await this.listProjects(apiClient, params);
        case 'search-issues':
          return await this.searchIssues(apiClient, params);
        case 'add-comment':
          return await this.addComment(apiClient, params);
        case 'get-user':
          return await this.getUser(apiClient, params);
        case 'assign-issue':
          return await this.assignIssue(apiClient, params);
        default:
          throw new Error(`Unsupported command: ${command}`);
      }
    } catch (error) {
      console.error('Jira API Error:', error.response?.data || error.message);
      throw new Error(`Jira operation failed: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    }
  }

  async createIssue(apiClient, { projectKey, summary, description, issueType = 'Task', priority = 'Medium' }) {
    const issueData = {
      fields: {
        project: { key: projectKey },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: description
            }]
          }]
        },
        issuetype: { name: issueType },
        priority: { name: priority }
      }
    };

    const response = await apiClient.post('/issue', issueData);
    
    return {
      success: true,
      message: 'Issue created successfully',
      data: {
        id: response.data.id,
        key: response.data.key,
        url: `https://${apiClient.defaults.baseURL.split('/rest')[0]}/browse/${response.data.key}`
      }
    };
  }

  async getIssue(apiClient, { issueKey, expand = 'names,schema,operations,editmeta,changelog,renderedFields' }) {
    const response = await apiClient.get(`/issue/${issueKey}?expand=${expand}`);
    const issue = response.data;
    
    return {
      success: true,
      data: {
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.renderedFields?.description || issue.fields.description,
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        reporter: issue.fields.reporter?.displayName,
        priority: issue.fields.priority?.name,
        created: issue.fields.created,
        updated: issue.fields.updated
      }
    };
  }

  async updateIssue(apiClient, { issueKey, fields }) {
    const updateData = { fields };
    await apiClient.put(`/issue/${issueKey}`, updateData);
    
    return {
      success: true,
      message: 'Issue updated successfully'
    };
  }

  async listProjects(apiClient, { expand = 'description,lead,url' }) {
    const response = await apiClient.get(`/project?expand=${expand}`);
    
    return {
      success: true,
      data: response.data.map(project => ({
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description,
        lead: project.lead?.displayName,
        projectTypeKey: project.projectTypeKey
      }))
    };
  }

  async searchIssues(apiClient, { jql, maxResults = 50, startAt = 0 }) {
    const response = await apiClient.post('/search', {
      jql,
      maxResults,
      startAt,
      fields: ['summary', 'status', 'assignee', 'created', 'priority']
    });
    
    return {
      success: true,
      data: {
        total: response.data.total,
        issues: response.data.issues.map(issue => ({
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          assignee: issue.fields.assignee?.displayName || 'Unassigned',
          created: issue.fields.created,
          priority: issue.fields.priority?.name
        }))
      }
    };
  }

  async addComment(apiClient, { issueKey, comment }) {
    const commentData = {
      body: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: comment
          }]
        }]
      }
    };

    const response = await apiClient.post(`/issue/${issueKey}/comment`, commentData);
    
    return {
      success: true,
      message: 'Comment added successfully',
      data: {
        id: response.data.id,
        created: response.data.created
      }
    };
  }

  async getUser(apiClient, { accountId }) {
    const response = await apiClient.get(`/user?accountId=${accountId}`);
    
    return {
      success: true,
      data: {
        accountId: response.data.accountId,
        displayName: response.data.displayName,
        emailAddress: response.data.emailAddress,
        active: response.data.active
      }
    };
  }

  async assignIssue(apiClient, { issueKey, accountId }) {
    await apiClient.put(`/issue/${issueKey}/assignee`, {
      accountId
    });
    
    return {
      success: true,
      message: 'Issue assigned successfully'
    };
  }
}

module.exports = new JiraProvider();
```

### Notion Provider Implementation

Create a new file `backend/providers/notion.js`:

```javascript
const { Client } = require('@notionhq/client');

class NotionProvider {
  constructor() {
    this.id = 'notion';
    this.supportedCommands = [
      'create-page',
      'get-page',
      'update-page',
      'query-database',
      'create-database-item',
      'update-database-item',
      'search',
      'get-block-children',
      'append-block-children'
    ];
  }

  async executeCommand(command, params, apiKey) {
    const notion = new Client({ auth: apiKey });

    try {
      switch (command) {
        case 'create-page':
          return await this.createPage(notion, params);
        case 'get-page':
          return await this.getPage(notion, params);
        case 'update-page':
          return await this.updatePage(notion, params);
        case 'query-database':
          return await this.queryDatabase(notion, params);
        case 'create-database-item':
          return await this.createDatabaseItem(notion, params);
        case 'update-database-item':
          return await this.updateDatabaseItem(notion, params);
        case 'search':
          return await this.search(notion, params);
        case 'get-block-children':
          return await this.getBlockChildren(notion, params);
        case 'append-block-children':
          return await this.appendBlockChildren(notion, params);
        default:
          throw new Error(`Unsupported command: ${command}`);
      }
    } catch (error) {
      console.error('Notion API Error:', error);
      throw new Error(`Notion operation failed: ${error.message}`);
    }
  }

  async createPage(notion, { parent, properties, children = [] }) {
    const response = await notion.pages.create({
      parent,
      properties,
      children
    });
    
    return {
      success: true,
      message: 'Page created successfully',
      data: {
        id: response.id,
        url: response.url,
        created_time: response.created_time
      }
    };
  }

  async getPage(notion, { pageId }) {
    const response = await notion.pages.retrieve({ page_id: pageId });
    
    return {
      success: true,
      data: {
        id: response.id,
        url: response.url,
        title: this.extractTitle(response.properties),
        created_time: response.created_time,
        last_edited_time: response.last_edited_time,
        properties: response.properties
      }
    };
  }

  async updatePage(notion, { pageId, properties }) {
    const response = await notion.pages.update({
      page_id: pageId,
      properties
    });
    
    return {
      success: true,
      message: 'Page updated successfully',
      data: {
        id: response.id,
        last_edited_time: response.last_edited_time
      }
    };
  }

  async queryDatabase(notion, { databaseId, filter, sorts, startCursor, pageSize = 100 }) {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts,
      start_cursor: startCursor,
      page_size: pageSize
    });
    
    return {
      success: true,
      data: {
        results: response.results.map(page => ({
          id: page.id,
          url: page.url,
          title: this.extractTitle(page.properties),
          properties: page.properties,
          created_time: page.created_time,
          last_edited_time: page.last_edited_time
        })),
        has_more: response.has_more,
        next_cursor: response.next_cursor
      }
    };
  }

  async createDatabaseItem(notion, { databaseId, properties, children = [] }) {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
      children
    });
    
    return {
      success: true,
      message: 'Database item created successfully',
      data: {
        id: response.id,
        url: response.url
      }
    };
  }

  async updateDatabaseItem(notion, { pageId, properties }) {
    const response = await notion.pages.update({
      page_id: pageId,
      properties
    });
    
    return {
      success: true,
      message: 'Database item updated successfully',
      data: {
        id: response.id,
        last_edited_time: response.last_edited_time
      }
    };
  }

  async search(notion, { query, filter, sort, startCursor, pageSize = 100 }) {
    const response = await notion.search({
      query,
      filter,
      sort,
      start_cursor: startCursor,
      page_size: pageSize
    });
    
    return {
      success: true,
      data: {
        results: response.results.map(item => ({
          id: item.id,
          object: item.object,
          url: item.url,
          title: item.object === 'page' ? this.extractTitle(item.properties) : item.title?.[0]?.plain_text,
          created_time: item.created_time,
          last_edited_time: item.last_edited_time
        })),
        has_more: response.has_more,
        next_cursor: response.next_cursor
      }
    };
  }

  async getBlockChildren(notion, { blockId, startCursor, pageSize = 100 }) {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: startCursor,
      page_size: pageSize
    });
    
    return {
      success: true,
      data: {
        results: response.results,
        has_more: response.has_more,
        next_cursor: response.next_cursor
      }
    };
  }

  async appendBlockChildren(notion, { blockId, children }) {
    const response = await notion.blocks.children.append({
      block_id: blockId,
      children
    });
    
    return {
      success: true,
      message: 'Blocks appended successfully',
      data: response.results
    };
  }

  extractTitle(properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value.type === 'title' && value.title.length > 0) {
        return value.title[0].plain_text;
      }
    }
    return 'Untitled';
  }
}

module.exports = new NotionProvider();
```

### Integration with MCP Server

Update your main server file (typically `backend/index.js`) to include the new providers:

```javascript
// Add to your existing imports
import slackProvider from './providers/slack.js';
import jiraProvider from './providers/jira.js';
import notionProvider from './providers/notion.js';

// Add to your provider registry
const providers = {
  github: require('./providers/github'), // existing
  slack: slackProvider,
  jira: jiraProvider,
  notion: notionProvider
};

// Update your command execution endpoint
app.post('/api/execute-command', async (req, res) => {
  try {
    const { provider, command, params, credentials } = req.body;
    
    if (!providers[provider]) {
      return res.status(400).json({ error: 'Unknown provider' });
    }
    
    const result = await providers[provider].executeCommand(command, params, credentials);
    res.json(result);
  } catch (error) {
    console.error('Command execution error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# Slack Configuration
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret

# Jira Configuration (optional, can be user-provided)
JIRA_DEFAULT_HOST=your-company.atlassian.net

# Notion Configuration (optional, can be user-provided)
NOTION_CLIENT_ID=your_notion_client_id
NOTION_CLIENT_SECRET=your_notion_client_secret
```

### Package Dependencies

Install the required packages:

```bash
npm install @slack/web-api @notionhq/client axios
```

### Authentication Endpoints

Add OAuth endpoints for Slack and Notion:

```javascript
// Slack OAuth
app.get('/auth/slack', (req, res) => {
  const scopes = 'channels:read,chat:write,users:read,channels:manage';
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(req.protocol + '://' + req.get('host') + '/auth/slack/callback')}`;
  res.redirect(slackAuthUrl);
});

app.get('/auth/slack/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const response = await axios.post('https://slack.com/api/oauth.v2.access', {
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: req.protocol + '://' + req.get('host') + '/auth/slack/callback'
    });
    
    // Store the access token securely
    // Implementation depends on your user management system
    
    res.redirect('/dashboard?slack=connected');
  } catch (error) {
    console.error('Slack OAuth error:', error);
    res.redirect('/dashboard?error=slack_auth_failed');
  }
});

// Notion OAuth
app.get('/auth/notion', (req, res) => {
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(req.protocol + '://' + req.get('host') + '/auth/notion/callback')}`;
  res.redirect(notionAuthUrl);
});

app.get('/auth/notion/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const response = await axios.post('https://api.notion.com/v1/oauth/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: req.protocol + '://' + req.get('host') + '/auth/notion/callback'
    }, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Store the access token securely
    // Implementation depends on your user management system
    
    res.redirect('/dashboard?notion=connected');
  } catch (error) {
    console.error('Notion OAuth error:', error);
    res.redirect('/dashboard?error=notion_auth_failed');
  }
});
```

This implementation provides a solid foundation for integrating Slack, Jira, and Notion into your MCP server. Each provider follows the established pattern and can be easily extended with additional commands as needed.

