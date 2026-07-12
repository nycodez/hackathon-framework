import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LocalAuthService } from '../core/local-auth.service'

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page local-auth-page">
      <div class="local-auth-card">
        <div class="local-auth-mark" aria-hidden="true">H</div>
        <span class="eyebrow">Local account</span>
        <h1>{{ registering ? 'Create your account' : 'Welcome back' }}</h1>
        <p>{{ registering ? 'Register locally to create your private workspace.' : 'Sign in to continue to your workspace.' }}</p>

        <form (submit)="submit($event)">
          @if (registering) {
            <label>Name<input #nameInput type="text" autocomplete="name" maxlength="100" [value]="name()" (input)="name.set(nameInput.value)" required></label>
          }
          <label>Email<input #emailInput type="email" autocomplete="email" maxlength="254" [value]="email()" (input)="email.set(emailInput.value)" required></label>
          <label>Password<input #passwordInput type="password" [autocomplete]="registering ? 'new-password' : 'current-password'" minlength="8" maxlength="128" [value]="password()" (input)="password.set(passwordInput.value)" required></label>
          @if (registering) {
            <label>Confirm password<input #confirmationInput type="password" autocomplete="new-password" minlength="8" maxlength="128" [value]="confirmation()" (input)="confirmation.set(confirmationInput.value)" required></label>
          }
          @if (error()) { <div class="local-auth-error" role="alert">{{ error() }}</div> }
          <button class="button primary" type="submit" [disabled]="loading()">{{ loading() ? 'Please wait…' : registering ? 'Create account' : 'Sign in' }}</button>
        </form>

        @if (registering) {
          <small>Already registered? <a routerLink="/login">Sign in</a></small>
        } @else {
          <small>Need an account? <a routerLink="/register">Register</a></small>
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalAuthPage implements OnInit {
  private readonly auth = inject(LocalAuthService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  protected readonly name = signal('')
  protected readonly email = signal('')
  protected readonly password = signal('')
  protected readonly confirmation = signal('')
  protected readonly error = signal('')
  protected readonly loading = signal(false)
  protected readonly registering = this.route.snapshot.routeConfig?.path === 'register'

  ngOnInit(): void {
    void this.auth.session().then((session) => {
      if (session) void this.router.navigateByUrl(this.returnUrl())
    })
  }

  protected submit(event: Event): void {
    event.preventDefault()
    if (this.loading()) return
    const name = this.name().trim()
    const email = this.email().trim().toLowerCase()
    const password = this.password()
    if (this.registering && password !== this.confirmation()) {
      this.error.set('Passwords do not match.')
      return
    }
    if ((this.registering && !name) || !email || password.length < 8) {
      this.error.set('Enter a valid name, email, and password of at least 8 characters.')
      return
    }

    this.loading.set(true)
    this.error.set('')
    const request = this.registering ? this.auth.register(name, email, password) : this.auth.signIn(email, password)
    void request.then(() => this.router.navigateByUrl(this.returnUrl())).catch((error: unknown) => {
      this.error.set(error instanceof Error ? error.message : 'Authentication failed')
    }).finally(() => this.loading.set(false))
  }

  private returnUrl(): string {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/'
    return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/'
  }
}
