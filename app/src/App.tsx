import { useEffect } from 'react'
import { useStore } from './store'
import { MapView } from './components/MapView'
import { ControlPanel } from './components/ControlPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TopBar } from './components/TopBar'

function App() {
  const loading = useStore(s => s.loading)
  const loadError = useStore(s => s.loadError)
  const loadGeoData = useStore(s => s.loadGeoData)
  const loadThematicManifest = useStore(s => s.loadThematicManifest)
  const adm1 = useStore(s => s.adm1)

  useEffect(() => {
    loadGeoData()
    loadThematicManifest()
  }, [loadGeoData, loadThematicManifest])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <ControlPanel />
      <main className="relative flex flex-1 flex-col">
        <TopBar />
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 text-sm text-slate-600">
              Cargando mapa base…
            </div>
          )}
          {loadError && (
            <div className="absolute inset-x-0 top-0 z-[1000] m-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </div>
          )}
          {adm1 && (
            <ErrorBoundary>
              <MapView />
            </ErrorBoundary>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
