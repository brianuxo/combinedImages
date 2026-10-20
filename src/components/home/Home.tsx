import { ArrowDown, Sparkles } from 'lucide-react'
import { useSettings } from '../../context/settings'
import { PROVIDERS } from '../../data/providers'
import { isProviderVisible } from '../../lib/visibility'
import type { ProviderId } from '../../types'
import { ProviderCard } from './ProviderCard'

export function Home({ onOpen }: { onOpen: (id: ProviderId) => void }) {
  const { settings } = useSettings()
  const visible = PROVIDERS.filter((provider) => isProviderVisible(provider, settings))

  return (
    <div className="home">
      <section className="hero">
        <span className="eyebrow rise">
          <Sparkles size={13} />
          {visible.length} fuentes conectadas
        </span>

        <h1 className="rise" style={{ '--i': 1 } as React.CSSProperties}>
          Tus imágenes,
          <br />
          <em>en un solo flujo.</em>
        </h1>

        <p className="hero-sub rise" style={{ '--i': 2 } as React.CSSProperties}>
          Explora, filtra y descarga fondos de pantalla y arte de varias fuentes. Sin cuentas,
          sin servidores y directo a tu dispositivo.
        </p>

        <div className="hero-stats rise" style={{ '--i': 3 } as React.CSSProperties}>
          <span>
            <strong>{visible.length}</strong> fuentes
          </span>
          <i />
          <span>
            <strong>0</strong> registros
          </span>
          <i />
          <span>
            <strong>100%</strong> local
          </span>
        </div>

        <span className="scroll-hint rise" style={{ '--i': 4 } as React.CSSProperties}>
          <ArrowDown size={14} />
          Elige una fuente
        </span>
      </section>

      <section className="provider-grid" aria-label="Fuentes disponibles">
        {visible.map((provider, index) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            index={index}
            onOpen={() => onOpen(provider.id)}
          />
        ))}

        {visible.length === 0 && (
          <div className="empty-state">
            <p>Todas las fuentes están ocultas.</p>
            <p className="hint">Actívalas de nuevo desde Ajustes → Fuentes.</p>
          </div>
        )}
      </section>

      <footer className="home-footer">
        <p>
          Las imágenes pertenecen a sus autores. Úsalas de forma personal y respeta la licencia
          de cada fuente.
        </p>
        <span>v0.1 · sin backend · sin tracking</span>
      </footer>
    </div>
  )
}
