import { useState } from 'react';
import { MCPRequest, MCPResponse } from '../types';

export const useMCPRequests = () => {
  const [requests, setRequests] = useState<MCPRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const executeCommand = async (
    prompt: string,
    provider: string,
    apiKey: string,
    command: string
  ): Promise<MCPResponse> => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const newRequest: MCPRequest = {
      id: requestId,
      prompt,
      provider,
      command,
      timestamp: new Date(),
      status: 'pending'
    };

    setRequests(prev => [newRequest, ...prev]);
    setLoading(true);

    try {
      // Call the backend /api/command endpoint
      const response = await fetch('http://localhost:3001/api/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, provider, command, apiKey }),
      });
      const data = await response.json();

      const realResponse: MCPResponse = {
        output: data.output,
        tokens_used: data.tokens_used,
        model_version: data.model_version,
        provider: data.provider,
        raw_response: data.raw_response,
      };

      // Update request with response
      setRequests(prev =>
        prev.map(req =>
          req.id === requestId
            ? {
                ...req,
                status: 'completed',
                response: realResponse.output,
                tokensUsed: realResponse.tokens_used,
                modelVersion: realResponse.model_version,
                duration: Math.floor(Math.random() * 2000) + 500
              }
            : req
        )
      );

      return realResponse;
    } catch (error) {
      setRequests(prev =>
        prev.map(req =>
          req.id === requestId
            ? { ...req, status: 'error', response: 'Request failed' }
            : req
        )
      );
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setRequests([]);
  };

  return {
    requests,
    loading,
    executeCommand,
    clearHistory
  };
};