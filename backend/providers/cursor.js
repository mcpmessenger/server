const cursorProvider = {
  id: 'cursor',
  name: 'Cursor',
  supportedCommands: ['chat', 'summarize', 'generate-code', 'explain', 'translate'],

  /**
   * Execute a command against the Cursor AI Assistant.
   * This is a scaffold implementation – real API calls still need to be added.
   */
  async executeCommand({ prompt = '', command = 'chat', context = '', apiKey }) {
    // TODO: Wire up the actual Cursor MCP endpoint once available.
    // For now, simply return a placeholder response so that the
    // rest of the backend can recognise the provider.
    return {
      output: `Cursor provider is not yet implemented. Received command: ${command}`,
      provider: 'cursor',
      command,
      context,
      raw_response: null,
    };
  },

  /**
   * Optional: list resources that Cursor can expose (e.g. projects).
   * Currently returns an empty array until implemented.
   */
  async listResources(/* params */) {
    // TODO: Implement resource discovery, if Cursor exposes any.
    return [];
  },
};

export default cursorProvider; 