// 数据访问层：把链上事件整理成可查询的 SQLite 数据。
//
// 这里使用 Node.js 内置的 node:sqlite（Node >= 22.5），
// 好处是零原生依赖，不需要编译 better-sqlite3 之类的扩展。
// 生产环境通常会换成 PostgreSQL / MySQL，但思路是一样的。

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM 中没有 __dirname，需要从当前模块 URL 推导。
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库文件放在 server/data/ 下；该目录已被 .gitignore 忽略。
// recursive: true 表示目录已存在时也不会报错。
const dataDir = path.resolve(__dirname, "../data");
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "chainlab.db"));

// 初始化表结构。
// - WAL（Write-Ahead Logging）模式让读写并发更友好，适合“索引器写、API 读”的场景。
// - meta：预留的键值表，可用于记录索引进度、合约地址等元信息。
// - notes：把链上 NoteCreated 事件落成一行行可查询的数据。
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    block_number INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL
  );

  -- 同一条链上日志可能因为“实时监听 + 历史回填”被处理两次，
  -- (tx_hash, log_index) 唯一索引配合 INSERT OR IGNORE 实现幂等写入。
  CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_log
    ON notes (tx_hash, log_index);

  -- 列表默认按 id 倒序，这里为未来的时间范围查询预留索引。
  CREATE INDEX IF NOT EXISTS idx_notes_created_at
    ON notes (created_at DESC);
`);

// 预编译语句（prepared statement）：
// 1. 避免每次查询都重新解析 SQL，性能更好；
// 2. 使用 ? 占位符传参，天然防止 SQL 注入。
const insertNote = db.prepare(`
  INSERT OR IGNORE INTO notes
    (id, author, content, created_at, block_number, tx_hash, log_index)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// 使用 AS 把 snake_case 列名映射成前端习惯的 camelCase。
// ORDER BY id DESC：最新的留言排在最前面。
const selectNotes = db.prepare(`
  SELECT
    id,
    author,
    content,
    created_at AS createdAt,
    block_number AS blockNumber,
    tx_hash AS txHash
  FROM notes
  ORDER BY id DESC
  LIMIT ?
`);

const countNotes = db.prepare("SELECT COUNT(*) AS count FROM notes");
const countAuthors = db.prepare(
  "SELECT COUNT(DISTINCT author) AS count FROM notes",
);
const latestBlock = db.prepare("SELECT MAX(block_number) AS block FROM notes");
const upsertMeta = db.prepare(`
  INSERT INTO meta (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const selectMeta = db.prepare("SELECT value FROM meta WHERE key = ?");

/**
 * 清空留言表。
 * 服务启动时会调用它，然后从链上事件重新回填，
 * 避免本地数据库与重启后的新链状态不一致。
 */
export function resetNotes() {
  db.exec("DELETE FROM notes");
}

/**
 * 保存一条留言事件。
 * 使用 INSERT OR IGNORE：如果 (tx_hash, log_index) 已存在就跳过，
 * 因此实时监听与历史回填重复处理同一事件也不会产生重复数据。
 *
 * @param {object} note
 * @param {number} note.id         链上留言编号
 * @param {string} note.author     作者地址
 * @param {string} note.content    留言内容
 * @param {number} note.createdAt  链上时间戳（秒）
 * @param {number} note.blockNumber 所在区块高度
 * @param {string} note.txHash     交易哈希
 * @param {number} note.logIndex   日志在区块内的序号
 */
export function saveNote({
  id,
  author,
  content,
  createdAt,
  blockNumber,
  txHash,
  logIndex,
}) {
  insertNote.run(
    id,
    author,
    content,
    createdAt,
    blockNumber,
    txHash,
    logIndex,
  );
}

/**
 * 查询最近的留言。
 * @param {number} limit 最多返回多少条
 * @returns {Array<object>} 按 id 倒序排列的留言
 */
export function listNotes(limit = 50) {
  return selectNotes.all(limit);
}

/**
 * 聚合统计信息，供前端顶部的数据卡片展示。
 * latestBlock 在没有留言时是 NULL，所以用 ?? 0 兜底。
 */
export function getStats() {
  return {
    totalNotes: countNotes.get().count,
    uniqueAuthors: countAuthors.get().count,
    latestBlock: latestBlock.get().block ?? 0,
  };
}

/**
 * 读取元信息（预留能力）。
 * @param {string} key
 * @returns {string | null}
 */
export function getMeta(key) {
  return selectMeta.get(key)?.value ?? null;
}

/**
 * 写入或更新元信息（预留能力）。
 * ON CONFLICT(key) DO UPDATE 实现 UPSERT。
 * @param {string} key
 * @param {string} value
 */
export function setMeta(key, value) {
  upsertMeta.run(key, value);
}

export default db;
