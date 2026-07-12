import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { createAuthClient } from 'better-auth/client'
import { BehaviorSubject } from 'rxjs'

const authClient = createAuthClient()
type LocalSession = typeof authClient.$Infer.Session

export interface LocalAuthUser {
  id: string
  name: string
  email: string
  image?: string | null
}

@Injectable({ providedIn: 'root' })
export class LocalAuthService {
  private readonly userSubject = new BehaviorSubject<LocalAuthUser | null>(null)
  private sessionRequest: Promise<LocalSession | null> | null = null
  private currentSession: LocalSession | null = null
  private loaded = false
  readonly user$ = this.userSubject.asObservable()

  constructor(private readonly router: Router) {}

  async session(force = false): Promise<LocalSession | null> {
    if (!force && this.loaded) return this.currentSession
    if (this.sessionRequest) return this.sessionRequest
    this.sessionRequest = authClient.getSession().then(({ data }) => {
      const session = data as LocalSession | null
      this.loaded = true
      this.currentSession = session
      this.userSubject.next(session?.user ?? null)
      return session
    }).finally(() => {
      this.sessionRequest = null
    })
    return this.sessionRequest
  }

  async signIn(email: string, password: string): Promise<void> {
    const result = await authClient.signIn.email({ email, password })
    if (result.error) throw new Error(result.error.message ?? 'Unable to sign in')
    await this.session(true)
  }

  async register(name: string, email: string, password: string): Promise<void> {
    const result = await authClient.signUp.email({ name, email, password })
    if (result.error) throw new Error(result.error.message ?? 'Unable to create account')
    await this.session(true)
  }

  async signOut(): Promise<void> {
    const result = await authClient.signOut()
    if (result.error) throw new Error(result.error.message ?? 'Unable to sign out')
    this.loaded = true
    this.currentSession = null
    this.userSubject.next(null)
    await this.router.navigate(['/login'])
  }
}
