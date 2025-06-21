import React, { useEffect, useState } from 'react';

export const ServerLogTicker: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_MCP_API as string) || 'http://localhost:3002';
    const source = new EventSource(`${apiBase}/api/server-logs`);
    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.message) {
          setLogs((prev) => {
            const isDummy = data.message.includes('[DEV-DUMMY]');
            const hasReal = prev.some(m => !m.includes('[DEV-DUMMY]'));
            const nextArr = hasReal
              ? (isDummy ? prev : [...prev, data.message])
              : [...prev, data.message];
            // If we now have a real log, purge dummies
            const cleaned = nextArr.filter(m => hasReal ? !m.includes('[DEV-DUMMY]') : true);
            return cleaned.slice(-50);
          });
        }
      } catch {
        // ignore bad JSON
      }
    };
    source.onerror = () => {
      // Auto-reconnect will happen by default, but we can close and reopen
      console.warn('Server log stream error');
    };
    return () => {
      source.close();
    };
  }, []);

  // Show placeholder if nothing received after 3 seconds
  useEffect(() => {
    const t = setTimeout(() => {
      if (logs.length === 0) {
        setLogs(['[waiting for server logs]']);
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [logs.length]);

  if (logs.length === 0) return null;

  const text = logs.join('   |   ');

  return (
    <div className="fixed top-16 left-0 w-full bg-black/90 text-green-400 text-sm md:text-base overflow-hidden whitespace-nowrap z-50 pointer-events-none">
      <div className="inline-block animate-marquee px-4 py-1">
        {text}
      </div>
    </div>
  );
}; 