import { WebClient } from '@slack/web-api';

export const id = 'slack';
export const supportedCommands = [
  'send-message',
  'list-channels',
  'get-channel-history'
];

/**
 * executeCommand params:
 *   command  – one of supportedCommands
 *   params   – object with command-specific args
 *   apiKey   – Slack Bot User OAuth token (xoxb-...)
 */
export async function executeCommand({ command, params = {}, apiKey }) {
  if (!apiKey) throw new Error('Missing Slack bot token (xoxb-...)');
  const slack = new WebClient(apiKey);

  // normalise command text (allow aliases typed by user)
  const cmd = (command || '').toLowerCase().replace(/_/g,'-');

  // Allow natural phrases
  if (/^list\s+channels?$/.test(cmd)) {
    const result = await slack.conversations.list({ exclude_archived: true, limit: 100 });
    const lines = result.channels.map(c => `${c.id} | ${c.name}`).join('\n');
    return { output: lines || 'No channels' };
  }
  if (cmd.startsWith('send ')) {
    // format: send #general Hello there
    const m = cmd.match(/^send\s+(\S+)\s+(.+)/);
    if (!m) throw new Error('Usage: send <channel> <text>');
    const [, channel, text] = m;
    const res = await slack.chat.postMessage({ channel, text });
    return { output: `Sent ✔️ ts=${res.ts}` };
  }
  if (/^get\s+messages/.test(cmd)) {
    // get messages #general 20
    const m = cmd.match(/^get\s+messages\s+(\S+)(?:\s+(\d+))?/);
    if (!m) throw new Error('Usage: get messages <channel> [limit]');
    const [, channel, lim] = m;
    const limit = lim ? Number(lim) : 20;
    const history = await slack.conversations.history({ channel, limit });
    const out = history.messages.map(m=>`${m.user||''}: ${m.text}`).join('\n');
    return { output: out || 'No messages' };
  }

  switch (cmd) {
    case 'send-message': {
      const { channel, text } = params;
      if (!channel || !text) throw new Error('channel and text are required');
      const result = await slack.chat.postMessage({ channel, text });
      return { output: `Sent ✔️ ts=${result.ts}` };
    }
    case 'list-channels': {
      const result = await slack.conversations.list({ exclude_archived: true, limit: 100 });
      const lines = result.channels.map(c => `${c.id} | ${c.name}`).join('\n');
      return { output: lines || 'No channels' };
    }
    case 'get-channel-history': {
      const { channel, limit = 20 } = params;
      if (!channel) throw new Error('channel required');
      const result = await slack.conversations.history({ channel, limit });
      const lines = result.messages.map(m => `${m.user || ''}: ${m.text}`).join('\n');
      return { output: lines || 'No messages' };
    }
    default:
      throw new Error(`Unsupported Slack command: ${command}`);
  }
}

export default { id, supportedCommands, executeCommand }; 