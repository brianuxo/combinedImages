import {
  Camera,
  Flame,
  Globe2,
  Image as ImageIcon,
  Landmark,
  Layers,
  MonitorPlay,
  Shield,
  Sparkles,
  TriangleAlert,
  Wallpaper,
} from 'lucide-react'
import type { ProviderIcon as ProviderIconName } from '../../types'

const ICONS = {
  sparkles: Sparkles,
  shield: Shield,
  image: ImageIcon,
  layers: Layers,
  monitor: MonitorPlay,
  flame: Flame,
  alert: TriangleAlert,
  wallpaper: Wallpaper,
  globe: Globe2,
  landmark: Landmark,
  camera: Camera,
} as const

export function ProviderIcon({
  name,
  size = 18,
  strokeWidth = 1.8,
}: {
  name: ProviderIconName
  size?: number
  strokeWidth?: number
}) {
  const Icon = ICONS[name] ?? ImageIcon
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />
}
