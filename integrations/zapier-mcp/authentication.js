const authentication = {
  type: 'custom',
  test: {
    url: '{{bundle.inputData.baseUrl}}/api/command',
    method: 'POST',
    body: {
      provider: 'openai',
      command: 'chat',
      prompt: 'Ping from Zapier auth test',
      apiKey: '{{bundle.authData.apiKey}}'
    },
    headers: {
      'Content-Type': 'application/json'
    }
  },
  fields: [
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'string',
      required: true,
      helpText: 'Root URL of your MCP Server.'
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'string',
      required: false,
      helpText: 'Optional API key if your server requires it.'
    }
  ],
  connectionLabel: '{{bundle.inputData.baseUrl}}'
};

module.exports = authentication; 