const pingTrigger = {
  key: 'ping',
  noun: 'Ping',
  display: {
    label: 'New Ping',
    description: 'Checks if the MCP server is reachable.'
  },
  operation: {
    type: 'polling',
    canPaginate: false,
    perform: async (z, bundle) => {
      const url = `${bundle.authData.baseUrl}/api/command`;
      const body = {
        provider: 'openai',
        command: 'chat',
        prompt: 'Ping',
        apiKey: bundle.authData.apiKey || undefined
      };
      const response = await z.request({
        url,
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      });
      // Return single result with timestamp
      return [{ id: Date.now(), ok: response.status === 200 }];
    },
    sample: { id: 1, ok: true }
  }
};

module.exports = pingTrigger; 