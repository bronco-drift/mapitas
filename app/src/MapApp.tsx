import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from './store'
import { MapView } from './components/MapView'
import { ControlPanel } from './components/ControlPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'
import { WelcomeModal } from './components/WelcomeModal'

// Lazy load del WorldMapView: trae d3-geo + d3-zoom (~70KB) solo cuando
// el user entra a vista Global. La vista Venezuela (default) no paga ese costo.
const WorldMapView = lazy(() =>
  import('./components/WorldMapView').then(m => ({ default: m.WorldMapView })),
)

export function MapApp() {
  const view = useStore(s => s.view)
  const loading = useStore(s => s.loading)
  const loadError = useStore(s => s.loadError)
  const loadGeoData = useStore(s => s.loadGeoData)
  const loadThematicManifest = useStore(s => s.loadThematicManifest)
  const adm1 = useStore(s => s.adm1)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    loadGeoData()
    loadThematicManifest()
  }, [loadGeoData, loadThematicManifest])

  const isGlobal = view === 'global'

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-100 md:flex-row">
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
          ) : (
            adm1 && (
              <ErrorBoundary>
                <MapView />
              </ErrorBoundary>
            )
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

