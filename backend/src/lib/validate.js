import { z } from 'zod'

export const id = z.coerce.number().int().positive()
export const idParam = (name = 'id') => z.object({ [name]: id })

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(30, 'Email addresses can be at most 30 characters.')
  .pipe(z.email({ message: 'Enter a valid email address.' }))

export const otpCode = z.string().trim().regex(/^\d{6}$/, 'The code has 6 digits.')

export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'https:' || u.protocol === 'http:'
    } catch {
      return false
    }
  }, 'Links must be full http(s) URLs.')

export const text = (max, min = 0) => z.string().trim().min(min).max(max)
