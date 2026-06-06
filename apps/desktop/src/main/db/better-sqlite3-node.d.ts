// Ambient type shim: better-sqlite3-node is an npm alias of better-sqlite3
// (for test-only use — keeps node ABI separate from electron ABI)
declare module 'better-sqlite3-node' {
  import D from 'better-sqlite3'
  export = D
}
