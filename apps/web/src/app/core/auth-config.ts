import { InjectionToken } from '@angular/core'
import type { ApiEnvelope, PublicAuthConfig } from '@hackathon/shared'

export const AUTH_MODE = new InjectionToken<PublicAuthConfig['mode']>('AUTH_MODE')

const disabledAuthConfig: PublicAuthConfig = {
  mode: 'off',
  enabled: false,
  domain: '',
  clientId: '',
  audience: '',
}

export async function loadAuthConfig(): Promise<PublicAuthConfig> {
  try {
    const response = await fetch('/api/auth-config', { headers: { accept: 'application/json' } })
    if (!response.ok) return disabledAuthConfig
    const payload = await response.json() as ApiEnvelope<PublicAuthConfig>
    const config = payload.data
    if (!payload.success || !config) return disabledAuthConfig
    if (!['off', 'local', 'auth0'].includes(config.mode)) return disabledAuthConfig
    if (config.mode === 'auth0' && (!config.domain || !config.clientId || !config.audience)) return disabledAuthConfig
    return config
  } catch {
    return disabledAuthConfig
  }
}
