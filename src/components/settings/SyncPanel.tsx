import { useState } from 'react'
import { Cloud, CloudOff, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useSync } from '../../context/sync'
import { useToast } from '../../context/toast'

function formatWhen(value: number | null): string {
  if (!value) return 'nunca'
  const date = new Date(value)
  const minutes = Math.round((Date.now() - value) / 60_000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  return date.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
}

export function SyncPanel() {
  const { enabled, status, error, lastSyncAt, revision, pending, enable, disable, syncNow } =
    useSync()
  const { push } = useToast()

  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)

  const connect = async () => {
    setBusy(true)
    const ok = await enable(passphrase)
    setBusy(false)
    if (ok) {
      setPassphrase('')
    }
  }

  return (
    <section className="panel-section" id="sync-section">
      <div className="section-head">
        <h3>Sincronización</h3>
        <span className="badge">instancia</span>
      </div>

      <p className="section-sub">
        Favoritos, claves API y ajustes se guardan cifrados en la instancia y se comparten
        entre tus dispositivos. La calidad de imagen no se sincroniza: depende de cada equipo.
      </p>

      {!enabled ? (
        <>
          <div className="field">
            <div className="field-label">Frase de cifrado</div>
            <input
              className="input"
              type="password"
              value={passphrase}
              placeholder="La misma en todos los dispositivos"
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => setPassphrase(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void connect()
              }}
            />
            <p className="hint">
              Con la frase se cifra el paquete y se autoriza la conexión: la misma frase en
              todos tus dispositivos y nada más que escribir. No viaja al servidor; si la
              pierdes, tendrás que volver a configurar las claves (los favoritos locales se
              conservan).
            </p>
          </div>

          {error && <p className="sync-error">{error}</p>}

          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy}
            onClick={() => void connect()}
          >
            {busy ? <Loader2 size={15} className="spin" /> : <Cloud size={15} />}
            {busy ? 'Conectando…' : 'Conectar'}
          </button>
        </>
      ) : (
        <>
          <div className="setting-row">
            <div>
              <span>Estado</span>
              <small>{error ?? (pending ? 'Cambios pendientes de subir' : 'Sin cambios pendientes')}</small>
            </div>
            <span className={`sync-state is-${status}`}>
              {status === 'syncing' && <Loader2 size={13} className="spin" />}
              {status === 'idle' && <ShieldCheck size={13} />}
              {(status === 'offline' || status === 'error') && <CloudOff size={13} />}
              {status === 'syncing'
                ? 'Sincronizando'
                : status === 'idle'
                  ? 'Al día'
                  : status === 'offline'
                    ? 'Sin conexión'
                    : 'Error'}
            </span>
          </div>

          <div className="about-row">
            <span>Última sincronización</span>
            <span className="hint">{formatWhen(lastSyncAt)}</span>
          </div>
          <div className="about-row">
            <span>Versión del paquete</span>
            <span className="hint">{revision}</span>
          </div>

          <div className="sync-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={status === 'syncing'}
              onClick={() => void syncNow()}
            >
              <RefreshCw size={15} className={status === 'syncing' ? 'spin' : ''} />
              Sincronizar ahora
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (window.confirm('¿Olvidar la frase en este dispositivo?')) {
                  disable()
                  push('Este dispositivo ya no sincroniza', 'default')
                }
              }}
            >
              <Trash2 size={15} />
              Olvidar dispositivo
            </button>
          </div>

          <p className="hint">
            Este navegador guarda una copia para poder abrir la app sin conexión. La fuente de
            verdad es la instancia: si cambias algo en el móvil, al abrir el PC se pone al día.
          </p>
        </>
      )}
    </section>
  )
}
