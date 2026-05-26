import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useStore } from './store'
import { MapView } from './components/MapView'
import { ControlPanel } from './components/ControlPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { WelcomeModal } from './components/WelcomeModal'
import { getIndicatorCoverage } from './data/indicators'

// Lazy load del WorldMapView: trae d3-geo + d3-zoom (~70KB) solo cuando
// el user entra a vista Global. La vista Venezuela (default) no paga ese costo.
const WorldMapView = lazy(() =>
  import('./components/WorldMapView').then(m => ({ default: m.WorldMapView })),
)
// Vista experimental "Test Leaflet": cualquier región (Mundo, Latam, Europa,
// etc.) renderizada en Leaflet en lugar de SVG d3-geo. La región específica
// sale de `globalRegion` del store; este componente sirve para los 6 tests.
const RegionTestView = lazy(() =>
  import('./components/RegionTestView').then(m => ({ default: m.RegionTestView })),
)

export function MapApp() {
  const view = useStore(s => s.view)
  const loading = useStore(s => s.loading)
  const loadError = useStore(s => s.loadError)
  const loadGeoData = useStore(s => s.loadGeoData)
  const loadThematicManifest = useStore(s => s.loadThematicManifest)
  const adm1 = useStore(s => s.adm1)
  const adm2 = useStore(s => s.adm2)
  const level = useStore(s => s.level)
  const setLevel = useStore(s => s.setLevel)
  const source = useStore(s => s.source)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    loadGeoData()
    loadThematicManifest()
  }, [loadGeoData, loadThematicManifest])

  const isGlobal = view === 'global'
  const isRegionTest = view === 'region_test'

  // Empty state: cuando el indicador activo NO aplica al nivel actual,
  // el mapa queda gris sin explicación. Renderemos un overlay sutil sobre
  // el mapa con el motivo + CTA al nivel donde sí aplica. Solo en vista
  // Venezuela (en global/regional la cobertura aplica distinta).
  const activeIndicator = source?.kind === 'indicator' ? source.indicator : null
  const coverage = useMemo(() => {
    if (!activeIndicator) return null
    const adm1Count = adm1?.features.length ?? 26
    const adm2Count = adm2?.features.length ?? 336
    return getIndicatorCoverage(activeIndicator, level, { adm1Count, adm2Count })
  }, [activeIndicator, level, adm1, adm2])
  const showEmptyState =
    !isGlobal &&
    !isRegionTest &&
    coverage != null &&
    !coverage.applies &&
    !!activeIndicator?.restrictedTo
  const ctaTargetLevel = activeIndicator?.restrictedTo
  const ctaLabel =
    ctaTargetLevel === 'adm0' ? 'Ver en País'
    : ctaTargetLevel === 'adm1' ? 'Ver en Estados'
    : ctaTargetLevel === 'adm2' ? 'Ver en Municipios'
    : ''

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 md:flex-row">
      <ControlPanel mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <main className="relative flex flex-1 flex-col">
        <TopBar />
        <div className="relative flex-1">
          {loading && !isGlobal && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 text-sm text-slate-600">
              Cargando mapa base…
            </div>
          )}
          {loadError && (
            <div className="absolute inset-x-0 top-0 z-[1000] m-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </div>
          )}
          {isGlobal ? (
            <ErrorBoundary>
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-slate-500">Cargando vista global…</div>}>
                <WorldMapView />
              </Suspense>
            </ErrorBoundary>
          ) : isRegionTest ? (
            <ErrorBoundary>
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-sm text-slate-500">Cargando vista Test Leaflet…</div>}>
                <RegionTestView />
              </Suspense>
            </ErrorBoundary>
          ) : (
            adm1 && (
              <ErrorBoundary>
                <MapView />
              </ErrorBoundary>
            )
          )}

          {/* Empty state overlay: el indicador activo no aplica al nivel
              actual (ej. "Banderas munis" en nivel Estados). En lugar de
              dejar al user con un mapa gris sin explicación, mostramos el
              motivo + CTA directo al nivel donde sí aplica. */}
          {showEmptyState && coverage && ctaTargetLevel && (
            <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/85 px-4 backdrop-blur-sm dark:bg-slate-950/85">
              <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Reporte no aplica
                </div>
                <p className="mt-2 text-[14px] leading-snug text-slate-700 dark:text-slate-200">
                  {coverage.reason}
                </p>
                <button
                  type="button"
                  onClick={() => setLevel(ctaTargetLevel)}
                  className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                >
                  {ctaLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Botón flotante solo mobile para abrir el panel.
          bottom usa env(safe-area-inset-bottom) para no quedar pegado al
          home indicator del iPhone. En Android/sin notch usa 1rem normal. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
        className="fixed left-1/2 z-[1100] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-medium text-white shadow-xl md:hidden"
        aria-label="Abrir panel"
      >
        Panel
      </button>

      {/* Modal de bienvenida: sólo aparece la primera vez. Auto-decide
          mostrarse o no según localStorage; cerrarlo marca el flag. */}
      <WelcomeModal />
    </div>
  )
}

