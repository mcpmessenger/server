export class MCPServerService {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // remove trailing slash
  }

  async executeCommand({ prompt, provider, command = 'chat', apiKey, context = '', messages = [] }) {
    const headers = { 'Content-Type': 'application/json' };
    // Allow Google Drive bearer tokens via Authorization header instead of apiKey
    if (provider === 'google_drive' && apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const body = {
      prompt,
      provider,
      command,
      context,
      ...(provider === 'google_drive' ? {} : { apiKey }),
      ...(Array.isArray(messages) && messages.length ? { messages } : {})
    };

    const res = await fetch(`${this.baseUrl}/api/command`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP Server error (${res.status}): ${text}`);
    }
    return res.json();
  }

  async executeWorkflow({ workflow, context = '' }) {
    return this.runWorkflow(workflow, context);
  }

  /**
   * POST a workflow array, returns { jobId, eta }
   */
  async runWorkflow(workflow, context = '') {
    if (!Array.isArray(workflow) || workflow.length === 0) {
      throw new Error('`workflow` must be a non-empty array');
    }
    const res = await fetch(`${this.baseUrl}/api/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow, context }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP Server error (${res.status}): ${text}`);
    }
    return res.json(); // { jobId, eta }
  }

  /**
   * Fetch single job state.
   */
  async getJob(jobId) {
    const res = await fetch(`${this.baseUrl}/api/job/${jobId}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Job fetch error (${res.status}): ${text}`);
    }
    return res.json();
  }

  /**
   * Poll job until done; onUpdate receives current job object on each poll.
   */
  async pollJob(jobId, { interval = 1000, maxInterval = 5000, onUpdate } = {}) {
    let currentInterval = interval;
    return new Promise((resolve, reject) => {
      const tick = async () => {
        try {
          const job = await this.getJob(jobId);
          if (typeof onUpdate === 'function') onUpdate(job);
          if (job.done) return resolve(job);
          currentInterval = Math.min(maxInterval, currentInterval * 1.4);
          setTimeout(tick, currentInterval);
        } catch (err) {
          return reject(err);
        }
      };
      tick();
    });
  }
}

// Default instance using env or localhost
const defaultService = new MCPServerService(import.meta?.env?.VITE_MCP_BASE_URL || 'http://localhost:3001');
export default defaultService; 