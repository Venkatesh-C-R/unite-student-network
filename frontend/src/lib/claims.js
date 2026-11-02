import { Building2, Landmark, MapPin } from 'lucide-react'

export const CATEGORY_ICON = { college: Building2, state: MapPin, national: Landmark }

export function resultLabel(result) {
  if (result === 'participation') return 'Participation'
  const n = Number(result)
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} place`
}
