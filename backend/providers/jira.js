import axios from 'axios';

export const id = 'jira';
export const supportedCommands = ['list-projects', 'create-issue'];

export async function executeCommand({ command, params = {}, credentials = {} }) {
  // Support two auth styles:
  // 1) Modern OAuth 2.0 (accessToken + cloudId) via Atlassian cloud API
  // 2) Legacy Basic Auth (email + apiToken + host)

  let client;
  if (credentials.accessToken && credentials.cloudId) {
    // ─── OAuth / PKCE flow ────────────────────────────────────────────────
    client = axios.create({
      baseURL: `https://api.atlassian.com/ex/jira/${credentials.cloudId}/rest/api/3`,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
  } else {
    // ─── Legacy Basic Auth fallback (self-hosted or API token) ────────────
    const { host, email, apiToken } = credentials;
    if (!host || !email || !apiToken) {
      throw new Error('Missing Jira credentials: provide accessToken+cloudId OR host+email+apiToken');
    }
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    client = axios.create({
      baseURL: `https://${host}/rest/api/3`,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  switch (command) {
    case 'list-projects': {
      const { data } = await client.get('/project/search');
      const lines = (data.values || []).map(p => `${p.key} | ${p.name}`).join('\n');
      return { output: lines || 'No projects' };
    }
    case 'create-issue': {
      const { projectKey, summary, description, issueType = 'Task' } = params;
      if (!projectKey || !summary) throw new Error('projectKey and summary required');
      const body = {
        fields: {
          project: { key: projectKey },
          summary,
          description: description || '',
          issuetype: { name: issueType }
        }
      };
      const { data } = await client.post('/issue', body);
      return { output: `✅ Issue ${data.key} created` };
    }
    default:
      throw new Error(`Unsupported Jira command: ${command}`);
  }
}

export default { id, supportedCommands, executeCommand }; 