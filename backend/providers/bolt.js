const boltProvider = {
  id: 'bolt',
  name: 'Bolt',
  supportedCommands: ['web-search', 'figma-action', 'custom-tool'],

  /**
   * Execute BoltAI commands.
   * This scaffold returns a placeholder until the Bolt MCP API details are finalised.
   */
  async executeCommand({ prompt = '', command = '', context = '', apiKey }) {
    // TODO: Implement BoltAI MCP integration.
    return {
      output: `Bolt provider not yet implemented (command: ${command}).`,
      provider: 'bolt',
      command,
      context,
      raw_response: null,
    };
  },

  async listResources() {
    // Bolt may expose projects, boards, etc. Provide list when API is available.
    return [];
  },
};

export default boltProvider; 