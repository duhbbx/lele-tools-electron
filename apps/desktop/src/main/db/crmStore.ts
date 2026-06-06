import type Database from 'better-sqlite3'

export interface CrmClientRow {
  id: number
  name: string
  type: 'company' | 'person'
  note: string
  createdAt: number
}

export interface CrmContactRow {
  id: number
  clientId: number
  name: string
  role: string
  phone: string
  wechat: string
  email: string
  note: string
  createdAt: number
}

export interface CrmProjectRow {
  id: number
  clientId: number
  name: string
  status: 'active' | 'done'
  description: string
  serverAddr: string
  domain: string
  adminUrl: string
  adminUser: string
  adminPass: string
  wxAppId: string
  wxAppSecret: string
  wxPayParams: string
  amountCents: number
  endDate: string
  createdAt: number
  updatedAt: number
}

export interface CrmPaymentRow {
  id: number
  projectId: number
  amountCents: number
  paidAt: string
  note: string
}

export interface CrmFileRow {
  id: number
  projectId: number
  name: string
  storedPath: string
  size: number
  uploadedAt: number
}

function mapClient(r: Record<string, unknown>): CrmClientRow {
  return {
    id: r.id as number,
    name: r.name as string,
    type: r.type as 'company' | 'person',
    note: r.note as string,
    createdAt: r.created_at as number,
  }
}

function mapContact(r: Record<string, unknown>): CrmContactRow {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    name: r.name as string,
    role: r.role as string,
    phone: r.phone as string,
    wechat: r.wechat as string,
    email: r.email as string,
    note: r.note as string,
    createdAt: r.created_at as number,
  }
}

function mapProject(r: Record<string, unknown>): CrmProjectRow {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    name: r.name as string,
    status: r.status as 'active' | 'done',
    description: r.description as string,
    serverAddr: r.server_addr as string,
    domain: r.domain as string,
    adminUrl: r.admin_url as string,
    adminUser: r.admin_user as string,
    adminPass: r.admin_pass as string,
    wxAppId: r.wx_app_id as string,
    wxAppSecret: r.wx_app_secret as string,
    wxPayParams: r.wx_pay_params as string,
    amountCents: r.amount_cents as number,
    endDate: r.end_date as string,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

function mapPayment(r: Record<string, unknown>): CrmPaymentRow {
  return {
    id: r.id as number,
    projectId: r.project_id as number,
    amountCents: r.amount_cents as number,
    paidAt: r.paid_at as string,
    note: r.note as string,
  }
}

function mapFile(r: Record<string, unknown>): CrmFileRow {
  return {
    id: r.id as number,
    projectId: r.project_id as number,
    name: r.name as string,
    storedPath: r.stored_path as string,
    size: r.size as number,
    uploadedAt: r.uploaded_at as number,
  }
}

export function makeCrmStore(db: Database.Database) {
  return {
    clients: {
      list(): CrmClientRow[] {
        const rows = db.prepare('SELECT * FROM crm_clients ORDER BY name').all() as Record<
          string,
          unknown
        >[]
        return rows.map(mapClient)
      },
      get(id: number): CrmClientRow | null {
        const row = db.prepare('SELECT * FROM crm_clients WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapClient(row) : null
      },
      create(c: { name: string; type: 'company' | 'person'; note: string }): number {
        const result = db
          .prepare(
            'INSERT INTO crm_clients(name, type, note, created_at) VALUES(?, ?, ?, ?)',
          )
          .run(c.name, c.type, c.note, Date.now())
        return result.lastInsertRowid as number
      },
      update(id: number, c: { name: string; type: 'company' | 'person'; note: string }): void {
        db.prepare('UPDATE crm_clients SET name = ?, type = ?, note = ? WHERE id = ?').run(
          c.name,
          c.type,
          c.note,
          id,
        )
      },
      remove(id: number): void {
        db.prepare('DELETE FROM crm_clients WHERE id = ?').run(id)
      },
    },

    contacts: {
      listByClient(clientId: number): CrmContactRow[] {
        const rows = db
          .prepare('SELECT * FROM crm_contacts WHERE client_id = ? ORDER BY name')
          .all(clientId) as Record<string, unknown>[]
        return rows.map(mapContact)
      },
      get(id: number): CrmContactRow | null {
        const row = db.prepare('SELECT * FROM crm_contacts WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapContact(row) : null
      },
      create(clientId: number, name: string): number {
        const result = db
          .prepare(
            'INSERT INTO crm_contacts(client_id, name, role, phone, wechat, email, note, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(clientId, name, '', '', '', '', '', Date.now())
        return result.lastInsertRowid as number
      },
      update(
        id: number,
        c: Omit<CrmContactRow, 'id' | 'clientId' | 'createdAt'>,
      ): void {
        db.prepare(
          'UPDATE crm_contacts SET name = ?, role = ?, phone = ?, wechat = ?, email = ?, note = ? WHERE id = ?',
        ).run(c.name, c.role, c.phone, c.wechat, c.email, c.note, id)
      },
      remove(id: number): void {
        db.prepare('DELETE FROM crm_contacts WHERE id = ?').run(id)
      },
    },

    projects: {
      listByClient(clientId: number): { id: number; name: string; status: string }[] {
        const rows = db
          .prepare('SELECT id, name, status FROM crm_projects WHERE client_id = ? ORDER BY name')
          .all(clientId) as { id: number; name: string; status: string }[]
        return rows
      },
      get(id: number): CrmProjectRow | null {
        const row = db.prepare('SELECT * FROM crm_projects WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapProject(row) : null
      },
      create(clientId: number, name: string): number {
        const now = Date.now()
        const result = db
          .prepare(
            `INSERT INTO crm_projects(
              client_id, name, status, description, server_addr, domain, admin_url,
              admin_user, admin_pass, wx_app_id, wx_app_secret, wx_pay_params,
              amount_cents, end_date, created_at, updated_at
            ) VALUES(?, ?, 'active', '', '', '', '', '', '', '', '', '[]', 0, ?, ?, ?)`,
          )
          .run(clientId, name, '', now, now)
        return result.lastInsertRowid as number
      },
      update(
        id: number,
        p: Omit<CrmProjectRow, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>,
      ): void {
        db.prepare(
          `UPDATE crm_projects SET
            name = ?, status = ?, description = ?, server_addr = ?, domain = ?,
            admin_url = ?, admin_user = ?, admin_pass = ?, wx_app_id = ?, wx_app_secret = ?,
            wx_pay_params = ?, amount_cents = ?, end_date = ?, updated_at = ?
          WHERE id = ?`,
        ).run(
          p.name,
          p.status,
          p.description,
          p.serverAddr,
          p.domain,
          p.adminUrl,
          p.adminUser,
          p.adminPass,
          p.wxAppId,
          p.wxAppSecret,
          p.wxPayParams,
          p.amountCents,
          p.endDate,
          Date.now(),
          id,
        )
      },
      remove(id: number): void {
        db.prepare('DELETE FROM crm_projects WHERE id = ?').run(id)
      },
    },

    payments: {
      listByProject(projectId: number): CrmPaymentRow[] {
        const rows = db
          .prepare(
            'SELECT * FROM crm_payments WHERE project_id = ? ORDER BY paid_at, id',
          )
          .all(projectId) as Record<string, unknown>[]
        return rows.map(mapPayment)
      },
      add(
        projectId: number,
        p: { amountCents: number; paidAt: string; note: string },
      ): number {
        const result = db
          .prepare(
            'INSERT INTO crm_payments(project_id, amount_cents, paid_at, note) VALUES(?, ?, ?, ?)',
          )
          .run(projectId, p.amountCents, p.paidAt, p.note)
        return result.lastInsertRowid as number
      },
      remove(id: number): void {
        db.prepare('DELETE FROM crm_payments WHERE id = ?').run(id)
      },
    },

    files: {
      listByProject(projectId: number): CrmFileRow[] {
        const rows = db
          .prepare('SELECT * FROM crm_files WHERE project_id = ? ORDER BY uploaded_at, id')
          .all(projectId) as Record<string, unknown>[]
        return rows.map(mapFile)
      },
      add(
        projectId: number,
        f: { name: string; storedPath: string; size: number },
      ): number {
        const result = db
          .prepare(
            'INSERT INTO crm_files(project_id, name, stored_path, size, uploaded_at) VALUES(?, ?, ?, ?, ?)',
          )
          .run(projectId, f.name, f.storedPath, f.size, Date.now())
        return result.lastInsertRowid as number
      },
      get(id: number): CrmFileRow | null {
        const row = db.prepare('SELECT * FROM crm_files WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        return row ? mapFile(row) : null
      },
      remove(id: number): void {
        db.prepare('DELETE FROM crm_files WHERE id = ?').run(id)
      },
    },
  }
}
