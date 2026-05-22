import type { PaletteId } from './types'

const PALETTES: Record<Exclude<PaletteId, 'custom'>, [string, string]> = {
  reds: ['#fff5eb', '#7f2704'],
  blues: ['#f7fbff', '#08306b'],
  greens: ['#f7fcf5', '#00441b'],
  viridis: ['#fde725', '#440154'],
  rdbu: ['#2166ac', '#b2182b'],
}

// Para la paleta 'custom', el caller pasa los colores en el opts.
export type CustomStops = { start: string; end: string }

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function stopsFor(palette: PaletteId, custom?: CustomStops): [string, string] {
  if (palette === 'custom') {
    return [custom?.start ?? '#fde68a', custom?.end ?? '#7c2d12']
  }
  return PALETTES[palette]
}

// Exposed: devuelve los 2 colores actuales de la paleta para mostrarlos en UI
export function getPaletteStops(palette: PaletteId, custom?: CustomStops): [string, string] {
  return stopsFor(palette, custom)
}

export function colorScale(
  value: number,
  min: number,
  max: number,
  palette: PaletteId = 'reds',
  custom?: CustomStops,
): string {
  const [start, end] = stopsFor(palette, custom)
  if (min === max) return start
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const [r1, g1, b1] = hexToRgb(start)
  const [r2, g2, b2] = hexToRgb(end)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

export function paletteStops(palette: PaletteId, steps = 6, custom?: CustomStops): string[] {
  return Array.from({ length: steps }, (_, i) =>
    colorScale(i, 0, steps - 1, palette, custom),
  )
}

export function paletteGradient(palette: PaletteId, custom?: CustomStops): string {
  const [start, end] = stopsFor(palette, custom)
  if (palette === 'viridis') return 'linear-gradient(90deg, #fde725, #21918c, #440154)'
  if (palette === 'rdbu') return 'linear-gradient(90deg, #2166ac, #f7f7f7, #b2182b)'
  return `linear-gradient(90deg, ${start}, ${end})`
}

export const PALETTE_OPTIONS: { id: PaletteId; label: string }[] = [
  { id: 'reds', label: 'Rojos' },
  { id: 'blues', label: 'Azules' },
  { id: 'greens', label: 'Verdes' },
  { id: 'viridis', label: 'Viridis' },
  { id: 'rdbu', label: 'Divergente' },
  { id: 'custom', label: 'Personalizada' },
]
