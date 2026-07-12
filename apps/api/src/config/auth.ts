import { optionalEnv, requireEnv } from './env.js'

export type AuthMode = 'off' | 'local' | 'auth0'

export interface AuthConfiguration {
  mode: AuthMode
  enabled: boolean
  domain: string
  clientId: string
  audience: string
  issuerBaseURL: string
}

const disabledConfiguration: AuthConfiguration = {
  mode: 'off',
  enabled: false,
  domain: '',
  clientId: '',
  audience: '',
  issuerBaseURL: '',
}

export function authConfiguration(): AuthConfiguration {
  const mode = optionalEnv('AUTH_ENABLED')?.toLowerCase() ?? 'false'
  if (mode === 'false' || mode === 'off') return disabledConfiguration
  if (mode === 'local') return { ...disabledConfiguration, mode: 'local', enabled: true }
  if (mode !== 'auth0') throw new Error('AUTH_ENABLED must be false, local, or auth0')

  const domain = normalizeDomain(requireEnv('AUTH0_DOMAIN'))
  return {
    mode: 'auth0',
    enabled: true,
    domain,
    clientId: requireEnv('AUTH0_CLIENT_ID'),
    audience: requireEnv('AUTH0_AUDIENCE'),
    issuerBaseURL: `https://${domain}/`,
  }
}

function normalizeDomain(value: string): string {
  const candidate = value.includes('://') ? value : `https://${value}`
  const parsed = new URL(candidate)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('AUTH0_DOMAIN must be an HTTPS Auth0 tenant or custom domain without a path')
  }
  return parsed.host
}
