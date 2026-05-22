import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { UploadedDataset, UserRow } from './types'

const GEO_HINTS = ['estado', 'state', 'provincia', 'region', 'municipio', 'municipality', 'pais', 'country', 'nombre', 'name']
const VALUE_HINTS = ['valor', 'value', 'count', 'cantidad', 'total', 'reportes', 'casos', 'numero', 'monto', 'poblacion', 'idh', 'tasa', 'porcentaje']
const PARENT_HINTS = ['estado', 'state', 'provincia', 'region', 'parent']

function inferColumns(rows: UserRow[], columns: string[]) {
  if (rows.length === 0) return { geoColumn: null, valueColumn: null, parentColumn: null }

  const norm = (s: string) => s.toLowerCase().trim()
  const lowerCols = columns.map(norm)

  const geoIdx = lowerCols.findIndex(c => GEO_HINTS.some(h => c.includes(h)))
  const valueIdx = lowerCols.findIndex((c, i) => {
    if (i === geoIdx) return false
    if (VALUE_HINTS.some(h => c.includes(h))) return true
    return typeof rows[0][columns[i]] === 'number'
  })
  const parentIdx = lowerCols.findIndex((c, i) => {
    if (i === geoIdx) return false
    return PARENT_HINTS.some(h => c.includes(h))
  })

  return {
    geoColumn: geoIdx >= 0 ? columns[geoIdx] : columns[0] ?? null,
    valueColumn: valueIdx >= 0 ? columns[valueIdx] : null,
    parentColumn: parentIdx >= 0 ? columns[parentIdx] : null,
  }
}

export async function parseFile(file: File): Promise<UploadedDataset> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    return new Promise((resolve, reject) => {
      Papa.parse<UserRow>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: result => {
          const rows = result.data.filter(r => r && Object.keys(r).length > 0)
          const columns = result.meta.fields ?? Object.keys(rows[0] ?? {})
          const inferred = inferColumns(rows, columns)
          resolve({ filename: file.name, rows, columns, ...inferred })
        },
        error: err => reject(err),
      })
    })
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<UserRow>(sheet, { defval: null })
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []
    const inferred = inferColumns(rows, columns)
    return { filename: file.name, rows, columns, ...inferred }
  }

  throw new Error(`Formato no soportado: .${ext}. Usá CSV, TSV o Excel.`)
}
