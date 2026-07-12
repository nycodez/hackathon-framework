import type { PoolClient } from 'pg'
import { query } from '../db/pool.js'

export interface RecordCreatedLog {
  workspaceId: string
  actorId?: string | null
  recordType: string
  recordId: string
  metadata?: Record<string, unknown>
}

export type ActivityAction = 'created' | 'deleted' | 'registered' | 'login_succeeded' | 'login_failed' | 'logged_out'

export interface ActivityLog extends Omit<RecordCreatedLog, 'workspaceId'> {
  action: ActivityAction
  workspaceId: string | null
}

/**
 * Persist a creation event. Pass the active transaction client so the record
 * and its log entry commit or roll back together.
 */
export async function logRecordCreated(entry: RecordCreatedLog, client?: PoolClient): Promise<void> {
  await logActivity({ ...entry, action: 'created' }, client)
}

export async function logActivity(entry: ActivityLog, client?: PoolClient): Promise<void> {
  const statement = `
    INSERT INTO record_activity_log (
      workspace_id, actor_id, action, record_type, record_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
  `
  const values = [
    entry.workspaceId,
    entry.actorId ?? null,
    entry.action,
    entry.recordType,
    entry.recordId,
    JSON.stringify(entry.metadata ?? {}),
  ]

  if (client) {
    await client.query(statement, values)
    return
  }
  await query(statement, values)
}
