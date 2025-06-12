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
    id: 'github',
    name: 'GitHub',
    status: 'disconnected',
    color: 'from-gray-700 to-black',
    icon: 'Bot',
    requestCount: 0
  }
];

export const useProviders = () => {
  const [providers, setProviders] = useState<Provider[]>(() => {
    // Load providers from localStorage
    const saved = localStorage.getItem('mcp-providers');
    let loaded = defaultProviders;
    if (saved) {
      try {
        loaded = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load providers:', error);
      }
    }
    // Load GitHub token from localStorage if present
    const githubToken = localStorage.getItem('githubToken') || '';
    loaded = loaded.map(p =>
      p.id === 'github' ? { ...p, apiKey: githubToken, status: githubToken ? 'connected' : 'disconnected' } : p
    );
    return loaded;
  });

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
    if (providerId === 'github') {
      if (apiKey) {
        localStorage.setItem('githubToken', apiKey);
      } else {
        localStorage.removeItem('githubToken');
      }
    }
  };

  return {
    providers,
    updateProvider,
    setApiKey
  };
};