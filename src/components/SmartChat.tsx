import React, { useRef, useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

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
    .split(/\b(?:then|and then)\b|[.;]/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function isGithubCommand(input: string): boolean {
  return /github.*repo|repo.*github|list.*repo|show.*repo|my.*repo|repo[- ]?summary|code[- ]?search|issue|pull[- ]?request|pr/i.test(input);
}

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

  // Only show OpenAI, Anthropic, and Gemini in the provider dropdown
  const allowedAIProviders = ['openai', 'anthropic', 'gemini'];
  const aiProviders = (providers || []).filter(p => allowedAIProviders.includes(p.id));

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

    // Single command: send provider and apiKey
    const formData = new FormData();
    formData.append('message', value);
    if (attachment) formData.append('attachment', attachment);
    formData.append('history', JSON.stringify(messages));
    let providerToSend = selectedProvider;
    let apiKeyToSend = aiProviders.find(p => p.id === selectedProvider)?.apiKey || '';
    if (isGithubCommand(value)) {
      providerToSend = 'github';
      // Get GitHub token from providers prop
      const githubProvider = providers?.find(p => p.id === 'github');
      apiKeyToSend = githubProvider?.apiKey || '';
      console.log('Using GitHub token:', apiKeyToSend); // Debug log
    }
    formData.append('provider', providerToSend);
    formData.append('apiKey', apiKeyToSend);
    const res = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await res.json();
    setMessages((prev) => [...prev, { sender: 'ai', text: data.response }]);
    setLoading(false);
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
    setHistoryIndex(null); // Reset history navigation on manual change
  };

  // Handle up/down arrow for command history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
              <div>{msg.text}</div>
              {msg.attachmentName && (
                <div className={`mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>📎 {msg.attachmentName}</div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>AI is thinking...</div>}
      </div>
      <form onSubmit={handleSend} className="flex items-center space-x-2">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder || "Type your message or command..."}
          className={`flex-1 px-4 py-2 border rounded-lg transition-colors duration-300
            ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900'}`}
          disabled={loading}
        />
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
    </div>
  );
}; 