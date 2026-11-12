import { ShieldCheck } from 'lucide-react'

export function SyncPanel() {
  return (
    <section className="panel-section" id="sync-section">
      <div className="section-head">
        <h3>Datos de la instancia</h3>
        <span className="badge">automático</span>
      </div>

      <p className="section-sub">
        Favoritos, claves API y ajustes se guardan automáticamente en la instancia.
        No se necesita frase de sincronización: cualquier dispositivo que abra la app
        comparte los mismos datos. La calidad de imagen se guarda por dispositivo.
      </p>

      <div className="setting-row">
        <div>
          <span>Estado</span>
          <small>Los cambios se guardan automáticamente</small>
        </div>
        <span className="sync-state is-idle">
          <ShieldCheck size={13} />
          Activo
        </span>
      </div>

      <p className="hint">
        Cada navegador guarda una copia local como respaldo. La fuente de verdad es la
        instancia: al abrir la app desde otro dispositivo, se cargan los datos guardados.
      </p>
    </section>
  )
}
