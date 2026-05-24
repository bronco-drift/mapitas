// Landing page de Mapitas. Estructura:
//   - <header> con logo + link a GitHub + link a FAQ
//   - <main> con hero + grid de features + sources + FAQ + CTA secundaria
//   - <footer> con créditos y atribuciones
//
// Diseño Apple/Anthropic: mucho whitespace, jerarquía tipográfica clara,
// sin imágenes pesadas, sólo SVG inline. HTML semántico para SEO y a11y.
//
// Las FAQ viven en data/faq.ts (single source of truth). El JSON-LD de
// FAQPage que las refleja para Google está en index.html — si cambia el
// listado, hay que actualizar ambos.

import { FAQ } from '../data/faq'

export function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
        <a href="#/" className="flex items-center gap-2.5" aria-label="Mapitas — inicio">
          <Logo className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">Mapitas</span>
        </a>
        <nav className="flex items-center gap-5 text-[13px] text-slate-500">
          <a
            href="#/mide"
            className="hidden hover:text-slate-900 sm:inline"
          >
            MIDE
          </a>
          <a
            href="#faq"
            className="hidden hover:text-slate-900 sm:inline"
          >
            FAQ
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
        <section className="pt-12 pb-20 sm:pt-24 sm:pb-32" aria-labelledby="hero-title">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Datos abiertos · 100% local
          </div>
          <h1
            id="hero-title"
            className="max-w-3xl text-[44px] font-bold leading-[0.98] tracking-[-0.025em] text-slate-900 sm:text-[68px]"
          >
            Mapas de Venezuela.
            <br />
            <span className="bg-gradient-to-br from-blue-500 to-slate-900 bg-clip-text text-transparent">
              Datos al instante.
            </span>
          </h1>
          <p className="mt-7 max-w-[58ch] text-[17px] leading-[1.55] text-slate-600 sm:text-[19px]">
            Visualizá indicadores territoriales sobre Venezuela. Usá los datos
            pre-cargados o subí tu propio CSV. Todo corre en tu navegador, sin
            servidores ni cuentas.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#/app"
              className="rounded-full bg-slate-900 px-6 py-3 text-[15px] font-medium text-white shadow-sm transition hover:bg-slate-700"
            >
              Abrir el mapa
            </a>
            <a
              href="#features"
              className="rounded-full px-6 py-3 text-[15px] font-medium text-slate-600 transition hover:text-slate-900"
            >
              Cómo funciona
            </a>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="features-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Hecho para periodistas, investigadores y curiosos.
          </h2>
          <p className="mt-4 max-w-[55ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            Sin instalación. Sin curva de aprendizaje. Solo abrís y mapeás.
          </p>

          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            <Feature
              icon={<IconLayers />}
              title="7 indicadores oficiales"
              body="Población, IDH, homicidios, PIB, área, PIB per cápita. Sobre estados y municipios."
            />
            <Feature
              icon={<IconUpload />}
              title="Subí tu CSV"
              body="Cruce automático por nombre o ISO. Excel también. Sin configuración."
            />
            <Feature
              icon={<IconLock />}
              title="100% en tu navegador"
              body="Nada se sube a un servidor. Tus datos no salen de tu máquina."
            />
            <Feature
              icon={<IconPalette />}
              title="Personalizable"
              body="13 paletas, opacidades, basemaps, fondo transparente. Tu mapa, tu estilo."
            />
          </div>
        </section>

        {/* Proyecto MIDE — iniciativa dentro de Mapitas */}
        <section
          aria-labelledby="mide-callout-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Iniciativa
          </div>
          <h2
            id="mide-callout-title"
            className="max-w-3xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Proyecto MIDE.
            <br />
            <span className="text-slate-500">
              La infraestructura que el Estado dejó vacía.
            </span>
          </h2>
          <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
            Mapitas no es solo una herramienta de visualización. Es una
            iniciativa para construir, desde la sociedad civil, la
            infraestructura cívica de datos que un Instituto Nacional de
            Estadística debería sostener y que en Venezuela está abandonada.
          </p>
          <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
            MIDE (Ministerio de Datos y Estadísticas) es un proyecto dentro
            de Mapitas con hoja de ruta explícita: qué hacemos, qué no
            podemos hacer desde afuera del Estado y qué sí podemos.
          </p>
          <div className="mt-7">
            <a
              href="#/mide"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition hover:bg-slate-700"
            >
              Conocer el proyecto
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </a>
          </div>
        </section>

        {/* Stack / Fuentes */}
        <section
          aria-labelledby="sources-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="sources-title"
            className="text-[24px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[32px]"
          >
            Datos confiables, abiertos.
          </h2>
          <div className="mt-8 grid gap-6 text-[14px] leading-relaxed text-slate-600 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Fronteras
              </div>
              <p className="mt-1.5">
                Provita y IGVSB. Geometría limpia con topología cerrada, sin huecos
                entre polígonos. 23 estados, 335 municipios.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Indicadores
              </div>
              <p className="mt-1.5">
                INE Venezuela, OVV, estimaciones 2026. Cada indicador conserva su
                fuente y año visibles en la app.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Capas temáticas
              </div>
              <p className="mt-1.5">
                11 capas opcionales de Provita: áreas protegidas, pueblos indígenas,
                cuencas, centros poblados.
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tecnología
              </div>
              <p className="mt-1.5">
                React, Leaflet y TopoJSON. Build estático servido desde CDN.
                Funciona offline una vez cargado.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          aria-labelledby="faq-title"
          className="border-t border-slate-100 pt-16 pb-20 sm:pt-24"
        >
          <h2
            id="faq-title"
            className="max-w-2xl text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-[40px]"
          >
            Preguntas frecuentes.
          </h2>
          <p className="mt-4 max-w-[55ch] text-[15px] leading-relaxed text-slate-500 sm:text-[16px]">
            Lo esencial sobre cómo funciona Mapitas, de dónde vienen los datos y qué viene después.
          </p>

          <div className="mt-12 space-y-12">
            {FAQ.map(cat => (
              <div key={cat.id}>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {cat.label}
                </h3>
                <div className="border-t border-slate-100">
                  {cat.items.map((item, i) => (
                    <FAQItem key={i} q={item.q} a={item.a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section
          aria-labelledby="cta-title"
          className="border-t border-slate-100 py-20 text-center sm:py-28"
        >
          <h2
            id="cta-title"
            className="text-[32px] font-bold leading-[1.05] tracking-[-0.025em] text-slate-900 sm:text-[56px]"
          >
            Listo cuando vos.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-500 sm:text-base">
            Sin registro. Sin descarga. Un click y estás mapeando.
          </p>
          <a
            href="#/app"
            className="mt-8 inline-flex rounded-full bg-slate-900 px-7 py-3.5 text-[15px] font-medium text-white shadow-sm transition hover:bg-slate-700"
          >
            Abrir el mapa
          </a>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5" />
            <span>Mapitas · © 2026</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <a
              href="https://github.com/bronco-drift/mapitas"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900"
            >
              Código fuente
            </a>
            <a
              href="https://geoportal.provita.org.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900"
            >
              Datos: Provita
            </a>
            <a
              href="https://www.ine.gob.ve/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900"
            >
              INE Venezuela
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// FAQ item con <details>/<summary> nativos para accesibilidad gratis
// (Enter/Space, screen readers). El ::-webkit-details-marker se oculta para
// usar el plus animado custom que rota 45deg al expandir (group-open).
function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-slate-100 [&::-webkit-details-marker]:hidden [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-start justify-between gap-4 py-4 marker:hidden">
        <span className="text-[15px] font-medium leading-snug text-slate-900">{q}</span>
        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition-transform duration-200 group-open:rotate-45">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
        </span>
      </summary>
      <p className="pb-5 pr-9 text-[14px] leading-relaxed text-slate-600">{a}</p>
    </details>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div>
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600">{body}</p>
    </div>
  )
}

// Logo en SVG inline (igual al favicon, escalable, ~150 bytes una vez minificado)
function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0f172a" />
      <path
        d="M14 48 V16 H22 L32 32 L42 16 H50 V48 H42 V28 L34 40 H30 L22 28 V48 Z"
        fill="url(#lg-logo)"
      />
    </svg>
  )
}

// Iconos lucide-style minimalistas, todo inline (no agregamos deps)
function IconLayers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconPalette() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  )
}
