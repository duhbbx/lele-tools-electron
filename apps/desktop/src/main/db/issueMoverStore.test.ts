import Database from 'better-sqlite3-node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeIssueMoverStore } from './issueMoverStore'
import { migrate } from './schema'

let db: Database.Database
let store: ReturnType<typeof makeIssueMoverStore>

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  migrate(db)
  store = makeIssueMoverStore(db)
})
afterEach(() => db.close())

function repoRow(id: number) {
  return store.repos.listByInstance(id)
}

describe('im instances', () => {
  it('creates / renames / lists / removes', () => {
    const a = store.instances.create('react → mine')
    store.instances.create('vue → mine')
    expect(store.instances.list()).toHaveLength(2)
    store.instances.rename(a, '改名')
    expect(store.instances.get(a)?.name).toBe('改名')
    store.instances.remove(a)
    expect(store.instances.list()).toHaveLength(1)
  })
})

describe('im repos', () => {
  it('adds sources and a target, getTarget returns the target', () => {
    const inst = store.instances.create('demo')
    store.repos.add(inst, { kind: 'source', owner: 'facebook', name: 'react' })
    store.repos.add(inst, { kind: 'source', owner: 'vuejs', name: 'core', token: 'tok' })
    const tgt = store.repos.add(inst, { kind: 'target', owner: 'me', name: 'mirror', token: 'wtok' })
    expect(repoRow(inst)).toHaveLength(3)
    const target = store.repos.getTarget(inst)
    expect(target?.id).toBe(tgt)
    expect(target?.kind).toBe('target')
    expect(store.repos.get(tgt)?.token).toBe('wtok')

    store.repos.update(tgt, { owner: 'me', name: 'mirror2', token: 'new' })
    expect(store.repos.get(tgt)?.name).toBe('mirror2')
  })

  it('tracks last_pulled_at and resets it to 0 on update (full re-pull)', () => {
    const inst = store.instances.create('demo')
    const src = store.repos.add(inst, { kind: 'source', owner: 'a', name: 'b' })
    expect(store.repos.get(src)?.lastPulledAt).toBe(0)
    store.repos.setLastPulled(src, 1700000000000)
    expect(store.repos.get(src)?.lastPulledAt).toBe(1700000000000)
    // 改仓库信息后回到全量（last_pulled_at 归零）
    store.repos.update(src, { owner: 'a', name: 'c', token: '' })
    expect(store.repos.get(src)?.lastPulledAt).toBe(0)
  })

  it('removing an instance cascades to repos and issues', () => {
    const inst = store.instances.create('demo')
    const src = store.repos.add(inst, { kind: 'source', owner: 'a', name: 'b' })
    const repo = store.repos.get(src)!
    store.issues.upsertMany(repo, [
      { number: 1, title: 't', body: '', state: 'open', htmlUrl: 'u', remoteCreatedAt: 0 },
    ])
    expect(store.issues.listByRepo(src)).toHaveLength(1)
    store.instances.remove(inst)
    expect(store.repos.listByInstance(inst)).toHaveLength(0)
    expect(store.issues.listByRepo(src)).toHaveLength(0)
  })
})

describe('im issues upsert', () => {
  it('upsert by (repo, number) updates content but keeps migrated/source mapping', () => {
    const inst = store.instances.create('demo')
    const src = store.repos.add(inst, { kind: 'source', owner: 'a', name: 'b' })
    const repo = store.repos.get(src)!
    store.issues.upsertMany(repo, [
      { number: 7, title: 'old', body: 'b', state: 'open', htmlUrl: 'u7', remoteCreatedAt: 100 },
    ])
    const issue = store.issues.listByRepo(src)[0]
    store.issues.markMigrated(issue.id, true)
    store.issues.setAiExplain(issue.id, 'AI 解读内容')

    // re-pull same number with new title/state — content updates, migrated + ai_explain preserved
    store.issues.upsertMany(repo, [
      { number: 7, title: 'new', body: 'b2', state: 'closed', htmlUrl: 'u7', remoteCreatedAt: 100 },
    ])
    const after = store.issues.get(issue.id)!
    expect(after.title).toBe('new')
    expect(after.state).toBe('closed')
    expect(after.migrated).toBe(true)
    expect(after.aiExplain).toBe('AI 解读内容')
    expect(store.issues.listByRepo(src)).toHaveLength(1)
  })
})

describe('im migrate flow', () => {
  it('inserts a target issue with source mapping and marks source migrated', () => {
    const inst = store.instances.create('demo')
    const src = store.repos.add(inst, { kind: 'source', owner: 'a', name: 'b' })
    const tgtId = store.repos.add(inst, { kind: 'target', owner: 'me', name: 'mine', token: 'w' })
    const srcRepo = store.repos.get(src)!
    const target = store.repos.get(tgtId)!
    store.issues.upsertMany(srcRepo, [
      { number: 42, title: 'bug', body: 'desc', state: 'open', htmlUrl: 'srcurl', remoteCreatedAt: 0 },
    ])
    const sourceIssue = store.issues.listByRepo(src)[0]

    store.issues.insertTarget(target, {
      number: 1,
      title: 'bug',
      body: 'desc\n\n搬运自 srcurl',
      state: 'open',
      htmlUrl: 'tgturl',
      remoteCreatedAt: 0,
      sourceIssueId: sourceIssue.id,
    })
    store.issues.markMigrated(sourceIssue.id, true)

    const targetIssues = store.issues.listByInstance(inst, 'target')
    expect(targetIssues).toHaveLength(1)
    expect(targetIssues[0].sourceIssueId).toBe(sourceIssue.id)
    expect(store.issues.get(sourceIssue.id)?.migrated).toBe(true)
  })
})
