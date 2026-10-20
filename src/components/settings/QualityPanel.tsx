import { Check, Feather, Gauge, Sparkles } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'
import { QUALITY_PAGE_SIZE } from '../../lib/format'
import type { Quality } from '../../types'

const QUALITIES: {
  id: Quality
  name: string
  description: string
  icon: typeof Sparkles
}[] = [
  {
    id: 'max',
    name: 'Máxima',
    description: 'Vista previa en la resolución más alta, animaciones completas y más imágenes por página.',
    icon: Sparkles,
  },
  {
    id: 'general',
    name: 'General',
    description: 'Buen equilibrio entre nitidez, datos y fluidez. Recomendado para la mayoría.',
    icon: Gauge,
  },
  {
    id: 'optimo',
    name: 'Óptimo',
    description: 'Miniaturas ligeras, sin desenfoques y con transiciones mínimas. Ideal para datos móviles.',
    icon: Feather,
  },
]

export function QualityPanel() {
  const { settings, update } = useSettings()

  return (
    <>
      <section className="panel-section">
        <h3>Calidad</h3>
        <p className="section-sub">
          Ajusta el peso de las vistas previas y el coste de las animaciones.
        </p>

        <div className="quality-list">
          {QUALITIES.map((quality) => {
            const active = settings.quality === quality.id
            const Icon = quality.icon
            return (
              <button
                type="button"
                key={quality.id}
                className={`quality-card ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => update({ quality: quality.id })}
              >
                <span className="q-icon">
                  <Icon size={18} />
                </span>
                <span className="q-body">
                  <strong>{quality.name}</strong>
                  <small>{quality.description}</small>
                  <em>{QUALITY_PAGE_SIZE[quality.id]} por página</em>
                </span>
                <span className="q-radio">{active && <Check size={14} />}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel-section">
        <p className="hint">
          La calidad afecta a las vistas previas, al número de resultados por página y a la
          intensidad de las animaciones. La descarga siempre guarda el archivo original
          disponible en la fuente.
        </p>
      </section>
    </>
  )
}
