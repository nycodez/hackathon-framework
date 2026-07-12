import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/" aria-label="Hackathon Framework dashboard">
          <span class="brand-mark">H</span>
          <span class="brand-copy"><small>Hackathon</small><strong>Framework</strong></span>
        </a>

        <nav aria-label="Primary navigation">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="exactPathMatch">
            <svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 13a8 8 0 1 1 16 0"/><path d="M12 13l4-4"/><path d="M5 19h14"/></svg>
            <span>Dashboard</span>
          </a>
          <a routerLink="/query" routerLinkActive="active">
            <svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 1-3.2-6.4"/><path d="M20 4v5h-5"/><path d="M8.5 11h7M8.5 15h4"/></svg>
            <span>Query</span>
          </a>
          <a routerLink="/results" routerLinkActive="active">
            <svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>
            <span>Results</span>
          </a>
          <a routerLink="/library" routerLinkActive="active">
            <svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7V5h7l2 2"/></svg>
            <span>Library</span>
          </a>
        </nav>

        <div class="sidebar-foot">
          <span class="status-dot"></span>
          <span><strong>Demo workspace</strong><small>RDS + pgvector</small></span>
        </div>
      </aside>

      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  protected readonly exactPathMatch = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  } as const
}
