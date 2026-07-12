import { AsyncPipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, HostListener, Input, inject, signal } from '@angular/core'
import { AUTH_IDENTITY } from '../core/auth-identity'

@Component({
  selector: 'app-auth-controls',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @if (variant === 'mobile') {
      @if (identity.user$ | async) {
        <button class="mobile-profile" type="button" (click)="toggleMenu()" aria-haspopup="menu" [attr.aria-expanded]="menuOpen()">
          <svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>
          <span>Profile</span>
        </button>
      }
    } @else {
      @if (identity.user$ | async; as user) {
        <div class="sidebar-foot auth-foot">
          <button class="profile-trigger" type="button" (click)="toggleMenu()" aria-haspopup="menu" [attr.aria-expanded]="menuOpen()" aria-label="Open user menu">
            <span class="profile-avatar"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></span>
            <span class="auth-copy"><strong>{{ user.name }}</strong><small>{{ user.email }}</small></span>
            <svg class="profile-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg>
          </button>
        </div>
      }
    }

    @if (menuOpen()) {
      <div class="account-menu-dismiss" role="presentation" (click)="closeMenu()"></div>
      <div class="account-menu" role="menu" [attr.data-variant]="variant">
        <button type="button" role="menuitem" (click)="openProfile()">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>
          View profile
        </button>
        <button type="button" role="menuitem" (click)="logout()">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4M18 12H9"/></svg>
          Sign out
        </button>
      </div>
    }

    @if (profileOpen()) {
      <div class="profile-modal-backdrop" role="presentation" (click)="closeProfile()">
        <section class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" (click)="keepOpen($event)">
          <header>
            <h2 id="profile-modal-title">Profile</h2>
            <button class="profile-modal-close" type="button" (click)="closeProfile()" aria-label="Close profile">×</button>
          </header>
          @if (identity.user$ | async; as user) {
            <div class="profile-summary">
              <span class="profile-modal-avatar"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></span>
              <h3>{{ user.name }}</h3>
              <p>{{ user.email }}</p>
            </div>
            <dl class="profile-details">
              <div><dt>Name</dt><dd>{{ user.name }}</dd></div>
              <div><dt>Email</dt><dd>{{ user.email }}</dd></div>
              <div><dt>Authentication</dt><dd>{{ identity.provider }}</dd></div>
            </dl>
          }
          <footer><button class="button secondary profile-signout" type="button" (click)="logout()">Sign out</button></footer>
        </section>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthControlsComponent {
  @Input() variant: 'footer' | 'mobile' = 'footer'
  protected readonly identity = inject(AUTH_IDENTITY)
  protected readonly menuOpen = signal(false)
  protected readonly profileOpen = signal(false)

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open)
  }

  protected closeMenu(): void {
    this.menuOpen.set(false)
  }

  protected openProfile(): void {
    this.menuOpen.set(false)
    this.profileOpen.set(true)
  }

  protected closeProfile(): void {
    this.profileOpen.set(false)
  }

  protected keepOpen(event: Event): void {
    event.stopPropagation()
  }

  protected logout(): void {
    this.closeMenu()
    this.closeProfile()
    void this.identity.logout()
  }

  @HostListener('document:keydown.escape')
  protected closeOverlays(): void {
    this.closeMenu()
    this.closeProfile()
  }
}
