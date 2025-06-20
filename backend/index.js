import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import session from 'express-session';
import { google } from 'googleapis';
import { Octokit } from '@octokit/rest';
import multer from 'multer';
import fs from 'fs';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { jwtDecode } from "jwt-decode";
import { parseIntent } from './parser.js';
import crypto from 'crypto';
import { getCredentials as daoGetCredentials, saveCredentials as daoSaveCredentials, deleteCredentials as daoDeleteCredentials } from './services/credentialDao.js';
import slackProvider from './providers/slack.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    const allowList = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim());
    if (!origin || allowList.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'mcp-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax', // 'lax' is best for local dev, 'none' for HTTPS
    secure: false,   // true if using HTTPS
  }
}));

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3001/auth/google/callback'
);
// Expanded scopes so a single OAuth consent covers Gmail (read/send), Drive, and Calendar
const GOOGLE_SCOPES = [
  // Drive (read/write - limits to files created or opened by this app)
  'https://www.googleapis.com/auth/drive.file',
  // Gmail read & send
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  // Calendar read/write
  'https://www.googleapis.com/auth/calendar',
  // Basic profile info
  'profile',
  'email'
];

// --- GitHub OAuth ---
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK = 'http://localhost:3001/auth/github/callback';

// --- MCP Protocol Implementation ---

// Command Registry - MCP compliant
const MCP_COMMANDS = [
  { id: 'chat', name: 'Chat', description: 'Conversational AI', providers: ['openai', 'anthropic', 'gemini'] },
  { id: 'summarize', name: 'Summarize', description: 'Summarize text or documents', providers: ['openai', 'anthropic', 'gemini'] },
  { id: 'generate-code', name: 'Generate Code', description: 'Generate code snippets', providers: ['openai', 'anthropic', 'gemini'] },
  { id: 'explain', name: 'Explain', description: 'Explain concepts or code', providers: ['openai', 'anthropic', 'gemini'] },
  { id: 'translate', name: 'Translate', description: 'Translate text to different languages', providers: ['openai', 'anthropic', 'gemini'] },
  { id: 'list-repos', name: 'List Repositories', description: 'List GitHub repositories', providers: ['github'] },
  { id: 'get-file', name: 'Get File', description: 'Fetch file content from repository', providers: ['github'] },
  { id: 'repo-summary', name: 'Repository Summary', description: 'Summarize repository structure and content', providers: ['github'] },
  { id: 'code-search', name: 'Code Search', description: 'Search code in repositories', providers: ['github'] },
  { id: 'generate-issue', name: 'Generate Issue', description: 'Create GitHub issue', providers: ['github'] },
  { id: 'generate-pr', name: 'Generate PR', description: 'Create GitHub pull request', providers: ['github'] },
  { id: 'list-messages', name: 'List Gmail messages', description: 'List recent Gmail messages', providers: ['gmail'] },
  { id: 'get-message',   name: 'Get Gmail message',    description: 'Fetch Gmail message by ID', providers: ['gmail'] },
  { id: 'send-email',    name: 'Send Email',            description: 'Send an email via Gmail',  providers: ['gmail'] },
  { id: 'list-files',    name: 'List Drive Files',      description: 'List Google Drive files', providers: ['google_drive'] },
  { id: 'search-files',  name: 'Search Drive Files',    description: 'Search Google Drive files', providers: ['google_drive'] },
  { id: 'download-file', name: 'Download Drive File',   description: 'Download file content from Drive', providers: ['google_drive'] },
  { id: 'upload-file',   name: 'Upload Drive File',     description: 'Upload a new file to Drive', providers: ['google_drive'] },
  { id: 'list-events', name: 'List Calendar Events', description: 'List today\'s Google Calendar events', providers: ['google_calendar'] },
  { id: 'generate-ui-component', name: 'Generate UI Component', description: 'Generate front-end UI component code', providers: ['21st_dev'] },
  { id: 'create-project', name: 'Create Project', description: 'Create a Supabase project via Loveable', providers: ['loveable'] },
  { id: 'manage-database', name: 'Manage Database', description: 'Run database operations', providers: ['loveable'] },
  { id: 'deploy', name: 'Deploy', description: 'Deploy project via Loveable', providers: ['loveable'] },
  { id: 'web-search', name: 'Web Search', description: 'Perform a web search via Bolt', providers: ['bolt'] },
  { id: 'figma-action', name: 'Figma Action', description: 'Interact with Figma via Bolt', providers: ['bolt'] },
  { id: 'custom-tool', name: 'Custom Tool', description: 'Run a custom Bolt tool', providers: ['bolt'] },
  { id: 'send-message', name: 'Slack Send message', description: 'Send Slack message', providers: ['slack'] },
  { id: 'list-channels', name: 'Slack List channels', description: 'List Slack channels', providers: ['slack'] },
  { id: 'get-channel-history', name: 'Slack Get messages', description: 'Channel history', providers: ['slack'] },
  { id: 'list-projects', name: 'Jira List projects', description: 'List Jira projects', providers: ['jira'] },
  { id: 'create-issue', name: 'Jira Create issue', description: 'Create Jira issue', providers: ['jira'] },
  { id: 'list-databases', name: 'Notion List DBs', description: 'List Notion databases', providers: ['notion'] },
  { id: 'query-database', name: 'Notion Query DB', description: 'Query Notion database', providers: ['notion'] },
];

// After the MCP_COMMANDS array is declared, insert the server version constant
const MCP_SERVER_VERSION = '2024-07-01';

// Maximum number of recent chat turns we keep when forwarding to LLMs
const HISTORY_LIMIT = 6;

// MCP Provider Plugin Interface
class ProviderPlugin {
  constructor(options = {}) {
    this.options = options;
  }
  
  id = 'base';
  name = 'Base Provider';
  supportedCommands = [];

  async executeCommand({ prompt, command, context, apiKey }) {
    throw new Error('executeCommand must be implemented by provider');
  }

  async listResources(params) {
    throw new Error('listResources not implemented');
  }
}

// GitHub Provider Plugin - MCP compliant
class GitHubProviderPlugin extends ProviderPlugin {
  id = 'github';
  name = 'GitHub';
  supportedCommands = ['list-repos', 'get-file', 'repo-summary', 'code-search', 'generate-issue', 'generate-pr'];

  async executeCommand({ prompt, command, context, apiKey }) {
    if (!apiKey) {
      throw new Error('GitHub API key (Personal Access Token) is required.');
    }
    const octokit = new Octokit({ auth: apiKey });

    // Normalize command: lower-case and replace spaces with dashes
    const cmd = (command || '')
      .toLowerCase()
      .replace(/[\s_]+/g, '-'); // convert spaces or underscores to dashes

    switch (cmd) {
      case 'list-repos': {
        const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 100 });
        const repoNames = data.map(repo => repo.full_name).join('\n');
        return { 
          output: `Your repositories:\n${repoNames}`, 
          tokens_used: null,
          model_version: 'github-api-v3',
          provider: this.id,
          command,
          raw_response: data
        };
      }
      case 'get-file': {
        // Parse prompt for owner/repo/path
        const match = prompt.match(/([^\/]+)\/([^\/]+)\/(.+)/);
        if (!match) {
          throw new Error('Format: owner/repo/path/to/file');
        }
        const [, owner, repo, path] = match;
        const { data } = await octokit.repos.getContent({ owner, repo, path });
        const content = Buffer.from(data.content, 'base64').toString();
        return {
          output: content,
          tokens_used: null,
          model_version: 'github-api-v3',
          provider: this.id,
          command,
          raw_response: data
        };
      }
      case 'repo-summary': {
        // Extract first owner/repo pattern from prompt
        const matchRepo = prompt.match(/([\w.-]+\/[\w.-]+)/);
        if (!matchRepo) throw new Error('Prompt must contain owner/repo');
        const [owner, repo] = matchRepo[1].split('/');
        if (!owner || !repo) throw new Error('Format repo as owner/repo');
        const { data: contents } = await octokit.repos.getContent({ owner, repo, path: '' });
        // List first 100 top-level files/dirs
        const listing = (Array.isArray(contents) ? contents : []).slice(0, 100).map(f => `${f.type}: ${f.name}`).join('\n');
        const summary = `Top-level contents of ${owner}/${repo}:\n${listing}`;
        return {
          output: summary,
          tokens_used: null,
          model_version: 'github-api-v3',
          provider: this.id,
          command,
          raw_response: contents
        };
      }
      case 'code-search': {
        // Expect prompt like "searchTerm in owner/repo"
        const match = prompt.match(/^(.*?)\s+in\s+([\w.-]+\/[\w.-]+)/i);
        if (!match) throw new Error('Format: <searchTerm> in owner/repo');
        const [, query, repoRef] = match;
        const [owner, repo] = repoRef.split('/');
        const { data } = await octokit.search.code({ q: `${query} repo:${owner}/${repo}`, per_page: 10 });
        const results = data.items.map(i => `${i.path} (${i.html_url})`).join('\n');
        return {
          output: results || 'No matches found.',
          tokens_used: null,
          model_version: 'github-api-v3',
          provider: this.id,
          command,
          raw_response: data
        };
      }
      case 'generate-issue': {
        // Expect prompt format: owner/repo | title | body (body optional)
        const parts = prompt.replace(/^\s*\/github\s+generate-issue/i,'').split('|').map(p=>p.trim()).filter(Boolean);
        if (parts.length < 2) {
          // try plain language: "create issue in owner/repo: title - body"
          let plainMatch = prompt.match(/issue\s+(?:in|on)\s+([\w.-]+\/[\w.-]+)\s*[:\-]\s*(.+)/i);
          if (!plainMatch) {
            // try without explicit : or - delimiter
            plainMatch = prompt.match(/issue\s+(?:in|on)\s+([\w.-]+\/[\w.-]+)\s+(.+)/i);
          }
          if (!plainMatch) throw new Error('Format: owner/repo | title | [body]');
          const titleBody = plainMatch[2].trim();
          const split = titleBody.split(/[-–—]/);
          const title = split[0].trim();
          const bodyRest = split.slice(1).join('-').trim();
          parts.length = 0;
          parts.push(plainMatch[1].trim(), title, bodyRest);
        }
        const [repoRef, issueTitle, issueBody] = parts;
        const matchRepo = repoRef.match(/([\w.-]+)\/([\w.-]+)/);
        if (!matchRepo) throw new Error('First segment must be owner/repo');
        const owner = matchRepo[1];
        const repo  = matchRepo[2];
        if (!owner || !repo) throw new Error('Repo must be owner/repo');
        const { data } = await octokit.issues.create({ owner, repo, title: issueTitle, body: issueBody || '' });
        return {
          output: `✅ Issue created: ${data.html_url}`,
          provider: this.id,
          command,
          raw_response: data
        };
      }
      case 'generate-pr': {
        // Expect prompt: owner/repo | headBranch | baseBranch | title | body(optional)
        const parts = prompt.replace(/^\s*\/github\s+generate-pr/i,'').split('|').map(p=>p.trim()).filter(Boolean);
        if (parts.length < 4) {
          const plain = prompt.match(/pr\s+from\s+(\S+)\s+into\s+(\S+)\s+on\s+([\w.-]+\/[\w.-]+)\s*[:\-]?\s*(.+)/i);
          if (!plain) throw new Error('Format: owner/repo | head | base | title | [body]');
          // plain[4] contains title+optional body separated by dash
          const tb = plain[4].trim();
          const s = tb.split(/[-–—]/);
          const tTitle = s[0].trim();
          const tBody = s.slice(1).join('-').trim();
          parts.length=0;
          parts.push(plain[3], plain[1], plain[2], tTitle, tBody);
        }
        const [repoRef, head, base, prTitle, prBody] = parts;
        const [owner, repo] = repoRef.split('/');
        if (!owner || !repo) throw new Error('Repo must be owner/repo');
        const { data } = await octokit.pulls.create({ owner, repo, head, base, title: prTitle, body: prBody || '' });
        return {
          output: `✅ Pull request created: ${data.html_url}`,
          provider: this.id,
          command,
          raw_response: data
        };
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async listResources({ apiKey }) {
    if (!apiKey) {
      throw new Error('GitHub API key required');
    }
    const octokit = new Octokit({ auth: apiKey });
    const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 100 });
    return data.map(repo => ({
      id: repo.id,
      name: repo.full_name,
      type: 'repository',
      url: repo.html_url,
      description: repo.description
    }));
  }
}

// Gmail Provider Plugin - MCP compliant
class GmailProviderPlugin extends ProviderPlugin {
  id = 'gmail';
  name = 'Gmail';
  supportedCommands = ['list-messages', 'get-message', 'send-email'];

  // helper to build Gmail client from OAuth bearer token
  buildGmailClient(accessToken) {
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth: authClient });
  }

  async executeCommand({ prompt, command, apiKey /* here apiKey carries accessToken */ }) {
    if (!apiKey) {
      throw new Error('Google OAuth access token required.');
    }
    const gmail = this.buildGmailClient(apiKey);

    // Accept both "get-message" and "get-message <id>" (with id appended)
    const parts = (command || '').trim().split(/\s+/);
    const cmdBase = parts[0].toLowerCase().replace(/[\s_]+/g, '-');
    const argString = parts.slice(1).join(' '); // rest of command after first token

    const cmd = cmdBase;

    switch (cmd) {
      case 'list-messages': {
        // First fetch message IDs (minimal)
        const listRes = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
        const msgs = listRes.data.messages || [];
        // Fetch metadata headers for each message in parallel (but capped)
        const detailed = await Promise.all(msgs.slice(0, 20).map(async (m) => {
          try {
            const meta = await gmail.users.messages.get({
              userId: 'me',
              id: m.id,
              format: 'metadata',
              metadataHeaders: ['Subject', 'From', 'Date']
            });
            const headers = (meta.data.payload?.headers || []).reduce((acc, h) => { acc[h.name.toLowerCase()] = h.value; return acc; }, {});
            return {
              id: meta.data.id,
              threadId: meta.data.threadId,
              subject: headers['subject'] || '',
              from: headers['from'] || '',
              date: headers['date'] || '',
              snippet: meta.data.snippet || ''
            };
          } catch {
            return { id: m.id };
          }
        }));
        return { output: detailed, provider: this.id, command: cmd, raw_response: detailed };
      }
      case 'get-message': {
        const messageId = argString;
        if (!messageId) throw new Error('Prompt must contain Gmail message ID');
        const { data } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
        const headers = (data.payload?.headers || []).reduce((acc, h) => { acc[h.name.toLowerCase()] = h.value; return acc; }, {});
        const simplified = {
          id: data.id,
          threadId: data.threadId,
          subject: headers['subject'] || '',
          from: headers['from'] || '',
          date: headers['date'] || '',
          snippet: data.snippet || '',
          body: ((data.payload?.parts || []).find(p=>p.mimeType==='text/plain')?.body?.data) || ''
        };
        return { output: simplified, provider: this.id, command: cmd, raw_response: data };
      }
      case 'send-email': {
        // Expect prompt as JSON: { to, subject, body }
        let payload;
        try { payload = JSON.parse(prompt); }
        catch { throw new Error('Prompt must be JSON with to, subject, body'); }
        const { to, subject, body } = payload;
        if (!to || !subject || !body) throw new Error('to, subject, body required');
        const emailLines = [
          `To: ${to}`,
          'Content-Type: text/plain; charset="UTF-8"',
          `Subject: ${subject}`,
          '',
          body
        ];
        const encodedMessage = Buffer.from(emailLines.join('\n'))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
        return { output: 'Email sent.', provider: this.id, command: cmd, raw_response: data };
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}

// Initialize provider plugins
const githubProviderPlugin = new GitHubProviderPlugin();
const gmailProviderPlugin = new GmailProviderPlugin();

// MCP Endpoints

// Get available commands - MCP compliant
app.get('/api/commands', (req, res) => {
  res.json(MCP_COMMANDS);
});

// Get provider information - MCP extension
app.get('/api/providers', (req, res) => {
  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      supportedCommands: ['chat', 'summarize', 'generate-code', 'explain', 'translate'],
      requiresApiKey: true
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      supportedCommands: ['chat', 'summarize', 'generate-code', 'explain', 'translate'],
      requiresApiKey: true
    },
    {
      id: 'gemini',
      name: 'Gemini',
      supportedCommands: ['chat', 'summarize', 'generate-code', 'explain', 'translate'],
      requiresApiKey: true
    },
    {
      id: cursorProvider.id,
      name: cursorProvider.name,
      supportedCommands: cursorProvider.supportedCommands,
      requiresApiKey: true
    },
    {
      id: twentyFirstDevProvider.id,
      name: twentyFirstDevProvider.name,
      supportedCommands: twentyFirstDevProvider.supportedCommands,
      requiresApiKey: true
    },
    {
      id: loveableProvider.id,
      name: loveableProvider.name,
      supportedCommands: loveableProvider.supportedCommands,
      requiresApiKey: true
    },
    {
      id: boltProvider.id,
      name: boltProvider.name,
      supportedCommands: boltProvider.supportedCommands,
      requiresApiKey: true
    },
    {
      id: githubProviderPlugin.id,
      name: githubProviderPlugin.name,
      supportedCommands: githubProviderPlugin.supportedCommands,
      requiresApiKey: true
    },
    {
      id: gmailProviderPlugin.id,
      name: gmailProviderPlugin.name,
      supportedCommands: gmailProviderPlugin.supportedCommands,
      requiresApiKey: true
    }
  ];
  res.json(providers);
});

// Get resources for a provider - MCP extension
app.get('/api/providers/:providerId/resources', async (req, res) => {
  const { providerId } = req.params;
  const { apiKey } = req.query;
  
  try {
    if (providerId === 'github') {
      const resources = await githubProviderPlugin.listResources({ apiKey });
      res.json({ resources });
    } else if (providerId === 'gmail') {
      const resources = await gmailProviderPlugin.listResources({ apiKey });
      res.json({ resources });
    } else if (providerId === 'cursor') {
      const resources = await cursorProvider.listResources({ apiKey });
      res.json({ resources });
    } else if (providerId === '21st_dev') {
      const resources = await twentyFirstDevProvider.listResources({ apiKey });
      res.json({ resources });
    } else if (providerId === 'loveable') {
      const resources = await loveableProvider.listResources({ apiKey });
      res.json({ resources });
    } else if (providerId === 'bolt') {
      const resources = await boltProvider.listResources({ apiKey });
      res.json({ resources });
    } else {
      res.status(400).json({ error: 'Provider does not support resource listing' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MCP compatibility - commands endpoint already defined above

app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.googleTokens = tokens;
    // Persist refresh_token using Credential DAO
    if (tokens.refresh_token) {
      await daoSaveCredentials('google', { refreshToken: encryptValue(tokens.refresh_token) });
    }
    res.send('Google authentication successful! You can close this window.');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).send('Google authentication failed. Please try again.');
  }
});

async function ensureGoogleTokens(req) {
  const now = Date.now();
  // 1. If we already have valid session tokens not expiring soon, reuse
  if (req.session.googleTokens && (req.session.googleTokens.expiry_date ?? 0) - now > 120_000) {
    return req.session.googleTokens;
  }

  // 2. Determine refresh token: preference session value, else DAO, else legacy DB
  let refreshToken = req.session.googleTokens?.refresh_token;
  if (!refreshToken) {
    const creds = await daoGetCredentials('google');
    if (creds?.refreshToken) {
      refreshToken = decryptValue(creds.refreshToken);
    } else {
      try {
        const user = await getOrCreateUser();
        if (user.googleRefreshToken) {
          refreshToken = decryptValue(user.googleRefreshToken);
          // migrate to DAO for future usage
          await daoSaveCredentials('google', { refreshToken: encryptValue(refreshToken) });
        }
      } catch { /* ignore */ }
    }
  }
  if (!refreshToken) return null;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3001/auth/google/callback'
  );
  client.setCredentials({ refresh_token: refreshToken });
  try {
    const { credentials } = await client.refreshAccessToken();
    req.session.googleTokens = {
      refresh_token: refreshToken,
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date || (now + 3_300_000)
    };
    try {
      await daoSaveCredentials('google', {
        refreshToken: encryptValue(refreshToken),
        accessToken: encryptValue(credentials.access_token),
        expiresAt: credentials.expiry_date || (now + 3_300_000)
      });
    } catch {
      /* ignore persistence errors */
    }
    return req.session.googleTokens;
  } catch (err) {
    console.error('Google refresh failed:', err.message);
    return null;
  }
}

// --- Bearer token auth middleware for Google Drive commands ---
async function requireAuth(req, res, next) {
  // Only enforce auth for Google Drive/Calendar commands
  if (!['google_drive', 'google_calendar'].includes(req.body?.provider)) {
    return next();
  }

  // 1. Prefer explicit Bearer token
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    req.googleToken = auth.replace('Bearer ', '');
    return next();
  }

  // 2. Attempt to ensure/refresh session token via refresh_token
  await ensureGoogleTokens(req);
  if (req.session.googleTokens?.access_token) {
    req.googleToken = req.session.googleTokens.access_token;
    return next();
  }

  // No token available
  return res.status(401).json({ error: 'Missing Google OAuth token' });
}

app.post(['/api/command', '/command'], requireAuth, async (req, res) => {
  // Log only high-level details to avoid dumping full conversation to console
  let { prompt, provider, command, apiKey } = req.body;
  const cmdIdHeader = req.headers['x-mcp-command-id'];
  const cmdId = Array.isArray(cmdIdHeader) ? cmdIdHeader[0] : (cmdIdHeader || crypto.randomUUID());

  // initial progress event
  broadcastEvent('command-progress', {
    id: cmdId,
    provider,
    command,
    percent: 0,
    stage: 'start',
    message: 'queued'
  });

  // emit complete once response finishes
  res.once('finish', () => {
    const ok = res.statusCode < 400;
    broadcastEvent('command-complete', {
      id: cmdId,
      provider,
      command,
      success: ok,
      error: ok ? undefined : res.locals?.errorMessage
    });
  });

  // Fallback: if no apiKey field provided use Bearer token from Authorization header
  if (!apiKey && typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')) {
    apiKey = req.headers.authorization.replace('Bearer ', '').trim();
  }
  console.log('Received /api/command', { provider, command, promptLength: prompt?.length, hasApiKey: !!apiKey, msgCount: Array.isArray(req.body.messages) ? req.body.messages.length : 0 });
  let formattedPrompt = prompt;

  switch (command) {
    case 'summarize':
      formattedPrompt = `Summarize this:\n${prompt}`;
      break;
    case 'generate-code':
      formattedPrompt = `Write code for:\n${prompt}`;
      break;
    case 'explain':
      formattedPrompt = `Explain this:\n${prompt}`;
      break;
    case 'translate':
      formattedPrompt = `Translate this to English:\n${prompt}`;
      break;
    default:
      // 'chat' or unknown, use as-is
      break;
  }

  try {
    if (provider === 'openai') {
      console.log(`[MCP -> OpenAI] command=${command}`);
      const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(400).json({ error: 'No OpenAI API key provided.' });
      }
      const openai = new OpenAI({ apiKey: openaiApiKey });

      // --- TRIM THE MESSAGES ARRAY TO LAST 10 ---
      let messagesToSend = req.body.messages;
      if (!messagesToSend) {
        messagesToSend = [{ role: 'user', content: formattedPrompt }];
      }
      if (Array.isArray(messagesToSend) && messagesToSend.length > HISTORY_LIMIT) {
        messagesToSend = messagesToSend.slice(-HISTORY_LIMIT);
      }

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: messagesToSend,
          max_tokens: 1024,
        });
        return res.json({
          output: completion.choices[0].message.content,
          tokens_used: completion.usage.total_tokens,
          model_version: 'gpt-3.5-turbo',
          provider: 'openai',
          raw_response: completion,
        });
      } catch (err) {
        // Detect and surface rate-limit errors clearly so the UI can show an informative message
        const message = err?.message || 'Unknown OpenAI error';
        // OpenAI client exposes status via err.status, fall back to 429 keyword in message if absent
        const status = err?.status || (message.includes('rate') && 429);
        if (status === 429) {
          return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please wait a moment and try again.' });
        }
        // Otherwise bubble up generic error
        return res.status(400).json({ error: message });
      }
    } else if (provider === 'anthropic') {
      console.log(`[MCP -> Anthropic] command=${command}`);
      const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        return res.status(400).json({ error: 'No Anthropic API key provided.' });
      }
      // Limit messages to last 10
      let messages = Array.isArray(req.body.messages) ? req.body.messages.slice(-HISTORY_LIMIT) : [{ role: 'user', content: formattedPrompt }];
      // Format messages for Claude 3 API
      const claudeMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      const anthropicRes = await time('Anthropic API', () => fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 256,
          messages: claudeMessages
        })
      }));
      if (!anthropicRes.ok) {
        const err = await anthropicRes.text();
        return res.status(400).json({ error: 'Anthropic API error', details: err });
      }
      const data = await anthropicRes.json();
      // Claude 3: content is an array of {type, text}
      let reply = '';
      if (data.content && Array.isArray(data.content)) {
        reply = data.content.map(part => part.text).join(' ');
      }
      return res.json({
        output: reply || 'No response from Anthropic.',
        raw: data
      });
    } else if (provider === 'gemini' || provider === 'google') {
      console.log(`[MCP -> Gemini] command=${command}`);
      const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('No Gemini API key provided');
      }
      // --- TRIM THE MESSAGES ARRAY TO LAST 10 ---
      let messages = req.body.messages || [{ role: 'user', content: formattedPrompt }];
      if (Array.isArray(messages) && messages.length > HISTORY_LIMIT) {
        messages = messages.slice(-HISTORY_LIMIT);
      }
      const contents = Array.isArray(messages)
        ? messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
        : [{ role: 'user', parts: [{ text: messages[messages.length - 1]?.content || '' }] }];
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 256 }
          })
        }
      );
      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        throw new Error(`Gemini API error: ${err}`);
      }
      const data = await geminiRes.json();
      return res.json({
        output: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.',
        tokens_used: null,
        model_version: 'gemini-2.0-flash',
        provider: 'gemini',
        raw_response: data,
      });
    } else if (provider === 'google_drive') {
      // Refresh tokens if needed
      await ensureGoogleTokens(req);
      // We expect the OAuth bearer token to be provided in req.googleToken (set by requireAuth)
      const googleToken = req.googleToken;
      if (!googleToken) {
        return res.status(401).json({ error: 'Missing Google OAuth token' });
      }

      const authClient = new google.auth.OAuth2();
      authClient.setCredentials({ access_token: googleToken });

      const drive = google.drive({ version: 'v3', auth: authClient });

      try {
        if (command === 'list-files') {
          console.log('[MCP -> Google Drive] list-files');
          const { data } = await drive.files.list({ pageSize: 100, fields: 'files(id, name, mimeType)' });
          const files = (data.files || []).map(f => `${f.id} | ${f.name} (${f.mimeType})`).join('\n');
          return res.json({ output: files || 'No files found.', provider: 'google_drive', command, raw_response: data });
        } else if (command === 'search-files') {
          const query = prompt || '';
          console.log('[MCP -> Google Drive] search', query);
          const { data } = await drive.files.list({ q: `name contains '${query.replace(/'/g, "\\'")}'`, pageSize: 50, fields: 'files(id, name, mimeType)' });
          const out = (data.files || []).map(f => `${f.id} | ${f.name} (${f.mimeType})`).join('\n');
          return res.json({ output: out || 'No matches.', provider: 'google_drive', command, raw_response: data });
        } else if (command === 'download-file') {
          const fileId = prompt.trim();
          if (!fileId) throw new Error('Provide fileId in prompt');
          const resp = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(resp.data);
          const base64 = buffer.toString('base64');
          return res.json({ output: base64, provider: 'google_drive', command, raw_response: { fileId, size: buffer.length } });
        } else {
          return res.status(400).json({ error: `Unsupported Google Drive command: ${command}` });
        }
      } catch (err) {
        console.error('[MCP Server] Google Drive error:', err.message);
        return res.status(400).json({ error: err.message });
      }
    } else if (provider === 'google_calendar') {
      await ensureGoogleTokens(req);
      const googleToken = req.googleToken;
      if (!googleToken) {
        return res.status(401).json({ error: 'Missing Google OAuth token' });
      }
      const authClient = new google.auth.OAuth2();
      authClient.setCredentials({ access_token: googleToken });
      const calendar = google.calendar({ version: 'v3', auth: authClient });
      try {
        if (command === 'list-events' || /list.*events/i.test(command || formattedPrompt)) {
          const today = new Date();
          const isoDate = today.toISOString().split('T')[0];
          const timeMin = `${isoDate}T00:00:00Z`;
          const timeMax = `${isoDate}T23:59:59Z`;
          const { data } = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime'
          });
          const summary = (data.items || []).map(ev => {
            const start = ev.start?.dateTime || ev.start?.date;
            return `${start} | ${ev.summary}`;
          }).join('\n');
          return res.json({ output: summary || 'No events today.', provider: 'google_calendar', command: 'list-events', raw_response: data });
        }
        return res.status(400).json({ error: `Unsupported Google Calendar command: ${command}` });
      } catch (err) {
        console.error('[MCP Server] Google Calendar error:', err.message);
        return res.status(400).json({ error: err.message });
      }
    } else if (provider === 'github') {
      console.log(`[MCP -> GitHub] command=${command}`);
      try {
        // If no command specified (e.g. "Test token"), just validate the token
        if (!command || command === 'validate' || command === 'test-token') {
          if (!apiKey) throw new Error('GitHub API key (PAT) is required.');
          const octokit = new Octokit({ auth: apiKey });
          await octokit.request('GET /user');
          return res.json({ success: true, output: 'Token is valid', provider: 'github' });
        }
        // Fallback to stored encrypted PAT if apiKey omitted
        if (!apiKey) {
          const creds = await daoGetCredentials('github');
          apiKey = creds?.token ? decryptValue(creds.token) : '';
        }

        const result = await githubProviderPlugin.executeCommand({ command, prompt: formattedPrompt, apiKey });
        return res.json(result);
      } catch (err) {
        console.error('[MCP Server] GitHub error:', err.message);
        return res.status(400).json({ success: false, error: err.message });
      }
    } else if (provider === 'zapier') {
      console.log(`[MCP -> Zapier] command=${command}`);
      // Basic Zapier NLA support (https://nla.zapier.com/api/v1/)
      const zapierKey = apiKey || req.body?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '') : '');
      if (!zapierKey) {
        return res.status(401).json({ error: 'Missing Zapier API key' });
      }
      try {
        // Currently support a single command: list-zaps (lists available AI Zaps for the user)
        if (command === 'list-zaps' || /list zaps/i.test(command || formattedPrompt)) {
          const resp = await fetch('https://nla.zapier.com/api/v1/ai_zaps/', {
            headers: {
              Authorization: `Bearer ${zapierKey}`,
              Accept: 'application/json'
            }
          });

          const isJson = resp.headers.get('content-type')?.includes('application/json');
          const payload = isJson ? await resp.json().catch(async () => ({ text: await resp.text() })) : await resp.text();

          if (!resp.ok) {
            return res.status(resp.status).json({ error: payload });
          }

          return res.json({
            output: Array.isArray(payload) ? payload.map(z => `${z.id}: ${z.description || z.name}`).join('\n') : JSON.stringify(payload),
            provider: 'zapier',
            command: 'list-zaps',
            raw_response: payload
          });
        }
        // trigger zap <id>
        if (/^trigger zap/i.test(command || formattedPrompt)) {
          const match = (command || formattedPrompt).match(/trigger zap\s+(\S+)/i);
          const zapId = match?.[1];
          if (!zapId) {
            return res.status(400).json({ error: 'Missing Zap ID' });
          }
          const execResp = await fetch(`https://nla.zapier.com/api/v1/ai_zaps/${zapId}/execute/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${zapierKey}` }
          });

          // Zapier returns JSON on success but may return HTML for 404/403
          const isJson = execResp.headers.get('content-type')?.includes('application/json');
          const payload = isJson ? await execResp.json().catch(async () => ({ text: await execResp.text() })) : await execResp.text();

          if (!execResp.ok) {
            return res.status(execResp.status).json({ error: payload });
          }

          return res.status(execResp.status).json({
            output: (payload.results || payload).description || payload.results || payload,
            provider: 'zapier',
            command: `trigger-zap-${zapId}`,
            raw_response: payload
          });
        }
        // If command not recognized yet
        return res.status(400).json({ error: `Unsupported Zapier command: ${command}` });
      } catch (err) {
        console.error('[MCP Server] Zapier error:', err.message);
        return res.status(400).json({ error: err.message });
      }
    } else if (provider === 'make_mcp_run') {
      console.log('[MCP -> Make.com MCP run]');
      const { zone, token, scenarioId } = req.body;
      if (!zone || !token || !scenarioId) {
        return res.status(400).json({ error: 'Missing required fields: zone, token, scenarioId' });
      }
      try {
        const url = `https://${zone}/mcp/api/v1/u/${token}/execute/${scenarioId}`;
        const r = await fetch(url, { headers: { Accept: 'text/event-stream' }, method: 'POST' });
        return res.status(r.ok ? 202 : r.status).json({ ok: r.ok });
      } catch (err) {
        console.error('[MCP Server] Make.com execute error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
      }
    } else if (provider === 'makecom') {
      console.log(`[MCP -> Make.com] command=${command}`);
      const makeToken = apiKey || req.body?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '') : '');
      if (!makeToken) {
        return res.status(401).json({ error: 'Missing Make.com API token' });
      }
      const zone = req.body?.zone || 'eu1'; // default to EU zone
      const makeBase = `https://${zone}.make.com/api/v2`;
      try {
        // LIST SCENARIOS
        if (command === 'list-scenarios' || /list\s+scenarios/i.test(command || formattedPrompt)) {
          const resp = await fetch(`${makeBase}/scenarios`, {
            headers: { Authorization: makeToken, Accept: 'application/json' }
          });
          const payload = await resp.json();
          if (!resp.ok) {
            return res.status(resp.status).json({ error: payload });
          }
          const list = (payload.scenarios || []).map(s => `${s.id}: ${s.name} (active: ${s.isActive})`).join('\n');
          return res.json({ output: list || 'No scenarios found.', provider: 'makecom', command: 'list-scenarios', raw_response: payload });
        }
        // RUN SCENARIO <id>
        if (/run\s+scenario/i.test(command || formattedPrompt) || command === 'run') {
          const match = (command || formattedPrompt).match(/run\s+scenario\s+(\d+)/i);
          const scenarioId = match?.[1] || req.body?.scenarioId;
          if (!scenarioId) {
            return res.status(400).json({ error: 'Missing scenarioId' });
          }
          const endpoint = `${makeBase}/scenarios/${scenarioId}/run`;
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: makeToken,
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({ responsive: false })
          });
          const payload = await resp.json().catch(() => ({ text: 'Non-JSON response' }));
          if (!resp.ok) {
            return res.status(resp.status).json({ error: payload });
          }
          return res.json({ output: `Execution started (id: ${payload.executionId || 'n/a'})`, provider: 'makecom', command: `run-scenario-${scenarioId}`, raw_response: payload });
        }
        return res.status(400).json({ error: `Unsupported Make.com command: ${command}` });
      } catch (err) {
        console.error('[MCP Server] Make.com error:', err.message);
        return res.status(400).json({ error: err.message });
      }
    } else if (provider === 'make_mcp_test') {
      console.log(`[MCP -> Make.com MCP token test]`);
      const { zone, token } = req.body;
      if (!zone || !token) {
        return res.status(400).json({ error: 'Missing required fields: zone and token' });
      }
      try {
        const url = `https://${zone}/mcp/api/v1/u/${token}/sse`;
        const r = await fetch(url, { headers: { Accept: 'text/event-stream' } });
        return res.status(r.ok ? 200 : r.status).json({ ok: r.ok });
      } catch (err) {
        console.error('[MCP Server] Make.com test error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
      }
    } else if (provider === 'make_webhook') {
      // Trigger a classic Make.com webhook URL
      const { url } = req.body;
      if (!url || !/^https?:\/\/[^\s]*hook\./i.test(url)) {
        return res.status(400).json({ error: 'Valid Make webhook URL required' });
      }
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
        const text = await r.text();
        return res.status(r.status || 202).type('text').send(text || 'OK');
      } catch (err) {
        console.error('[MCP Server] Make.com webhook error:', err.message);
        return res.status(500).json({ error: err.message || 'fetch failed' });
      }
    } else if (provider === 'gmail') {
      console.log(`[MCP -> Gmail] command=${command}`);
      // Ensure we have fresh tokens in session if possible
      await ensureGoogleTokens(req);
      const bearerToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '') : null;
      const accessToken = apiKey || bearerToken || (req.session.googleTokens?.access_token);

      const result = await gmailProviderPlugin.executeCommand({ command, prompt: formattedPrompt, apiKey: accessToken });
      return res.json(result);
    } else if (provider === 'slack') {
      // fallback to stored token if apiKey omitted
      if (!apiKey) {
        const creds = await daoGetCredentials('slack');
        apiKey = creds?.token ? decryptValue(creds.token) : '';
      }
      const result = await slackProvider.executeCommand({ command, params: req.body.params, apiKey });
      return res.json(result);
    } else if (provider === 'jira') {
      const creds = { host: req.body.host, email: req.body.email, apiToken: apiKey };
      const result = await jiraProvider.executeCommand({ command, params: req.body.params, credentials: creds });
      return res.json(result);
    } else if (provider === 'notion') {
      const result = await notionProvider.executeCommand({ command, params: req.body.params, apiKey });
      return res.json(result);
    } else if (provider === 'cursor') {
      console.log(`[MCP -> Cursor] command=${command}`);
      const result = await cursorProvider.executeCommand({ command, prompt: formattedPrompt, apiKey });
      return res.json(result);
    } else if (provider === '21st_dev') {
      console.log(`[MCP -> 21st DEV] command=${command}`);
      const result = await twentyFirstDevProvider.executeCommand({ command, prompt: formattedPrompt, apiKey });
      return res.json(result);
    } else if (provider === 'loveable') {
      console.log(`[MCP -> Loveable] command=${command}`);
      const result = await loveableProvider.executeCommand({ command, prompt: formattedPrompt, apiKey });
      return res.json(result);
    } else if (provider === 'bolt') {
      console.log(`[MCP -> Bolt] command=${command}`);
      const result = await boltProvider.executeCommand({ command, prompt: formattedPrompt, apiKey });
      return res.json(result);
    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/google/disconnect', (req, res) => {
  req.session.googleTokens = undefined;
  res.json({ disconnected: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  // DEBUG – list every POST route on start-up
  console.log(
    'POST routes →',
    app._router.stack
      .filter(l => l.route && l.route.methods.post)
      .map(l => l.route.path)
  );
});

app.post('/api/github/trigger-action', async (req, res) => {
  const octokit = getGitHubOctokitFromSession(req);
  if (!octokit) return res.status(401).json({ error: 'Not authenticated with GitHub' });

  const { owner, repo, workflow_id, ref, inputs } = req.body;
  if (!owner || !repo || !workflow_id || !ref) {
    return res.status(400).json({ error: 'Missing required fields (owner, repo, workflow_id, ref)' });
  }

  try {
    // Trigger the workflow dispatch
    await octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id, // can be file name (e.g., main.yml) or workflow ID
      ref,         // branch or tag name
      inputs: inputs || {}
    });

    // Optionally, list recent workflow runs for feedback
    const runs = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id,
      per_page: 1
    });

    const runUrl = runs.data.workflow_runs[0]?.html_url;

    res.json({ success: true, runUrl, message: 'Workflow triggered!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Zapier webhook endpoint
app.post('/api/webhook/zapier', express.json(), (req, res) => {
  const { secret } = req.query;
  // TODO: Validate secret against user config
  console.log('Received Zapier webhook:', req.body);
  res.json({ success: true });
});

// n8n webhook endpoint
app.post('/api/webhook/n8n', express.json(), (req, res) => {
  const { secret } = req.query;
  // TODO: Validate secret against user config
  console.log('Received n8n webhook:', req.body);
  res.json({ success: true });
});

// Example: Send to Zapier/n8n as a workflow step
async function sendToWebhook(url, payload, secret) {
  try {
    const headers = secret ? { 'X-MCP-Secret': secret } : {};
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (err) {
    console.error('Webhook error:', err);
    return { error: err.message };
  }
}

// --- SQLite Setup ---
let db;
(async () => {
  db = await open({
    filename: './mcp.sqlite',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      githubId TEXT UNIQUE,
      zapierUrl TEXT,
      zapierSecret TEXT,
      n8nUrl TEXT,
      n8nSecret TEXT,
      googleRefreshToken TEXT,
      githubPAT TEXT,
      slackToken TEXT
    );
    CREATE TABLE IF NOT EXISTS Webhook (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      name TEXT,
      url TEXT,
      type TEXT,
      secret TEXT
    );
    CREATE TABLE IF NOT EXISTS WorkflowJob (
      id TEXT PRIMARY KEY,
      status TEXT,
      created INTEGER,
      updated INTEGER,
      workflow_json TEXT,
      context TEXT,
      results_json TEXT
    );
  `);
})();

// List all webhooks for the user
app.get('/api/user/webhooks', async (req, res) => {
  let userId = req.session.userId;
  if (!userId) {
    const user = await db.get('SELECT id FROM User LIMIT 1');
    if (user) userId = user.id;
  }
  if (!userId) return res.status(404).json({ error: 'User not found' });
  const webhooks = await db.all('SELECT * FROM Webhook WHERE userId = ?', userId);
  res.json({ webhooks });
});

// Add a new webhook
app.post('/api/user/webhooks', express.json(), async (req, res) => {
  const { name, url, type, secret } = req.body;
  let userId = req.session.userId;
  if (!userId) {
    let user = await db.get('SELECT id FROM User LIMIT 1');
    if (!user) {
      const result = await db.run('INSERT INTO User (githubId) VALUES (?)', 'dummy');
      userId = result.lastID;
    } else {
      userId = user.id;
    }
  }
  await db.run('INSERT INTO Webhook (userId, name, url, type, secret) VALUES (?, ?, ?, ?, ?)', userId, name, url, type, secret);
  res.json({ success: true });
});

// Delete a webhook
app.delete('/api/user/webhooks/:id', async (req, res) => {
  const { id } = req.params;
  await db.run('DELETE FROM Webhook WHERE id = ?', id);
  res.json({ success: true });
});

// Provider API key validation endpoint
app.post('/api/validate/provider', express.json(), async (req, res) => {
  const { provider, apiKey } = req.body;
  try {
    if (provider === 'openai') {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });
      // Try a simple call
      await openai.models.list();
      return res.json({ success: true });
    } else if (provider === 'anthropic') {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey });
      // Try a simple call
      await anthropic.models.list();
      return res.json({ success: true });
    } else if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      // Try to list models
      await genAI.listModels();
      return res.json({ success: true });
    } else if (provider === 'github') {
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: apiKey });
      try {
        // Try a simple authenticated call
        await octokit.request('GET /user');
        return res.json({ success: true });
      } catch (err) {
        return res.json({ success: false, error: err.message });
      }
    } else {
      return res.json({ success: false, error: 'Provider not supported for validation.' });
    }
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
});

// Webhook validation endpoint
app.post('/api/validate/webhook', express.json(), async (req, res) => {
  const { url } = req.body;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });
    if (response.ok) {
      return res.json({ success: true });
    } else {
      return res.json({ success: false, error: `Status ${response.status}` });
    }
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// NEW: plain "/health" alias for convenience and spec compatibility
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// NEW: "/commands" discovery endpoint (and /api/commands alias)
app.get(['/commands', '/api/commands'], (req, res) => {
  // Surface server version for clients via header
  res.set('MCP-Server-Version', MCP_SERVER_VERSION);
  res.json(MCP_COMMANDS);
});

// NEW: "/schema" endpoint for autocomplete with caching
app.get('/schema', (req, res) => {
  // 1-hour client cache so the Hub can poll every 60 min without redownloading if unchanged
  res.set({
    'Cache-Control': 'public, max-age=3600',
    'MCP-Server-Version': MCP_SERVER_VERSION
  });
  res.json(MCP_COMMANDS);
});

// Helper to fetch single user row (id=1) or create if missing
async function getOrCreateUser() {
  let user = await db.get('SELECT * FROM User LIMIT 1');
  if (!user) {
    await db.run('INSERT INTO User (githubId) VALUES (NULL)');
    user = await db.get('SELECT * FROM User LIMIT 1');
  }
  return user;
}

// --- NEW: encryption helpers for API keys & tokens ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'change-me'; // Fallback for local dev
function getAesKey() {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest(); // 32-byte key
}

/**
 * Encrypt arbitrary text with AES-256-GCM.
 * Returns a value prefixed with "enc:" so we can detect encrypted payloads later.
 */
function encryptValue(str = '') {
  if (!str) return str;
  if (str.startsWith('enc:')) return str; // already encrypted
  const iv = crypto.randomBytes(12); // 96-bit IV per NIST recommendation
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `enc:${payload}`;
}

/**
 * Decrypt previously encrypted value (created via encryptValue). If the value
 * is not encrypted, it is returned as-is for backward compatibility.
 */
function decryptValue(str = '') {
  if (!str || !str.startsWith('enc:')) return str;
  try {
    const buf = Buffer.from(str.slice(4), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getAesKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // If decryption fails, return original string so we don't break prod data
    return str;
  }
}
// --- END encryption helpers ---

// --- GitHub PAT storage endpoints (updated with encryption) ---
app.get('/api/user/github-token', async (req, res) => {
  try {
    const creds = await daoGetCredentials('github');
    const token = creds?.token ? decryptValue(creds.token) : '';
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/github-token', express.json(), async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const encrypted = encryptValue(token);
    await daoSaveCredentials('github', { token: encrypted });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/github-token', async (req, res) => {
  try {
    await daoDeleteCredentials('github');
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Slack Bot token storage endpoints ---
app.get('/api/user/slack-token', async (req, res) => {
  try {
    const creds = await daoGetCredentials('slack');
    const token = creds?.token ? decryptValue(creds.token) : '';
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/slack-token', express.json(), async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    await daoSaveCredentials('slack', { token: encryptValue(token) });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/slack-token', async (req, res) => {
  try {
    await daoDeleteCredentials('slack');
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// After Slack token routes, add unified credentials REST endpoints
app.get('/api/credentials/:providerId', async (req, res) => {
  const { providerId } = req.params;
  if (!providerId) return res.status(400).json({ error: 'Missing providerId' });
  try {
    const credentials = await daoGetCredentials(providerId);
    return res.json({ credentials });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/credentials/:providerId', express.json(), async (req, res) => {
  const { providerId } = req.params;
  if (!providerId) return res.status(400).json({ error: 'Missing providerId' });
  const { credentials } = req.body || {};
  if (!credentials || typeof credentials !== 'object') return res.status(400).json({ error: 'Missing credentials object' });
  try {
    await daoSaveCredentials(providerId, credentials);
    return res.json({ saved: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/credentials/:providerId', async (req, res) => {
  const { providerId } = req.params;
  if (!providerId) return res.status(400).json({ error: 'Missing providerId' });
  try {
    await daoDeleteCredentials(providerId);
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// MCP JSON-RPC endpoint — minimal support for initialize, tools/list, and tools/call
app.post('/mcp', async (req, res) => {
  const rpc = req.body;
  if (!rpc || typeof rpc !== 'object' || !rpc.method) {
    return res.status(400).json({ error: 'Invalid JSON-RPC request' });
  }
  const { id } = rpc; // undefined for notifications

  const sendResult = (result) => res.json({ jsonrpc: '2.0', id, result });
  const sendError = (code, message) => res.json({ jsonrpc: '2.0', id, error: { code, message } });

  // If this is a notification (no id), handle known notifications silently
  if (id === undefined) {
    if (rpc.method === 'notifications/initialized') {
      console.log('[MCP] Client initialized');
      return res.end(); // No response for notifications per JSON-RPC spec
    }
    // Unknown notifications are simply ignored
    return res.end();
  }

  try {
    // 1) Capability negotiation / handshake
    if (rpc.method === 'initialize') {
      const requestedVersion = rpc.params?.protocolVersion;
      const supportedVersions = ['2025-03-26', '2024-11-05'];
      const version = supportedVersions.includes(requestedVersion)
        ? requestedVersion
        : '2025-03-26';

      return sendResult({
        protocolVersion: version,
        serverInfo: {
          name: 'mcpserver',
          version: '0.1.0'
        },
        capabilities: {
          logging: {},
          prompts: { listChanged: true },
          resources: { listChanged: true },
          tools: { listChanged: true }
        }
      });
    }

    // 2) List available tools (one per command in MCP_COMMANDS)
    if (rpc.method === 'tools/list') {
      const tools = MCP_COMMANDS.map(cmd => ({
        name: cmd.id,
        description: cmd.description,
        inputSchema: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: cmd.providers },
            prompt: { type: 'string' },
            apiKey: { type: 'string' }
          },
          required: ['provider'],
          additionalProperties: true
        }
      }));
      return sendResult({ tools });
    }

    // 3) Execute a tool call by proxying to /api/command
    if (rpc.method === 'tools/call') {
      const { name, arguments: args } = rpc.params || {};
      if (!name) return sendError(-32602, 'Missing tool name');

      const provider = (args && args.provider) || 'openai';
      const command = name; // tool name matches command id
      const prompt = (args && args.prompt) || '';
      const apiKey = args?.apiKey;

      try {
        const resp = await fetch(`http://localhost:${PORT}/api/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, provider, command, apiKey })
        }).then(r => r.json());

        if (resp.error) {
          return sendResult({
            content: [{ type: 'text', text: `Error: ${resp.error}` }],
            isError: true
          });
        }

        return sendResult({
          content: [{ type: 'text', text: resp.output || '' }],
          isError: false
        });
      } catch (err) {
        return sendResult({
          content: [{ type: 'text', text: `Internal error: ${err.message}` }],
          isError: true
        });
      }
    }

    // Fallback for unknown methods
    return sendError(-32601, `Unknown method ${rpc.method}`);
  } catch (err) {
    console.error('[MCP] Error:', err);
    return sendError(-32603, err.message);
  }
});

// ── MCP SSE stream ───────────────────────────────────────────────
app.get('/mcp', (req, res) => {
  console.log('[MCP] Incoming SSE connection from', req.ip);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Allow any origin so Claude Desktop (which runs its own origin) can connect during local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();          // send headers now
  // Send initial comment to complete EventSource handshake immediately
  res.write(': connected\n\n');

  // keep-alive ping every 20 s
  const ping = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(ping);
    console.log('[MCP] SSE client', req.ip, 'disconnected');
  });
});

// --- simple timing helper ---
async function time(label, fn) {
  const start = Date.now();
  try {
    const res = await fn();
    const ms = Date.now() - start;
    const status = res?.status ?? 'ok';
    console.log(`[${label}] ${ms}ms status=${status}`);
    return res;
  } catch (err) {
    console.log(`[${label}] ERROR after ${Date.now() - start}ms -> ${err.message}`);
    throw err;
  }
}

app.post('/api/validate-key', express.json(), async (req, res) => {
  const { provider, apiKey } = req.body || {};
  if (!provider || !apiKey) return res.status(400).json({ valid: false, error: 'Missing provider or apiKey' });
  try {
    if (provider === 'github') {
      const octo = new Octokit({ auth: apiKey });
      await octo.request('GET /user');
      return res.json({ valid: true });
    }
    if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      return res.json({ valid: resp.ok });
    }
    if (provider === 'anthropic') {
      const resp = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        method: 'GET'
      });
      return res.json({ valid: resp.ok });
    }
    if (provider === 'gemini' || provider === 'google' ) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      return res.json({ valid: resp.ok });
    }
    if (provider === 'cursor' || provider === '21st_dev' || provider === 'loveable' || provider === 'bolt') {
      // TODO: Implement real validation once provider APIs are available.
      // For now, treat any non-empty key as valid.
      const valid = typeof apiKey === 'string' && apiKey.trim().length > 0;
      return res.json({ valid });
    }
    // Default: unknown provider
    return res.status(400).json({ valid: false, error: 'Provider not supported' });
  } catch (err) {
    return res.json({ valid: false, error: err.message });
  }
});

// --- Google OAuth token refresh endpoint ---
app.post('/google/refresh', express.json(), async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });
  try {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token
    });
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return res.status(401).json({ error: 'refresh_failed', details: text });
    }
    const json = await tokenRes.json(); // { access_token, expires_in, scope, token_type }
    return res.json({ access_token: json.access_token, expires_in: json.expires_in });
  } catch (err) {
    console.error('Google refresh error', err);
    return res.status(500).json({ error: err.message });
  }
});

// alias for compatibility
app.post('/refresh', (req, res) => {
  req.url = '/google/refresh';
  // continue to existing route handler stack
  app._router.handle(req, res);
});

// --- Status endpoints for front-end UI ---
app.get('/api/google/status', async (req, res) => {
  try {
    // Session token
    if (req.session.googleTokens?.access_token) {
      return res.json({ connected: true });
    }
    // DAO refresh token
    const creds = await daoGetCredentials('google');
    const hasRefresh = !!creds?.refreshToken;
    return res.json({ connected: hasRefresh });
  } catch (err) {
    return res.status(500).json({ connected: false, error: err.message });
  }
});

app.get('/api/github/status', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const hasToken = !!user.githubPAT;
    return res.json({ connected: hasToken });
  } catch (err) {
    return res.status(500).json({ connected: false, error: err.message });
  }
});

// After existing /api/github/status endpoint
app.get('/api/:provider/status', async (req, res) => {
  const providerId = canonicalProvider(req.params.provider);
  try {
    if (providerId === 'google') {
      // session first
      if (req.session.googleTokens?.access_token) {
        return res.json({ connected: true });
      }
      const creds = await daoGetCredentials('google');
      return res.json({ connected: !!creds?.refreshToken });
    }
    if (providerId === 'github' || providerId === 'slack' || providerId === 'notion' || providerId === 'jira') {
      const creds = await daoGetCredentials(providerId);
      return res.json({ connected: !!creds?.token || !!creds?.apiKey });
    }
    // default: check any credentials blob
    const creds = await daoGetCredentials(providerId);
    return res.json({ connected: !!creds });
  } catch (err) {
    return res.status(500).json({ connected: false, error: err.message });
  }
});

// ── SSE Event Bus (mcp/events) ─────────────────────────────
const sseClients = new Set();
function broadcastEvent(type, payload = {}) {
  const json = JSON.stringify(payload);
  for (const res of sseClients) {
    try {
      res.write(`event: ${type}\n`);
      res.write(`data: ${json}\n\n`);
    } catch {
      // client disconnected; will be pruned on 'close'
    }
  }
}

app.get('/mcp/events', (req, res) => {
  console.log('[MCP] New /mcp/events connection from', req.ip);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  res.write(': connected\n\n');
  sseClients.add(res);

  const ping = setInterval(() => {
    if (!res.writableEnded) {
      res.write('event: ping\n');
      res.write('data: {}\n\n');
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
    console.log('[MCP] /mcp/events client disconnected', req.ip);
  });
});

// ── Token Manager (auto-refresh) ──────────────────────────
function startTokenManager() {
  const FIVE_MIN = 5 * 60 * 1000;
  const intervalMs = 10 * 60 * 1000; // 10 min
  setInterval(async () => {
    try {
      const creds = await daoGetCredentials('google');
      if (!creds || !creds.refreshToken) return;
      const expiresAt = creds.expiresAt || 0;
      if (expiresAt - Date.now() > FIVE_MIN) return; // still fresh

      const refreshToken = decryptValue(creds.refreshToken);
      const oauth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3001/auth/google/callback'
      );
      oauth.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth.refreshAccessToken();
      const newCreds = {
        refreshToken: encryptValue(refreshToken),
        accessToken: encryptValue(credentials.access_token),
        expiresAt: credentials.expiry_date || (Date.now() + 3300000)
      };
      await daoSaveCredentials('google', newCreds);
      broadcastEvent('token-refresh', { provider: 'google', refreshed: true });
      console.log('[TokenManager] Google token refreshed');
    } catch (err) {
      console.error('[TokenManager] Google refresh failed:', err.message);
    }
  }, intervalMs);
}

startTokenManager();

// Provider alias map (canonicalizing IDs)
const PROVIDER_ALIASES = {
  gmail: 'google',
  google_drive: 'google',
  google_calendar: 'google'
};
function canonicalProvider(id = '') {
  return PROVIDER_ALIASES[id] || id;
}

