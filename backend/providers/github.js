import fetch from 'node-fetch';

// Lightweight GitHub provider that implements the MCP ProviderPlugin contract
// Only a subset of commands is currently supported. New commands can be added
// without touching the main backend entry point – simply extend the logic here.

const request = (apiKey) => async (url, opts = {}) => {
  if (!apiKey) {
    throw new Error('Missing GitHub token');
  }
  const res = await fetch(`https://api.github.com${url}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `token ${apiKey}`,
      ...(opts.headers || {}),
    },
  });
  return res;
};

async function executeCommand({ command = '', prompt = '', apiKey }) {
  const cmd = (command || prompt || '').trim();
  const req = request(apiKey);

  // 1) list-repos
  if (/^\/?list-?repos?$/i.test(cmd)) {
    const r = await req('/user/repos?per_page=100');
    let data = await r.json();
    // Parse limit from prompt (e.g., 'last 3 repos' or 'get 5 repos')
    let limit = 0;
    if (prompt) {
      const m = prompt.match(/last\s+(\d+)/i) || prompt.match(/(?:list|get|show)\s+(\d+)\s+repos?/i);
      if (m) limit = parseInt(m[1], 10);
    }
    if (limit && Array.isArray(data)) {
      data = data.slice(0, limit);
    }
    const repoNames = Array.isArray(data) ? data.map((repo) => `• ${repo.full_name}`).join('\n') : '';
    return {
      output: repoNames || 'No repositories found.',
      provider: 'github',
      command: 'list-repos',
      status: r.status,
      raw_response: data,
    };
  }

  // 2) get-issues owner/repo
  const mGet = cmd.match(/^\/?get-?issues?\s+([\w-]+\/[\w\-.]+)$/i);
  if (mGet) {
    const repo = mGet[1];
    const r = await req(`/repos/${repo}/issues?state=open`);
    const data = await r.json();
    return {
      output: `Open issues in ${repo}:\n` + data.map((i) => `#${i.number}: ${i.title}`).join('\n'),
      provider: 'github',
      command: 'get-issues',
      status: r.status,
      raw_response: data,
    };
  }

  // 3) create-issue owner/repo Title | Body
  const mNew = cmd.match(/^\/?create-?issue\s+([\w-]+\/[\w\-.]+)\s+(.+?)\s\|\s([\s\S]+)$/i);
  if (mNew) {
    const [, repo, title, body] = mNew;
    const r = await req(`/repos/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
    const data = await r.json();
    return {
      output: `Issue #${data.number} created: ${data.html_url}`,
      provider: 'github',
      command: 'create-issue',
      status: r.status,
      raw_response: data,
    };
  }

  return { error: 'Unsupported GitHub command', status: 400 };
}

async function listResources({ apiKey }) {
  const r = await request(apiKey)('/user/repos?per_page=100');
  const data = await r.json();
  return (Array.isArray(data) ? data : []).map((repo) => ({
    id: repo.id,
    name: repo.full_name,
    type: 'repository',
    url: repo.html_url,
    description: repo.description,
  }));
}

const githubProvider = {
  id: 'github',
  name: 'GitHub',
  supportedCommands: ['list-repos', 'get-issues', 'create-issue'],
  executeCommand,
  listResources,
};

export default githubProvider; 