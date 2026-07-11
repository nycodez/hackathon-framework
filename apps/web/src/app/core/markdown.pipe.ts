import { Pipe, type PipeTransform, SecurityContext, inject } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { marked } from 'marked'

@Pipe({
  name: 'markdown',
  standalone: true,
  pure: true,
})
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer)

  transform(value: string): string {
    const rendered = marked.parse(value, { async: false, breaks: true, gfm: true })
    if (typeof rendered !== 'string') return ''
    return this.sanitizer.sanitize(SecurityContext.HTML, rendered) ?? ''
  }
}
