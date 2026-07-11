import { createRequire } from 'node:module'
import pdfParse from 'pdf-parse'

interface LegacyPdfJsModule {
  PDFJS: {
    verbosity: number
    VERBOSITY_LEVELS: { errors: number }
  }
}

const require = createRequire(import.meta.url)
let verbosityConfigured = false

export async function extractPdfText(buffer: Buffer): Promise<string> {
  configurePdfVerbosity()
  const result = await pdfParse(buffer, { version: 'v1.10.100' })
  return result.text
}

function configurePdfVerbosity(): void {
  if (verbosityConfigured) return

  // pdf-parse loads this legacy PDF.js build lazily. Setting its supported
  // verbosity level keeps malformed embedded-font warnings from flooding logs;
  // parsing errors still reject and continue through the OCR fallback.
  const pdfJs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js') as LegacyPdfJsModule
  pdfJs.PDFJS.verbosity = pdfJs.PDFJS.VERBOSITY_LEVELS.errors
  verbosityConfigured = true
}
