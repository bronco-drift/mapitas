// Landing del Proyecto MIDE (Ministerio de Datos y Estadísticas).
//
// MIDE es una iniciativa DENTRO de Mapitas: pensar la plataforma como
// infraestructura cívica de datos que llene, desde la sociedad civil,
// las funciones que un Instituto Nacional de Estadística debería cumplir
// y que en Venezuela hoy están abandonadas.
//
// La página explica: qué hace un INE, el vacío venezolano actual, lo
// que ya hacemos alineado con MIDE, los límites estructurales de hacerlo
// desde afuera del Estado, y la hoja de ruta hacia un MIDE virtual real.
//
// Mismo estilo Apple/Anthropic que Landing.tsx (sin gradients ornamentales,
// jerarquía por aire, tipografía como protagonista).

export function MIDE() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
        <a href="#/" className="flex items-center gap-2.5" aria-label="Mapitas — inicio">
          <Logo className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">Mapitas</span>
        </a>
        <nav className="flex items-center gap-5 text-[13px] text-slate-500">
          <a href="#/" className="hidden hover:text-slate-900 sm:inline">
            Mapitas
          </a>
          <a
            href="https://github.com/bronco-drift/mapitas"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden hover:text-slate-900 sm:inline"
          >
            GitHub
          </a>
          <a
            href="#/app"
            className="rounded-full bg-slate-900 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-slate-700"
          >
            Abrir mapa
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 sm:px-10">
        {/* Hero */}
        <section className="pt-12 pb-20 sm:pt-24 sm:pb-28" aria-labelledby="mide-title">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Iniciativa · Proyecto dentro de Mapitas
          </div>
          <h1
            id="mide-title"
            className="max-w-3xl text-[44px] font-bold leading-[0.98] tracking-[-0.025em] text-slate-900 sm:text-[68px]"
          >
            Proyecto MIDE.
            <br />
            <span className="text-slate-500">
              Ministerio de Datos y Estadísticas.
            </span>
          </h1>
          <p className="mt-7 max-w-[60ch] text-[17px] leading-[1.55] text-slate-600 sm:text-[19px]">
            Una iniciativa para construir, desde la sociedad civil, la
            infraestructura cívica de datos que un Instituto Nacional de
            Estadística debería sostener y que en Venezuela está abandonada.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#por-que"
              className="rounded-full bg-slate-900 px-6 py-3 text-[15px] font-medium text-white shadow-sm transition hover:bg-slate-700"
            >
              Por qué existe
            </a>
            <a
              href="#hoja-de-ruta"
              className="rounded-full px-6 py-3 text-[15px] font-medium text-slate-600 transition hover:text-slate-900"
            >
              Hoja de ruta
            </a>
          </div>
        </section>

        {/* Por qué — el vacío venezolano */}
        <section
          id="por-que"
          aria-labelledby="por-que-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="por-que-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            El árbitro de verdad se fue.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            Un INE serio cumple una función que no se ve hasta que falta: ser
            la referencia oficial. Cuando ese rol se vacía, cada actor publica
            su propia versión de la verdad y nadie sabe a quién creer.
          </p>

          <div className="mt-10 grid gap-x-10 gap-y-8 text-[14px] leading-relaxed text-slate-600 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Censos
              </div>
              <p className="mt-1.5">
                Último censo nacional: 2011. El de 2021 nunca se realizó.
                Las proyecciones poblacionales del INE siguen base 2001.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Encuestas continuas
              </div>
              <p className="mt-1.5">
                La Encuesta de Hogares por Muestreo del INE se publica con
                años de retraso o no se publica. ENCOVI (UCAB) llenó parte
                del vacío, pero es muestra y no oficial.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Anuarios y series
              </div>
              <p className="mt-1.5">
                Las publicaciones periódicas se discontinuaron de facto. No
                hay garantía de continuidad metodológica entre años.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Microdatos
              </div>
              <p className="mt-1.5">
                El acceso a datasets primarios está limitado o cerrado.
                Investigación y periodismo deben reconstruir desde fuentes
                secundarias.
              </p>
            </div>
          </div>
        </section>

        {/* Qué hace un MIDE */}
        <section
          aria-labelledby="que-hace-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="que-hace-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Qué hace un Ministerio de Datos.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            En la mayoría de países la función la cumple un instituto
            autónomo: INE en Venezuela, INDEC en Argentina, IBGE en Brasil,
            INEGI en México. El alcance es ministerial igual.
          </p>

          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            <FunctionBlock
              title="Producción primaria"
              items={[
                'Censo nacional cada 10 años',
                'Encuestas continuas (hogares, ingreso, fuerza laboral)',
                'Estadísticas vitales (nacimientos, muertes)',
                'Índices (IPC, canasta básica, precios productor)',
                'Cuentas nacionales (PIB, comercio exterior)',
                'Proyecciones poblacionales',
              ]}
            />
            <FunctionBlock
              title="Infraestructura técnica"
              items={[
                'División político-administrativa oficial',
                'Cartografía estadística por nivel',
                'Clasificadores (ocupaciones, industrias, productos)',
                'Marco muestral nacional',
                'Codebook común entre productores',
              ]}
            />
            <FunctionBlock
              title="Servicio público"
              items={[
                'Anuarios estadísticos periódicos',
                'Microdatos anónimos para investigación',
                'Coordinación con ministerios sectoriales',
                'Reportes a organismos internacionales',
                'Documentación metodológica abierta',
                'Asesoría técnica a otros productores',
              ]}
            />
          </div>

          <div className="mt-10 max-w-[60ch] border-l-2 border-slate-200 pl-5 text-[15px] leading-relaxed text-slate-600">
            Pero lo verdaderamente importante no son los números. Es la
            función de{' '}
            <span className="font-medium text-slate-900">árbitro de verdad</span>:
            cuando dos fuentes contradicen, el dato oficial es la referencia.
            Eso da estabilidad al debate público. Y la{' '}
            <span className="font-medium text-slate-900">continuidad
            metodológica</span>: que el IDH de 2025 sea comparable con el
            de 2010. Sin eso no hay análisis de tendencia.
          </div>
        </section>

        {/* Lo que YA hacemos */}
        <section
          id="estado-actual"
          aria-labelledby="ya-hacemos-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="ya-hacemos-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Lo que ya hacemos.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            Mapitas hoy cubre funciones que un INE serio tendría que sostener
            y que en la práctica suple desde afuera del Estado.
          </p>

          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            <Cover
              title="Infraestructura geo-administrativa"
              body="TopoJSON adm0/1/2 con códigos oficiales, nombres oficiales,
              parent states. Manejo explícito de casos especiales: Esequibo,
              Dependencias Federales, La Guaira (ex Vargas)."
            />
            <Cover
              title="Consolidador maestro"
              body="Un schema común que matchea 5 fuentes heterogéneas (INE,
              Wikipedia, Source CV, Provita, CSV propios). Es la función de
              estandarización clasificatoria."
            />
            <Cover
              title="Cobertura honesta"
              body="Badges, modales de cobertura, indicación de fuente y año
              por indicador. No escondemos los huecos, los exponemos."
            />
            <Cover
              title="Series temporales parciales"
              body="Población 2010/2020/2026, IDH 1990/2000/2010/2020. La
              base para reportes longitudinales."
            />
            <Cover
              title="Publicación abierta"
              body="Static-first, sin barreras de acceso ni cuentas. Funciona
              offline una vez cargado. Mejor que la mayoría de portales
              gubernamentales."
            />
            <Cover
              title="Capas temáticas integradas"
              body="11 capas de Provita: áreas protegidas, pueblos indígenas,
              cuencas, centros poblados. Cartografía estadística operacional."
            />
          </div>
        </section>

        {/* Los límites */}
        <section
          aria-labelledby="limites-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="limites-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Los límites honestos.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            Hay funciones que ningún actor civil puede cumplir. Mejor decirlo
            de frente que pretender lo contrario.
          </p>

          <div className="mt-10 space-y-6">
            <Limit
              title="Censo nacional"
              body="Requiere autoridad estatal, presupuesto millonario y decenas de miles de encuestadores. No se hace desde afuera del Estado."
            />
            <Limit
              title="Estadísticas vitales primarias"
              body="Dependen del registro civil. Sin acceso al sistema oficial, solo podemos trabajar con estimaciones agregadas."
            />
            <Limit
              title="Marco muestral nacional"
              body="El inventario maestro de hogares y empresas requiere el censo como base. Sin censo nuevo, todo lo derivado pierde precisión."
            />
            <Limit
              title="Autoridad oficial"
              body="No podemos decretar '<i>este</i> es EL dato oficial'. Pero sí podemos volvernos árbitro de facto en ausencia del Estado, que es lo que importa en la práctica."
            />
          </div>
        </section>

        {/* Lo que SÍ podemos */}
        <section
          aria-labelledby="si-podemos-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="si-podemos-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Lo que sí podemos.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            Las funciones que un MIDE virtual puede cumplir desde la sociedad
            civil con resultados comparables, o mejores, que muchas
            instituciones estatales.
          </p>

          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            <CanDo
              title="Consolidación e integración"
              body="Unificar fuentes existentes en un schema común con cobertura visible."
            />
            <CanDo
              title="Infraestructura geo-administrativa"
              body="Mantener actualizada la cartografía y la división territorial canónica."
            />
            <CanDo
              title="Continuidad metodológica"
              body="Documentar cómo se construye cada indicador, exponer cambios y mantener comparabilidad."
            />
            <CanDo
              title="Anuarios y publicaciones"
              body="Reportes periódicos auto-actualizables sobre el estado del país por estado y muni."
            />
            <CanDo
              title="Microdatos derivados"
              body="Distribuir datasets consolidados en CSV/JSON/GeoJSON, citables y reutilizables."
            />
            <CanDo
              title="Coordinación con productores"
              body="Integrar formalmente datos de UCAB-ENCOVI, OVV, ANOVA, Provita, IPYS, Wikimedia VE."
            />
            <CanDo
              title="APIs y datos abiertos"
              body="Exponer todo el catálogo para que medios, academia y otros sitios consuman."
            />
            <CanDo
              title="Crowdsourcing controlado"
              body="Ciudadanos pueden contribuir datasets verificables sobre su territorio."
            />
          </div>

          <div className="mt-10 max-w-[60ch] border-l-2 border-slate-200 pl-5 text-[15px] leading-relaxed text-slate-600">
            Un MIDE virtual tiene ventajas que un ministerio estatal no:
            velocidad de iteración sin burocracia, independencia política con
            financiamiento diverso, acceso global sin barreras, contribución
            ciudadana abierta.
          </div>
        </section>

        {/* Hoja de ruta */}
        <section
          id="hoja-de-ruta"
          aria-labelledby="ruta-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="ruta-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Hoja de ruta.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            Seis fases del MIDE virtual. Las dos primeras son alcanzables
            como proyecto unipersonal; de la tercera en adelante requieren
            estructura organizacional.
          </p>

          <ol className="mt-12 space-y-10">
            <Phase
              number="01"
              status="En curso"
              title="Visor consolidado"
              body="Visualizar indicadores integrados de múltiples fuentes con cobertura honesta. Cartografía limpia. Series temporales parciales. Subida de CSV propio."
            />
            <Phase
              number="02"
              status="Próximo"
              title="Catálogo y metodología pública"
              body="Página de metodología por indicador (fuente, año base, definición, fórmula, frecuencia, limitaciones). Manual de fuentes ampliado. Descarga de datos por indicador. Cita académica autogenerada."
            />
            <Phase
              number="03"
              status="Por venir"
              title="Federación con productores"
              body="Acuerdos formales con UCAB-ENCOVI, OVV, ANOVA, Provita, Wikimedia VE, IPYS. Contribución de datasets actualizados con cadencia acordada. Crédito visible por indicador."
            />
            <Phase
              number="04"
              status="Por venir"
              title="Anuarios y series temporales"
              body="Anuario Mapitas: publicación periódica con síntesis del estado del país. Timeline slider para series. Reportes temáticos por sector: pobreza, demografía, seguridad, salud, educación."
            />
            <Phase
              number="05"
              status="Por venir"
              title="Plataforma abierta"
              body="API pública versionada para que otros sitios consuman datos. Sistema de contribuciones ciudadanas con verificación. Embebibles para que medios usen los mapas en sus notas."
            />
            <Phase
              number="06"
              status="Visión"
              title="Árbitro de facto y estándares"
              body="Mapitas como referencia citable en periodismo y academia. Standards de reporte territorial venezolano. Convocatoria a productores a alinearse con el codebook común."
            />
          </ol>
        </section>

        {/* CTA */}
        <section
          aria-labelledby="cta-title"
          className="border-t border-slate-100 py-20 text-center sm:py-28"
        >
          <h2
            id="cta-title"
            className="text-[32px] font-bold leading-[1.05] tracking-[-0.025em] text-slate-900 sm:text-[48px]"
          >
            La infraestructura ya está corriendo.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-500 sm:text-base">
            MIDE no es un plan a futuro. Es lo que Mapitas hace hoy, con un
            horizonte más explícito y honesto.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#/app"
              className="rounded-full bg-slate-900 px-7 py-3.5 text-[15px] font-medium text-white shadow-sm transition hover:bg-slate-700"
            >
              Abrir el mapa
            </a>
            <a
              href="https://github.com/bronco-drift/mapitas"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-slate-200 px-7 py-3.5 text-[15px] font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            >
              Ver código
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5" />
            <span>Mapitas · Proyecto MIDE · © 2026</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <a href="#/" className="hover:text-slate-900">
              Volver a Mapitas
            </a>
            <a
              href="https://github.com/bronco-drift/mapitas"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900"
            >
              Código fuente
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

function FunctionBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map(item => (
          <li
            key={item}
            className="flex gap-2 text-[14px] leading-relaxed text-slate-700"
          >
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Cover({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
            aria-hidden="true"
          >
            <path d="M3 8l3 3 7-7" />
          </svg>
        </span>
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      </div>
      <p className="text-[14px] leading-relaxed text-slate-600">{body}</p>
    </div>
  )
}

function Limit({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:gap-8">
      <div className="text-[14px] font-medium text-slate-900">{title}</div>
      <p
        className="text-[14px] leading-relaxed text-slate-600"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  )
}

function CanDo({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{body}</p>
    </div>
  )
}

function Phase({
  number,
  status,
  title,
  body,
}: {
  number: string
  status: string
  title: string
  body: string
}) {
  const statusColor =
    status === 'En curso'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : status === 'Próximo'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-slate-50 text-slate-500 ring-slate-200'
  return (
    <li className="grid gap-3 sm:grid-cols-[80px_1fr] sm:gap-8">
      <div className="text-[24px] font-semibold leading-none text-slate-300 tabular-nums sm:text-[28px]">
        {number}
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="text-[18px] font-semibold leading-tight text-slate-900 sm:text-[20px]">
            {title}
          </h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ${statusColor}`}
          >
            {status}
          </span>
        </div>
        <p className="max-w-[64ch] text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">
          {body}
        </p>
      </div>
    </li>
  )
}

// Mismo logo que Landing.tsx (consistencia visual).
function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg-mide" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <path
        d="M14 48 V16 H22 L32 32 L42 16 H50 V48 H42 V28 L34 40 H30 L22 28 V48 Z"
        fill="url(#lg-mide)"
      />
    </svg>
  )
}
