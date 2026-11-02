// Small wrapper for the UNITE API. Cookies carry the session; the X-UNITE header is required
// by the server's CSRF check on every state-changing request.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Something went wrong. Please try again.')
    this.status = status
    this.code = body?.error
  }
}

// `body` may be a plain object (sent as JSON) or FormData (sent as multipart, e.g. evidence files)
export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'x-unite': '1', ...(body && !isForm ? { 'content-type': 'application/json' } : {}) },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    })
  } catch {
    throw new ApiError(0, { message: 'Cannot reach the UNITE server. Is the backend running?' })
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}
