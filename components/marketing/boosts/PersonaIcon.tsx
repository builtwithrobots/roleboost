import {
  Headset,
  HandCoins,
  Megaphone,
  HardHat,
  Store,
  BarChart3,
  ClipboardList,
  Boxes,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import type { PersonaIconKey } from '@/lib/boosts/personas'

// Maps a persona's industry-icon key to its lucide icon. Each icon stands in for
// the person's field, so an example card reads as a career at a glance.
const ICONS: Record<PersonaIconKey, LucideIcon> = {
  headset: Headset, // customer service / support
  handcoins: HandCoins, // retail banking / financial services
  megaphone: Megaphone, // marketing / executive
  hardhat: HardHat, // skilled trades
  store: Store, // retail management
  chart: BarChart3, // data / analytics
  clipboard: ClipboardList, // program / project management
  boxes: Boxes, // operations / fulfillment
  stethoscope: Stethoscope, // healthcare / nursing
}

export default function PersonaIcon({
  icon,
  className,
}: {
  icon: PersonaIconKey
  className?: string
}) {
  const Icon = ICONS[icon] ?? Headset
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />
}
