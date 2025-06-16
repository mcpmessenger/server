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

dotenv.config();

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5176', 'http://localhost:5177'],
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:3001/auth/google/callback'
);
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
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
    // Persist refresh_token (first-time auth) to user row
    if (tokens.refresh_token) {
      const user = await getOrCreateUser();
      await db.run('UPDATE User SET googleRefreshToken = ? WHERE id = ?', tokens.refresh_token, user.id);
    }
    res.send('Google authentication successful! You can close this window.');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).send('Google authentication failed. Please try again.');
  }
});

async function getGoogleAuthFromSession(req) {
  if (!req.session.googleTokens) return null;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3001/auth/google/callback'
  );

  client.setCredentials(req.session.googleTokens);

  // Auto-refresh access token if expired or about to expire (less than 2 min)
  const expiryDate = req.session.googleTokens.expiry_date || 0;
  const now = Date.now();
  if (expiryDate && expiryDate - now < 120_000 && req.session.googleTokens.refresh_token) {
    try {
      const { credentials } = await client.refreshAccessToken();
      // Merge new credentials back into session
      req.session.googleTokens = {
        ...req.session.googleTokens,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date || (now + 3_300_000) // ~55min
      };
      client.setCredentials(req.session.googleTokens);
    } catch (err) {
      console.error('Google token refresh failed:', err.message);
    }
  }

  return client;
}

// --- Bearer token auth middleware for Google Drive commands ---
function requireAuth(req, res, next) {
  // Only enforce auth for Google Drive commands
  if (req.body?.provider !== 'google_drive') {
    return next();
  }
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  req.googleToken = auth.replace('Bearer ', '');
  next();
}

app.post(['/api/command', '/command'], requireAuth, async (req, res) => {
  // Log only high-level details to avoid dumping full conversation to console
  let { prompt, provider, command, apiKey } = req.body;
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
    } else if (provider === 'gmail') {
      console.log(`[MCP -> Gmail] command=${command}`);
      // Determine access token: prefer Authorization header set earlier by requireAuth fallback, else session token
      const bearerToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '') : null;
      const accessToken = apiKey || bearerToken || (req.session.googleTokens?.access_token);

      const result = await gmailProviderPlugin.executeCommand({ command, prompt: formattedPrompt, apiKey: accessToken });
      return res.json(result);
    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Asynchronous Workflow execution ---
async function enqueueWorkflowJob(workflow, context = '') {
  const jobId = 'wf-' + crypto.randomUUID();
  const now = Date.now();
  await db.run(
    'INSERT INTO WorkflowJob (id, status, created, updated, workflow_json, context, results_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    jobId,
    'queued',
    now,
    now,
    JSON.stringify(workflow),
    context,
    JSON.stringify([])
  );

  // Start async processing without blocking response
  process.nextTick(() => processWorkflowJob(jobId));

  return jobId;
}

async function processWorkflowJob(jobId) {
  let job = await db.get('SELECT * FROM WorkflowJob WHERE id = ?', jobId);
  if (!job) return;
  let workflow = JSON.parse(job.workflow_json);
  let results = [];
  let lastOutput = job.context || '';

  await db.run('UPDATE WorkflowJob SET status = ? WHERE id = ?', 'running', jobId);

  for (let idx = 0; idx < workflow.length; idx++) {
    const step = workflow[idx];
    const { provider, command, prompt, apiKey } = step;
    const stepPrompt = prompt || lastOutput;

    try {
      // Proxy to existing /api/command route so we reuse all provider logic
      const resp = await fetch(`http://localhost:${PORT}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: stepPrompt, provider, command, apiKey })
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      results.push({ status: 'success', output: data.output, provider, command });
      lastOutput = data.output;
    } catch (err) {
      results.push({ status: 'error', error: err.message, provider, command });
      // Decide whether to stop on error or continue; here we stop.
      break;
    }

    await db.run('UPDATE WorkflowJob SET results_json = ?, updated = ? WHERE id = ?', JSON.stringify(results), Date.now(), jobId);
  }

  await db.run('UPDATE WorkflowJob SET status = ?, results_json = ?, updated = ? WHERE id = ?', 'done', JSON.stringify(results), Date.now(), jobId);
}

app.post('/api/workflow', async (req, res) => {
  const { workflow, context } = req.body;
  if (!Array.isArray(workflow) || workflow.length === 0) {
    return res.status(400).json({ error: 'Workflow must be a non-empty array.' });
  }
  try {
    const jobId = await enqueueWorkflowJob(workflow, context);
    res.json({ jobId, eta: workflow.length * 10 }); // naive ETA: 10s per step
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/job/:id', async (req, res) => {
  const { id } = req.params;
  const job = await db.get('SELECT * FROM WorkflowJob WHERE id = ?', id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    jobId: job.id,
    status: job.status,
    created: job.created,
    updated: job.updated,
    done: job.status === 'done',
    results: JSON.parse(job.results_json || '[]')
  });
});

app.get('/api/google/drive-files', async (req, res) => {
  const auth = await getGoogleAuthFromSession(req);
  if (!auth) return res.status(401).json({ error: 'Not authenticated with Google' });
  const drive = google.drive({ version: 'v3', auth });
  const files = await drive.files.list({ pageSize: 20, fields: 'files(id, name, mimeType)' });
  res.json({ files: files.data.files });
});

app.get('/api/google/gmail-messages', async (req, res) => {
  const auth = await getGoogleAuthFromSession(req);
  if (!auth) return res.status(401).json({ error: 'Not authenticated with Google' });
  const gmail = google.gmail({ version: 'v1', auth });
  const messages = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
  res.json({ messages: messages.data.messages });
});

app.get('/api/google/status', (req, res) => {
  if (req.session.googleTokens) {
    res.json({ connected: true });
  } else {
    res.json({ connected: false });
  }
});

app.get('/auth/github', (req, res) => {
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK)}&scope=repo%20read:user`;
  res.redirect(url);
});

app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_CALLBACK
    })
  });
  const tokenData = await tokenRes.json();
  console.log('GitHub tokenData:', tokenData);
  req.session.githubToken = tokenData.access_token;

  // Fetch GitHub user info
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${tokenData.access_token}` }
  });
  const userData = await userRes.json();
  console.log('GitHub userData:', userData);
  const githubId = userData.id?.toString();
  if (!githubId) return res.status(400).send('Could not get GitHub user ID');

  // Upsert user in SQLite
  let user = await db.get('SELECT * FROM User WHERE githubId = ?', githubId);
  if (!user) {
    const result = await db.run('INSERT INTO User (githubId) VALUES (?)', githubId);
    user = await db.get('SELECT * FROM User WHERE id = ?', result.lastID);
  }
  req.session.userId = user.id;

  res.redirect('http://localhost:5174/');
});

function getGitHubOctokitFromSession(req) {
  if (!req.session.githubToken) return null;
  return new Octokit({ auth: req.session.githubToken });
}

app.get('/api/github/repos', async (req, res) => {
  const octokit = getGitHubOctokitFromSession(req);
  if (!octokit) {
    console.error('Not authenticated with GitHub (no Octokit instance)');
    return res.status(401).json({ error: 'Not authenticated with GitHub' });
  }
  let allRepos = [];
  let page = 1;
  let fetched;
  try {
    do {
      const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 100, page });
      fetched = data.length;
      allRepos = allRepos.concat(data);
      page++;
    } while (fetched === 100);
    res.json({ repos: allRepos });
  } catch (err) {
    console.error('Error fetching GitHub repos:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/github/files', async (req, res) => {
  const octokit = getGitHubOctokitFromSession(req);
  const { owner, repo, path } = req.query;
  if (!octokit) return res.status(401).json({ error: 'Not authenticated with GitHub' });
  if (!owner || !repo) return res.status(400).json({ error: 'Missing owner or repo' });
  const { data } = await octokit.repos.getContent({ owner, repo, path: path || '' });
  res.json({ files: data });
});

app.get('/api/github/status', (req, res) => {
  if (req.session.githubToken) {
    res.json({ connected: true });
  } else {
    res.json({ connected: false });
  }
});

app.post('/api/github/disconnect', (req, res) => {
  req.session.githubToken = undefined;
  res.json({ disconnected: true });
});

const upload = multer({ dest: 'uploads/' });

// --- Smart Chat Endpoint ---
app.post('/api/chat', upload.single('attachment'), async (req, res) => {
  const message = req.body.message;
  const history = req.body.history ? JSON.parse(req.body.history) : [];
  let attachmentContent = '';
  if (req.file) {
    attachmentContent = fs.readFileSync(req.file.path, 'utf-8');
    fs.unlinkSync(req.file.path); // Clean up temp file
  }

  // Multi-webhook Zapier intent parsing
  const zapierPattern = /^\s*\/zapier(?::([\w-]+))?/i;
  const zapierMatch = message.match(zapierPattern);
  if (zapierMatch) {
    const hookName = zapierMatch[1];
    try {
      let userId = req.session.userId;
      if (!userId) {
        const user = await db.get('SELECT id FROM User LIMIT 1');
        if (user) userId = user.id;
      }
      let webhook = null;
      if (hookName) {
        webhook = await db.get('SELECT * FROM Webhook WHERE userId = ? AND name = ?', userId, hookName);
      } else {
        webhook = await db.get('SELECT * FROM Webhook WHERE userId = ? LIMIT 1', userId);
      }
      if (!webhook) return res.json({ response: 'No Zapier webhook found. Please add one in settings.' });
      let payloadText = message.replace(zapierPattern, '').trim();
      let payload;
      try {
        payload = payloadText ? JSON.parse(payloadText) : { message, history, attachmentContent };
      } catch (e) {
        payload = { message: payloadText || message, history, attachmentContent };
      }
      console.log('Sending to Zapier:', webhook.url, payload);
      const zapierResult = await sendToWebhook(webhook.url, payload, webhook.secret);
      if (zapierResult && !zapierResult.error) {
        return res.json({ response: '✅ Sent to Zapier webhook successfully!' });
      } else {
        return res.json({ response: '❌ Failed to send to Zapier webhook: ' + (zapierResult.error || 'Unknown error') });
      }
    } catch (err) {
      console.error('Zapier integration error:', err);
      return res.json({ response: '❌ Error sending to Zapier: ' + err.message });
    }
  }

  // n8n intent parsing (returns early if handled)
  const n8nPattern = /^\s*(\/n8n\b|send (this|it)? to n8n|trigger n8n|n8n:)/i;
  if (n8nPattern.test(message)) {
    try {
      let user = null;
      if (req.session.userId) {
        user = await db.get('SELECT n8nUrl, n8nSecret FROM User WHERE id = ?', req.session.userId);
      } else {
        user = await db.get('SELECT n8nUrl, n8nSecret FROM User LIMIT 1');
      }
      if (!user || !user.n8nUrl) return res.json({ response: 'No n8n webhook URL found. Please set it in settings.' });
      let payloadText = message.replace(n8nPattern, '').trim();
      let payload;
      try {
        payload = payloadText ? JSON.parse(payloadText) : { message, history, attachmentContent };
      } catch (e) {
        payload = { message: payloadText || message, history, attachmentContent };
      }
      console.log('Sending to n8n:', user.n8nUrl, payload);
      const n8nResult = await sendToWebhook(user.n8nUrl, payload, user.n8nSecret);
      if (n8nResult && !n8nResult.error) {
        return res.json({ response: '✅ Sent to n8n webhook successfully!' });
      } else {
        return res.json({ response: '❌ Failed to send to n8n webhook: ' + (n8nResult.error || 'Unknown error') });
      }
    } catch (err) {
      console.error('n8n integration error:', err);
      return res.json({ response: '❌ Error sending to n8n: ' + err.message });
    }
  }

  // 1) Start with explicit values from body (UI may send these)
  let provider = req.body.provider || undefined;
  let apiKey   = req.body.apiKey || undefined;
  let command  = req.body.command || undefined;
  let prompt   = message;

  // 2) Let the shared parser suggest provider/command if not supplied
  const intent = parseIntent(message);
  if (!provider && intent.provider) provider = intent.provider;
  if (!command && intent.command)   command  = intent.command;

  // 3) Fallback defaults
  provider = provider || 'openai';
  command  = command  || 'chat';

  // If there's an attachment, use it as context
  if (attachmentContent) {
    prompt += '\n\nAttached file:\n' + attachmentContent;
  }

  // Only log after provider/command are set
  console.log('Routing:', { provider, command, prompt });

  try {
    if (provider === 'github' && command === 'list-repos') {
      // Call the /api/command endpoint, which supports PATs
      const result = await fetch('http://localhost:3001/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider, command, apiKey }),
      });
      const data = await result.json();
      if (data.output) {
        return res.json({ response: data.output });
      } else {
        console.error('Could not fetch GitHub repositories. Response:', data);
        return res.json({ response: 'Could not fetch GitHub repositories.' });
      }
    }

    // Call the existing /api/command logic
    const result = await fetch('http://localhost:3001/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider, command, apiKey }),
    });
    const data = await result.json();
    res.json({ response: data.output });
  } catch (err) {
    console.error('Error in /api/chat endpoint:', err);
    res.status(500).json({ response: 'Error: ' + err.message });
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
      githubPAT TEXT
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

// Helper to fetch single user row (id=1) or create if missing
async function getOrCreateUser() {
  let user = await db.get('SELECT * FROM User LIMIT 1');
  if (!user) {
    await db.run('INSERT INTO User (githubId) VALUES (NULL)');
    user = await db.get('SELECT * FROM User LIMIT 1');
  }
  return user;
}

// --- GitHub PAT storage endpoints ---
app.get('/api/user/github-token', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    res.json({ token: user.githubPAT || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/github-token', express.json(), async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const user = await getOrCreateUser();
    await db.run('UPDATE User SET githubPAT = ? WHERE id = ?', token, user.id);
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/user/github-token', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    await db.run('UPDATE User SET githubPAT = NULL WHERE id = ?', user.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

