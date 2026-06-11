import { useRef, useState } from 'react'
import { CheckCircle2, Download, FileUp, RotateCcw, UploadCloud } from 'lucide-react'
import { CsvError } from '../data/csv'
import { getMeta, ingestCsv, resetDataset, type DatasetId } from '../data/store'

function downloadTemplate(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Drag-and-drop CSV upload for one dataset, with inline error/empty states.
export function CsvDropzone({
  id,
  title,
  schemaHint,
  template,
}: {
  id: DatasetId
  title: string
  schemaHint: string
  template: { filename: string; content: string }
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const meta = getMeta(id)

  async function handle(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      await ingestCsv(id, file)
    } catch (e) {
      setError(e instanceof CsvError ? e.message : 'Unexpected error reading that file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-hairline bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
            meta.source === 'sample' ? 'bg-bg text-muted' : 'bg-green/10 text-green',
          ].join(' ')}
        >
          {meta.source === 'live' ? 'Live' : meta.source === 'upload' ? 'Uploaded' : 'Sample data'}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          handle(e.dataTransfer.files?.[0])
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          drag ? 'border-gold bg-gold/5' : 'border-hairline hover:border-navy/30 hover:bg-bg',
        ].join(' ')}
      >
        <UploadCloud size={22} className={drag ? 'text-gold' : 'text-muted'} />
        <p className="mt-2 text-sm font-medium text-navy">{busy ? 'Reading…' : 'Drop CSV here or click to browse'}</p>
        <p className="mt-1 text-[11px] text-muted">{schemaHint}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>

      <button
        onClick={() => downloadTemplate(template.filename, template.content)}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-navy hover:underline"
      >
        <Download size={12} /> Download {template.filename} template
      </button>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-coral/10 p-2.5 text-xs text-coral">
          <FileUp size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 size={12} className="text-green" />
          {meta.rows} rows
          {meta.fileName && ` · ${meta.fileName}`}
        </span>
        {meta.source === 'upload' && (
          <button onClick={() => resetDataset(id)} className="inline-flex items-center gap-1 font-medium text-navy hover:underline">
            <RotateCcw size={12} /> Reset to sample
          </button>
        )}
      </div>
    </div>
  )
}
