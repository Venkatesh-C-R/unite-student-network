import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const badRequest = (msg, code = 'bad_request') => new HttpError(400, msg, code)
export const unauthorized = (msg = 'Please sign in.') => new HttpError(401, msg, 'unauthorized')
export const forbidden = (msg = 'You are not allowed to do that.') => new HttpError(403, msg, 'forbidden')
export const notFound = (msg = 'Not found.') => new HttpError(404, msg, 'not_found')
export const conflict = (msg, code = 'conflict') => new HttpError(409, msg, code)

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_error',
      message: err.issues[0]?.message || 'Invalid input.',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message })
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'file_too_large', message: 'Each file must be 5 MB or smaller.' })
  }
  if (err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'too_many_files', message: 'Upload at most 5 files in the "evidence" field.' })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_json', message: 'Request body is not valid JSON.' })
  }
  console.error(err)
  res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' })
}
