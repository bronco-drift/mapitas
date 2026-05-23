import type { PaletteId } from './types'

const PALETTES: Record<Exclude<PaletteId, 'custom'>, [string, string]> = {
  blues: ['#f7fbff', '#08306b'],
  reds: ['#fff5eb', '#7f2704'],
  greens: ['#f7fcf5', '#00441b'],
  oranges: ['#fff5eb', '#7f2704'],
  purples: ['#fcfbfd', '#3f007d'],
  teals: ['#f7fcfd', '#00441b'],
  pinks: ['#feebe2', '#7a0177'],
  grays: ['#f7f7f7', '#252525'],
  viridis: ['#fde725', '#440154'],
  rdbu: ['#2166ac', '#b2182b'],
  brbg: ['#543005', '#003c30'],
  piyg: ['#c51b7d', '#276419'],
  spectral: ['#9e0142', '#5e4fa2'],
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

// Midpoint reshape: t lineal [0..1] → t curvado tal que en t=midpoint el valor
// representa el 50% del gradiente visual. Comprime un lado y estira el otro.
function reshape(t: number, midpoint: number): number {
  if (midpoint <= 0) return t === 0 ? 0 : 1
  if (midpoint >= 1) return t === 1 ? 1 : 0
  if (midpoint === 0.5) return t
  return t < midpoint
    ? (t / midpoint) * 0.5
    : 0.5 + ((t - midpoint) / (1 - midpoint)) * 0.5
}

export function colorScale(
  value: number,
  min: number,
  max: number,
  palette: PaletteId = 'blues',
  custom?: CustomStops,
  midpoint = 0.5,
): string {
  const [start, end] = stopsFor(palette, custom)
  if (min === max) return start
  const tLinear = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const t = reshape(tLinear, midpoint)
  const [r1, g1, b1] = hexToRgb(start)
  const [r2, g2, b2] = hexToRgb(end)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

export function paletteStops(palette: PaletteId, steps = 6, custom?: CustomStops, midpoint = 0.5): string[] {
  return Array.from({ length: steps }, (_, i) =>
    colorScale(i, 0, steps - 1, palette, custom, midpoint),
  )
}

export function paletteGradient(palette: PaletteId, custom?: CustomStops, midpoint = 0.5): string {
  const [start, end] = stopsFor(palette, custom)
  if (palette === 'viridis') return 'linear-gradient(90deg, #fde725, #21918c, #440154)'
  if (palette === 'rdbu') return 'linear-gradient(90deg, #2166ac, #f7f7f7, #b2182b)'
  if (palette === 'brbg') return 'linear-gradient(90deg, #543005, #f5f5f5, #003c30)'
  if (palette === 'piyg') return 'linear-gradient(90deg, #c51b7d, #f7f7f7, #276419)'
  if (palette === 'spectral') return 'linear-gradient(90deg, #9e0142, #ffffbf, #5e4fa2)'
  // Si midpoint != 0.5, el color del medio es el del gradiente CURVADO en t=0.5
  if (midpoint !== 0.5) {
    const midColor = colorScale(0.5, 0, 1, palette, custom, midpoint)
    return `linear-gradient(90deg, ${start}, ${midColor} 50%, ${end})`
  }
  return `linear-gradient(90deg, ${start}, ${end})`
}

// 5 paletas "principales" mostradas siempre + el botón "+" abre el resto
export const PALETTE_OPTIONS: { id: PaletteId; label: string }[] = [
  { id: 'blues', label: 'Azules' },
  { id: 'reds', label: 'Rojos' },
  { id: 'greens', label: 'Verdes' },
  { id: 'viridis', label: 'Viridis' },
  { id: 'rdbu', label: 'Divergente' },
]

export const PALETTE_EXTRA: { id: PaletteId; label: string }[] = [
  { id: 'oranges', label: 'Naranjas' },
  { id: 'purples', label: 'Violetas' },
  { id: 'teals', label: 'Verde-azul' },
  { id: 'pinks', label: 'Rosas' },
  { id: 'grays', label: 'Grises' },
  { id: 'brbg', label: 'Marrón-verde' },
  { id: 'piyg', label: 'Rosa-verde' },
  { id: 'spectral', label: 'Spectral' },
  { id: 'custom', label: 'Personalizada' },
]
