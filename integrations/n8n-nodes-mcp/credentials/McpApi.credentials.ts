import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class McpApi implements ICredentialType {
  name = 'mcpApi';
  displayName = 'MCP API';
  documentationUrl = 'https://github.com/your-org/n8n-nodes-mcp#readme';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:3000',
      placeholder: 'https://your-mcp-server.com',
      required: true,
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      default: '',
      required: false,
    },
  ];
} 