import { ArrowDown, MonitorDown, Sparkles } from 'lucide-react'
import { useSettings } from '../../context/settings'
import { PROVIDERS } from '../../data/providers'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useVersionTap } from '../../hooks/useVersionTap'
import { isProviderVisible } from '../../lib/visibility'
import type { ProviderId } from '../../types'
import { ProviderCard } from './ProviderCard'

export function Home({
  onOpen,
  onToggleNsfw,
}: {
  onOpen: (id: ProviderId) => void
  onToggleNsfw: () => void
}) {
  const { settings } = useSettings()
  const { canInstall, install } = useInstallPrompt()
  const { onTap: onVersionTap, armed, action } = useVersionTap(onToggleNsfw)
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
          sin publicidad y con tus favoritos en todos tus dispositivos.
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
            <strong>100%</strong> sin tracking
          </span>
        </div>

        {canInstall && (
          <button
            type="button"
            className="hero-install rise"
            style={{ '--i': 4 } as React.CSSProperties}
            onClick={() => void install()}
          >
            <MonitorDown size={15} />
            Instalar la app
          </button>
        )}

        <span
          className="scroll-hint rise"
          style={{ '--i': canInstall ? 5 : 4 } as React.CSSProperties}
        >
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
        <button
          type="button"
          className={`version-tap${armed ? ' is-armed' : ''}`}
          onClick={onVersionTap}
        >
          v1.0 · sin cuentas · sin tracking
        </button>
        {armed && (
          <span className="version-hint">Toca otra vez para {action} el contenido adulto</span>
        )}
      </footer>
    </div>
  )
}
