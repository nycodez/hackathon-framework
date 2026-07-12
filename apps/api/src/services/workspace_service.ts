import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { authConfiguration } from '../config/auth.js'

const defaultWorkspace = 'hackathon-demo'

export function workspaceId(req: Request): string {
  const authConfig = authConfiguration()
  if (authConfig.mode === 'auth0') {
    const subject = req.auth?.payload.sub
    if (!subject) throw new Error('Authenticated request is missing a subject claim')
    return `auth0-${createHash('sha256').update(subject).digest('hex').slice(0, 48)}`
  }
  if (authConfig.mode === 'local') {
    const userId = req.localAuthUser?.id
    if (!userId) throw new Error('Authenticated request is missing a local user')
    return localWorkspaceId(userId)
  }

  const supplied = req.header('x-workspace-id')?.trim()
  if (!supplied) return defaultWorkspace
  return /^[a-zA-Z0-9_-]{1,64}$/.test(supplied) ? supplied : defaultWorkspace
}

export function localWorkspaceId(userId: string): string {
  return `local-${createHash('sha256').update(userId).digest('hex').slice(0, 48)}`
}

export function actorId(req: Request): string | null {
  const authConfig = authConfiguration()
  if (authConfig.mode === 'auth0') return req.auth?.payload.sub ?? null
  if (authConfig.mode === 'local') return req.localAuthUser?.id ?? null
  return null
}
