// Credential DAO – stores per-user provider credentials
// Supports Supabase table `user_integration_accounts` by default.
// Falls back to local SQLite table (same schema) when Supabase env vars are absent.

import dotenv from 'dotenv';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

// Lazy-open SQLite for local/dev fallback
let _sqliteDb;
async function sqlite() {
  if (_sqliteDb) return _sqliteDb;
  _sqliteDb = await open({ filename: './mcp.sqlite', driver: sqlite3.Database });
  // Ensure table exists (mirrors Supabase)
  await _sqliteDb.exec(`CREATE TABLE IF NOT EXISTS user_integration_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    provider_id TEXT NOT NULL,
    credentials TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider_id)
  );`);
  return _sqliteDb;
}

const DEFAULT_USER_ID = 1;

export async function getCredentials(providerId, userId = DEFAULT_USER_ID) {
  if (supabase) {
    const { data, error } = await supabase
      .from('user_integration_accounts')
      .select('credentials')
      .eq('provider_id', providerId)
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? data.credentials : null;
  }
  // SQLite fallback
  const db = await sqlite();
  const row = await db.get('SELECT credentials FROM user_integration_accounts WHERE provider_id = ? AND user_id = ?', providerId, userId);
  return row ? JSON.parse(row.credentials) : null;
}

export async function saveCredentials(providerId, credentialsObj, userId = DEFAULT_USER_ID) {
  if (!credentialsObj || typeof credentialsObj !== 'object') throw new Error('credentialsObj must be an object');
  if (supabase) {
    const { error } = await supabase
      .from('user_integration_accounts')
      .upsert({ user_id: userId, provider_id: providerId, credentials: credentialsObj }, { onConflict: 'user_id,provider_id' });
    if (error) throw new Error(error.message);
    return true;
  }
  const db = await sqlite();
  const str = JSON.stringify(credentialsObj);
  await db.run(`INSERT INTO user_integration_accounts (user_id, provider_id, credentials, updated_at)
                VALUES (?,?,?,CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, provider_id) DO UPDATE SET credentials=excluded.credentials, updated_at=CURRENT_TIMESTAMP`,
    userId, providerId, str);
  return true;
}

export async function deleteCredentials(providerId, userId = DEFAULT_USER_ID) {
  if (supabase) {
    const { error } = await supabase
      .from('user_integration_accounts')
      .delete()
      .eq('provider_id', providerId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return true;
  }
  const db = await sqlite();
  await db.run('DELETE FROM user_integration_accounts WHERE provider_id = ? AND user_id = ?', providerId, userId);
  return true;
} 