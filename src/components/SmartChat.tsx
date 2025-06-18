import React, { useRef, useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
// @ts-ignore
import Fuse from 'fuse.js';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  attachmentName?: string;
  attachmentContent?: string; // base64 or text
}

interface SmartChatProps {
  inputValue?: string;
  setInputValue?: (val: string) => void;
  inputPlaceholder?: string;
  providers?: import('../types').Provider[];
}

function parseChainedCommands(input: string): string[] {
  return input
    // Split on punctuation or common conjunctions used to chain commands
    .split(/\b(?:then|and then|and)\b|[.;]/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function isGithubCommand(input: string): boolean {
  const lower = input.toLowerCase();
  // Match common GitHub intents: slash commands, repo keywords, issues/PRs.
  return (
    lower.startsWith('/github') ||
    /github.*repo/.test(lower) ||
    /repo.*github/.test(lower) ||
    /list.*repos?/.test(lower) ||
    /show.*repos?/.test(lower) ||
    /get.*repos?/.test(lower) ||
    /my.*repos?/.test(lower) ||
    /repositories?/.test(lower) ||
    /repo[- ]?summary/.test(lower) ||
    /code[- ]?search/.test(lower) ||
    /\bissue\b/.test(lower) ||
    /pull[- ]?request|\bpr\b/.test(lower)
  );
}

function parseIntent(input: string): { provider?: string; command?: string } {
  const msg = input.trim();
  let provider: string | undefined;
  let command: string | undefined;
  // --- GitHub ---
  if (
    /^\/github/i.test(msg) ||
    /github/i.test(msg) ||
    /(last|list|get|show|my)[-\s]+\d*\s*(?:github\s*)?repos?/i.test(msg) ||
    /repo[-\s]*summary/i.test(msg) ||
    /repositories/i.test(msg)
  ) {
    provider = 'github';
    if (/(last|list|get|show|my)[-\s]+\d*\s*(?:github\s*)?repos?/i.test(msg) || /list[-\s]?repos?/i.test(msg)) {
      command = 'list-repos';
    } else if (/get\s+issues?/i.test(msg)) {
      command = 'get-issues';
    } else if (/create\s+issue/i.test(msg)) {
      command = 'create-issue';
    } else if (/repo[-\s]*summary/i.test(msg)) {
      command = 'repo-summary';
    } else if (/code[-\s]?search/i.test(msg)) {
      command = 'code-search';
    } else if (/pull\s+request|\bpr\b/i.test(msg)) {
      command = 'generate-pr';
    } else if (/issue/i.test(msg)) {
      command = 'generate-issue';
    } else if (/^\/github\s*$/i.test(msg)) {
      command = 'list-repos';
    }
  }
  // Plain-language GitHub create issue / PR
  if (!provider && /(create|open)\s+issue/i.test(msg) && /[\w.-]+\/[\w.-]+/.test(msg)) {
    provider = 'github';
    command = 'generate-issue';
  }
  if (!provider && /(create|open|make)\s+(pull\s+request|pr)/i.test(msg) && /[\w.-]+\/[\w.-]+/.test(msg)) {
    provider = 'github';
    command = 'generate-pr';
  }
  // --- Gmail ---
  if (!provider && (/^\/gmail/i.test(msg) || /\bemail(s)?\b/i.test(msg))) {
    provider = 'gmail';
    if (/list|get\s+(last\s+\d+\s+)?emails?/i.test(msg)) {
      command = 'list-messages';
    } else if (/send\s+email/i.test(msg)) {
      command = 'send-email';
    }
  }
  // --- Google Drive ---
  if (!provider && (/^\/drive/i.test(msg) || /google\s+drive/i.test(msg))) {
    provider = 'google_drive';
    if (/list\s+files/i.test(msg) || /show\s+files/i.test(msg)) {
      command = 'list-files';
    }
  }
  // --- Zapier ---
  if (!provider && (/^\/zapier/i.test(msg) || /zapier/i.test(msg))) {
    provider = 'zapier';
    if (/list\s+zaps/i.test(msg)) {
      command = 'list-zaps';
    } else if (/trigger\s+zap/i.test(msg)) {
      command = 'trigger';
    }
  }
  // --- LLM Generic utility commands ---
  if (!provider && /(summarize|summary|summarise)/i.test(msg)) {
    provider = undefined; // keep whichever LLM user selected
    command = 'summarize';
  }
  return { provider, command };
}

const limits: Record<string, number> = {       // lines
  openai: 80,
  anthropic: 80,
  gemini: 120   // cheaper / larger window
};

export const SmartChat: React.FC<SmartChatProps & { minimized?: boolean; onRestore?: () => void; darkMode?: boolean }> = ({ inputValue, setInputValue, inputPlaceholder, providers, minimized, onRestore, darkMode }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [internalValue, setInternalValue] = useState('');
  const value = inputValue !== undefined ? inputValue : internalValue;
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(
    providers && providers.find(p => p.status === 'connected')?.id || ''
  );
  // Command history state
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<string>('');
  const [ticker, setTicker] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightIdx, setHighlightIdx] = useState<number>(-1);
  const [fuse, setFuse] = useState<Fuse<string> | null>(null);

  // Only show OpenAI, Anthropic, and Gemini in the provider dropdown
  const allowedAIProviders = ['openai', 'anthropic', 'gemini'];
  const aiProviders = (providers || []).filter(p => allowedAIProviders.includes(p.id));

  // Build dynamic suggestions when providers change
  useEffect(() => {
    async function loadSuggestions() {
      try {
        const resp = await fetch('http://localhost:3001/api/commands');
        const cmds: { id: string; providers?: string[] }[] = await resp.json();
        const connected = (providers || []).filter(p => p.status === 'connected');
        const list: string[] = [];
        cmds.forEach(c => {
          if (Array.isArray(c.providers) && c.providers.length > 0) {
            c.providers.forEach(pid => {
              if (connected.some(cp => cp.id === pid)) {
                list.push(`/${pid} ${c.id}`);
              }
            });
          } else {
            // generic LLM command
            list.push(c.id);
          }
        });
        const fuseInstance = new Fuse(list, { includeScore: true, threshold: 0.4 });
        setFuse(fuseInstance);
      } catch (err) {
        console.error('Failed to fetch commands', err);
      }
    }
    loadSuggestions();
  }, [providers]);

  useEffect(() => {
    const handler = (e: any) => setTicker(e.detail as string);
    window.addEventListener('mcp-run', handler);
    return () => window.removeEventListener('mcp-run', handler);
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!value.trim() && !attachment) return;
    setLoading(true);
    let attachmentContent = undefined;
    if (attachment) {
      const reader = new FileReader();
      attachmentContent = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(attachment);
      });
    }
    const userMsg: ChatMessage = {
      sender: 'user',
      text: value,
      attachmentName: attachment?.name,
      attachmentContent,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInternalValue('');
    setAttachment(null);
    setCommandHistory(prev => (prev.length === 0 || prev[prev.length - 1] !== value) ? [...prev, value] : prev);
    setHistoryIndex(null);

    // --- Split into chained commands ("then", "and then", ";", ".") ---
    const commandsArray = parseChainedCommands(value.trim());

    // If more than 1 command, we'll process sequentially and concatenate outputs
    const results: string[] = [];

    for (let step = 0; step < commandsArray.length; step++) {
      const cmdText = commandsArray[step];
      // Determine provider/command for this sub-command
      let { provider: intentProvider, command: intentCommand } = parseIntent(cmdText);
      let provider = intentProvider || selectedProvider;
      let command = intentCommand || 'chat';

      // Determine apiKey based on provider
      let apiKey = '';
      if (['openai','anthropic','gemini'].includes(provider)) {
        apiKey = aiProviders.find(p => p.id === provider)?.apiKey || '';
      } else if (provider === 'github') {
        apiKey = providers?.find(p => p.id === 'github')?.apiKey || '';
      } else if (provider === 'gmail') {
        apiKey = providers?.find(p => p.id === 'gmail')?.apiKey || '';
      }

      // Fallback: if chosen LLM has no key, pick the first AI provider that has one
      if (['openai','anthropic','gemini'].includes(provider) && !apiKey) {
        const firstWithKey = aiProviders.find(p => !!p.apiKey);
        if (firstWithKey) {
          provider = firstWithKey.id;
          apiKey = firstWithKey.apiKey || '';
        }
      }

      const isCommandProvider = ['github','gmail','google_drive','drive','zapier','n8n','make','slack','chroma','figma','jupyter'].includes(provider);
      let output = '';
      if (!isCommandProvider && apiKey.startsWith('github_pat_')) {
        // never send a GitHub PAT to an LLM
        apiKey = '';
      }

      if (isCommandProvider) {
        const payload: any = { prompt: cmdText, provider, command };
        if (apiKey) payload.apiKey = apiKey;
        const resp = await fetch('http://localhost:3001/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        });
        const data = await resp.json();
        // If the provider returns an object/array, pretty-print it so the user can actually read it
        const primary = data.output ?? data.response;
        if (typeof primary === 'string' && primary.trim()) {
          output = primary;
        } else if (primary !== undefined) {
          output = JSON.stringify(primary, null, 2);
        } else if (data.error) {
          output = `Error: ${data.error}`;
        } else {
          // Fallback to the full response if neither output nor response exists or they are empty
          output = JSON.stringify(data, null, 2);
        }
      } else {
        // send to /api/chat (LLM providers)
        const fd = new FormData();
        const maxLines = limits[provider] ?? 50;
        const priorContext = results.join('\n');
        const combinedPrompt = priorContext ? priorContext + "\n" + cmdText : cmdText;
        fd.append('message', combinedPrompt);
        fd.append('provider', provider);
        fd.append('command', command);
        // We can send partial history (only previous outputs) if desired; for now empty
        fd.append('history', JSON.stringify([]));
        if (attachmentContent) fd.append('attachment', new Blob([attachmentContent], { type: 'text/plain' }));
        if (apiKey) fd.append('apiKey', apiKey);
        const res = await fetch('http://localhost:3001/api/chat', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const data = await res.json();
        const primary2 = data.response ?? data.output;
        if (typeof primary2 === 'string' && primary2.trim()) {
          output = primary2;
        } else if (primary2 !== undefined) {
          output = JSON.stringify(primary2, null, 2);
        } else if (data.error) {
          output = `Error: ${data.error}`;
        } else {
          // Fallback to the full response if neither output nor response exists or they are empty
          output = JSON.stringify(data, null, 2);
        }
      }
      results.push(output);
    }

    const finalText = results.join('\n---\n');
    setMessages(prev => [...prev, { sender: 'ai', text: finalText }]);
    setLoading(false);
    return;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (setInputValue) {
      setInputValue(e.target.value);
    } else {
      setInternalValue(e.target.value);
    }
    const text = e.target.value;
    if (fuse && (text.startsWith('/') || text.length >= 2)) {
      const results = fuse.search(text, { limit: 7 }) as Fuse.FuseResult<string>[];
      setSuggestions(results.map((r) => r.item));
    } else {
      setSuggestions([]);
    }
    setHistoryIndex(null); // Reset history navigation on manual change
  };

  // Handle up/down arrow for command history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If suggestions visible, handle arrow navigation first
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx(idx => (idx + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx(idx => (idx <= 0 ? suggestions.length - 1 : idx - 1));
        return;
      }
      if (e.key === 'Enter' && highlightIdx >= 0) {
        e.preventDefault();
        const chosen = suggestions[highlightIdx];
        if (setInputValue) setInputValue(chosen); else setInternalValue(chosen);
        setSuggestions([]);
        return;
      }
    }
    if (commandHistory.length === 0) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistoryIndex(prev => {
        const newIndex = prev === null ? commandHistory.length - 1 : Math.max(0, prev - 1);
        const cmd = commandHistory[newIndex] || '';
        if (setInputValue) setInputValue(cmd); else setInternalValue(cmd);
        return newIndex;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistoryIndex(prev => {
        if (prev === null) return null;
        const newIndex = prev + 1;
        if (newIndex >= commandHistory.length) {
          if (setInputValue) setInputValue(''); else setInternalValue('');
          return null;
        }
        const cmd = commandHistory[newIndex] || '';
        if (setInputValue) setInputValue(cmd); else setInternalValue(cmd);
        return newIndex;
      });
    }
  };

  if (minimized) {
    return (
      <button
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg p-4 flex items-center justify-center"
        onClick={onRestore}
        aria-label="Restore chat"
      >
        <MessageCircle className="w-7 h-7" />
      </button>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto mt-10 rounded-xl p-6 border shadow-lg transition-colors duration-300
      ${darkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
    >
      <h2 className="text-2xl font-bold mb-4 text-center">MCP Smart Chat</h2>
      {/* Provider Dropdown */}
      {providers && providers.filter(p => p.status === 'connected').length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label htmlFor="provider-select" className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Provider:</label>
          <select
            id="provider-select"
            value={selectedProvider}
            onChange={e => setSelectedProvider(e.target.value)}
            className={`px-3 py-2 border rounded-lg ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
          >
            {aiProviders.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className={`h-96 overflow-y-auto mb-4 rounded p-4 transition-colors duration-300
        ${darkMode ? 'bg-neutral-800 text-white' : 'bg-gray-50 text-gray-900'}`}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block px-4 py-2 rounded-lg max-w-[80%] transition-colors duration-300
              ${msg.sender === 'user'
                ? (darkMode ? 'bg-neutral-700 text-white' : 'bg-blue-200 text-gray-900')
                : (darkMode ? 'bg-neutral-900 text-white' : 'bg-green-100 text-gray-900')}
            `}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
              {msg.attachmentName && (
                <div className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>📎 {msg.attachmentName}</div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>AI is thinking...</div>}
        {loading && <MessageCircle className="animate-ping text-gray-400 w-5 h-5" />}
        {lastRun && (
          <div className="absolute -top-6 left-0 text-xs text-gray-400 select-none">
            {lastRun}
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="flex items-center space-x-2 relative">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder || "Type your message or command..."}
            className={`w-full px-4 py-2 border rounded-lg transition-colors duration-300
              ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}`}
            disabled={loading}
          />
          {suggestions.length > 0 && (
            <ul className={`absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border text-sm z-50
              ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            >
              {suggestions.map((s, i) => (
                <li
                  key={s}
                  onClick={() => {
                    if (setInputValue) setInputValue(s); else setInternalValue(s);
                    setSuggestions([]);
                  }}
                  className={`px-3 py-2 cursor-pointer ${i === highlightIdx ? (darkMode ? 'bg-neutral-700' : 'bg-gray-100') : ''}`}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`px-3 py-2 rounded-lg transition-colors duration-300
            ${darkMode ? 'bg-neutral-700 text-white hover:bg-neutral-900' : 'bg-neutral-700 text-white hover:bg-neutral-900'}`}
          disabled={loading}
        >
          📎
        </button>
        <button
          type="submit"
          className={`px-4 py-2 rounded-lg transition-colors duration-300
            ${darkMode ? 'bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-700' : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300'}`}
          disabled={loading || (!value.trim() && !attachment)}
        >
          Send
        </button>
      </form>
      {attachment && (
        <div className={`mt-2 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Attached: {attachment.name}</div>
      )}
      {ticker && (
        <div className="fixed bottom-4 right-5 z-50 bg-black/80 text-white text-xs px-3 py-1 rounded shadow-lg">
          {ticker}
        </div>
      )}
    </div>
  );
}; 