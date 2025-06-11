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

dotenv.config();

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5176'],
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
    res.send('Google authentication successful! You can close this window.');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.status(500).send('Google authentication failed. Please try again.');
  }
});

function getGoogleAuthFromSession(req) {
  if (!req.session.googleTokens) return null;
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3001/auth/google/callback'
  );
  client.setCredentials(req.session.googleTokens);
  return client;
}

app.post('/api/command', async (req, res) => {
  const { prompt, provider, command, apiKey } = req.body;
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
      const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return res.status(400).json({ error: 'No OpenAI API key provided.' });
      }
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: formattedPrompt }],
      });
      return res.json({
        output: completion.choices[0].message.content,
        tokens_used: completion.usage.total_tokens,
        model_version: 'gpt-3.5-turbo',
        provider: 'openai',
        raw_response: completion,
      });
    } else if (provider === 'anthropic') {
      const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        return res.status(400).json({ error: 'No Anthropic API key provided.' });
      }
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const completion = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: formattedPrompt }
        ],
      });
      return res.json({
        output: completion.content[0].text,
        tokens_used: completion.usage.input_tokens + completion.usage.output_tokens,
        model_version: 'claude-3-sonnet-20240229',
        provider: 'anthropic',
        raw_response: completion,
      });
    } else if (provider === 'gemini') {
      const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        console.error('No Gemini API key provided.');
        return res.status(400).json({ error: 'No Gemini API key provided.' });
      }
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(formattedPrompt);
        console.log('Gemini raw result:', result);
        const response = await result.response;
        const text = response.text();
        console.log('Gemini response text:', text);
        return res.json({
          output: text,
          tokens_used: null,
          model_version: 'gemini-2.0-flash',
          provider: 'gemini',
          raw_response: response,
        });
      } catch (err) {
        console.error('Gemini error:', err);
        return res.status(500).json({ error: err.message });
      }
    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workflow', async (req, res) => {
  const { workflow, context } = req.body;
  if (!Array.isArray(workflow) || workflow.length === 0) {
    return res.status(400).json({ error: 'Workflow must be a non-empty array.' });
  }
  let lastOutput = context || '';
  const results = [];
  for (const step of workflow) {
    const { provider, command, prompt, apiKey } = step;
    let stepPrompt = prompt || lastOutput;
    let formattedPrompt = stepPrompt;
    switch (command) {
      case 'summarize':
        formattedPrompt = `Summarize this:\n${stepPrompt}`;
        break;
      case 'generate-code':
        formattedPrompt = `Write code for:\n${stepPrompt}`;
        break;
      case 'explain':
        formattedPrompt = `Explain this:\n${stepPrompt}`;
        break;
      case 'translate':
        formattedPrompt = `Translate this to English:\n${stepPrompt}`;
        break;
      default:
        break;
    }
    try {
      let result;
      if (provider === 'openai') {
        const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) throw new Error('No OpenAI API key provided.');
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: formattedPrompt }],
        });
        result = {
          output: completion.choices[0].message.content,
          tokens_used: completion.usage.total_tokens,
          model_version: 'gpt-3.5-turbo',
          provider: 'openai',
          command,
          raw_response: completion,
        };
      } else if (provider === 'anthropic') {
        const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
        if (!anthropicApiKey) throw new Error('No Anthropic API key provided.');
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });
        const completion = await anthropic.messages.create({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: formattedPrompt }
          ],
        });
        result = {
          output: completion.content[0].text,
          tokens_used: completion.usage.input_tokens + completion.usage.output_tokens,
          model_version: 'claude-3-sonnet-20240229',
          provider: 'anthropic',
          command,
          raw_response: completion,
        };
      } else if (provider === 'gemini') {
        const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
        if (!geminiApiKey) throw new Error('No Gemini API key provided.');
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const resultGemini = await model.generateContent(formattedPrompt);
        const response = await resultGemini.response;
        const text = response.text();
        result = {
          output: text,
          tokens_used: null,
          model_version: 'gemini-2.0-flash',
          provider: 'gemini',
          command,
          raw_response: response,
        };
      } else {
        throw new Error('Unsupported provider');
      }
      results.push(result);
      lastOutput = result.output;
    } catch (err) {
      results.push({ error: err.message, provider, command });
      lastOutput = '';
    }
  }
  res.json({ results });
});

app.get('/api/google/drive-files', async (req, res) => {
  const auth = getGoogleAuthFromSession(req);
  if (!auth) return res.status(401).json({ error: 'Not authenticated with Google' });
  const drive = google.drive({ version: 'v3', auth });
  const files = await drive.files.list({ pageSize: 20, fields: 'files(id, name, mimeType)' });
  res.json({ files: files.data.files });
});

app.get('/api/google/gmail-messages', async (req, res) => {
  const auth = getGoogleAuthFromSession(req);
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

  // Debug: log the received message
  console.log('Received chat message:', message);

  // Zapier intent parsing (returns early if handled)
  const zapierPattern = /^(\/?zapier\b|send (this|it)? to zapier|trigger zapier|zapier:)/i;
  if (zapierPattern.test(message)) {
    try {
      let user = null;
      if (req.session.userId) {
        user = await db.get('SELECT zapierUrl, zapierSecret FROM User WHERE id = ?', req.session.userId);
      } else {
        user = await db.get('SELECT zapierUrl, zapierSecret FROM User LIMIT 1');
      }
      if (!user || !user.zapierUrl) return res.json({ response: 'No Zapier webhook URL found. Please set it in settings.' });
      let payloadText = message.replace(zapierPattern, '').trim();
      let payload;
      try {
        payload = payloadText ? JSON.parse(payloadText) : { message, history, attachmentContent };
      } catch (e) {
        payload = { message: payloadText || message, history, attachmentContent };
      }
      console.log('Sending to Zapier:', user.zapierUrl, payload);
      const zapierResult = await sendToWebhook(user.zapierUrl, payload, user.zapierSecret);
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
  const n8nPattern = /^(\/?n8n\b|send (this|it)? to n8n|trigger n8n|n8n:)/i;
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

  // Always define these before using or logging them!
  // Use provider and apiKey from the request body if present
  let provider = req.body.provider || 'openai';
  let apiKey = req.body.apiKey || undefined;
  let command = 'chat';
  let prompt = message;

  if (
    /github.*repo|repo.*github/i.test(message) ||
    /list.*repo/i.test(message) ||
    /show.*repo/i.test(message) ||
    /my.*repo/i.test(message)
  ) {
    provider = 'github';
    command = 'list-repos';
  } else if (/repo[- ]?summary/i.test(message)) {
    provider = 'github';
    command = 'repo-summary';
  } else if (/code[- ]?search/i.test(message)) {
    provider = 'github';
    command = 'code-search';
  } else if (/issue/i.test(message)) {
    provider = 'github';
    command = 'generate-issue';
  } else if (/pull[- ]?request|pr/i.test(message)) {
    provider = 'github';
    command = 'generate-pr';
  }

  // If there's an attachment, use it as context
  if (attachmentContent) {
    prompt += '\n\nAttached file:\n' + attachmentContent;
  }

  // Only log after provider/command are set
  console.log('Routing:', { provider, command, prompt });

  try {
    if (provider === 'github' && command === 'list-repos') {
      // Call your GitHub repos endpoint
      const ghRes = await fetch('http://localhost:3001/api/github/repos', {
        method: 'GET',
        headers: { 'Cookie': req.headers.cookie || '' },
      });
      const data = await ghRes.json();
      if (data.repos) {
        const repoList = data.repos.map(r => `- ${r.full_name}`).join('\n');
        return res.json({ response: `Your GitHub repositories:\n${repoList}` });
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
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

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
      n8nSecret TEXT
    )
  `);
})();

export { db };

// Get current user's webhook settings
app.get('/api/user/webhooks', async (req, res) => {
  const user = await db.get('SELECT zapierUrl, zapierSecret, n8nUrl, n8nSecret FROM User WHERE id = ?', req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update current user's webhook settings
app.post('/api/user/webhooks', express.json(), async (req, res) => {
  const { zapierUrl, zapierSecret, n8nUrl, n8nSecret } = req.body;
  await db.run(
    'UPDATE User SET zapierUrl = ?, zapierSecret = ?, n8nUrl = ?, n8nSecret = ? WHERE id = ?',
    zapierUrl, zapierSecret, n8nUrl, n8nSecret, req.session.userId
  );
  res.json({ success: true });
});

export default app;