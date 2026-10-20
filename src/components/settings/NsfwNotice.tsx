import { Modal } from '../ui/Modal'

export function NsfwNotice({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Aviso"
      title="Contenido adulto desbloqueado"
      actions={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Entendido
        </button>
      }
    >
      <p>
        Ahora puedes activar «Incluir resultados NSFW» en Ajustes. Al hacerlo aparecerán resultados
        adultos de Danbooru, Konachan, Yande.re, Anime-Pictures y Wallhaven, y se sumarán{' '}
        <strong>Gelbooru</strong> y <strong>Rule34</strong> como fuentes nuevas.
      </p>
      <p>
        Las dos fuentes adultas necesitan una API key y un User ID gratuitos, que puedes configurar
        en <strong>Ajustes → Claves API</strong> con el botón «Probar».
      </p>
      <p className="hint">
        La preferencia se guarda solo en este navegador y puedes desactivarla cuando quieras.
      </p>
    </Modal>
  )
}
