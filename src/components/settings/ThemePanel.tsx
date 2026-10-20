import { Check } from 'lucide-react'
import { ACCENTS, useSettings } from '../../context/settings'
import type { ThemeId } from '../../types'

const THEMES: { id: ThemeId; name: string; description: string }[] = [
  {
    id: 'dark',
    name: 'Oscuro',
    description: 'Negro azulado con superficies suaves. El equilibrio por defecto.',
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    description: 'Azul profundo, más contraste entre fondo y paneles.',
  },
  {
    id: 'contrast',
    name: 'Alto contraste',
    description: 'Negro puro, bordes marcados y sin desenfoques.',
  },
]

export function ThemePanel() {
  const { settings, update } = useSettings()

  return (
    <>
      <section className="panel-section">
        <h3>Tema</h3>
        <p className="section-sub">Se guarda en este dispositivo y se aplica al instante.</p>

        <div className="theme-grid">
          {THEMES.map((theme) => {
            const active = settings.theme === theme.id
            return (
              <button
                type="button"
                key={theme.id}
                className={`theme-card ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => update({ theme: theme.id })}
              >
                <span className={`theme-preview theme-preview-${theme.id}`}>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="theme-name">
                  {theme.name}
                  {active && <Check size={14} />}
                </span>
                <span className="theme-desc">{theme.description}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel-section">
        <h3>Color de acento</h3>
        <p className="section-sub">Se usa en botones, focos y detalles activos.</p>

        <div className="accent-grid">
          {ACCENTS.map((accent) => {
            const active = settings.accent === accent.value
            return (
              <button
                type="button"
                key={accent.id}
                className={`accent-swatch ${active ? 'is-active' : ''}`}
                style={{ '--swatch': accent.value } as React.CSSProperties}
                aria-label={accent.label}
                aria-pressed={active}
                title={accent.label}
                onClick={() => update({ accent: accent.value })}
              >
                {active && <Check size={14} />}
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
