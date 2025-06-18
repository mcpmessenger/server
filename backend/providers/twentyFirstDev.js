const twentyFirstDevProvider = {
  id: '21st_dev',
  name: '21st DEV',
  supportedCommands: ['generate-ui-component'],

  /**
   * Execute a command against 21st DEV Magic MCP service.
   * Placeholder implementation – will be replaced with real API integration.
   */
  async executeCommand({ prompt = '', command = 'generate-ui-component', context = '', apiKey }) {
    // TODO: Call the 21st DEV / Magic MCP endpoint with the provided parameters.
    return {
      output: '21st DEV integration not implemented yet. Stay tuned!',
      provider: '21st_dev',
      command,
      context,
      raw_response: null,
    };
  },

  /**
   * 21st DEV currently does not expose resource listing; return empty list.
   */
  async listResources() {
    return [];
  },
};

export default twentyFirstDevProvider; 