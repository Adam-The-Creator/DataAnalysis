import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '@/api'
import type { ExportFormat } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ErrorView } from '@/components/ui/states'
import { downloadBlob, downloadJson, fileSafe } from '@/lib/download'

/** The raw drawing as JSON (requirement EXP-02) and its strokes as a 3D file (EXP-03). */
export function DrawingExportMenu({ drawingId, name }: { drawingId: string; name: string }) {
  const { t } = useTranslation()
  const [includeErased, setIncludeErased] = useState(false)
  const download = useMutation({
    mutationFn: async (kind: 'json' | ExportFormat) => {
      const base = `drawing-${fileSafe(name)}`
      if (kind === 'json') {
        downloadJson(await getApi().drawings.get(drawingId), `${base}.json`)
      } else {
        downloadBlob(await getApi().analysis.exportDrawing(drawingId, kind, includeErased), `${base}.${kind}`)
      }
    },
  })

  return (
    <Menu label={t('export.drawing')}>
      <div className="space-y-2">
        <Button variant="secondary" className="w-full justify-start" disabled={download.isPending} onClick={() => download.mutate('json')}>
          {t('export.json')}
        </Button>
        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('export.model3d')}</p>
        {(['gltf', 'obj', 'ply'] as const).map((format) => (
          <Button key={format} variant="secondary" className="w-full justify-start" disabled={download.isPending} onClick={() => download.mutate(format)}>
            {t(`export.formats.${format}`)}
          </Button>
        ))}
        <label className="flex items-center gap-2 pt-1 text-slate-700">
          <input type="checkbox" checked={includeErased} onChange={(e) => setIncludeErased(e.target.checked)} />
          {t('export.includeErased')}
        </label>
        <p className="text-xs text-slate-500">{t('export.modelHint')}</p>
      </div>
      {download.isError && <div className="mt-3"><ErrorView error={download.error} /></div>}
    </Menu>
  )
}
