import type Database from 'better-sqlite3'

export type CrmClientSource =
  | '' | 'xiaohongshu' | 'xianyu' | 'referral' | 'wechat' | 'github' | 'website' | 'other'
export type CrmPaymentMethod = '' | 'bank' | 'wechat' | 'alipay' | 'other'

export interface CrmClientRow {
  id: number
  name: string
  type: 'company' | 'person'
  note: string
  phone: string
  email: string
  legalPerson: string
  legalPersonPhone: string
  uscc: string
  regAddress: string
  establishedDate: string
  source: CrmClientSource
  idCardFront: string
  idCardBack: string
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
  sex: '' | 'male' | 'female'
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
  shareCents: number
  endDate: string
  reqCurrent: string
  reqAdded: string
  reqFuture: string
  createdAt: number
  updatedAt: number
}

export interface CrmPaymentRow {
  id: number
  projectId: number
  amountCents: number
  paidAt: string
  method: CrmPaymentMethod
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

export interface CrmDocRow {
  id: number
  name: string
  storedPath: string
  size: number
  uploadedAt: number
}

export interface CrmProjectListRow {
  id: number
  clientId: number
  name: string
  status: 'active' | 'done'
  clientName: string
  amountCents: number
  shareCents: number
  endDate: string
}

function mapClient(r: Record<string, unknown>): CrmClientRow {
  return {
    id: r.id as number,
    name: r.name as string,
    type: r.type as 'company' | 'person',
    note: r.note as string,
    phone: r.phone as string,
    email: r.email as string,
    legalPerson: r.legal_person as string,
    legalPersonPhone: r.legal_person_phone as string,
    uscc: r.uscc as string,
    regAddress: r.reg_address as string,
    establishedDate: r.established_date as string,
    source: (r.source as CrmClientSource | null) ?? '',
    idCardFront: (r.id_card_front as string | null) ?? '',
    idCardBack: (r.id_card_back as string | null) ?? '',
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
    sex: r.sex as '' | 'male' | 'female',
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
    amountCents: (r.amount_cents as number | null) ?? 0,
    shareCents: (r.share_cents as number | null) ?? 0,
    endDate: r.end_date as string,
    reqCurrent: (r.req_current as string | null) ?? '',
    reqAdded: (r.req_added as string | null) ?? '',
    reqFuture: (r.req_future as string | null) ?? '',
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }
}

function mapPayment(r: Record<string, unknown>): CrmPaymentRow {
  return {
    id: r.id as number,
    projectId: r.project_id as number,
    amountCents: (r.amount_cents as number | null) ?? 0,
    paidAt: r.paid_at as string,
    method: (r.method as CrmPaymentMethod | null) ?? '',
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
      list(f?: { q?: string; type?: 'company' | 'person' }): CrmClientRow[] {
        const conds = ['deleted_at IS NULL']
        const params: unknown[] = []
        if (f?.q) {
          conds.push('name LIKE ?')
          params.push(`%${f.q}%`)
        }
        if (f?.type) {
          conds.push('type = ?')
          params.push(f.type)
        }
        const rows = db
          .prepare(`SELECT * FROM crm_clients WHERE ${conds.join(' AND ')} ORDER BY name`)
          .all(...params) as Record<string, unknown>[]
        return rows.map(mapClient)
      },
      get(id: number): CrmClientRow | null {
        const row = db
          .prepare('SELECT * FROM crm_clients WHERE id = ? AND deleted_at IS NULL')
          .get(id) as Record<string, unknown> | undefined
        return row ? mapClient(row) : null
      },
      create(c: {
        name: string
        type: 'company' | 'person'
        note?: string
        phone?: string
        email?: string
        legalPerson?: string
        legalPersonPhone?: string
        uscc?: string
        regAddress?: string
        establishedDate?: string
        source?: CrmClientSource
      }): number {
        const result = db
          .prepare(
            `INSERT INTO crm_clients(
              name, type, note, phone, email, legal_person, legal_person_phone,
              uscc, reg_address, established_date, source, created_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            c.name, c.type, c.note ?? '', c.phone ?? '', c.email ?? '',
            c.legalPerson ?? '', c.legalPersonPhone ?? '', c.uscc ?? '',
            c.regAddress ?? '', c.establishedDate ?? '', c.source ?? '', Date.now(),
          )
        return result.lastInsertRowid as number
      },
      update(id: number, c: Omit<CrmClientRow, 'id' | 'createdAt' | 'idCardFront' | 'idCardBack'>): void {
        db.prepare(
          `UPDATE crm_clients SET
            name = ?, type = ?, note = ?, phone = ?, email = ?,
            legal_person = ?, legal_person_phone = ?, uscc = ?, reg_address = ?, established_date = ?,
            source = ?
          WHERE id = ?`,
        ).run(
          c.name, c.type, c.note, c.phone, c.email,
          c.legalPerson, c.legalPersonPhone, c.uscc, c.regAddress, c.establishedDate,
          c.source,
          id,
        )
      },
      /** 身份证正/反面图片路径单独维护（上传/删除即生效，不走整体 update） */
      setIdCard(id: number, side: 'front' | 'back', storedPath: string): void {
        const col = side === 'front' ? 'id_card_front' : 'id_card_back'
        db.prepare(`UPDATE crm_clients SET ${col} = ? WHERE id = ?`).run(storedPath, id)
      },
      remove(id: number): void {
        const now = Date.now()
        db.transaction(() => {
          db.prepare('UPDATE crm_clients SET deleted_at = ? WHERE id = ?').run(now, id)
          db.prepare(
            'UPDATE crm_contacts SET deleted_at = ? WHERE client_id = ? AND deleted_at IS NULL',
          ).run(now, id)
          db.prepare(
            'UPDATE crm_projects SET deleted_at = ? WHERE client_id = ? AND deleted_at IS NULL',
          ).run(now, id)
        })()
      },
    },

    contacts: {
      listByClient(clientId: number): CrmContactRow[] {
        const rows = db
          .prepare(
            'SELECT * FROM crm_contacts WHERE client_id = ? AND deleted_at IS NULL ORDER BY name',
          )
          .all(clientId) as Record<string, unknown>[]
        return rows.map(mapContact)
      },
      listAll(f?: { q?: string; clientId?: number }): (CrmContactRow & { clientName: string })[] {
        const conds = ['c.deleted_at IS NULL']
        const params: unknown[] = []
        if (f?.q) {
          conds.push('c.name LIKE ?')
          params.push(`%${f.q}%`)
        }
        if (f?.clientId !== undefined) {
          conds.push('c.client_id = ?')
          params.push(f.clientId)
        }
        const rows = db
          .prepare(
            `SELECT c.*, cl.name AS client_name FROM crm_contacts c
             JOIN crm_clients cl ON cl.id = c.client_id AND cl.deleted_at IS NULL
             WHERE ${conds.join(' AND ')} ORDER BY c.name`,
          )
          .all(...params) as Record<string, unknown>[]
        return rows.map((r) => ({ ...mapContact(r), clientName: r.client_name as string }))
      },
      get(id: number): CrmContactRow | null {
        const row = db
          .prepare('SELECT * FROM crm_contacts WHERE id = ? AND deleted_at IS NULL')
          .get(id) as Record<string, unknown> | undefined
        return row ? mapContact(row) : null
      },
      create(
        clientId: number,
        c: {
          name: string
          role?: string
          phone?: string
          wechat?: string
          email?: string
          sex?: '' | 'male' | 'female'
          note?: string
        },
      ): number {
        const result = db
          .prepare(
            'INSERT INTO crm_contacts(client_id, name, role, phone, wechat, email, sex, note, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            clientId, c.name, c.role ?? '', c.phone ?? '', c.wechat ?? '',
            c.email ?? '', c.sex ?? '', c.note ?? '', Date.now(),
          )
        return result.lastInsertRowid as number
      },
      update(
        id: number,
        c: Omit<CrmContactRow, 'id' | 'clientId' | 'createdAt'>,
      ): void {
        db.prepare(
          'UPDATE crm_contacts SET name = ?, role = ?, phone = ?, wechat = ?, email = ?, sex = ?, note = ? WHERE id = ?',
        ).run(c.name, c.role, c.phone, c.wechat, c.email, c.sex, c.note, id)
      },
      remove(id: number): void {
        db.prepare('UPDATE crm_contacts SET deleted_at = ? WHERE id = ?').run(Date.now(), id)
      },
    },

    projects: {
      listByClient(clientId: number): { id: number; name: string; status: string }[] {
        const rows = db
          .prepare(
            'SELECT id, name, status FROM crm_projects WHERE client_id = ? AND deleted_at IS NULL ORDER BY name',
          )
          .all(clientId) as { id: number; name: string; status: string }[]
        return rows
      },
      listAll(f?: {
        q?: string
        status?: 'active' | 'done'
        clientId?: number
      }): CrmProjectListRow[] {
        const conds = ['p.deleted_at IS NULL']
        const params: unknown[] = []
        if (f?.q) {
          conds.push('p.name LIKE ?')
          params.push(`%${f.q}%`)
        }
        if (f?.status) {
          conds.push('p.status = ?')
          params.push(f.status)
        }
        if (f?.clientId !== undefined) {
          conds.push('p.client_id = ?')
          params.push(f.clientId)
        }
        const rows = db
          .prepare(
            `SELECT p.id, p.client_id, p.name, p.status, p.amount_cents, p.share_cents, p.end_date,
                    cl.name AS client_name
             FROM crm_projects p
             JOIN crm_clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
             WHERE ${conds.join(' AND ')} ORDER BY p.name`,
          )
          .all(...params) as Record<string, unknown>[]
        return rows.map((r) => ({
          id: r.id as number,
          clientId: r.client_id as number,
          name: r.name as string,
          status: r.status as 'active' | 'done',
          clientName: r.client_name as string,
          amountCents: (r.amount_cents as number | null) ?? 0,
          shareCents: (r.share_cents as number | null) ?? 0,
          endDate: r.end_date as string,
        }))
      },
      get(id: number): CrmProjectRow | null {
        const row = db
          .prepare('SELECT * FROM crm_projects WHERE id = ? AND deleted_at IS NULL')
          .get(id) as Record<string, unknown> | undefined
        return row ? mapProject(row) : null
      },
      create(
        clientId: number,
        p: {
          name: string
          status?: 'active' | 'done'
          description?: string
          amountCents?: number
          shareCents?: number
          endDate?: string
        },
      ): number {
        const now = Date.now()
        const result = db
          .prepare(
            `INSERT INTO crm_projects(
              client_id, name, status, description, server_addr, domain, admin_url,
              admin_user, admin_pass, wx_app_id, wx_app_secret, wx_pay_params,
              amount_cents, share_cents, end_date, created_at, updated_at
            ) VALUES(?, ?, ?, ?, '', '', '', '', '', '', '', '[]', ?, ?, ?, ?, ?)`,
          )
          .run(
            clientId, p.name, p.status ?? 'active', p.description ?? '',
            p.amountCents ?? 0, p.shareCents ?? 0, p.endDate ?? '', now, now,
          )
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
            wx_pay_params = ?, amount_cents = ?, share_cents = ?, end_date = ?,
            req_current = ?, req_added = ?, req_future = ?, updated_at = ?
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
          p.shareCents,
          p.endDate,
          p.reqCurrent,
          p.reqAdded,
          p.reqFuture,
          Date.now(),
          id,
        )
      },
      remove(id: number): void {
        db.prepare('UPDATE crm_projects SET deleted_at = ? WHERE id = ?').run(Date.now(), id)
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
        p: { amountCents: number; paidAt: string; method: CrmPaymentMethod; note: string },
      ): number {
        const result = db
          .prepare(
            'INSERT INTO crm_payments(project_id, amount_cents, paid_at, method, note) VALUES(?, ?, ?, ?, ?)',
          )
          .run(projectId, p.amountCents, p.paidAt, p.method, p.note)
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

    docs: {
      list(q?: string): CrmDocRow[] {
        const rows = (
          q
            ? db.prepare('SELECT * FROM crm_docs WHERE name LIKE ? ORDER BY uploaded_at DESC, id DESC').all(`%${q}%`)
            : db.prepare('SELECT * FROM crm_docs ORDER BY uploaded_at DESC, id DESC').all()
        ) as Record<string, unknown>[]
        return rows.map((r) => ({
          id: r.id as number,
          name: r.name as string,
          storedPath: r.stored_path as string,
          size: r.size as number,
          uploadedAt: r.uploaded_at as number,
        }))
      },
      add(d: { name: string; storedPath: string; size: number }): number {
        const result = db
          .prepare('INSERT INTO crm_docs(name, stored_path, size, uploaded_at) VALUES(?, ?, ?, ?)')
          .run(d.name, d.storedPath, d.size, Date.now())
        return result.lastInsertRowid as number
      },
      get(id: number): CrmDocRow | null {
        const row = db.prepare('SELECT * FROM crm_docs WHERE id = ?').get(id) as
          | Record<string, unknown>
          | undefined
        if (!row) return null
        return {
          id: row.id as number,
          name: row.name as string,
          storedPath: row.stored_path as string,
          size: row.size as number,
          uploadedAt: row.uploaded_at as number,
        }
      },
      remove(id: number): void {
        db.prepare('DELETE FROM crm_docs WHERE id = ?').run(id)
      },
    },
  }
}
