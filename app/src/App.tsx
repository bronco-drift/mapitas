import { Suspense, lazy, useEffect, useState } from 'react'
import { Landing } from './components/Landing'

// Lazy load del mapa: ~280kb extra (Leaflet + react-leaflet + Turf cuando se
// requiera). La landing NO los necesita, así que sólo se descargan cuando
// el user navega a /#/app. Mejora drásticamente el LCP de la home.
const MapApp = lazy(() => import('./MapApp').then(m => ({ default: m.MapApp })))

function getRoute(): 'landing' | 'app' {
  const hash = window.location.hash.slice(1)
  return hash.startsWith('/app') ? 'app' : 'landing'
}

export default function App() {
  const [route, setRoute] = useState<'landing' | 'app'>(getRoute)

  useEffect(() => {
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Cambia el <title> del documento según la ruta. Mejora UX al compartir
  // y mantenerse en el historial. La landing usa el title del index.html.
  useEffect(() => {
    if (route === 'app') {
      document.title = 'Mapa interactivo — Mapitas'
    } else {
      document.title = 'Mapitas — Mapas y datos abiertos de Venezuela'
    }
  }, [route])

  if (route === 'app') {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen w-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
            Cargando mapa…
          </div>
        }
      >
        <MapApp />
      </Suspense>
    )
  }
  return <Landing />
}
