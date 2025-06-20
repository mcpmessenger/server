import axios from 'axios';

export const id = 'jira';
export const supportedCommands = ['list-projects', 'create-issue'];

export async function executeCommand({ command, params = {}, credentials }) {
  const { host, email, apiToken } = credentials || {};
  if (!host || !email || !apiToken) throw new Error('host, email, apiToken are required');
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const client = axios.create({
    baseURL: `https://${host}/rest/api/3`,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });

  switch (command) {
    case 'list-projects': {
      const { data } = await client.get('/project/search');
      const lines = data.values.map(p => `${p.key} | ${p.name}`).join('\n');
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