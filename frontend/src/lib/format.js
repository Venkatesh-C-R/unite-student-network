export function formatPoints(p) {
  const n = Number(p) || 0
  return n % 1 ? n.toFixed(1) : String(n)
}

export function timeAgo(date) {
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000))
  const units = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
  ]
  let v = s
  for (const [step, unit] of units) {
    if (v < step) return `${Math.floor(v)} ${unit}${Math.floor(v) === 1 ? '' : 's'} ago`
    v /= step
  }
  return `${Math.floor(v)} years ago`
}
