import { Client as NotionClient } from '@notionhq/client';

export const id = 'notion';
export const supportedCommands = ['list-databases', 'query-database'];

export async function executeCommand({ command, params = {}, apiKey }) {
  if (!apiKey) throw new Error('Missing Notion secret token');
  const notion = new NotionClient({ auth: apiKey });

  switch (command) {
    case 'list-databases': {
      const { results } = await notion.search({ filter: { property: 'object', value: 'database' } });
      const lines = results.map(db => `${db.id} | ${db.title?.[0]?.plain_text || 'Untitled'}`).join('\n');
      return { output: lines || 'No databases' };
    }
    case 'query-database': {
      const { databaseId, pageSize = 10 } = params;
      if (!databaseId) throw new Error('databaseId required');
      const { results } = await notion.databases.query({ database_id: databaseId, page_size: pageSize });
      const lines = results.map(p => `${p.id} | ${p.properties?.Name?.title?.[0]?.plain_text || ''}`).join('\n');
      return { output: lines || 'No pages' };
    }
    default:
      throw new Error(`Unsupported Notion command: ${command}`);
  }
}

export default { id, supportedCommands, executeCommand }; 