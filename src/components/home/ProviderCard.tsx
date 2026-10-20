import { ArrowUpRight, Lock, Zap } from 'lucide-react'
import type { ProviderMeta } from '../../types'
import { ProviderIcon } from '../ui/ProviderIcon'

export function ProviderCard({
  provider,
  index,
  onOpen,
}: {
  provider: ProviderMeta
  index: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className="provider-card rise"
      style={
        {
          '--pa': provider.accent[0],
          '--pb': provider.accent[1],
          '--i': index,
        } as React.CSSProperties
      }
      onClick={onOpen}
    >
      <span className="pc-top">
        <span className="pc-icon">
          <ProviderIcon name={provider.icon} size={21} />
        </span>
        <span className="pc-arrow">
          <ArrowUpRight size={17} />
        </span>
      </span>

      <span className="pc-name">{provider.name}</span>
      <span className="pc-tagline">{provider.tagline}</span>

      <span className="pc-tags">
        {provider.categories.map((category) => (
          <span className="pc-tag" key={category}>
            {category}
          </span>
        ))}
      </span>

      <span className="pc-foot">
        <span
          className={`pc-status ${
            provider.needsProxy || provider.needsMediaProxy ? 'is-warn' : ''
          }`}
        >
          {provider.needsProxy || provider.needsMediaProxy ? (
            <Lock size={11} />
          ) : (
            <Zap size={11} />
          )}
          {provider.needsProxy || provider.needsMediaProxy
            ? 'Proxy en producción'
            : 'Acceso directo'}
        </span>
        {provider.experimental && <span className="pc-flag">beta</span>}
      </span>
    </button>
  )
}
