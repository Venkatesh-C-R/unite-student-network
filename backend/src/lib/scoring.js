// Confirmed UNITE scoring rules. Results below 10th are submitted as "participation".
const BASE_POINTS = {
  1: 100, 2: 70, 3: 50, 4: 45, 5: 40, 6: 35, 7: 30, 8: 25, 9: 20, 10: 15,
  participation: 10,
}

// The host institution decides the category: PSG → college, other college → state, INI → national.
const MULTIPLIER = { college: 1.0, state: 1.5, national: 2.0 }

export function scoreFor(result, hostCategory) {
  const base = BASE_POINTS[result]
  const multiplier = MULTIPLIER[hostCategory]
  if (base === undefined || multiplier === undefined) throw new Error('Unknown result or category')
  return { base, multiplier, points: Math.round(base * multiplier * 10) / 10 }
}
