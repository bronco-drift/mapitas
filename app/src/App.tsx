import { Suspense, lazy, useEffect, useState } from 'react'
import { Landing } from './components/Landing'
import { MIDE } from './components/MIDE'

// Lazy load del mapa: ~280kb extra (Leaflet + react-leaflet + Turf cuando se
// requiera). La landing NO los necesita, así que sólo se descargan cuando
// el user navega a /#/app. Mejora drásticamente el LCP de la home.
const MapApp = lazy(() => import('./MapApp').then(m => ({ default: m.MapApp })))

type Route = 'landing' | 'app' | 'mide'

function getRoute(): Route {
  const hash = window.location.hash.slice(1)
  if (hash.startsWith('/app')) return 'app'
  if (hash.startsWith('/mide')) return 'mide'
  return 'landing'
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute)

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
    } else if (route === 'mide') {
      document.title = 'Proyecto MIDE — Mapitas'
    } else {
      document.title = 'Mapitas — Mapas coropleticos en tu navegador'
    }
  }, [route])

  // Lock del viewport SOLO en la app del mapa. Sin esto, la landing y
  // MIDE no se podían scrollear en iPhone porque el index.css aplicaba
  // overflow:hidden + height:100dvh al body globalmente. La clase
  // `.app-locked` reactiva esos estilos puntualmente para la app, donde
  // sí los necesitamos (anti-bounce iOS + URL bar estable). Ver index.css.
  useEffect(() => {
    if (route !== 'app') return
    const html = document.documentElement
    html.classList.add('app-locked')
    return () => html.classList.remove('app-locked')
  }, [route])

  if (route === 'app') {
    return (
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
            Cargando mapa…
          </div>
        }
      >
        <MapApp />
      </Suspense>
    )
  }
  if (route === 'mide') {
    return <MIDE />
  }
  return <Landing />
}
