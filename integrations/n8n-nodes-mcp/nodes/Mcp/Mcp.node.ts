import { IExecuteFunctions } from 'n8n-core';
import {
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import fetch from 'node-fetch';

interface McpCredentials {
  baseUrl: string;
  apiKey?: string;
}

export class Mcp implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'MCP',
    name: 'mcp',
    icon: 'file:mcp.svg',
    group: ['transform'],
    version: 1,
    description: 'Interact with MCP Server',
    defaults: {
      name: 'MCP',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'mcpApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        options: [
          {
            name: 'Command',
            value: 'command',
          },
          {
            name: 'Workflow',
            value: 'workflow',
          },
        ],
        default: 'command',
      },
      {
        displayName: 'Provider',
        name: 'provider',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['command'],
          },
        },
      },
      {
        displayName: 'Command',
        name: 'command',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['command'],
          },
        },
      },
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        typeOptions: {
          rows: 5,
        },
        default: '',
        displayOptions: {
          show: {
            resource: ['command'],
          },
        },
      },
      {
        displayName: 'Workflow JSON',
        name: 'workflowJson',
        type: 'string',
        typeOptions: {
          rows: 10,
        },
        default: '[]',
        displayOptions: {
          show: {
            resource: ['workflow'],
          },
        },
      },
      {
        displayName: 'Context',
        name: 'context',
        type: 'string',
        default: '',
        required: false,
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        default: {},
        placeholder: 'Add Field',
        options: [
          {
            displayName: 'Return Raw Response',
            name: 'rawResponse',
            type: 'boolean',
            default: false,
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = (await this.getCredentials('mcpApi')) as McpCredentials;

    for (let i = 0; i < items.length; i++) {
      const resource = this.getNodeParameter('resource', i) as string;
      const context = this.getNodeParameter('context', i, '') as string;
      const rawResponse = this.getNodeParameter('additionalFields.rawResponse', i, false) as boolean;

      let responseData: any;

      if (resource === 'command') {
        const provider = this.getNodeParameter('provider', i) as string;
        const command = this.getNodeParameter('command', i) as string;
        const prompt = this.getNodeParameter('prompt', i) as string;

        const body: Record<string, any> = {
          provider,
          command,
          prompt,
          context,
        };

        if (credentials.apiKey) {
          body.apiKey = credentials.apiKey;
        }

        responseData = await fetch(`${credentials.baseUrl}/api/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }).then(async (res) => res.json());
      } else if (resource === 'workflow') {
        const workflowJson = this.getNodeParameter('workflowJson', i) as string;
        let workflow;
        try {
          workflow = JSON.parse(workflowJson);
        } catch (error) {
          throw new Error('Invalid JSON in "Workflow JSON" field');
        }

        const body = {
          workflow,
          context,
        };

        responseData = await fetch(`${credentials.baseUrl}/api/workflow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }).then(async (res) => res.json());
      }

      if (rawResponse) {
        returnData.push({ json: responseData });
      } else {
        returnData.push({
          json: {
            data: responseData.output ?? responseData.results ?? responseData,
          },
        });
      }
    }

    return [returnData];
  }
} 