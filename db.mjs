import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = './data/tokens.db';

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    agent_url TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    access_token_expires_at INTEGER,
    token_endpoint TEXT,
    client_id TEXT,
    client_secret TEXT,
    scopes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS pending_auth (
    state TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_url TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    token_endpoint TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT,
    scopes TEXT,
    redirect_uri TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// Prepared statements
const storeTokensStmt = db.prepare(`
  INSERT OR REPLACE INTO tokens (agent_url, agent_id, access_token, refresh_token, access_token_expires_at, token_endpoint, client_id, client_secret, scopes, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
`);

const getTokensStmt = db.prepare(`SELECT * FROM tokens WHERE agent_id = ?`);
const getTokensByUrlStmt = db.prepare(
  `SELECT * FROM tokens WHERE SUBSTR(?, 1, LENGTH(agent_url)) = agent_url LIMIT 1`
);
const deleteTokensStmt = db.prepare(`DELETE FROM tokens WHERE agent_id = ?`);
const getAllTokensStmt = db.prepare(`SELECT * FROM tokens`);

const storePendingAuthStmt = db.prepare(`
  INSERT OR REPLACE INTO pending_auth (state, agent_id, agent_url, code_verifier, token_endpoint, client_id, client_secret, scopes, redirect_uri)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getPendingAuthStmt = db.prepare(`SELECT * FROM pending_auth WHERE state = ?`);
const deletePendingAuthStmt = db.prepare(`DELETE FROM pending_auth WHERE state = ?`);

// Clean up stale pending_auth entries (older than 10 minutes)
const cleanStalePendingStmt = db.prepare(`DELETE FROM pending_auth WHERE created_at < unixepoch() - 600`);

export function storeTokens(agentUrl, { agentId, accessToken, refreshToken, expiresAt, tokenEndpoint, clientId, clientSecret, scopes }) {
  storeTokensStmt.run(agentUrl, agentId, accessToken, refreshToken || null, expiresAt || null, tokenEndpoint || null, clientId || null, clientSecret || null, scopes || null);
}

export function getTokens(agentId) {
  return getTokensStmt.get(agentId) || null;
}

export function getTokensByUrl(targetUrl) {
  return getTokensByUrlStmt.get(targetUrl) || null;
}

export function deleteTokens(agentId) {
  deleteTokensStmt.run(agentId);
}

export function getAllTokens() {
  return getAllTokensStmt.all();
}

export function storePendingAuth(state, { agentId, agentUrl, codeVerifier, tokenEndpoint, clientId, clientSecret, scopes, redirectUri }) {
  // Clean up stale entries first
  cleanStalePendingStmt.run();
  storePendingAuthStmt.run(state, agentId, agentUrl, codeVerifier, tokenEndpoint, clientId, clientSecret || null, scopes || null, redirectUri);
}

export function getPendingAuth(state) {
  return getPendingAuthStmt.get(state) || null;
}

export function deletePendingAuth(state) {
  deletePendingAuthStmt.run(state);
}

export { db };
