import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turf from '@turf/turf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'GEOjson files');
const OUT = join(ROOT, 'data');

mkdirSync(OUT, { recursive: true });

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mapeo de nombres cortos (geoBoundaries) a nombres oficiales (Gaceta Oficial Venezuela).
// Para estados que aún no incorporan el "Bolivariano" o tienen formas especiales.
const STATE_OFFICIAL = {
  Amazonas: 'Estado Amazonas',
  Anzoátegui: 'Estado Anzoátegui',
  Apure: 'Estado Apure',
  Aragua: 'Estado Aragua',
  Barinas: 'Estado Barinas',
  Bolívar: 'Estado Bolívar',
  Carabobo: 'Estado Carabobo',
  Cojedes: 'Estado Cojedes',
  'Delta Amacuro': 'Estado Delta Amacuro',
  'Distrito Capital': 'Distrito Capital',
  Falcón: 'Estado Falcón',
  Guárico: 'Estado Guárico',
  'La Guaira': 'Estado La Guaira',
  Lara: 'Estado Lara',
  Mérida: 'Estado Mérida',
  Miranda: 'Estado Bolivariano Miranda',
  Monagas: 'Estado Monagas',
  'Nueva Esparta': 'Estado Nueva Esparta',
  Portuguesa: 'Estado Portuguesa',
  Sucre: 'Estado Sucre',
  Táchira: 'Estado Táchira',
  Trujillo: 'Estado Trujillo',
  Yaracuy: 'Estado Yaracuy',
  Zulia: 'Estado Zulia',
  'Dependencias Federales': 'Dependencias Federales',
  'Guayana Esequiba': 'Estado Guayana Esequiba',
}

// Municipios con denominación especial (Bolivariano, Indígena, Turístico, etc.)
// Clave = compoundKey (estadoKey__nombreKey), valor = nombreOficial completo.
const MUNI_OFFICIAL_OVERRIDES = {
  // Distrito Capital
  'distrito capital__libertador': 'Municipio Bolivariano Libertador',
  // Miranda
  'miranda__guaicaipuro': 'Municipio Bolivariano Guaicaipuro',
  'miranda__libertador': 'Municipio Bolivariano Libertador',
  // Zulia
  'zulia__guajira': 'Municipio Indígena Bolivariano Guajira',
  // Anzoátegui
  'anzoategui__diego bautista urbanejo': 'Municipio Turístico Diego Bautista Urbaneja',
  // Bolívar
  'bolivar__angostura': 'Municipio Bolivariano Angostura',
  // Amazonas (todos son Autónomos)
  // se manejan con el sufijo por defecto abajo
}

// =============================================================
// FASE 1: ADM1 (estados) + Esequibo
// =============================================================
console.log('Leyendo ADM1 y ADM2...');
const adm1Raw = JSON.parse(
  readFileSync(join(SRC, 'geoBoundaries-VEN-ADM1_simplified.geojson'), 'utf8')
);
const adm2Raw = JSON.parse(
  readFileSync(join(SRC, 'geoBoundaries-VEN-ADM2_simplified.geojson'), 'utf8')
);

// geoBoundaries trae el Esequibo como "Zona en Reclamación" en ADM2.
// Lo extraemos y lo promovemos a ADM1 como "Guayana Esequiba" (VE-GE).
const zonaReclamacion = adm2Raw.features.find(
  f => f.properties.shapeName === 'Zona en Reclamación'
);
if (!zonaReclamacion) {
  throw new Error('No se encontró "Zona en Reclamación" en ADM2');
}

const esequibo = {
  type: 'Feature',
  properties: {
    name: 'Guayana Esequiba',
    nombreOficial: STATE_OFFICIAL['Guayana Esequiba'],
    iso: 'VE-GE',
    nameKey: normalize('Guayana Esequiba'),
    capital: 'Tumeremo',
    region: 'Guayana',
    isDisputed: true,
    note: 'Territorio reclamado por Venezuela. Acuerdo de Ginebra 1966 + Ley Orgánica 2024.',
    sourceID: zonaReclamacion.properties.shapeID
  },
  geometry: zonaReclamacion.geometry
};

const adm1Features = adm1Raw.features.map(f => ({
  type: 'Feature',
  properties: {
    name: f.properties.shapeName,
    nombreOficial: STATE_OFFICIAL[f.properties.shapeName] ?? `Estado ${f.properties.shapeName}`,
    iso: f.properties.shapeISO,
    nameKey: normalize(f.properties.shapeName),
    isDisputed: false,
    sourceID: f.properties.shapeID
  },
  geometry: f.geometry
}));

adm1Features.push(esequibo);

const adm1Enriched = {
  type: 'FeatureCollection',
  crs: adm1Raw.crs,
  features: adm1Features
};

writeFileSync(
  join(OUT, 'venezuela-adm1-enriched.geojson'),
  JSON.stringify(adm1Enriched)
);
console.log(`ADM1 OK: ${adm1Features.length} features (25 oficiales + Esequibo)`);

// =============================================================
// FASE 2: ADM2 (municipios) con spatial join
// =============================================================
// Excluimos "Zona en Reclamación" porque ya fue promovida a ADM1 como Esequibo
const adm2Source = adm2Raw.features.filter(
  f => f.properties.shapeName !== 'Zona en Reclamación'
);
console.log(`Spatial join: ${adm2Source.length} municipios contra ${adm1Features.length} estados...`);

let matched = 0;
let matchedByDistance = 0;
const unmatched = [];
const fallbackHits = [];

// Centroides precalculados de cada estado, para el fallback por distancia
const stateCentroids = adm1Features.map(s => {
  try {
    return { state: s, centroid: turf.centroid(s) };
  } catch {
    return { state: s, centroid: null };
  }
});

function findParentState(municipalityFeature) {
  // Estrategia 1: point-in-polygon con pointOnFeature (siempre dentro del municipio)
  const candidates = [];
  try { candidates.push(turf.pointOnFeature(municipalityFeature)); } catch {}
  try { candidates.push(turf.centroid(municipalityFeature)); } catch {}

  for (const point of candidates) {
    for (const state of adm1Features) {
      try {
        if (turf.booleanPointInPolygon(point, state)) {
          return {
            name: state.properties.name,
            iso: state.properties.iso,
            method: 'point-in-polygon'
          };
        }
      } catch {}
    }
  }

  // Estrategia 2: fallback para islas / costas mal alineadas — estado más cercano
  if (candidates.length === 0) return null;
  const point = candidates[0];
  let nearest = null;
  let minDist = Infinity;
  for (const { state, centroid } of stateCentroids) {
    if (!centroid) continue;
    const d = turf.distance(point, centroid);
    if (d < minDist) {
      minDist = d;
      nearest = state;
    }
  }
  if (!nearest) return null;
  return {
    name: nearest.properties.name,
    iso: nearest.properties.iso,
    method: `nearest-centroid (${minDist.toFixed(0)}km)`
  };
}

const adm2Features = adm2Source.map(f => {
  const parent = findParentState(f);
  if (parent) {
    matched++;
    if (parent.method.startsWith('nearest')) {
      matchedByDistance++;
      fallbackHits.push(`${f.properties.shapeName} → ${parent.name} (${parent.method})`);
    }
  } else {
    unmatched.push(f.properties.shapeName);
  }

  const parentName = parent?.name ?? null;
  const parentISO = parent?.iso ?? null;
  const parentKey = parentName ? normalize(parentName) : null;
  const nameKey = normalize(f.properties.shapeName);
  const compoundKey = parentKey ? `${parentKey}__${nameKey}` : null;
  const nombreOficial = (compoundKey && MUNI_OFFICIAL_OVERRIDES[compoundKey])
    ?? `Municipio ${f.properties.shapeName}`;

  return {
    type: 'Feature',
    properties: {
      name: f.properties.shapeName,
      nombreOficial,
      nameKey,
      parentState: parentName,
      parentISO,
      parentStateKey: parentKey,
      compoundKey,
      sourceID: f.properties.shapeID
    },
    geometry: f.geometry
  };
});

// Inyectar municipios placeholder cuando el estado no tiene subdivisión en
// geoBoundaries: Esequibo, La Guaira (estado de un solo muni), Dependencias
// Federales (sin municipalización formal). Cada uno = misma geometría del estado.
function buildPlaceholderMuni(stateFeature, muniName, oficialName) {
  const stateName = stateFeature.properties.name
  const parentISO = stateFeature.properties.iso
  const parentKey = normalize(stateName)
  const nameKey = normalize(muniName)
  return {
    type: 'Feature',
    properties: {
      name: muniName,
      nombreOficial: oficialName,
      nameKey,
      parentState: stateName,
      parentISO,
      parentStateKey: parentKey,
      compoundKey: `${parentKey}__${nameKey}`,
      sourceID: `${stateFeature.properties.sourceID}_muni`,
    },
    geometry: stateFeature.geometry,
  }
}

const placeholderConfigs = [
  { iso: 'VE-GE', muni: 'Guayana Esequiba', oficial: 'Estado Guayana Esequiba' },
  { iso: 'VE-X', muni: 'Vargas', oficial: 'Municipio Vargas' },
  { iso: 'VE-W', muni: 'Dependencias Federales', oficial: 'Dependencias Federales' },
]
for (const cfg of placeholderConfigs) {
  // Solo agregamos si el estado existe Y no hay ya un muni con su geometría
  const stateF = adm1Features.find(f => f.properties.iso === cfg.iso)
  if (!stateF) continue
  const already = adm2Features.find(f => f.properties.parentISO === cfg.iso)
  if (already) continue
  adm2Features.push(buildPlaceholderMuni(stateF, cfg.muni, cfg.oficial))
  console.log(`  + Muni placeholder agregado: ${cfg.iso} ${cfg.muni}`)
}

const adm2Enriched = {
  type: 'FeatureCollection',
  crs: adm2Raw.crs,
  features: adm2Features
};

writeFileSync(
  join(OUT, 'venezuela-adm2-enriched.geojson'),
  JSON.stringify(adm2Enriched)
);

console.log(`ADM2 OK: ${adm2Features.length} municipios`);
console.log(`   Matched (point-in-polygon): ${matched - matchedByDistance}`);
console.log(`   Matched (fallback distancia): ${matchedByDistance}`);
console.log(`   Sin parentState: ${unmatched.length}`);
if (fallbackHits.length > 0) {
  console.log('   Fallback hits:');
  fallbackHits.forEach(h => console.log('     -', h));
}
if (unmatched.length > 0) {
  console.log(`   Huérfanos: ${unmatched.join(', ')}`);
}
