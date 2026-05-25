// Temas visuales para la vista Global (d3-geo). Reusan la UX del selector
// "Mapa base" pero definen un set coherente de colores para los tres elementos:
//
//   - space: el fondo de la app (lo "fuera" del globo). Reemplaza bgColor.
//   - globe: el color del cuerpo del globo (sphere fill). Distinto del space
//     para que el planeta se vea como una entidad sobre el vacío.
//   - missing: color de los países sin data del indicador activo.
//   - border: color de los bordes entre países.
//
// Los países CON data se pintan con la paleta del store (igual que en vista VE).

export type GlobeThemeId = 'day' | 'night' | 'editorial' | 'cosmos'

export type GlobeTheme = {
  id: GlobeThemeId
  label: string
  short: string
  preview: string // CSS gradient para el swatch del selector
  space: string
  globe: string
  missing: string
  border: string
}

export const GLOBE_THEMES: GlobeTheme[] = [
  {
    id: 'day',
    label: 'Día',
    short: 'Día',
    preview: 'linear-gradient(135deg, #f1f5f9 0%, #f1f5f9 50%, #ffffff 50%, #ffffff 100%)',
    space: '#f1f5f9', // slate-100
    globe: '#ffffff', // blanco puro
    missing: '#cbd5e1', // slate-300
    border: '#94a3b8', // slate-400 (borde del globo sutil)
  },
  {
    id: 'night',
    label: 'Noche',
    short: 'Noche',
    preview: 'linear-gradient(135deg, #0f172a 0%, #0f172a 50%, #334155 50%, #334155 100%)',
    space: '#0f172a', // slate-900
    globe: '#334155', // slate-700
    missing: '#64748b', // slate-500
    border: '#475569', // slate-600
  },
  {
    id: 'editorial',
    label: 'Editorial',
    short: 'Editorial',
    preview: 'linear-gradient(135deg, #cbd5e1 0%, #cbd5e1 50%, #f8fafc 50%, #f8fafc 100%)',
    space: '#cbd5e1', // slate-300
    globe: '#f8fafc', // slate-50
    missing: '#e2e8f0', // slate-200
    border: '#94a3b8', // slate-400
  },
  {
    // Tema "Cosmos": estética de mapamundi clásico tipo atlas escolar — mar
    // en azul grisáceo desaturado (el azul-celeste reconocible de cualquier
    // atlas o globo terráqueo de aula), tierras en gris claro neutro para
    // que sean lectura limpia sin competir con el choropleth. Background
    // ligeramente oscuro (slate-900) para que el globo destaque como objeto
    // iluminado — no es espacio profundo, es una superficie neutra que
    // respeta la jerarquía visual del mapa.
    id: 'cosmos',
    label: 'Cosmos',
    short: 'Cosmos',
    preview: 'linear-gradient(135deg, #0f172a 0%, #0f172a 50%, #bedaee 50%, #bedaee 100%)',
    space: '#0f172a', // slate-900: fondo oscuro neutro, no espacial puro
    globe: '#bedaee', // powder blue suave: celeste claro tipo atlas escolar
    missing: '#e2e8f0', // slate-200: tierra en gris muy claro, contrastante con mar
    border: '#475569', // slate-600: sphere outline visible pero contenido
  },
]

export function getGlobeTheme(id: GlobeThemeId): GlobeTheme {
  return GLOBE_THEMES.find(t => t.id === id) ?? GLOBE_THEMES[0]
}
