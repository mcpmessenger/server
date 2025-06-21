// parser.js
// Utility functions for parsing natural-language commands into provider + command pairs.
// This is deliberately dependency-free (regex / string ops only) so it can be shared by
// both the front-end (via simple copy or future bundling) and the back-end.

export function parseChainedCommands(input = '') {
  return input
    .split(/\b(?:then|and then|and)\b|[.;]/i)
    .map(s => s.trim())
    .filter(Boolean);
}

// Very lightweight heuristic intent detector.
// Returns { provider?: string, command?: string }
export function parseIntent(input = '') {
  const msg = input.trim();
  const lower = msg.toLowerCase();
  let provider;
  let command;

  // GitHub – repos, issues, PRs, code search
  if (/github/.test(lower) || /(last|list|get|show|my)\s+\d*\s*(?:github\s*)?repos?/.test(lower)) {
    provider = 'github';
    if (/repo[- ]?summary/.test(lower)) command = 'repo-summary';
    else if (/code[- ]?search/.test(lower)) command = 'code-search';
    else if (/generate.*issue|create.*issue/.test(lower)) command = 'generate-issue';
    else if (/generate.*pr|pull\s+request/.test(lower)) command = 'generate-pr';
    else if (/list[-\s]?repos?/.test(lower) || /(last|get|show|my)[-\s]+\d*\s*repos?/.test(lower)) command = 'list-repos';
    else command = 'list-repos';
  }

  // --- Plain-language GitHub create issue / PR ---
  if (!provider && /(create|open)\s+issue/i.test(lower) && /[\w.-]+\/[\w.-]+/.test(lower)) {
    provider = 'github';
    command = 'generate-issue';
  }
  if (!provider && /(create|open|make)\s+(pull\s+request|pr)/i.test(lower) && /[\w.-]+\/[\w.-]+/.test(lower)) {
    provider = 'github';
    command = 'generate-pr';
  }

  // Gmail
  if (!provider && (/gmail/.test(lower) || /^\/gmail/.test(lower) || /email/.test(lower))) {
    provider = 'gmail';
    if (/send\s+email/.test(lower)) command = 'send-email';
    else command = 'list-messages';
  }

  // Google Drive
  if (!provider && (/google\s+drive/.test(lower) || /^\/drive/.test(lower))) {
    provider = 'google_drive';
    command = 'list-files';
  }

  // Zapier
  if (!provider && (/zapier/.test(lower) || /^\/zapier/.test(lower))) {
    provider = 'zapier';
    if (/list\s+zaps/.test(lower)) command = 'list-zaps';
    else if (/trigger\s+zap/.test(lower)) command = 'trigger';
  }

  // Make.com
  if (!provider && (/make\.com/.test(lower) || /^\/make/.test(lower))) {
    provider = 'makecom';
    if (/list\s+scenarios/.test(lower)) command = 'list-scenarios';
    else if (/run\s+scenario/.test(lower)) command = 'run';
  }

  // Generic LLM utility commands (no explicit provider = uses whatever LLM is selected)
  if (!command) {
    if (/\b(summarize|summary|summarise)\b/.test(lower)) command = 'summarize';
    else if (/\b(explain)\b/.test(lower)) command = 'explain';
    else if (/generate\s+code|write\s+code|code\s+snippet/.test(lower)) command = 'generate-code';
    else if (/translate\s+.*\s+to\s+\w+/.test(lower)) command = 'translate';
  }

  return { provider, command };
} 