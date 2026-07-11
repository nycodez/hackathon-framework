import { DatePipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import type { Conversation, DecisionTraceEvent } from '@hackathon/shared'
import { distinctUntilChanged, finalize, map } from 'rxjs'
import { ApiService } from '../core/api.service'
import { MarkdownPipe } from '../core/markdown.pipe'

@Component({
  standalone: true,
  imports: [DatePipe, MarkdownPipe, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page query-page" [class.is-resizing-console]="resizingConsole()" [style.--console-height]="consoleHeight() + 'px'">
      <header class="page-header compact-header">
        <div><span class="eyebrow">Query</span><h1>{{ conversation()?.title ?? 'New conversation' }}</h1></div>
        <a class="button secondary" routerLink="/query">New conversation</a>
      </header>

      <div class="chat-surface" #chatSurface>
        @if (loading()) {
          <div class="state-card" role="status">Loading conversation…</div>
        } @else if (error()) {
          <div class="state-card error" role="alert">{{ error() }}</div>
        }

        @if (!loading() && !conversation()?.messages?.length) {
          <div class="chat-empty">
            <span class="chat-orb">✦</span>
            <h2>What would you like to learn?</h2>
            <p>Ask about any ready document in the corpus. Answers include the retrieved source passages.</p>
            <div class="prompt-chips">
              <button type="button" (click)="usePrompt('Summarize the most important information in the corpus.')">Summarize the corpus</button>
              <button type="button" (click)="usePrompt('What decisions or next steps are described?')">Find next steps</button>
            </div>
          </div>
        }

        <div class="message-list" aria-live="polite">
          @for (message of conversation()?.messages ?? []; track message.id) {
            <article class="message" [class.user-message]="message.role === 'user'">
              <span class="message-avatar">{{ message.role === 'user' ? 'You' : 'AI' }}</span>
              <div class="message-body">
                @if (message.role === 'user') {
                  <p>{{ message.content }}</p>
                } @else {
                  <div class="markdown-content" [innerHTML]="message.content | markdown"></div>
                }
                @if (message.citations.length) {
                  <details class="citations">
                    <summary>{{ message.citations.length }} sources</summary>
                    @for (citation of message.citations; track citation.chunkId) {
                      <blockquote><strong>[{{ citation.label }}] {{ citation.documentName }}</strong><span>{{ citation.excerpt }}</span></blockquote>
                    }
                  </details>
                }
              </div>
            </article>
          }
          @if (sending()) {
            <article class="message"><span class="message-avatar">AI</span><div class="message-body typing">Searching the corpus…</div></article>
          }
        </div>
      </div>

      <form class="composer" (ngSubmit)="submit()">
        <textarea [formControl]="messageControl" rows="1" placeholder="Ask your documents…" aria-label="Message" (keydown)="handleKeydown($event)"></textarea>
        <button class="send-button" type="submit" [disabled]="messageControl.invalid || sending()" aria-label="Send message">↑</button>
        <small>Grounded in the library · Ctrl/⌘ + Enter to send</small>
      </form>

      <div class="decision-console" role="log" aria-live="polite" data-readonly="true" aria-label="Decision console">
        <div
          class="console-resize-handle"
          role="separator"
          tabindex="0"
          aria-label="Resize console"
          aria-orientation="horizontal"
          [attr.aria-valuemin]="minimumConsoleHeight"
          [attr.aria-valuemax]="maximumConsoleHeight()"
          [attr.aria-valuenow]="consoleHeight()"
          (pointerdown)="startConsoleResize($event)"
          (pointermove)="moveConsoleResize($event)"
          (pointerup)="finishConsoleResize($event)"
          (pointercancel)="finishConsoleResize($event)"
          (keydown)="resizeConsoleWithKeyboard($event)"
        ><i></i></div>
        <div class="console-events">
          @if (!displayedTrace().length) {
            <div class="console-empty"><span>›_</span></div>
          } @else {
            @for (event of displayedTrace(); track event.id; let index = $index) {
              <article class="console-event" [attr.data-outcome]="event.outcome">
                <div class="event-rail"><span>{{ index + 1 }}</span><i></i></div>
                <div class="event-copy">
                  <div><strong>{{ event.title }}</strong><time>{{ event.createdAt | date:'mediumTime' }}</time></div>
                  <p>{{ event.detail }}</p>
                  <small>{{ event.stage }} · {{ event.outcome }}</small>
                </div>
              </article>
            }
          }
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryPage implements OnInit {
  @ViewChild('chatSurface') private chatSurface?: ElementRef<HTMLElement>
  private readonly api = inject(ApiService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly destroyRef = inject(DestroyRef)
  protected readonly messageControl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(8000)] })
  protected readonly conversation = signal<Conversation | null>(null)
  protected readonly loading = signal(false)
  protected readonly sending = signal(false)
  protected readonly error = signal('')
  protected readonly minimumConsoleHeight = 110
  protected readonly consoleHeight = signal(150)
  protected readonly maximumConsoleHeight = signal(560)
  protected readonly resizingConsole = signal(false)
  private readonly pendingTrace = signal<DecisionTraceEvent[]>([])
  private resizeStartY = 0
  private resizeStartHeight = 0
  protected readonly displayedTrace = computed(() => {
    if (this.pendingTrace().length) return this.pendingTrace()
    const messages = this.conversation()?.messages ?? []
    return [...messages].reverse().find((message) => message.role === 'assistant')?.decisionTrace ?? []
  })

  ngOnInit(): void {
    this.route.paramMap.pipe(
      map((params) => params.get('conversationId')),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((id) => {
      if (!id) {
        this.conversation.set(null)
        this.pendingTrace.set([])
        this.error.set('')
        return
      }
      this.loadConversation(id)
    })
  }

  protected usePrompt(prompt: string): void {
    this.messageControl.setValue(prompt)
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      this.submit()
    }
  }

  protected startConsoleResize(event: PointerEvent): void {
    if (event.button !== 0) return
    const handle = event.currentTarget as HTMLElement
    this.maximumConsoleHeight.set(this.consoleHeightLimit())
    this.resizeStartY = event.clientY
    this.resizeStartHeight = this.consoleHeight()
    this.resizingConsole.set(true)
    handle.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  protected moveConsoleResize(event: PointerEvent): void {
    if (!this.resizingConsole()) return
    this.consoleHeight.set(this.clampConsoleHeight(this.resizeStartHeight + this.resizeStartY - event.clientY))
  }

  protected finishConsoleResize(event: PointerEvent): void {
    if (!this.resizingConsole()) return
    const handle = event.currentTarget as HTMLElement
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    this.resizingConsole.set(false)
  }

  protected resizeConsoleWithKeyboard(event: KeyboardEvent): void {
    this.maximumConsoleHeight.set(this.consoleHeightLimit())
    const changes: Partial<Record<KeyboardEvent['key'], number>> = {
      ArrowUp: 24,
      ArrowDown: -24,
      PageUp: 80,
      PageDown: -80,
    }
    if (event.key === 'Home') this.consoleHeight.set(this.minimumConsoleHeight)
    else if (event.key === 'End') this.consoleHeight.set(this.maximumConsoleHeight())
    else if (changes[event.key] !== undefined) {
      this.consoleHeight.set(this.clampConsoleHeight(this.consoleHeight() + (changes[event.key] ?? 0)))
    } else return
    event.preventDefault()
  }

  protected submit(): void {
    const content = this.messageControl.value.trim()
    if (!content || this.sending()) return
    this.sending.set(true)
    this.error.set('')
    this.pendingTrace.set([
      pendingEvent('input', 'Query submitted', `Accepted ${content.length} characters for the active workspace.`, 'accepted'),
      pendingEvent('retrieval', 'Corpus retrieval running', 'Comparing the query with ready document chunks using hybrid search.', 'accepted'),
    ])
    const existingId = this.conversation()?.id
    this.api.ask(content, existingId).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.sending.set(false))
    ).subscribe({
      next: (result) => {
        this.conversation.set(result.conversation)
        this.pendingTrace.set([])
        this.messageControl.reset()
        if (!existingId) void this.router.navigate(['/query', result.conversation.id], { replaceUrl: true })
        queueMicrotask(() => this.scrollToBottom())
      },
      error: (error: unknown) => {
        this.pendingTrace.set([])
        this.error.set(this.api.message(error))
      },
    })
  }

  private loadConversation(id: string): void {
    this.loading.set(true)
    this.error.set('')
    this.api.conversation(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (conversation) => {
        this.conversation.set(conversation)
        queueMicrotask(() => this.scrollToBottom())
      },
      error: (error: unknown) => this.error.set(this.api.message(error)),
    })
  }

  private scrollToBottom(): void {
    const element = this.chatSurface?.nativeElement
    if (element) element.scrollTop = element.scrollHeight
  }

  private clampConsoleHeight(height: number): number {
    return Math.min(this.maximumConsoleHeight(), Math.max(this.minimumConsoleHeight, Math.round(height)))
  }

  private consoleHeightLimit(): number {
    return Math.max(this.minimumConsoleHeight, Math.floor(window.innerHeight * 0.62))
  }
}

function pendingEvent(
  stage: DecisionTraceEvent['stage'],
  title: string,
  detail: string,
  outcome: DecisionTraceEvent['outcome']
): DecisionTraceEvent {
  return {
    id: `${stage}-${crypto.randomUUID()}`,
    stage,
    title,
    detail,
    outcome,
    createdAt: new Date().toISOString(),
  }
}
