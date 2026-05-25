// FAQ de Mapitas (producto genérico: la herramienta de mapping).
//
// Estas FAQ son agnósticas a país. No mencionan Venezuela, INE, OVV ni
// fuentes específicas. Cubren: qué es la herramienta, cómo usarla, formatos,
// paletas, privacidad. Para FAQ sobre el caso Venezuela ver faq-mide.ts.
//
// El JSON-LD FAQPage que las refleja para Google vive en index.html. Si
// modificás esta lista, actualizá también el JSON-LD manualmente.

export type FAQItem = { q: string; a: string }

export type FAQCategory = {
  id: string
  label: string
  items: FAQItem[]
}

export const FAQ_MAPITAS: FAQCategory[] = [
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'producto',
    label: 'Sobre Mapitas',
    items: [
      {
        q: '¿Qué es Mapitas?',
        a: 'Una herramienta web para crear mapas coropléticos en el navegador. Subís un CSV o Excel y se pinta sobre el mapa de un país en segundos. Sin pagar, sin login, sin instalar nada.',
      },
      {
        q: '¿Para qué sirve Mapitas?',
        a: 'Para visualizar cualquier dataset territorial: indicadores demográficos, económicos, ambientales o tus propios datos. Útil para periodistas, investigadores, ONGs, estudiantes y curiosos que necesitan mostrar información sobre un mapa sin saber GIS.',
      },
      {
        q: '¿Es gratis Mapitas?',
        a: 'Sí, completamente. Sin paywall, sin freemium, sin marca de agua. Es un proyecto open source que se aloja en un CDN estático.',
      },
      {
        q: '¿Tengo que crear una cuenta?',
        a: 'No. Mapitas no tiene login, registro ni perfiles. Abrís la página y empezás. Tus preferencias (paleta, configuración de estilo) se guardan en tu navegador con localStorage.',
      },
      {
        q: '¿Mapitas es open source?',
        a: 'Sí. El código fuente está en GitHub bajo bronco-drift/mapitas. Cualquiera puede revisar cómo funciona, proponer mejoras o usarlo como base para sus propios proyectos.',
      },
      {
        q: '¿En qué se diferencia de Datawrapper, Flourish o MapChart?',
        a: 'Mapitas corre 100% en tu navegador (no toca servidor), no exige login ni marca de agua, es open source, y prioriza la velocidad: el mapa aparece en menos de 30 segundos desde que abrís el sitio.',
      },
      {
        q: '¿Cuál es la misión de Mapitas?',
        a: 'Hacer la visualización territorial accesible para cualquier persona, sin barreras técnicas ni económicas. La herramienta es genérica; los datos curados de Venezuela viven en el proyecto MIDE, que usa Mapitas como base.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  {
    id: 'uso',
    label: 'Cómo usarlo',
    items: [
      {
        q: '¿Cómo subo mis datos a Mapitas?',
        a: 'En el panel lateral hay un botón Subir CSV o Excel. Arrastrás tu archivo o lo seleccionás. Mapitas detecta las columnas automáticamente y te pide confirmar cuál es el nombre del territorio y cuál es el valor a mapear.',
      },
      {
        q: '¿Qué formatos de archivo acepta?',
        a: 'CSV (separado por coma), TSV (separado por tabulación), Excel (.xlsx y .xls) y OpenDocument Spreadsheet (.ods). El parseo se hace localmente con PapaParse y SheetJS, sin subir tu archivo a ningún servidor.',
      },
      {
        q: '¿Cómo debe estar estructurado mi CSV?',
        a: 'Necesitás una columna con el nombre del territorio (estado, departamento, municipio, etc.) y una columna con el valor numérico. Mapitas adivina cuál es cuál y te deja confirmar el mapeo después.',
      },
      {
        q: '¿Qué pasa si los nombres de mis territorios tienen tildes o abreviaciones?',
        a: 'Mapitas usa fuzzy matching: tolera tildes faltantes, mayúsculas, espacios extra y abreviaciones comunes. Después de cargar el archivo, te muestra cuántas filas matchearon y cuáles no, con la lista exacta para corregir.',
      },
      {
        q: '¿Puedo elegir qué columna usar como valor?',
        a: 'Sí. Después de subir el archivo, Mapitas muestra dropdowns con todas las columnas detectadas. Elegís cuál usar como geo (nombre) y cuál como valor. Podés cambiar el mapeo sin volver a subir el archivo.',
      },
      {
        q: '¿Cómo cambio la paleta de colores?',
        a: 'En la pestaña Estilo del panel hay doce paletas predefinidas más una opción custom con dos color pickers (color inicial y final). También podés mover el centro del gradiente con un editor de rango que muestra el histograma de tus datos.',
      },
      {
        q: '¿Puedo personalizar el rango de colores?',
        a: 'Sí, con el range editor. Muestra el histograma de tus datos con tres handles (mínimo, medio, máximo) que podés mover. Por default se aplica un auto-clip de outliers usando los percentiles 2 y 98 para que un valor extremo no aplane el resto del mapa.',
      },
      {
        q: '¿Cómo exporto el mapa que generé?',
        a: 'Por ahora la forma directa es hacer un screenshot del navegador. En el roadmap hay un export directo a PNG y SVG previsto para los próximos meses.',
      },
      {
        q: '¿Puedo hacer un mapa con fondo transparente?',
        a: 'Sí. En la pestaña Estilo hay un toggle de Fondo transparente. Sirve para que el mapa exportado se vea bien sobre cualquier color de fondo en notas, presentaciones o redes sociales.',
      },
      {
        q: '¿Mapitas funciona en celular?',
        a: 'Sí, Mapitas es responsive. En mobile el panel de controles aparece como una bottom sheet deslizable que no oscurece el mapa al abrirse, así seguís viendo lo que estás mapeando mientras ajustás.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  {
    id: 'privacidad',
    label: 'Privacidad',
    items: [
      {
        q: '¿Mis datos se suben a un servidor?',
        a: 'No. Todo el procesamiento ocurre en tu navegador. Cuando subís un CSV, el archivo nunca sale de tu máquina: las librerías de parseo lo leen localmente y los resultados se renderizan en el mapa sin tocar ningún backend.',
      },
      {
        q: '¿Mapitas tiene tracking o analytics?',
        a: 'No. Mapitas no usa Google Analytics, Facebook Pixel ni ningún script de seguimiento. No se sabe quién entra, qué hace ni cuántas veces vuelve.',
      },
      {
        q: '¿Necesita conexión a internet para funcionar?',
        a: 'Sólo la primera vez para descargar la app y los datos base. Una vez cargada, funciona offline: podés navegar el mapa, cambiar configuración y aplicar estilos sin conexión.',
      },
    ],
  },
]
