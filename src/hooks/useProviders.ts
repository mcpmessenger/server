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
    id: 'zapier',
    name: 'Zapier AI',
    status: 'disconnected',
    color: 'from-yellow-400 to-red-500',
    icon: 'Zap',
    requestCount: 0
  },
  {
    id: 'github',
    name: 'GitHub',
    status: 'disconnected',
    color: 'from-gray-700 to-black',
    icon: 'Bot',
    requestCount: 0
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    status: 'disconnected',
    color: 'from-green-400 to-blue-500',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'gmail',
    name: 'Gmail',
    status: 'disconnected',
    color: 'from-red-500 to-orange-500',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'n8n',
    name: 'n8n',
    status: 'disconnected',
    color: 'from-red-500 to-orange-600',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'make',
    name: 'Make.com',
    status: 'disconnected',
    color: 'from-purple-500 to-pink-600',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'figma',
    name: 'Figma',
    status: 'disconnected',
    color: 'from-pink-500 to-red-500',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'slack',
    name: 'Slack',
    status: 'disconnected',
    color: 'from-purple-600 to-green-400',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'chroma',
    name: 'Chroma',
    status: 'disconnected',
    color: 'from-teal-500 to-emerald-600',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'jupyter',
    name: 'Jupyter',
    status: 'disconnected',
    color: 'from-yellow-500 to-orange-600',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'cursor',
    name: 'Cursor',
    status: 'disconnected',
    color: 'from-emerald-500 to-teal-600',
    icon: 'Bot',
    requestCount: 0
  },
  {
    id: '21st_dev',
    name: '21st DEV',
    status: 'disconnected',
    color: 'from-purple-500 to-indigo-600',
    icon: 'Sparkles',
    requestCount: 0
  },
  {
    id: 'loveable',
    name: 'Loveable',
    status: 'disconnected',
    color: 'from-pink-500 to-red-400',
    icon: 'Heart',
    requestCount: 0
  },
  {
    id: 'bolt',
    name: 'Bolt',
    status: 'disconnected',
    color: 'from-amber-400 to-yellow-500',
    icon: 'Zap',
    requestCount: 0
  }
];

export const useProviders = () => {
  const [providers, setProviders] = useState<Provider[]>(() => {
    // Load providers from localStorage
    const saved = localStorage.getItem('mcp-providers');
    let merged = defaultProviders;
    if (saved) {
      try {
        const savedArr: Provider[] = JSON.parse(saved);
        // Merge by id: keep any custom fields from saved (apiKey, requestCount, etc.)
        merged = defaultProviders.map(def => {
          const match = savedArr.find(s => s.id === def.id);
          return match ? { ...def, ...match } : def;
        });
      } catch (error) {
        console.error('Failed to parse saved providers:', error);
      }
    }
    // Load GitHub token from localStorage if present
    const githubToken = localStorage.getItem('githubToken') || '';
    merged = merged.map(p =>
      p.id === 'github' ? { ...p, apiKey: githubToken, status: githubToken ? 'connected' : 'disconnected' } : p
    );
    // Persist back (drops unknown providers)
    localStorage.setItem('mcp-providers', JSON.stringify(merged));
    return merged;
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
    const status = apiKey ? 'pending' : 'disconnected';
    updateProvider(providerId, { apiKey, status });
    if (providerId === 'github') {
      if (apiKey) {
        localStorage.setItem('githubToken', apiKey);
      } else {
        localStorage.removeItem('githubToken');
      }
    }
  };

  const setStatus = (providerId: string, status: Provider['status']) => {
    updateProvider(providerId, { status });
  };

  return {
    providers,
    updateProvider,
    setApiKey,
    setStatus
  };
};