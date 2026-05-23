// Preguntas frecuentes de Mapitas — fuente única de verdad.
//
// Estas 50 FAQ se usan en dos lugares:
//   1. Landing.tsx (sección visible para usuarios)
//   2. index.html (JSON-LD FAQPage para SEO / featured snippets de Google)
//
// Si modificás esta lista, actualizá también el JSON-LD manualmente en
// index.html para mantener consistencia (lo que ve el usuario = lo que ve el bot).
//
// Tono: directo, en español, sin promoción. Respuestas de ~50-100 palabras.

export type FAQItem = { q: string; a: string }

export type FAQCategory = {
  id: string
  label: string
  items: FAQItem[]
}

export const FAQ: FAQCategory[] = [
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'proyecto',
    label: 'Sobre el proyecto',
    items: [
      {
        q: '¿Qué es Mapitas?',
        a: 'Una herramienta web para visualizar datos territoriales sobre el mapa de Venezuela. Permite subir un CSV o Excel y verlo pintado sobre estados o municipios en segundos. También trae indicadores oficiales pre-cargados como población, IDH y tasa de homicidios.',
      },
      {
        q: '¿Para qué sirve Mapitas?',
        a: 'Para que periodistas, investigadores, ONGs y ciudadanos puedan crear mapas coropléticos de Venezuela sin saber GIS, sin instalar nada y sin pagar. Sirve tanto para ilustrar notas y reportes como para explorar visualmente los indicadores oficiales del país.',
      },
      {
        q: '¿Quién hizo Mapitas?',
        a: 'Mapitas es un proyecto open source mantenido bajo el handle bronco-drift. El código fuente está disponible públicamente en GitHub. No es una empresa ni una organización con fines de lucro.',
      },
      {
        q: '¿Es gratis Mapitas?',
        a: 'Sí, completamente. Sin paywall, sin freemium, sin marca de agua en los mapas exportados. El proyecto es open source y se aloja en un CDN estático, por lo que el costo de operación es cercano a cero.',
      },
      {
        q: '¿Tengo que crear una cuenta?',
        a: 'No. Mapitas no tiene login, registro ni perfiles. Abrís la página y empezás a usar. Tus preferencias (paleta, indicador activo, capas) se guardan en tu navegador con localStorage, no en un servidor.',
      },
      {
        q: '¿Por qué se enfoca en Venezuela?',
        a: 'Porque resolver bien un país obliga a construir las abstracciones correctas para escalar al siguiente. Venezuela es el primer caso completo; el código ya está preparado para sumar otros países latinoamericanos en el futuro sin reescribirse.',
      },
      {
        q: '¿Mapitas es open source?',
        a: 'Sí. El código fuente completo está en GitHub bajo el repositorio bronco-drift/mapitas. Cualquiera puede revisar cómo funciona, proponer mejoras, abrir issues o usarlo como base para sus propios proyectos.',
      },
      {
        q: '¿Cuánto cuesta usar Mapitas?',
        a: 'Nada. No tiene planes, no hay pago por uso ni límite de mapas generados. Tampoco existe una versión "pro" pagada. El modelo es 100% gratuito y libre, en línea con el principio de transparencia que motiva al proyecto.',
      },
      {
        q: '¿En qué se diferencia de Datawrapper o Flourish?',
        a: 'Mapitas se especializa exclusivamente en Venezuela, con datos oficiales pre-cargados y geometrías ya validadas para estados y municipios. No tiene marca de agua, no requiere login y todo el procesamiento ocurre en tu navegador. Datawrapper y Flourish son más generales pero menos integrados con datos venezolanos.',
      },
      {
        q: '¿Cuál es la misión de Mapitas?',
        a: 'Hacer la transparencia territorial accesible para cualquier persona. Que los datos relevantes para la ciudadanía dejen de estar encerrados en PDFs y silos institucionales y pasen a ser visibles, comparables y públicos sobre un mapa que todos entienden.',
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
        a: 'En el panel lateral hay un botón "Subir CSV o Excel". Podés arrastrar tu archivo o seleccionarlo desde el sistema. Mapitas detecta las columnas automáticamente y te pide confirmar cuál es el nombre del estado o municipio y cuál es el valor a mapear.',
      },
      {
        q: '¿Qué formatos de archivo acepta?',
        a: 'CSV (separado por coma), TSV (separado por tabulación), Excel (.xlsx y .xls) y OpenDocument Spreadsheet (.ods). El parseo se hace localmente con PapaParse y SheetJS, sin subir tu archivo a ningún servidor.',
      },
      {
        q: '¿Cómo debe estar estructurado mi CSV?',
        a: 'Solo necesitás una columna con el nombre del estado o municipio y una columna con el valor numérico. Mapitas adivina cuál es cuál y te deja confirmar. Si trabajás a nivel municipio y hay nombres repetidos entre estados, podés sumar una columna opcional de "estado padre" para desambiguar.',
      },
      {
        q: '¿Qué pasa si los nombres de mis municipios tienen tildes o abreviaciones?',
        a: 'Mapitas usa fuzzy matching: tolera tildes faltantes, mayúsculas, espacios extra y abreviaciones comunes como "Edo." o "Mcpio.". Después de cargar el archivo, te muestra cuántas filas matchearon y cuáles no, con la lista exacta de los nombres no reconocidos para que los corrijas.',
      },
      {
        q: '¿Puedo elegir qué columna usar como valor?',
        a: 'Sí. Después de subir el archivo, Mapitas muestra dropdowns con todas las columnas detectadas. Vos elegís cuál usar como geo (nombre) y cuál como valor. Si cambiás de idea, podés modificar el mapeo sin volver a subir el archivo.',
      },
      {
        q: '¿Cómo cambio la paleta de colores?',
        a: 'En la pestaña "Estilo" del panel hay doce paletas predefinidas más una opción custom con dos color pickers (color inicial y final). También podés mover el centro del gradiente con un editor de rango que muestra el histograma de tus datos.',
      },
      {
        q: '¿Puedo personalizar el rango de colores?',
        a: 'Sí, con el range editor. Muestra el histograma de tus datos con tres handles (mínimo, medio, máximo) que podés mover. Por default se aplica un auto-clip de outliers usando los percentiles 2 y 98 para que un valor extremo no aplane el resto del mapa. Es toggleable.',
      },
      {
        q: '¿Cómo exporto el mapa que generé?',
        a: 'Por ahora la forma directa es hacer un screenshot del navegador (Ctrl+Shift+S en Firefox, Command+Shift+4 en Mac, o herramientas como Lightshot y ShareX). En el roadmap hay un export directo a PNG y SVG previsto para los próximos meses.',
      },
      {
        q: '¿Puedo hacer un mapa con fondo transparente?',
        a: 'Sí. En la pestaña "Estilo" → sección "Vista" hay un toggle de "Fondo transparente" pensado justamente para esto. Sirve para que el mapa exportado se vea bien sobre cualquier color de fondo en notas, presentaciones, sitios web o redes sociales.',
      },
      {
        q: '¿Funciona en celular?',
        a: 'Sí, Mapitas es responsive. En mobile el panel de controles aparece como una bottom sheet deslizable que no oscurece el mapa al abrirse, así seguís viendo lo que estás mapeando mientras ajustás. Hay un botón flotante "Panel" para invocarla desde cualquier vista.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  {
    id: 'datos',
    label: 'Datos y fuentes',
    items: [
      {
        q: '¿De dónde vienen los datos de Venezuela?',
        a: 'Las geometrías de estados y municipios vienen de geoBoundaries (William & Mary). Las del Esequibo de Provita / IGVSB. Los indicadores oficiales del Instituto Nacional de Estadística (INE), del Observatorio Venezolano de Violencia (OVV) y de Source CV. Las capas temáticas son del geoportal de Provita.',
      },
      {
        q: '¿Qué indicadores oficiales vienen pre-cargados?',
        a: 'Siete: población 2024, población 2026 (proyección), Índice de Desarrollo Humano (IDH), PIB total, PIB per cápita, área en kilómetros cuadrados y tasa de homicidios del OVV. Cada indicador muestra su fuente y año dentro de la app, en la leyenda del mapa.',
      },
      {
        q: '¿Por qué hay municipios sin datos en algunos indicadores?',
        a: 'Porque las fuentes oficiales no publican datos para todas las entidades. En la lista de indicadores aparece un badge en color ámbar con el número de entidades sin datos. Si hacés click ahí, se abre un modal con la lista completa de qué está faltando, para que la opacidad de los datos sea visible.',
      },
      {
        q: '¿Qué pasa con el Esequibo?',
        a: 'Está incluido como entidad propia con su geometría, basada en datos de Provita / IGVSB. La mayoría de los indicadores oficiales no publica datos diferenciados para el Esequibo, así que aparece en gris en esos casos. En el roadmap se planea agregar valores espejados desde Delta Amacuro como estimaciones marcadas.',
      },
      {
        q: '¿Por qué Dependencias Federales aparece en gris?',
        a: 'Porque las fuentes oficiales (INE, OVV, Wikipedia) no publican datos demográficos para esa entidad. Está representada con su geometría correcta, pero los indicadores quedan sin valor. En el roadmap hay un plan para agregar estimaciones marcadas explícitamente como aproximadas, no oficiales.',
      },
      {
        q: '¿Qué año tienen los datos de población?',
        a: 'Hay dos series disponibles: población 2024 y proyección 2026, ambas basadas en publicaciones del INE. La proyección 2026 está marcada como estimación. En el futuro se sumarán las series históricas 2010, 2020 y 2050 que ya están procesadas, a la espera de una UI de timeline slider.',
      },
      {
        q: '¿De dónde viene la tasa de homicidios?',
        a: 'Del Observatorio Venezolano de Violencia (OVV), una organización independiente que publica estadísticas anuales de violencia letal por estado y municipio. Es una fuente reconocida internacionalmente, citada por medios y trabajos académicos sobre seguridad pública en Venezuela.',
      },
      {
        q: '¿Qué son las capas temáticas?',
        a: 'Son once capas opcionales del geoportal de Provita / IGVSB que podés superponer al mapa: áreas protegidas, territorios indígenas, cuencas hidrográficas, vialidad, lotes petroleros, energía, centros poblados y otras. Se cargan bajo demanda para no aumentar el peso del bootstrap inicial.',
      },
      {
        q: '¿Quién valida que los datos sean correctos?',
        a: 'Las fuentes son las oficiales (INE, OVV, Provita). Mapitas no genera datos propios, los normaliza y consolida. Cuando un dato es estimado o tiene baja confianza, la app lo indica explícitamente con la leyenda "datos ilustrativos · validar contra fuente oficial" para que el usuario sepa.',
      },
      {
        q: '¿Qué licencia tienen los datos?',
        a: 'geoBoundaries y Provita publican bajo Creative Commons BY 4.0. Wikipedia bajo CC BY-SA. Los datos del INE y OVV son de acceso público según las leyes venezolanas de estadística. Las licencias específicas se documentan en el repositorio de GitHub.',
      },
    ],
  },

]
