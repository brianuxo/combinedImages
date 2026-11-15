import { Check, Feather, Gauge, Sparkles } from 'lucide-react'
import { useSettings } from '../../context/settings'
import { QUALITY_LIMITS } from '../../lib/format'
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
    description:
      'Sin límite de resolución en las vistas previas, animaciones completas y más imágenes por página.',
    icon: Sparkles,
  },
  {
    id: 'general',
    name: 'General',
    description:
      'Las imágenes se muestran hasta 2984 px (lado mayor). Buen equilibrio entre nitidez, datos y fluidez. Recomendado para la mayoría.',
    icon: Gauge,
  },
  {
    id: 'optimo',
    name: 'Óptimo',
    description:
      'Las imágenes se muestran hasta 1920 px (lado mayor), 12 por página, sin animaciones y con las siguientes a mano. Ideal para móviles y datos limitados.',
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
                  <em>
                    {QUALITY_LIMITS[quality.id].perPage} por página
                    {Number.isFinite(QUALITY_LIMITS[quality.id].autoCap)
                      ? ` · tope ${QUALITY_LIMITS[quality.id].autoCap}`
                      : ''}
                    {QUALITY_LIMITS[quality.id].maxSide > 0
                      ? ` · imágenes hasta ${QUALITY_LIMITS[quality.id].maxSide} px`
                      : ' · sin límite de px'}
                  </em>
                </span>
                <span className="q-radio">{active && <Check size={14} />}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel-section">
        <p className="hint">
          La calidad afecta al tamaño máximo de las imágenes que se muestran (Óptimo: 1920 px,
          General: 2984 px en el lado mayor), al número de resultados por página y a la
          intensidad de las animaciones. En Óptimo la galería se detiene a las 12 imágenes y
          el resto se pide con «Ver más». La descarga siempre guarda el archivo original
          disponible en la fuente, sea cual sea la calidad.
        </p>
      </section>
    </>
  )
}
