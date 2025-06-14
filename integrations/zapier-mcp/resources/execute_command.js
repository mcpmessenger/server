const executeCommand = {
  key: 'execute_command',
  noun: 'Command',
  display: {
    label: 'Execute Command',
    description: 'Execute a single MCP command'
  },
  operation: {
    inputFields: [
      { key: 'provider', required: true, type: 'string', helpText: 'Provider id, e.g. openai' },
      { key: 'command', required: true, type: 'string', helpText: 'Command id, e.g. chat' },
      { key: 'prompt', required: true, type: 'text', helpText: 'Prompt or message' },
      { key: 'context', required: false, type: 'text', helpText: 'Optional contextual string' }
    ],
    perform: async (z, bundle) => {
      const body = {
        provider: bundle.inputData.provider,
        command: bundle.inputData.command,
        prompt: bundle.inputData.prompt,
        context: bundle.inputData.context,
        apiKey: bundle.authData.apiKey || undefined
      };
      const response = await z.request({
        url: `${bundle.authData.baseUrl}/api/command`,
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.json;
    },
    sample: {
      output: 'Hello from MCP',
      tokens_used: 42,
      model_version: 'gpt-3.5-turbo'
    }
  }
};

module.exports = executeCommand; 