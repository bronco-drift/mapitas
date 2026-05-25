import type { PaletteId } from './types'

// Paletas de gradiente. Las "clásicas" (blues..pinks) y las "científicas"
// (viridis, rdbu, brbg, piyg, spectral) son ColorBrewer / Matplotlib —
// optimizadas para legibilidad estadística pero a veces ásperas
// visualmente. Las "Apple-aesthetic" (sky, emerald, slate) usan stops
// de la paleta Tailwind hand-tuned: tonos refinados, menos saturados en
// los extremos, ideales cuando el mapa va a vivir junto a UI minimalista.
const PALETTES: Record<Exclude<PaletteId, 'custom'>, [string, string]> = {
  blues: ['#f7fbff', '#08306b'],
  reds: ['#fff5eb', '#7f2704'],
  greens: ['#f7fcf5', '#00441b'],
  oranges: ['#fff5eb', '#7f2704'],
  purples: ['#fcfbfd', '#3f007d'],
  teals: ['#f7fcfd', '#00441b'],
  pinks: ['#feebe2', '#7a0177'],
  grays: ['#f7f7f7', '#252525'],
  // Apple-aesthetic (Tailwind scales): azul fresco, verde natural, gris-azul
  // sofisticado. Pensadas para mapas donde la paleta no tiene que gritar.
  sky: ['#f0f9ff', '#075985'],
  emerald: ['#ecfdf5', '#064e3b'],
  slate: ['#f8fafc', '#1e293b'],
  viridis: ['#fde725', '#440154'],
  rdbu: ['#2166ac', '#b2182b'],
  brbg: ['#543005', '#003c30'],
  piyg: ['#c51b7d', '#276419'],
  spectral: ['#9e0142', '#5e4fa2'],
}

// Opts para colorScale: `start/end` solo se usan cuando palette === 'custom'
// (override de los colores). `reverse` funciona para CUALQUIER paleta
// (built-in o custom): invierte el orden de los stops, útil cuando la
// paleta original arranca muy claro y se pierde en dark mode, o para dar
// vuelta semánticamente "más=mejor" → "más=peor".
export type CustomStops = { start: string; end: string; reverse?: boolean }

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
  const stops: [string, string] =
    palette === 'custom'
      ? [custom?.start ?? '#fde68a', custom?.end ?? '#7c2d12']
      : PALETTES[palette]
  // reverse vive en `custom` (no en una signature aparte) para no propagar
  // un param extra por todos los callers — cualquier código que ya pasa
  // `custom` solo tiene que agregar `reverse: mapStyle.paletteReverse`.
  return custom?.reverse ? [stops[1], stops[0]] : stops
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
  // Truco: `270deg` invierte visualmente el gradient sin tener que reescribir
  // los stops. Aplica a las paletas hardcoded de 3+ stops (viridis, rdbu, etc.).
  // Para start/end de 2 stops, `stopsFor` ya devuelve invertido.
  const dir = custom?.reverse ? '270deg' : '90deg'
  if (palette === 'viridis') return `linear-gradient(${dir}, #fde725, #21918c, #440154)`
  if (palette === 'rdbu') return `linear-gradient(${dir}, #2166ac, #f7f7f7, #b2182b)`
  if (palette === 'brbg') return `linear-gradient(${dir}, #543005, #f5f5f5, #003c30)`
  if (palette === 'piyg') return `linear-gradient(${dir}, #c51b7d, #f7f7f7, #276419)`
  if (palette === 'spectral') return `linear-gradient(${dir}, #9e0142, #ffffbf, #5e4fa2)`
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

// El extra se abre con "+". Las 3 Apple-aesthetic van al principio porque
// son las que el usuario suele preferir cuando descubre el panel — el resto
// son alternativas más técnicas (ColorBrewer científico) o de uso esporádico.
export const PALETTE_EXTRA: { id: PaletteId; label: string }[] = [
  { id: 'sky', label: 'Cielo' },
  { id: 'emerald', label: 'Esmeralda' },
  { id: 'slate', label: 'Pizarra' },
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
