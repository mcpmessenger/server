import { Client as NotionClient } from '@notionhq/client';

export const id = 'notion';
export const supportedCommands = ['list-databases', 'query-database', 'pages', 'create-page', 'update-page', 'get-page'];

export async function executeCommand({ command, params = {}, apiKey }) {
  if (!apiKey) throw new Error('Missing Notion secret token');
  const notion = new NotionClient({ auth: apiKey });

  // normalize command (lowercase, replace spaces/unders w/ dash)
  let cmd = (command || '').toLowerCase().replace(/[\s_]+/g, '-');
  // alias map
  if (cmd === 'list-pages') cmd = 'pages';
  if (cmd === 'retrieve-page') cmd = 'get-page';

  switch (cmd) {
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
    case 'pages': {
      const { query = '' } = params;
      const { results } = await notion.search({ query, filter: { property: 'object', value: 'page' }, page_size: 10 });
      const lines = results.map(pg => `${pg.id} | ${pg.properties?.Name?.title?.[0]?.plain_text || pg.url}`).join('\n');
      return { output: lines || 'No pages' };
    }
    case 'create-page': {
      const { parentId, properties = {}, children = [] } = params;
      if (!parentId) throw new Error('parentId required');
      const { id } = await notion.pages.create({ parent: { database_id: parentId }, properties, children });
      return { output: `✅ Page created: ${id}` };
    }
    case 'update-page': {
      const { pageId, properties = {} } = params;
      if (!pageId) throw new Error('pageId required');
      await notion.pages.update({ page_id: pageId, properties });
      return { output: `✅ Page ${pageId} updated` };
    }
    case 'get-page': {
      const { pageId } = params;
      if (!pageId) throw new Error('pageId required');
      const page = await notion.pages.retrieve({ page_id: pageId });
      return { output: JSON.stringify(page, null, 2) };
    }
    default:
      throw new Error(`Unsupported Notion command: ${command}`);
  }
}

export default { id, supportedCommands, executeCommand };

// Auxiliary helper used by /api/providers/:id/resources to populate picker
export async function listResources({ apiKey }) {
  return executeCommand({ command: 'list-databases', params: {}, apiKey });
} 