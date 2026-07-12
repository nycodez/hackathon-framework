import { DatePipe, DecimalPipe } from '@angular/common'
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser'
import { ActivatedRoute, Router } from '@angular/router'
import type { KnowledgeDocument, LibraryListing } from '@hackathon/shared'
import { distinctUntilChanged, finalize, from, map, of, switchMap } from 'rxjs'
import { ApiService } from '../core/api.service'
import { MarkdownPipe } from '../core/markdown.pipe'

const emptyListing: LibraryListing = {
  currentFolder: null,
  breadcrumbs: [],
  folders: [],
  documents: [],
}

type PreviewKind = 'pdf' | 'image' | 'markdown' | 'text' | 'unsupported'

interface DocumentPreview {
  document: KnowledgeDocument
  kind: PreviewKind
  url: string
  trustedUrl: SafeResourceUrl | null
}

@Component({
  standalone: true,
  imports: [DatePipe, DecimalPipe, MarkdownPipe],
  template: `
    <section class="page">
      <header class="page-header compact-header">
        <div><span class="eyebrow">Library</span><h1>{{ listing().currentFolder?.name ?? 'Learning library' }}</h1><p>Organize source material into folders and query it once processing is complete.</p></div>
        <div class="library-actions">
          <button class="button secondary" type="button" (click)="showFolderForm.set(true)">New folder</button>
          <button class="button primary" type="button" (click)="fileInput.click()" [disabled]="uploading()">{{ uploading() ? 'Processing…' : 'Upload file' }}</button>
        </div>
        <input #fileInput type="file" hidden accept=".txt,.md,.csv,.json,.html,.pdf,image/png,image/jpeg,image/webp" (change)="selectFile($event)">
      </header>

      <nav class="library-breadcrumbs" aria-label="Library folders">
        <button type="button" (click)="openFolder(null)" [class.current]="!currentFolderId()">Library</button>
        @for (folder of listing().breadcrumbs; track folder.id) {
          <span aria-hidden="true">›</span>
          <button type="button" (click)="openFolder(folder.id)" [class.current]="folder.id === currentFolderId()">{{ folder.name }}</button>
        }
      </nav>

      @if (showFolderForm()) {
        <form class="new-folder-form" (submit)="createFolder($event)">
          <input #folderName type="text" maxlength="80" autocomplete="off" placeholder="Folder name" [value]="folderDraft()" (input)="folderDraft.set(folderName.value)">
          <button class="button primary" type="submit" [disabled]="!folderDraft().trim() || creatingFolder()">Create</button>
          <button class="button secondary" type="button" (click)="cancelFolder()">Cancel</button>
        </form>
      }

      <div class="upload-note"><span>↑</span><div><strong>Upload limit: 4 MB</strong><small>New files are saved in the current folder, then extracted, summarized, and indexed.</small></div></div>

      @if (error()) {
        <div class="state-card error" role="alert">{{ error() }}</div>
      }
      @if (loading()) {
        <div class="state-card" role="status">Loading library…</div>
      } @else {
        @if (listing().folders.length) {
          <div class="folder-grid" aria-label="Folders">
            @for (folder of listing().folders; track folder.id) {
              <article class="folder-item">
                <button class="folder-card" type="button" (click)="openFolder(folder.id)">
                  <span class="folder-icon">▰</span>
                  <span><strong>{{ folder.name }}</strong><small>Folder</small></span>
                  <i aria-hidden="true">›</i>
                </button>
                <button class="folder-delete" type="button" [disabled]="deletingId() === folder.id" (click)="deleteFolder(folder.id)" aria-label="Delete folder">×</button>
              </article>
            }
          </div>
        }

        @if (!hasItems()) {
          <div class="empty-card"><span>▱</span><h2>This folder is empty</h2><p>Add a folder or upload source material here.</p></div>
        } @else if (listing().documents.length) {
          <div class="file-table" role="table" aria-label="Library documents">
            <div class="file-row file-head" role="row"><span>File</span><span>Pipeline</span><span>Size</span><span>Updated</span></div>
            @for (document of listing().documents; track document.id) {
              <article class="file-row" role="row">
                <button class="file-name file-preview-trigger" type="button" (click)="openPreview(document)" [attr.aria-label]="'Preview ' + document.name"><span class="file-icon">▱</span><span class="file-copy"><strong>{{ document.name }}</strong><small>{{ document.mimeType }} · {{ document.chunkCount }} chunks</small></span></button>
                <div><span class="status-pill" [attr.data-status]="document.status"><i></i>{{ document.status }}</span>@if (document.errorMessage) { <small class="file-error">{{ document.errorMessage }}</small> }</div>
                <span>{{ document.sizeBytes / 1024 | number:'1.0-1' }} KB</span>
                <span>{{ document.updatedAt | date:'short' }}</span>
                <button class="file-delete" type="button" [disabled]="deletingId() === document.id" (click)="deleteDocument(document.id)" aria-label="Delete document">×</button>
              </article>
            }
          </div>
        }
      }
    </section>

    @if (preview(); as filePreview) {
      <div class="preview-backdrop" role="presentation" (click)="closePreview()">
        <section class="document-preview" role="dialog" aria-modal="true" aria-labelledby="preview-heading" (click)="keepPreviewOpen($event)">
          <header class="preview-header">
            <div>
              <h2 id="preview-heading">{{ filePreview.document.name }}</h2>
              <p>{{ filePreview.document.mimeType }} · {{ filePreview.document.sizeBytes / 1024 | number:'1.0-1' }} KB</p>
            </div>
            <button class="preview-close" type="button" (click)="closePreview()" aria-label="Close preview">×</button>
          </header>

          <div class="preview-body" [attr.data-kind]="filePreview.kind">
            @if (previewLoading()) {
              <div class="preview-state" role="status">Loading preview…</div>
            } @else if (previewError()) {
              <div class="preview-state error" role="alert">{{ previewError() }}</div>
            } @else if (filePreview.kind === 'pdf') {
              <iframe [src]="filePreview.trustedUrl" [title]="filePreview.document.name"></iframe>
            } @else if (filePreview.kind === 'image') {
              <img [src]="filePreview.url" [alt]="filePreview.document.name">
            } @else if (filePreview.kind === 'markdown') {
              <article class="preview-markdown markdown-content" [innerHTML]="previewText() | markdown"></article>
            } @else if (filePreview.kind === 'text') {
              <pre>{{ previewText() }}</pre>
            } @else {
              <div class="preview-state"><p>This file type can be downloaded but does not have an inline viewer.</p><a class="button primary" [href]="filePreview.url" [download]="filePreview.document.name">Download file</a></div>
            }
          </div>
        </section>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesPage implements OnInit {
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>
  private readonly api = inject(ApiService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly destroyRef = inject(DestroyRef)
  private readonly sanitizer = inject(DomSanitizer)
  private previewObjectUrl: string | null = null
  protected readonly listing = signal<LibraryListing>(emptyListing)
  protected readonly currentFolderId = signal<string | null>(null)
  protected readonly loading = signal(true)
  protected readonly uploading = signal(false)
  protected readonly deletingId = signal<string | null>(null)
  protected readonly creatingFolder = signal(false)
  protected readonly showFolderForm = signal(false)
  protected readonly folderDraft = signal('')
  protected readonly error = signal('')
  protected readonly preview = signal<DocumentPreview | null>(null)
  protected readonly previewText = signal('')
  protected readonly previewLoading = signal(false)
  protected readonly previewError = signal('')
  protected readonly hasItems = computed(() => Boolean(this.listing().folders.length || this.listing().documents.length))

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreviewObjectUrl())
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(
      map((params) => params.get('folder')),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((folderId) => {
      this.currentFolderId.set(folderId)
      this.load()
    })
  }

  protected openFolder(folderId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { folder: folderId },
      queryParamsHandling: 'merge',
    })
  }

  protected createFolder(event: Event): void {
    event.preventDefault()
    const name = this.folderDraft().trim()
    if (!name || this.creatingFolder()) return
    this.creatingFolder.set(true)
    this.error.set('')
    this.api.createFolder(name, this.currentFolderId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.creatingFolder.set(false))
    ).subscribe({
      next: () => {
        this.cancelFolder()
        this.load()
      },
      error: (error: unknown) => this.error.set(this.api.message(error)),
    })
  }

  protected cancelFolder(): void {
    this.folderDraft.set('')
    this.showFolderForm.set(false)
  }

  protected selectFile(event: Event): void {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file || this.uploading()) return
    this.uploading.set(true)
    this.error.set('')
    this.api.upload(file, this.currentFolderId()).pipe(
      switchMap((document) => this.api.processDocument(document.id)),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.uploading.set(false)
        if (this.fileInput) this.fileInput.nativeElement.value = ''
      })
    ).subscribe({
      next: () => this.load(),
      error: (error: unknown) => this.error.set(this.api.message(error)),
    })
  }

  protected deleteDocument(id: string): void {
    if (this.deletingId()) return
    this.deletingId.set(id)
    this.error.set('')
    this.api.deleteDocument(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.deletingId.set(null))
    ).subscribe({
      next: () => this.listing.update((listing) => ({
        ...listing,
        documents: listing.documents.filter((document) => document.id !== id),
      })),
      error: (error: unknown) => this.error.set(this.api.message(error)),
    })
  }

  protected deleteFolder(id: string): void {
    if (this.deletingId()) return
    this.deletingId.set(id)
    this.error.set('')
    this.api.deleteFolder(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.deletingId.set(null))
    ).subscribe({
      next: () => this.load(),
      error: (error: unknown) => this.error.set(this.api.message(error)),
    })
  }

  protected openPreview(document: KnowledgeDocument): void {
    const kind = this.previewKind(document)
    this.revokePreviewObjectUrl()
    this.previewText.set('')
    this.previewError.set('')
    this.previewLoading.set(true)
    this.preview.set({
      document,
      kind,
      url: '',
      trustedUrl: null,
    })

    this.api.documentBlob(document.id).pipe(
      switchMap((blob) => kind === 'markdown' || kind === 'text'
        ? from(blob.text()).pipe(map((content) => ({ blob, content })))
        : of({ blob, content: '' })),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (this.preview()?.document.id === document.id) this.previewLoading.set(false)
      })
    ).subscribe({
      next: ({ blob, content }) => {
        if (this.preview()?.document.id !== document.id) return
        if (kind === 'markdown' || kind === 'text') {
          this.previewText.set(content)
          return
        }
        const url = URL.createObjectURL(blob)
        this.previewObjectUrl = url
        this.preview.update((current) => current?.document.id === document.id ? {
          ...current,
          url,
          trustedUrl: kind === 'pdf' ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null,
        } : current)
      },
      error: (error: unknown) => {
        if (this.preview()?.document.id === document.id) this.previewError.set(this.api.message(error))
      },
    })
  }

  protected closePreview(): void {
    this.revokePreviewObjectUrl()
    this.preview.set(null)
    this.previewText.set('')
    this.previewLoading.set(false)
    this.previewError.set('')
  }

  protected keepPreviewOpen(event: Event): void {
    event.stopPropagation()
  }

  @HostListener('document:keydown.escape')
  protected closePreviewWithEscape(): void {
    if (this.preview()) this.closePreview()
  }

  private load(): void {
    this.loading.set(true)
    this.error.set('')
    this.api.library(this.currentFolderId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (listing) => this.listing.set(listing),
      error: (error: unknown) => this.error.set(this.api.message(error)),
    })
  }

  private previewKind(document: KnowledgeDocument): PreviewKind {
    const mimeType = document.mimeType.toLowerCase()
    const extension = document.name.toLowerCase().split('.').pop() ?? ''
    if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType === 'text/markdown' || extension === 'md' || extension === 'markdown') return 'markdown'
    if (mimeType.startsWith('text/') || ['application/json', 'application/xml'].includes(mimeType)) return 'text'
    return 'unsupported'
  }

  private revokePreviewObjectUrl(): void {
    if (!this.previewObjectUrl) return
    URL.revokeObjectURL(this.previewObjectUrl)
    this.previewObjectUrl = null
  }
}
