// FAQ del Proyecto MIDE (caso Venezuela).
//
// Estas FAQ son específicas al caso venezolano: fuentes oficiales,
// indicadores pre-cargados, capas temáticas, Esequibo, Dependencias
// Federales. Las FAQ genéricas sobre cómo usar la herramienta viven en
// faq-mapitas.ts.
//
// El JSON-LD FAQPage para MIDE debería vivir en la ruta /mide. Por ahora
// (sin pre-rendering) las FAQ MIDE se ven en la página pero no se inyectan
// como schema separado.

export type FAQItem = { q: string; a: string }

export type FAQCategory = {
  id: string
  label: string
  items: FAQItem[]
}

export const FAQ_MIDE: FAQCategory[] = [
  // ──────────────────────────────────────────────────────────────────
  {
    id: 'sobre-mide',
    label: 'Sobre MIDE',
    items: [
      {
        q: '¿Qué es el proyecto MIDE?',
        a: 'MIDE (Ministerio de Datos y Estadísticas) es una iniciativa para construir desde la sociedad civil la infraestructura cívica de datos territoriales sobre Venezuela. Usa la herramienta Mapitas como base, suma fuentes oficiales y no oficiales, y las consolida en un visor abierto.',
      },
      {
        q: '¿Por qué se llama MIDE?',
        a: 'Por dos razones: es un acrónimo de Ministerio de Datos y Estadísticas, y al mismo tiempo es un verbo (medir). Funciona como recordatorio de que los datos territoriales públicos son un bien que alguien tiene que mantener — y si el Estado no lo hace, lo hace la sociedad civil.',
      },
      {
        q: '¿MIDE es lo mismo que Mapitas?',
        a: 'No. Mapitas es la herramienta web genérica (mapping coroplético, BYO data). MIDE es el proyecto venezolano específico que vive sobre Mapitas con datos curados, indicadores oficiales pre-cargados y misión cívica explícita.',
      },
      {
        q: '¿Quién mantiene MIDE?',
        a: 'MIDE es mantenido por el mismo autor que Mapitas (bronco-drift). Es un proyecto open source y abierto a contribuciones de investigadores, periodistas y organizaciones de la sociedad civil venezolana.',
      },
      {
        q: '¿Por qué Venezuela tiene este vacío de datos?',
        a: 'El último censo nacional fue en 2011; el de 2021 nunca se realizó. La Encuesta de Hogares del INE se publica con años de retraso o no se publica. Los anuarios estadísticos se discontinuaron de facto. ENCOVI (UCAB) llenó parte del vacío como muestra académica, pero sin estatus oficial. MIDE consolida lo que existe.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  {
    id: 'datos',
    label: 'Datos y fuentes',
    items: [
      {
        q: '¿De dónde vienen los datos de Venezuela en MIDE?',
        a: 'Geometrías de estados y municipios: geoBoundaries (William & Mary). Esequibo: Provita / IGVSB. Indicadores oficiales: INE Venezuela, OVV (Observatorio Venezolano de Violencia), Source CV (recopilación PNUD/UCAB). Capas temáticas: geoportal Provita.',
      },
      {
        q: '¿Qué indicadores oficiales vienen pre-cargados?',
        a: 'Población 2024 / 2026 (proyección), IDH histórico 1990-2020 e IDH 2026 estimado, PIB total, PIB per cápita, área en kilómetros cuadrados, tasa de homicidios del OVV, % en cabecera urbana, densidad. Cada indicador muestra su fuente y año en la leyenda del mapa.',
      },
      {
        q: '¿Por qué hay municipios sin datos en algunos indicadores?',
        a: 'Porque las fuentes oficiales no publican datos para todas las entidades. En la lista de indicadores aparece un badge en color ámbar con el número de entidades sin datos. Click en el badge abre un modal con la lista completa para que la opacidad sea visible.',
      },
      {
        q: '¿Qué pasa con el Esequibo?',
        a: 'Está incluido como entidad propia con su geometría, basada en datos de Provita / IGVSB. La mayoría de los indicadores oficiales no publica datos diferenciados para el Esequibo, así que aparece en gris en esos casos. En el roadmap se planea agregar valores espejados desde Delta Amacuro como estimaciones marcadas.',
      },
      {
        q: '¿Por qué Dependencias Federales aparece en gris?',
        a: 'Porque las fuentes oficiales (INE, OVV, Wikipedia) no publican datos demográficos para esa entidad. Está representada con su geometría correcta, pero los indicadores quedan sin valor. En el roadmap hay un plan para agregar estimaciones marcadas explícitamente como aproximadas.',
      },
      {
        q: '¿Qué año tienen los datos de población?',
        a: 'Hay dos series principales: población 2024 y proyección 2026, ambas basadas en publicaciones del INE. La proyección 2026 está marcada como estimación. En el futuro se sumarán las series históricas 2010, 2020 y 2050 que ya están procesadas, a la espera de una UI de timeline slider.',
      },
      {
        q: '¿De dónde viene la tasa de homicidios?',
        a: 'Del Observatorio Venezolano de Violencia (OVV), una organización independiente que publica estadísticas anuales de violencia letal por estado y municipio. Es una fuente reconocida internacionalmente, citada por medios y trabajos académicos sobre seguridad pública en Venezuela.',
      },
      {
        q: '¿Qué son las capas temáticas?',
        a: 'Son once capas opcionales del geoportal de Provita / IGVSB que podés superponer al mapa: áreas protegidas, territorios indígenas, cuencas hidrográficas, vialidad, lotes petroleros, energía, centros poblados y otras. Se cargan bajo demanda para no aumentar el peso del bootstrap.',
      },
      {
        q: '¿Quién valida que los datos sean correctos?',
        a: 'Las fuentes son las oficiales (INE, OVV, Provita). MIDE no genera datos propios, los normaliza y consolida. Cuando un dato es estimado o tiene baja confianza, la app lo indica explícitamente con la leyenda "datos ilustrativos · validar contra fuente oficial".',
      },
      {
        q: '¿Qué licencia tienen los datos?',
        a: 'geoBoundaries y Provita publican bajo Creative Commons BY 4.0. Wikipedia bajo CC BY-SA. Los datos del INE y OVV son de acceso público según las leyes venezolanas de estadística. Las licencias específicas se documentan en el repositorio de GitHub.',
      },
    ],
  },
]
