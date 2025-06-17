const loveableProvider = {
  id: 'loveable',
  name: 'Loveable',
  supportedCommands: ['create-project', 'manage-database', 'deploy'],

  /**
   * Executes Loveable-related commands interacting with Supabase projects.
   * To be implemented once Loveable MCP endpoints are confirmed.
   */
  async executeCommand({ prompt = '', command = '', context = '', apiKey }) {
    // TODO: Implement real Loveable API calls.
    return {
      output: `Loveable provider stub – command: ${command || 'N/A'} not yet supported.`,
      provider: 'loveable',
      command,
      context,
      raw_response: null,
    };
  },

  /**
   * List Supabase projects or resources via Loveable.
   * Currently returns empty list.
   */
  async listResources() {
    return [];
  },
};

export default loveableProvider; 