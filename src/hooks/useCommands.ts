import { useState, useEffect } from 'react';
import { Command } from '../types';

const mockCommands: Command[] = [
  {
    id: 'chat',
    name: 'Chat',
    description: 'Interactive conversation with the AI model',
    provider: 'all',
    category: 'chat'
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Create concise summaries of text content',
    provider: 'all',
    category: 'analysis'
  },
  {
    id: 'generate-code',
    name: 'Generate Code',
    description: 'Generate code snippets and functions',
    provider: 'all',
    category: 'generation'
  },
  {
    id: 'explain',
    name: 'Explain',
    description: 'Provide detailed explanations of concepts',
    provider: 'all',
    category: 'analysis'
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text between languages',
    provider: 'all',
    category: 'other'
  }
];

export const useCommands = () => {
  const [commands, setCommands] = useState<Command[]>(mockCommands);
  const [loading, setLoading] = useState(false);

  const fetchCommands = async (provider?: string) => {
    setLoading(true);
    try {
      // In a real implementation, this would call the /commands endpoint
      // const response = await fetch('/api/commands', {
      //   headers: { 'Authorization': `Bearer ${apiKey}` }
      // });
      // const data = await response.json();
      
      // For now, return mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      setCommands(mockCommands);
    } catch (error) {
      console.error('Failed to fetch commands:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, []);

  return {
    commands,
    loading,
    fetchCommands
  };
};