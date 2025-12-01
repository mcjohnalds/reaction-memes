import { DatabaseSync } from "node:sqlite";

export function getSQL(dataDirectory) {
  const db = new DatabaseSync(`${dataDirectory}/main.sqlite`);
  const sql = db.createTagStore();
  // Hack to prevent segfault. See https://github.com/nodejs/node/pull/60462
  sql._db = db;
  db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 1000;
  PRAGMA cache_size = 10000;
  PRAGMA temp_store = MEMORY;
  BEGIN IMMEDIATE;
  CREATE TABLE IF NOT EXISTS meme(
    id BLOB PRIMARY KEY,
    embedding,
    width,
    height,
    naughty,
    source UNIQUE
  );
  CREATE TABLE IF NOT EXISTS similar_meme(
    a REFERENCES meme(id) ON DELETE CASCADE,
    b REFERENCES meme(id) ON DELETE CASCADE,
    PRIMARY KEY(a, b),
    CHECK(a < b)
  );
  CREATE TABLE IF NOT EXISTS cached_response(
    id BLOB PRIMARY KEY,
    url TEXT UNIQUE
  );
  COMMIT;
`);
  return sql;
}
