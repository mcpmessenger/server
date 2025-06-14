import { Mcp } from './nodes/Mcp/Mcp.node';
import { McpApi } from './credentials/McpApi.credentials';

export const version = 1;

export const nodes = [
  Mcp,
];

export const credentials = [
  McpApi,
]; 