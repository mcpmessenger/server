import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import mcp from '../services/mcpServerService.js';

export function useJobPolling(jobId?: string) {
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let interval = 1000;
    const tick = async () => {
      try {
        const j = await mcp.getJob(jobId);
        setJob(j);
        if (j.done) return; // stop polling
        interval = Math.min(5000, interval * 1.4);
        pollingRef.current = setTimeout(tick, interval);
      } catch (err: any) {
        setError(err.message || 'Polling error');
      }
    };

    tick();

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [jobId]);

  return { job, error };
} 