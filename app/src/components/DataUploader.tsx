import { useCallback, useRef, useState } from 'react'
import { useStore } from '../store'
import { parseFile } from '../lib/parse-file'

export function DataUploader() {
  const source = useStore(s => s.source)
  const stats = useStore(s => s.stats)
  const setDataset = useStore(s => s.setDataset)
  const updateMapping = useStore(s => s.updateDatasetMapping)
  const clearSource = useStore(s => s.clearSource)
  const level = useStore(s => s.level)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dataset = source?.kind === 'upload' ? source.dataset : null

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      try {
        const ds = await parseFile(file)
        setDataset(ds)
      } catch (err) {
        setError(String(err))
      }
    },
    [setDataset],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  if (!dataset) {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[13px] transition ${
            dragging
              ? 'border-slate-900 bg-slate-50 text-slate-900'
              : 'border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-current text-center text-[11px] leading-[14px]">
            +
          </span>
          <span className="min-w-0 truncate">Subir CSV o Excel</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,.ods"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {error && (
          <div className="mt-2 rounded bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
            {error}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-slate-800" title={dataset.filename}>
            {dataset.filename}
          </div>
          <div className="text-[11px] text-slate-500">
            {dataset.rows.length} filas · {dataset.columns.length} columnas
          </div>
        </div>
        <button
          type="button"
          onClick={clearSource}
          className="text-[11px] text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
        >
          quitar
        </button>
      </div>

      <div className="space-y-2 text-[11px]">
        <Field label={`Columna de ${level === 'adm1' ? 'estado' : 'municipio'}`}>
          <Select
            value={dataset.geoColumn ?? ''}
            onChange={v => updateMapping({ geoColumn: v || null })}
            options={dataset.columns}
            placeholder="— elegir —"
          />
        </Field>

        {level === 'adm2' && (
          <Field label="Columna de estado padre (opcional)">
            <Select
              value={dataset.parentColumn ?? ''}
              onChange={v => updateMapping({ parentColumn: v || null })}
              options={dataset.columns}
              placeholder="— sin —"
            />
          </Field>
        )}

        <Field label="Columna de valor">
          <Select
            value={dataset.valueColumn ?? ''}
            onChange={v => updateMapping({ valueColumn: v || null })}
            options={dataset.columns}
            placeholder="— elegir —"
          />
        </Field>
      </div>

      {stats && 'unmatchedRows' in stats && (
        <div className="border-t border-slate-200 pt-2 text-[11px]">
          <div>
            <span className="font-medium text-slate-700">{stats.matched}</span>
            <span className="text-slate-500"> de {stats.totalRows ?? stats.matched + stats.unmatched} pintadas</span>
          </div>
          {stats.unmatched > 0 && stats.unmatchedRows.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-amber-700">
                {stats.unmatched} sin match
              </summary>
              <div className="mt-1 max-h-24 overflow-auto text-slate-600">
                {stats.unmatchedRows.slice(0, 30).map((u, i) => (
                  <div key={i} className="truncate">
                    · {u}
                  </div>
                ))}
                {stats.unmatchedRows.length > 30 && (
                  <div className="text-slate-400">+{stats.unmatchedRows.length - 30} más…</div>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-800 focus:border-slate-900 focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {options.map(c => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}
