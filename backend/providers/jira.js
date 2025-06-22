import axios from 'axios';

export const id = 'jira';
export const supportedCommands = [
  'list-projects',
  'list-issues',
  'get-issue',
  'create-issue',
  'update-issue',
  'add-comment',
  'transition-issue'
];

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
    case 'list-issues': {
      // Optional JQL param; default to assigned to me
      const { jql } = params;
      const { data } = await client.get('/search', {
        params: {
          jql: jql || 'assignee = currentUser() ORDER BY updated DESC',
          maxResults: 20,
          fields: 'key,summary,status'
        }
      });
      const lines = (data.issues || []).map(i => `${i.key} | ${i.fields.summary} (${i.fields.status?.name})`).join('\n');
      return { output: lines || 'No issues found' };
    }
    case 'get-issue': {
      const { issueKey } = params;
      if (!issueKey) throw new Error('issueKey required');
      const { data } = await client.get(`/issue/${issueKey}`);
      return { output: JSON.stringify(data, null, 2) };
    }
    case 'update-issue': {
      const { issueKey, fields = {} } = params;
      if (!issueKey || !Object.keys(fields).length) throw new Error('issueKey and fields required');
      await client.put(`/issue/${issueKey}`, { fields });
      return { output: `✅ Issue ${issueKey} updated` };
    }
    case 'add-comment': {
      const { issueKey, body } = params;
      if (!issueKey || !body) throw new Error('issueKey and body required');
      const { data } = await client.post(`/issue/${issueKey}/comment`, { body });
      return { output: `💬 Comment ${data.id} added` };
    }
    case 'transition-issue': {
      const { issueKey, transitionName } = params;
      if (!issueKey || !transitionName) throw new Error('issueKey and transitionName required');
      // Get available transitions first to map name -> id
      const { data: txData } = await client.get(`/issue/${issueKey}/transitions`);
      const tx = (txData.transitions || []).find(t => t.name.toLowerCase() === transitionName.toLowerCase());
      if (!tx) throw new Error(`Transition '${transitionName}' not found`);
      await client.post(`/issue/${issueKey}/transitions`, { transition: { id: tx.id } });
      return { output: `🔀 Issue ${issueKey} transitioned to ${transitionName}` };
    }
    default:
      throw new Error(`Unsupported Jira command: ${command}`);
  }
}

export default { id, supportedCommands, executeCommand }; 