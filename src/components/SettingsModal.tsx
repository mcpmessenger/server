import React, { useEffect, useState } from 'react';
import { ProviderCard } from './ProviderCard';
import { Provider } from '../types';
import { Bot, Zap, Sparkles, Github, Globe, Link, Key, Webhook } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  providers: Provider[];
  onSetApiKey: (providerId: string, apiKey: string) => void;
  onShowCommands: () => void;
}

// Example help links for each provider
const HELP_LINKS: { [key: string]: string } = {
  openai: 'https://platform.openai.com/account/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://console.cloud.google.com/apis/credentials',
  github: 'https://github.com/settings/tokens',
  zapier: 'https://platform.zapier.com/docs/triggers/#webhooks',
  n8n: 'https://docs.n8n.io/integrations/builtin/webhook/',
  cohere: 'https://dashboard.cohere.com/api-keys',
  mistral: 'https://docs.mistral.ai/platform/api-keys/',
  perplexity: 'https://www.perplexity.ai/settings/api',
  'azure-openai': 'https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/create-resource?pivots=web-portal',
};

const initialTempKeys = (providers: Provider[]) => Object.fromEntries(providers.map(p => [p.id, p.apiKey || '']));

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, providers, onSetApiKey, onShowCommands }) => {
  const [githubConnected, setGithubConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [zapierUrl, setZapierUrl] = useState('');
  const [zapierSecret, setZapierSecret] = useState('');
  const [n8nUrl, setN8nUrl] = useState('');
  const [n8nSecret, setN8nSecret] = useState('');
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [tempKeys, setTempKeys] = useState<{ [id: string]: string }>(() => initialTempKeys(providers));
  const [keyStatus, setKeyStatus] = useState<{ [id: string]: 'connected' | 'disconnected' | 'error' }>({});
  const [keyError, setKeyError] = useState<{ [id: string]: string }>({});

  const fetchStatuses = () => {
    fetch('http://localhost:3001/api/github/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setGithubConnected(!!data.connected))
      .catch(() => setGithubConnected(false));
    fetch('http://localhost:3001/api/google/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setGoogleConnected(!!data.connected))
      .catch(() => setGoogleConnected(false));
  };

  useEffect(() => {
    if (open) {
      fetch('/api/user/webhooks', { credentials: 'include' })
        .then(async res => {
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })
        .then(data => {
          setZapierUrl(data.zapierUrl || '');
          setZapierSecret(data.zapierSecret || '');
          setN8nUrl(data.n8nUrl || '');
          setN8nSecret(data.n8nSecret || '');
          setWebhookError(null);
        })
        .catch(err => {
          setWebhookError('Could not load webhook settings. Please sign in.');
        });
    }
    setTempKeys(initialTempKeys(providers));
    setKeyStatus(Object.fromEntries(providers.map(p => [p.id, p.apiKey ? p.status : 'disconnected'])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providers]);

  const handleGitHubConnect = () => {
    window.open('http://localhost:3001/auth/github', '_blank');
    setTimeout(fetchStatuses, 2000);
  };
  const handleGoogleConnect = () => {
    window.open('http://localhost:3001/auth/google', '_blank');
    setTimeout(fetchStatuses, 2000);
  };
  const handleGitHubDisconnect = async () => {
    await fetch('http://localhost:3001/api/github/disconnect', { credentials: 'include', method: 'POST' });
    fetchStatuses();
  };
  const handleGoogleDisconnect = async () => {
    await fetch('http://localhost:3001/api/google/disconnect', { credentials: 'include', method: 'POST' });
    fetchStatuses();
  };

  const onSaveZapier = (url: string, secret: string) => {
    fetch('/api/user/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        zapierUrl: url,
        zapierSecret: secret,
        n8nUrl,
        n8nSecret
      })
    })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text());
        setWebhookError(null);
      })
      .catch(err => {
        setWebhookError('Failed to save Zapier settings.');
      });
    setZapierUrl(url);
    setZapierSecret(secret);
  };
  const onSaveN8n = (url: string, secret: string) => {
    fetch('/api/user/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        zapierUrl,
        zapierSecret,
        n8nUrl: url,
        n8nSecret: secret
      })
    })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text());
        setWebhookError(null);
      })
      .catch(err => {
        setWebhookError('Failed to save n8n settings.');
      });
    setN8nUrl(url);
    setN8nSecret(secret);
  };

  // Simulate backend validation (replace with real API call if available)
  const validateApiKey = async (providerId: string, apiKey: string) => {
    if (!apiKey) return 'disconnected';
    // TODO: Replace with real backend validation
    if (apiKey.length < 10) return 'error';
    return 'connected';
  };

  const handleSaveKey = async (providerId: string) => {
    const apiKey = tempKeys[providerId];
    const status = await validateApiKey(providerId, apiKey);
    setKeyStatus(s => ({ ...s, [providerId]: status }));
    if (status === 'connected') {
      setKeyError(e => ({ ...e, [providerId]: '' }));
      onSetApiKey(providerId, apiKey);
    } else {
      setKeyError(e => ({ ...e, [providerId]: 'Invalid API key.' }));
    }
  };

  const handleDeleteKey = (providerId: string) => {
    setTempKeys(k => ({ ...k, [providerId]: '' }));
    setKeyStatus(s => ({ ...s, [providerId]: 'disconnected' }));
    setKeyError(e => ({ ...e, [providerId]: '' }));
    onSetApiKey(providerId, '');
  };

  if (!open) return null;
  // Unified settings items: providers + integrations
  const integrationItems = [
    {
      id: 'github',
      name: 'GitHub',
      icon: <Github className="w-6 h-6 text-white" />,
      color: 'from-gray-700 to-black',
      status: githubConnected ? 'connected' : 'disconnected',
      action: (
        <div className="flex flex-col gap-2">
          {githubConnected ? (
            <div className="flex gap-2">
              <button onClick={handleGitHubConnect} className="bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900">Reconnect</button>
              <button onClick={handleGitHubDisconnect} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs">Disconnect</button>
            </div>
          ) : (
            <button onClick={handleGitHubConnect} className="bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900">Connect</button>
          )}
          <a href="https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to connect GitHub?</a>
        </div>
      )
    },
    {
      id: 'google',
      name: 'Google',
      icon: <Globe className="w-6 h-6 text-white" />,
      color: 'from-green-400 to-blue-500',
      status: googleConnected ? 'connected' : 'disconnected',
      action: (
        <div className="flex flex-col gap-2">
          {googleConnected ? (
            <div className="flex gap-2">
              <button onClick={handleGoogleConnect} className="bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900">Reconnect</button>
              <button onClick={handleGoogleDisconnect} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs">Disconnect</button>
            </div>
          ) : (
            <button onClick={handleGoogleConnect} className="bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900">Connect</button>
          )}
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to connect Google?</a>
        </div>
      )
    },
    {
      id: 'zapier',
      name: 'Zapier',
      icon: <Zap className="w-6 h-6 text-white" />,
      color: 'from-yellow-400 to-orange-500',
      status: zapierUrl ? 'connected' : 'disconnected',
      action: (
        <div className="flex flex-col gap-2 w-full">
          <input type="url" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="Zapier Webhook URL" value={zapierUrl || ''} onChange={e => setZapierUrl(e.target.value)} />
          <input type="text" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="Zapier Secret (optional)" value={zapierSecret || ''} onChange={e => setZapierSecret(e.target.value)} />
          <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm w-fit" onClick={() => onSaveZapier(zapierUrl, zapierSecret)} type="button">Save Zapier Settings</button>
          <a href="https://platform.zapier.com/docs/triggers/#webhooks" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to set up a Zapier webhook?</a>
        </div>
      )
    },
    {
      id: 'n8n',
      name: 'n8n',
      icon: <Webhook className="w-6 h-6 text-white" />,
      color: 'from-pink-500 to-purple-700',
      status: n8nUrl ? 'connected' : 'disconnected',
      action: (
        <div className="flex flex-col gap-2 w-full">
          <input type="url" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="n8n Webhook URL" value={n8nUrl || ''} onChange={e => setN8nUrl(e.target.value)} />
          <input type="text" className="w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700" placeholder="n8n Secret (optional)" value={n8nSecret || ''} onChange={e => setN8nSecret(e.target.value)} />
          <button className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm w-fit" onClick={() => onSaveN8n(n8nUrl, n8nSecret)} type="button">Save n8n Settings</button>
          <a href="https://docs.n8n.io/integrations/builtin/webhook/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to set up an n8n webhook?</a>
        </div>
      )
    }
  ];
  // Map provider icon string to Lucide icon
  const iconMap = { Bot, Zap, Sparkles };
  // Unified list: providers + integrations
  const unifiedItems = [
    { section: 'AI Providers' },
    ...providers.map(p => ({
      id: p.id,
      name: p.name,
      icon: React.createElement(iconMap[p.icon as keyof typeof iconMap] || Bot, { className: 'w-6 h-6 text-white' }),
      color: p.color,
      status: keyStatus[p.id] || 'disconnected',
      action: (
        <div className="flex flex-col gap-2 w-full">
          <input
            type="password"
            className={`w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 ${keyError[p.id] ? 'border-red-500' : ''}`}
            placeholder="API Key"
            value={tempKeys[p.id] || ''}
            onChange={e => setTempKeys(k => ({ ...k, [p.id]: e.target.value }))}
          />
          {HELP_LINKS[p.id] && (
            <a href={HELP_LINKS[p.id]} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">How to get this?</a>
          )}
          {keyError[p.id] && <div className="text-red-500 text-xs">{keyError[p.id]}</div>}
          <div className="flex space-x-2 mt-1">
            <button
              className="flex-1 bg-neutral-800 text-white px-4 py-2 rounded-lg hover:bg-neutral-900 transition-colors text-sm"
              onClick={() => handleSaveKey(p.id)}
              type="button"
            >
              Save
            </button>
            <button
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
              onClick={() => handleDeleteKey(p.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      )
    })),
    { section: 'Integrations' },
    ...integrationItems
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-0 w-full max-w-2xl shadow-2xl relative flex flex-col h-[80vh]">
        <button onClick={onClose} className="absolute top-6 right-8 text-2xl text-gray-400 hover:text-gray-700 dark:hover:text-white z-20">✕</button>
        <h2 className="text-2xl font-bold px-10 pt-8 pb-4 border-b border-gray-200 dark:border-neutral-800">Settings</h2>
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="space-y-4">
            {unifiedItems.map((item, idx) =>
              'section' in item ? (
                <div key={item.section} className="pt-4 pb-2 text-xs uppercase tracking-widest text-gray-400 dark:text-gray-500 font-semibold">{item.section}</div>
              ) : (
                <div key={item.id} className="flex items-center gap-4 bg-white/80 dark:bg-neutral-900 dark:border-neutral-700 border border-gray-200 rounded-xl px-5 py-4 shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</span>
                      <span className={`text-xs capitalize ${item.status === 'connected' ? 'text-green-600' : 'text-gray-400'}`}>{item.status}</span>
                    </div>
                    <div className="mt-2">{item.action}</div>
                  </div>
                </div>
              )
            )}
            {webhookError && (
              <div className="text-red-500 text-sm mt-2">{webhookError}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 