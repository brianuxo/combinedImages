import { useRef } from 'react'
import { motion } from 'motion/react'
import { RotateCcw } from 'lucide-react'
import { useSettings } from '../../context/settings'
import { useToast } from '../../context/toast'
import { PROVIDERS, PROVIDER_MAP } from '../../data/providers'
import { probeProviderKey } from '../../lib/providers/probe'
import { isProviderInSettings, isProviderVisible } from '../../lib/visibility'
import type { ProviderId } from '../../types'
import { ApiKeyField } from './ApiKeyField'
import { ChipInput } from '../ui/ChipInput'
import { ProviderIcon } from '../ui/ProviderIcon'
import { Toggle } from '../ui/Toggle'

export function SettingsPanel() {
  const { settings, update, updateProvider, unlockNsfw, enableNsfw, reset } = useSettings()
  const { push } = useToast()
  const versionClicks = useRef(0)

  const settingsProviders = PROVIDERS.filter((provider) =>
    isProviderInSettings(provider, settings),
  )
  const visibleCount = PROVIDERS.filter((provider) =>
    isProviderVisible(provider, settings),
  ).length

  const handleVersion = () => {
    if (settings.nsfw.unlocked) return
    versionClicks.current += 1
    if (versionClicks.current >= 5) {
      versionClicks.current = 0
      unlockNsfw()
      push('Opciones de contenido adulto visibles', 'warn')
    }
  }

  const testKey = async (provider: ProviderId) => {
    const current = settings.providers[provider]
    const result = await probeProviderKey(provider, {
      apiKey: current?.apiKey,
      userId: current?.userId,
      proxyUrl: settings.proxyUrl,
      signal: new AbortController().signal,
    })
    const name = PROVIDER_MAP[provider].name
    push(`${name}: ${result.message}`, result.ok ? 'success' : 'warn')
  }

  return (
    <>
      <section className="panel-section">
        <div className="section-head">
          <h3>Fuentes</h3>
          <span className="section-count">
            {visibleCount}/{PROVIDERS.length}
          </span>
        </div>
        <p className="section-sub">
          Activa o esconde proveedores. Los ocultos no aparecen en el inicio ni en la barra
          superior.
        </p>
        {settings.nsfw.unlocked && !settings.nsfw.enabled && (
          <p className="hint">
            Gelbooru y Rule34 son solo para adultos y aparecen al activar «Incluir resultados
            NSFW».
          </p>
        )}

        <div className="provider-list">
          {settingsProviders.map((provider) => {
            const hidden = settings.providers[provider.id]?.hidden ?? false
            return (
              <div className={`provider-row ${hidden ? 'is-off' : ''}`} key={provider.id}>
                <span
                  className="pr-icon"
                  style={
                    {
                      '--pa': provider.accent[0],
                      '--pb': provider.accent[1],
                    } as React.CSSProperties
                  }
                >
                  <ProviderIcon name={provider.icon} size={16} />
                </span>
                <div className="pr-info">
                  <span>{provider.name}</span>
                  <small>
                    {provider.categories.join(' · ')}
                    {provider.needsProxy
                      ? ' · proxy'
                      : provider.needsMediaProxy
                        ? ' · proxy imágenes'
                        : ''}
                    {provider.experimental ? ' · beta' : ''}
                  </small>
                </div>
                <Toggle
                  checked={!hidden}
                  label={`Mostrar ${provider.name}`}
                  onChange={(value) => updateProvider(provider.id, { hidden: !value })}
                />
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel-section">
        <h3>Claves API</h3>
        <p className="section-sub">
          {settings.nsfw.unlocked
            ? 'Pixabay, Gelbooru y Rule34 necesitan clave. Wallhaven y Openverse la aceptan de forma opcional. Todo se guarda únicamente en este navegador.'
            : 'Pixabay necesita clave. Wallhaven y Openverse la aceptan de forma opcional. Todo se guarda únicamente en este navegador.'}
        </p>

        <ApiKeyField
          label="Pixabay"
          value={settings.providers.pixabay?.apiKey ?? ''}
          placeholder="API key de Pixabay"
          hint="Necesaria para buscar fotos e ilustraciones."
          helpUrl="https://pixabay.com/api/docs/"
          required
          onTest={() => testKey('pixabay')}
          onChange={(value) => updateProvider('pixabay', { apiKey: value })}
        />

        <ApiKeyField
          label="Wallhaven"
          value={settings.providers.wallhaven?.apiKey ?? ''}
          placeholder="API key de Wallhaven"
          hint={
            settings.nsfw.unlocked
              ? 'Opcional para SFW; obligatoria para incluir contenido adulto.'
              : 'Opcional para SFW.'
          }
          helpUrl="https://wallhaven.cc/settings/account"
          onTest={() => testKey('wallhaven')}
          onChange={(value) => updateProvider('wallhaven', { apiKey: value })}
        />

        <ApiKeyField
          label="Openverse"
          value={settings.providers.openverse?.apiKey ?? ''}
          placeholder="Token personal de Openverse"
          hint="Sin token funciona con límites bajos."
          helpUrl="https://api.openverse.org/v1/"
          onTest={() => testKey('openverse')}
          onChange={(value) => updateProvider('openverse', { apiKey: value })}
        />

        {settings.nsfw.unlocked ? (
          <>
            <ApiKeyField
              label="Gelbooru"
              value={settings.providers.gelbooru?.apiKey ?? ''}
              placeholder="API key de Gelbooru"
              hint="Solo se usa con el contenido adulto activo."
              helpUrl="https://gelbooru.com/index.php?page=account&s=options"
              required
              userId={settings.providers.gelbooru?.userId ?? ''}
              onUserIdChange={(value) => updateProvider('gelbooru', { userId: value })}
              onTest={() => testKey('gelbooru')}
              onChange={(value) => updateProvider('gelbooru', { apiKey: value })}
            />

            <ApiKeyField
              label="Rule34"
              value={settings.providers.rule34?.apiKey ?? ''}
              placeholder="API key de Rule34"
              hint="Solo se usa con el contenido adulto activo."
              helpUrl="https://rule34.xxx/index.php?page=account&s=options"
              required
              userId={settings.providers.rule34?.userId ?? ''}
              onUserIdChange={(value) => updateProvider('rule34', { userId: value })}
              onTest={() => testKey('rule34')}
              onChange={(value) => updateProvider('rule34', { apiKey: value })}
            />
          </>
        ) : null}
      </section>

      <section className="panel-section">
        <h3>Lista negra global</h3>
        <p className="section-sub">
          Se aplica a todas las fuentes. En los booru se envía como exclusión (
          <code>-tag</code>) y además se filtra en local.
        </p>

        <ChipInput
          label="Tags excluidos"
          placeholder="ej. guro, watermark, text"
          values={settings.blacklist.tags}
          onChange={(values) => update({ blacklist: { ...settings.blacklist, tags: values } })}
          hint="Escribe un tag y pulsa Enter. Acepta espacios: se convierten en guiones bajos."
        />

        <ChipInput
          label="Palabras clave"
          placeholder="ej. lowres, sketch"
          values={settings.blacklist.keywords}
          onChange={(values) =>
            update({ blacklist: { ...settings.blacklist, keywords: values } })
          }
          hint="Filtro local sobre tags, título y autor."
        />
      </section>

      <section className="panel-section">
        <div className="section-head">
          <h3>Red</h3>
          <span className="badge">avanzado</span>
        </div>
        <div className="field">
          <div className="field-label">Proxy CORS</div>
          <input
            className="input"
            type="url"
            value={settings.proxyUrl}
            placeholder="https://mi-proxy.dev/?url={url}"
            spellCheck={false}
            onChange={(event) => update({ proxyUrl: event.target.value })}
          />
          <p className="hint">
            Necesario en producción para Konachan, Yande.re, Anime-Pictures, Gelbooru y
            Wallhaven. También sirve las imágenes de Gelbooru y Rule34. El marcador{' '}
            <code>{'{url}'}</code> se sustituye por la URL codificada. En desarrollo, Vite ya
            actúa como proxy.
          </p>
        </div>
      </section>

      {settings.nsfw.unlocked && (
        <motion.section
          className="panel-section nsfw-section"
          id="nsfw-section"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            settings.quality === 'optimo'
              ? { duration: 0.16 }
              : { type: 'spring', stiffness: 320, damping: 30 }
          }
        >
          <div className="section-head">
            <h3>Contenido adulto</h3>
            <span className="badge badge-warn">desbloqueado</span>
          </div>
          <div className="setting-row">
            <div>
              <span>Incluir resultados NSFW</span>
              <small>
                Danbooru, Konachan, Yande.re, Anime-Pictures, Wallhaven, Gelbooru y Rule34
              </small>
            </div>
            <Toggle
              checked={settings.nsfw.enabled}
              label="Incluir contenido NSFW"
              onChange={(value) => enableNsfw(value)}
            />
          </div>
          <p className="hint">
            Al activarlo aparecen en la barra de fuentes y en el inicio las pestañas de Gelbooru y
            Rule34. La preferencia queda guardada en este navegador, así que no hay que repetirla.
            Wallhaven necesita su API key para devolver NSFW. Las fuentes seguras (Safebooru,
            Openverse, Wikimedia, Pixabay) no cambian.
          </p>
          <p className="hint">
            <kbd>F</kbd> oculta esta sección y desactiva el contenido adulto.
          </p>
        </motion.section>
      )}

      <section className="panel-section">
        <h3>Acerca de</h3>
        <div className="about-row">
          <span>Versión</span>
          <button type="button" className="version-button" onClick={handleVersion}>
            v1.0.0
          </button>
        </div>
        <div className="about-row">
          <span>Datos</span>
          <span className="hint">solo en tu navegador</span>
        </div>
        {settings.nsfw.unlocked && (
          <div className="about-row">
            <span>NSFW</span>
            <span className="hint">{settings.nsfw.enabled ? 'activo' : 'visible, desactivado'}</span>
          </div>
        )}

        <button
          type="button"
          className="btn btn-danger btn-block"
          onClick={() => {
            if (window.confirm('¿Restablecer todos los ajustes de este dispositivo?')) {
              reset()
              push('Ajustes restablecidos', 'success')
            }
          }}
        >
          <RotateCcw size={15} />
          Restablecer ajustes
        </button>
      </section>
    </>
  )
}
