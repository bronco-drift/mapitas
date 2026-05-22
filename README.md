# Mapitas

Plataforma de **transparencia territorial** estática para Venezuela. Sube un CSV/Excel y el mapa se pinta solo, todo en el navegador, sin backend.

## Características

- **27 estados** (24 oficiales + Distrito Capital + Dependencias Federales + Estado Guayana Esequiba) con nomenclatura oficial (Gaceta) y nombres cortos
- **337 municipios** con `parentState`, `compoundKey` y normalización de nombres
- **7 indicadores pre-cargados**: Población 2024/2026, IDH, PIB total, PIB per cápita, Área, Tasa de homicidios
- **11 capas temáticas** del catálogo Provita / IGVSB (Áreas Protegidas, Territorios Indígenas, Cuencas, Vialidad, Lotes Petroleros, Energía, etc.) — lazy-loaded
- **Cruce de CSV** con detección automática de columnas + fuzzy matching de nombres
- **5 paletas + custom** (dos color pickers)
- **Controles**: grosor de borde, color, fondo, aislar país, jerarquía estado/muni
- **Picklist LATAM** preparado para escalar a más países

## Stack

Vite + React 19 + TypeScript + Tailwind v4 + Leaflet + Zustand + PapaParse + SheetJS + Turf.js

100% static-first. Deployable a cualquier CDN.

## Desarrollo

```bash
# en la raíz: dependencias para los scripts de preprocesamiento
npm install

# para regenerar las bases enriquecidas
npm run enrich
node scripts/process-municipal-csv.mjs

# para regenerar capas temáticas (requiere los SHP en raw-sources/)
node scripts/convert-provita.mjs
node scripts/simplify-thematic.mjs

# desarrollo del frontend
cd app
npm install
npm run dev
```

## Fuentes

- **Base geográfica**: geoBoundaries (William & Mary, CC BY 4.0)
- **Esequibo**: Provita / IGVSB (Instituto Geográfico de Venezuela Simón Bolívar)
- **Capas temáticas**: Provita geoportal (CC BY 4.0) — https://geoportal.provita.org.ve/
- **Datos**: INE Venezuela, OVV (Observatorio Venezolano de Violencia), estimaciones municipales 2026

Datos marcados con _datos ilustrativos · validar contra fuente oficial_ donde corresponde.
