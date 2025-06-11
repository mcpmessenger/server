import { useState, useEffect } from 'react';
import { Provider } from '../types';

const defaultProviders: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'disconnected',
    color: 'from-green-500 to-emerald-600',
    icon: 'Bot',
    requestCount: 0
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    status: 'disconnected',
    color: 'from-orange-500 to-red-500',
    icon: 'Zap',
    requestCount: 0
  },
  {
    id: 'gemini',
    name: 'Gemini',
    status: 'disconnected',
    color: 'from-blue-500 to-purple-600',
    icon: 'Sparkles',
    requestCount: 0
  },
  {
    id: 'cohere',
    name: 'Cohere',
    status: 'disconnected',
    color: 'from-yellow-500 to-orange-600',
    icon: 'Zap',
    requestCount: 0
  },
  {
    id: 'mistral',
    name: 'Mistral',
    status: 'disconnected',
    color: 'from-indigo-500 to-blue-700',
    icon: 'Sparkles',
    requestCount: 0
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    status: 'disconnected',
    color: 'from-pink-500 to-purple-600',
    icon: 'Bot',
    requestCount: 0
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    status: 'disconnected',
    color: 'from-blue-400 to-cyan-600',
    icon: 'Bot',
    requestCount: 0
  }
];

export const useProviders = () => {
  const [providers, setProviders] = useState<Provider[]>(defaultProviders);

  useEffect(() => {
    // Load providers from localStorage
    const saved = localStorage.getItem('mcp-providers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProviders(parsed);
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    }
  }, []);

  const updateProvider = (id: string, updates: Partial<Provider>) => {
    setProviders(prev => {
      const updated = prev.map(p => 
        p.id === id ? { ...p, ...updates } : p
      );
      localStorage.setItem('mcp-providers', JSON.stringify(updated));
      return updated;
    });
  };

  const setApiKey = (providerId: string, apiKey: string) => {
    const status = apiKey ? 'connected' : 'disconnected';
    updateProvider(providerId, { apiKey, status });
  };

  return {
    providers,
    updateProvider,
    setApiKey
  };
};