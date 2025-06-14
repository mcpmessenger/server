const executeWorkflow = {
  key: 'execute_workflow',
  noun: 'Workflow',
  display: {
    label: 'Execute Workflow',
    description: 'Execute an MCP workflow'
  },
  operation: {
    inputFields: [
      { key: 'workflow', required: true, type: 'text', helpText: 'JSON array of workflow steps' },
      { key: 'context', required: false, type: 'text', helpText: 'Optional context string' }
    ],
    perform: async (z, bundle) => {
      let workflowArray;
      try {
        workflowArray = JSON.parse(bundle.inputData.workflow);
      } catch (e) {
        throw new z.errors.Error('Workflow must be valid JSON array');
      }
      const body = {
        workflow: workflowArray,
        context: bundle.inputData.context,
        // apiKey intentionally not in body; rely on server verifying user-level restrictions
      };
      const response = await z.request({
        url: `${bundle.authData.baseUrl}/api/workflow`,
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json;
    },
    sample: {
      results: [
        {
          output: 'First result',
          provider: 'openai',
          command: 'summarize'
        }
      ]
    }
  }
};

module.exports = executeWorkflow; 