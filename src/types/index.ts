export interface Provider {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  color: string;
  icon: string;
  apiKey?: string;
  lastUsed?: Date;
  requestCount?: number;
}

export interface Command {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: 'chat' | 'generation' | 'analysis' | 'other';
}

export interface MCPRequest {
  id: string;
  prompt: string;
  provider: string;
  command: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'error';
  response?: string;
  tokensUsed?: number;
  modelVersion?: string;
  duration?: number;
}

export interface MCPResponse {
  output: string;
  tokens_used: number;
  model_version: string;
  provider: string;
  raw_response?: any;
}