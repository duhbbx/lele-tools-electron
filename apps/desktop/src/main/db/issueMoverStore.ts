import type Database from 'better-sqlite3'
import type { ImInstance, ImIssue, ImRepo, ImRepoKind } from '@lele/shared-types'

function mapInstance(r: Record<string, unknown>): ImInstance {
  return {
    id: r.id as number,
    name: r.name as string,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

function mapRepo(r: Record<string, unknown>): ImRepo {
  return {
    id: r.id as number,
    instanceId: r.instance_id as number,
    kind: r.kind as ImRepoKind,
    owner: r.owner as string,
    name: r.name as string,
    token: r.token as string,
    lastPulledAt: (r.last_pulled_at as number) ?? 0,
    createdAt: r.created_at as number,
  }
}

function mapIssue(r: Record<string, unknown>): ImIssue {
  return {
    id: r.id as number,
    instanceId: r.instance_id as number,
    repoId: r.repo_id as number,
    kind: r.kind as ImRepoKind,
    number: r.number as number,
    title: r.title as string,
    body: r.body as string,
    state: (r.state === 'closed' ? 'closed' : 'open') as 'open' | 'closed',
    htmlUrl: r.html_url as string,
    migrated: (r.migrated as number) === 1,
    sourceIssueId: (r.source_issue_id as number | null) ?? null,
    aiExplain: (r.ai_explain as string) ?? '',
    remoteCreatedAt: r.remote_created_at as number,
    fetchedAt: r.fetched_at as number,
  }
}

/** 远端拉来的一条 issue（IPC 层从 GitHub API 映射后传入） */
export interface ImIssueUpsert {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  htmlUrl: string
  remoteCreatedAt: number
}

export function makeIssueMoverStore(db: Database.Database) {
  return {
    instances: {
      list(): ImInstance[] {
        const rows = db
          .prepare('SELECT * FROM im_instances ORDER BY updated_at DESC')
          .all() as Record<string, unknown>[]
        return rows.map(mapInstance)
      },
      get(id: number): ImInstance | null {
        const row = db.prepare('SELECT * FROM im_instances WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapInstance(row) : null
      },
      create(name: string): number {
        const now = Date.now()
        const result = db
          .prepare('INSERT INTO im_instances(name, created_at, updated_at) VALUES(?, ?, ?)')
          .run(name, now, now)
        return result.lastInsertRowid as number
      },
      rename(id: number, name: string): void {
        db.prepare('UPDATE im_instances SET name = ?, updated_at = ? WHERE id = ?').run(
          name,
          Date.now(),
          id,
        )
      },
      touch(id: number): void {
        db.prepare('UPDATE im_instances SET updated_at = ? WHERE id = ?').run(Date.now(), id)
      },
      remove(id: number): void {
        db.prepare('DELETE FROM im_instances WHERE id = ?').run(id)
      },
    },

    repos: {
      listByInstance(instanceId: number): ImRepo[] {
        const rows = db
          .prepare('SELECT * FROM im_repos WHERE instance_id = ? ORDER BY kind DESC, id')
          .all(instanceId) as Record<string, unknown>[]
        return rows.map(mapRepo)
      },
      get(id: number): ImRepo | null {
        const row = db.prepare('SELECT * FROM im_repos WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapRepo(row) : null
      },
      /** 该实例的目标仓库（至多一个） */
      getTarget(instanceId: number): ImRepo | null {
        const row = db
          .prepare("SELECT * FROM im_repos WHERE instance_id = ? AND kind = 'target' LIMIT 1")
          .get(instanceId) as Record<string, unknown> | undefined
        return row ? mapRepo(row) : null
      },
      add(instanceId: number, r: { kind: ImRepoKind; owner: string; name: string; token?: string }): number {
        const result = db
          .prepare(
            'INSERT INTO im_repos(instance_id, kind, owner, name, token, created_at) VALUES(?, ?, ?, ?, ?, ?)',
          )
          .run(instanceId, r.kind, r.owner, r.name, r.token ?? '', Date.now())
        return result.lastInsertRowid as number
      },
      /** 改了 owner/name/token 后重置 last_pulled_at=0，让下次回到全量拉取（避免漏掉新库历史） */
      update(id: number, r: { owner: string; name: string; token: string }): void {
        db.prepare(
          'UPDATE im_repos SET owner = ?, name = ?, token = ?, last_pulled_at = 0 WHERE id = ?',
        ).run(r.owner, r.name, r.token, id)
      },
      setLastPulled(id: number, ts: number): void {
        db.prepare('UPDATE im_repos SET last_pulled_at = ? WHERE id = ?').run(ts, id)
      },
      remove(id: number): void {
        db.prepare('DELETE FROM im_repos WHERE id = ?').run(id)
      },
    },

    issues: {
      listByRepo(repoId: number): ImIssue[] {
        const rows = db
          .prepare('SELECT * FROM im_issues WHERE repo_id = ? ORDER BY number DESC')
          .all(repoId) as Record<string, unknown>[]
        return rows.map(mapIssue)
      },
      listByInstance(instanceId: number, kind: ImRepoKind): ImIssue[] {
        const rows = db
          .prepare(
            'SELECT * FROM im_issues WHERE instance_id = ? AND kind = ? ORDER BY repo_id, number DESC',
          )
          .all(instanceId, kind) as Record<string, unknown>[]
        return rows.map(mapIssue)
      },
      get(id: number): ImIssue | null {
        const row = db.prepare('SELECT * FROM im_issues WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapIssue(row) : null
      },
      /** 整批 upsert（按 repo_id+number）；不覆盖已有的 migrated / source_issue_id，返回写入条数 */
      upsertMany(repo: ImRepo, issues: ImIssueUpsert[]): number {
        const stmt = db.prepare(
          `INSERT INTO im_issues
             (instance_id, repo_id, kind, number, title, body, state, html_url, source_issue_id, remote_created_at, fetched_at)
           VALUES (@instanceId, @repoId, @kind, @number, @title, @body, @state, @htmlUrl, NULL, @remoteCreatedAt, @fetchedAt)
           ON CONFLICT(repo_id, number) DO UPDATE SET
             title = excluded.title, body = excluded.body, state = excluded.state,
             html_url = excluded.html_url, remote_created_at = excluded.remote_created_at,
             fetched_at = excluded.fetched_at`,
        )
        const now = Date.now()
        const run = db.transaction((list: ImIssueUpsert[]) => {
          for (const it of list) {
            stmt.run({
              instanceId: repo.instanceId,
              repoId: repo.id,
              kind: repo.kind,
              number: it.number,
              title: it.title,
              body: it.body,
              state: it.state,
              htmlUrl: it.htmlUrl,
              remoteCreatedAt: it.remoteCreatedAt,
              fetchedAt: now,
            })
          }
        })
        run(issues)
        return issues.length
      },
      /** 插入一条目标仓库的 issue（搬运结果），带回源映射 */
      insertTarget(
        target: ImRepo,
        it: ImIssueUpsert & { sourceIssueId: number },
      ): number {
        const result = db
          .prepare(
            `INSERT INTO im_issues
               (instance_id, repo_id, kind, number, title, body, state, html_url, source_issue_id, remote_created_at, fetched_at)
             VALUES (?, ?, 'target', ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(repo_id, number) DO UPDATE SET
               title = excluded.title, body = excluded.body, state = excluded.state,
               html_url = excluded.html_url, source_issue_id = excluded.source_issue_id,
               fetched_at = excluded.fetched_at`,
          )
          .run(
            target.instanceId,
            target.id,
            it.number,
            it.title,
            it.body,
            it.state,
            it.htmlUrl,
            it.sourceIssueId,
            it.remoteCreatedAt,
            Date.now(),
          )
        return result.lastInsertRowid as number
      },
      markMigrated(id: number, migrated: boolean): void {
        db.prepare('UPDATE im_issues SET migrated = ? WHERE id = ?').run(migrated ? 1 : 0, id)
      },
      setAiExplain(id: number, text: string): void {
        db.prepare('UPDATE im_issues SET ai_explain = ? WHERE id = ?').run(text, id)
      },
    },
  }
}
