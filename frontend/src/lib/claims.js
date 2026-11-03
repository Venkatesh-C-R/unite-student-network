import { Building2, Landmark, MapPin } from 'lucide-react'

export const CATEGORY_ICON = { college: Building2, state: MapPin, national: Landmark }

// Public claim reference, e.g. CLM-0007. The review search accepts this form.
export const claimRef = (id) => `CLM-${String(id).padStart(4, '0')}`

export function resultLabel(result) {
  if (result === 'participation') return 'Participation'
  const n = Number(result)
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} place`
}
