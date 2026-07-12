import { InjectionToken } from '@angular/core'
import { AuthService } from '@auth0/auth0-angular'
import { map, type Observable } from 'rxjs'
import { LocalAuthService } from './local-auth.service'

export interface AuthIdentityUser {
  name: string
  email: string
}

export interface AuthIdentity {
  provider: string
  user$: Observable<AuthIdentityUser | null>
  logout(): void | Promise<void>
}

export const AUTH_IDENTITY = new InjectionToken<AuthIdentity>('AUTH_IDENTITY')

export function auth0Identity(auth: AuthService): AuthIdentity {
  return {
    provider: 'Auth0',
    user$: auth.user$.pipe(map((user) => user ? {
      name: user.name ?? user.nickname ?? 'User',
      email: user.email ?? 'Authenticated',
    } : null)),
    logout: () => {
      auth.logout({ logoutParams: { returnTo: window.location.origin } }).subscribe()
    },
  }
}

export function localIdentity(auth: LocalAuthService): AuthIdentity {
  return {
    provider: 'Local account',
    user$: auth.user$.pipe(map((user) => user ? { name: user.name, email: user.email } : null)),
    logout: () => auth.signOut(),
  }
}
