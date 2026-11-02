import { z } from 'zod'

export const id = z.coerce.number().int().positive()
export const idParam = (name = 'id') => z.object({ [name]: id })

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(190)
  .pipe(z.email({ message: 'Enter a valid email address.' }))

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')

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
