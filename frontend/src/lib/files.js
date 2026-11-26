// Upload rules, matching the server (backend/src/lib/uploads.js). Photos may be large because the
// server shrinks them before saving; PDFs are stored as they are, so their limit is lower.
export const DOC_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
export const IMAGE_TYPES = ['image/png', 'image/jpeg']
const MB = 1024 * 1024
export const MAX_IMAGE_BYTES = 10 * MB
export const MAX_PDF_BYTES = 3 * MB

export const DOC_HINT = 'PDF up to 3 MB · PNG or JPG photo up to 10 MB'
export const IMAGE_HINT = 'PNG or JPG · up to 10 MB'

// Returns a message explaining why the file can't be used, or '' when it is fine
export function fileProblem(f, types = DOC_TYPES) {
  if (!types.includes(f.type)) return `"${f.name}" is not a ${types.includes('application/pdf') ? 'PDF, PNG or JPG' : 'PNG or JPG'}.`
  if (f.type === 'application/pdf' && f.size > MAX_PDF_BYTES) return `"${f.name}" is larger than 3 MB. Save the PDF at a smaller size, or upload a photo of it instead.`
  if (f.size > MAX_IMAGE_BYTES) return `"${f.name}" is larger than 10 MB.`
  return ''
}
