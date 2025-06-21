import { useState, useEffect } from 'react';
import { Provider } from '../types';
import { supabase } from '../services/supabaseClient';

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
    id: 'bolt',
    name: 'Bolt',
    status: 'disconnected',
    color: 'from-amber-400 to-yellow-500',
    icon: 'Zap',
    requestCount: 0
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    status: 'disconnected',
    color: 'from-green-400 to-blue-500',
    icon: 'Globe',
    requestCount: 0
  },
  {
    id: 'slack',
    name: 'Slack',
    status: 'disconnected',
    color: 'from-gray-700 to-black',
    icon: 'Bot',
    requestCount: 0
  }
];

export const useProviders = () => {
  const [providers, setProviders] = useState<Provider[]>(defaultProviders);

  const updateProvider = (id: string, updates: Partial<Provider>) => {
    setProviders(prev => {
      const updated = prev.map(p => 
        p.id === id ? { ...p, ...updates } : p
      );
      return updated;
    });
  };

  const setApiKey = async (providerId: string, apiKey: string) => {
    // Optimistic UI update
    updateProvider(providerId, { apiKey, status: apiKey ? 'pending' : 'disconnected' });

    try {
      // Persist to backend so all devices get Realtime event
      if (providerId === 'github' || providerId === 'slack') {
        // Dedicated endpoint handles encryption server-side
        const endpoint = providerId === 'github' ? '/api/user/github-token' : '/api/user/slack-token';
        if (apiKey) {
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: apiKey })
          });
        } else {
          await fetch(endpoint, { method: 'DELETE' });
        }
      } else {
        // Generic credentials endpoint (stores plaintext as-is; server may encrypt)
        const method = apiKey ? 'POST' : 'DELETE';
        const body = apiKey ? JSON.stringify({ credentials: { apiKey } }) : undefined;
        await fetch(`/api/credentials/${providerId}`, {
          method,
          headers: apiKey ? { 'Content-Type': 'application/json' } : undefined,
          body
        });
      }
    } catch (err) {
      console.error('Failed to save credentials', err);
      updateProvider(providerId, { status: 'error' });
    }
  };

  const setStatus = (providerId: string, status: Provider['status']) => {
    updateProvider(providerId, { status });
  };

  // On mount: fetch stored credentials for providers that rely on backend storage (e.g., GitHub)
  useEffect(() => {
    const fetchInitialCreds = async () => {
      try {
        const res = await fetch('/api/user/github-token');
        const data = await res.json();
        if (data.token) {
          updateProvider('github', { apiKey: data.token, status: 'connected' });
        }
      } catch (err) {
        console.warn('No GitHub token');
      }

      try {
        const res = await fetch('/api/user/slack-token');
        const data = await res.json();
        if (data.token) {
          updateProvider('slack', { apiKey: data.token, status: 'connected' });
        }
      } catch (err) {
        console.warn('No Slack token');
      }

      // Generic loop for any other providers that may have stored apiKey
      const others = defaultProviders
        .map(p => p.id)
        .filter(id => id !== 'github' && id !== 'slack');
      for (const pid of others) {
        try {
          const res = await fetch(`/api/credentials/${pid}`);
          const data = await res.json();
          if (data.credentials && data.credentials.apiKey) {
            updateProvider(pid, { apiKey: data.credentials.apiKey, status: 'connected' });
          }
        } catch {
          /* ignore */
        }
      }
    };
    fetchInitialCreds();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel('mcp-credentials')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_integration_accounts' },
        async (payload: any) => {
          const providerId = payload.new?.provider || payload.old?.provider;
          if (!providerId) return;
          try {
            const res = await fetch(`/api/${providerId}/status`);
            const json = await res.json();
            if (!json) return;
            const status: Provider['status'] = json.connected ? 'connected' : 'disconnected';
            const updates: Partial<Provider> = { status };
            if (providerId === 'github' && status === 'connected') {
              // fetch token so this tab has plaintext for future requests
              try {
                const tokRes = await fetch('/api/user/github-token');
                const tokData = await tokRes.json();
                if (tokData.token) updates.apiKey = tokData.token;
              } catch {}
            }
            if (providerId === 'slack' && status === 'connected') {
              try {
                const tokRes = await fetch('/api/user/slack-token');
                const tokData = await tokRes.json();
                if (tokData.token) updates.apiKey = tokData.token;
              } catch {}
            }
            if (!updates.apiKey && status === 'connected') {
              try {
                const credRes = await fetch(`/api/credentials/${providerId}`);
                const credJson = await credRes.json();
                if (credJson.credentials && credJson.credentials.apiKey) {
                  updates.apiKey = credJson.credentials.apiKey;
                }
              } catch {}
            }
            updateProvider(providerId, updates);
          } catch (err) {
            console.error('Realtime status fetch failed', err);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [updateProvider]);

  return {
    providers,
    updateProvider,
    setApiKey,
    setStatus
  };
};