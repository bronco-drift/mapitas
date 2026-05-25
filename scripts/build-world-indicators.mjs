// Genera app/public/data/world-indicators.json con datos comparativos por
// país para la vista Global. Hoy: PIB per cápita (USD nominal, Banco Mundial
// 2023) e IDH (PNUD HDR 2023/24).
//
// Cuándo regenerar:
//   - El Banco Mundial publica el WDI anual en julio. Cuando salga 2024,
//     actualizar valores y reflota.
//   - El PNUD publica HDR anual en marzo. Idem.
//   - Si agregamos más métricas mundiales (esperanza de vida, % alfabetización,
//     densidad poblacional, etc.), agregar acá y actualizar applyDiaspora +
//     global-reports.
//
// Cómo correr:
//   node scripts/build-world-indicators.mjs
//
// Fuentes oficiales:
//   - Banco Mundial WDI: https://data.worldbank.org/indicator/NY.GDP.PCAP.CD
//   - PNUD HDR: https://hdr.undp.org/data-center/country-insights

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Datos por ISO_A3 (alpha-3). Mantener el mismo orden alfabético que el
// geojson para facilitar comparar y detectar países sin cobertura.
// null = sin dato confiable de la fuente oficial.
const COUNTRIES = {
  AFG: { pib_per_capita_usd: 422,    idh: 0.462 }, // Afghanistan (post-2021 collapse)
  AGO: { pib_per_capita_usd: 2057,   idh: 0.591 }, // Angola
  ALB: { pib_per_capita_usd: 8368,   idh: 0.789 }, // Albania
  ARE: { pib_per_capita_usd: 51910,  idh: 0.937 }, // United Arab Emirates
  ARG: { pib_per_capita_usd: 13730,  idh: 0.849 }, // Argentina
  ARM: { pib_per_capita_usd: 8040,   idh: 0.786 }, // Armenia
  ATF: { pib_per_capita_usd: null,   idh: null  }, // French Southern Territories (uninhabited)
  AUS: { pib_per_capita_usd: 65366,  idh: 0.951 }, // Australia
  AUT: { pib_per_capita_usd: 56506,  idh: 0.926 }, // Austria
  AZE: { pib_per_capita_usd: 7762,   idh: 0.760 }, // Azerbaijan
  BDI: { pib_per_capita_usd: 200,    idh: 0.420 }, // Burundi
  BEL: { pib_per_capita_usd: 53475,  idh: 0.942 }, // Belgium
  BEN: { pib_per_capita_usd: 1428,   idh: 0.504 }, // Benin
  BFA: { pib_per_capita_usd: 893,    idh: 0.438 }, // Burkina Faso
  BGD: { pib_per_capita_usd: 2529,   idh: 0.670 }, // Bangladesh
  BGR: { pib_per_capita_usd: 15797,  idh: 0.799 }, // Bulgaria
  BHS: { pib_per_capita_usd: 34749,  idh: 0.820 }, // Bahamas
  BIH: { pib_per_capita_usd: 7682,   idh: 0.779 }, // Bosnia and Herzegovina
  BLR: { pib_per_capita_usd: 7889,   idh: 0.801 }, // Belarus
  BLZ: { pib_per_capita_usd: 7252,   idh: 0.700 }, // Belize
  BOL: { pib_per_capita_usd: 3658,   idh: 0.698 }, // Bolivia
  BRA: { pib_per_capita_usd: 10412,  idh: 0.760 }, // Brasil
  BRN: { pib_per_capita_usd: 33700,  idh: 0.823 }, // Brunei
  BTN: { pib_per_capita_usd: 3838,   idh: 0.681 }, // Bhutan
  BWA: { pib_per_capita_usd: 7250,   idh: 0.708 }, // Botswana
  CAF: { pib_per_capita_usd: 511,    idh: 0.414 }, // Central African Republic
  CAN: { pib_per_capita_usd: 53247,  idh: 0.935 }, // Canada
  CHE: { pib_per_capita_usd: 99995,  idh: 0.967 }, // Switzerland
  CHL: { pib_per_capita_usd: 17094,  idh: 0.860 }, // Chile
  CHN: { pib_per_capita_usd: 12614,  idh: 0.788 }, // China (excl. HK/Macao)
  CIV: { pib_per_capita_usd: 2729,   idh: 0.534 }, // Côte d'Ivoire
  CMR: { pib_per_capita_usd: 1647,   idh: 0.587 }, // Cameroon
  COD: { pib_per_capita_usd: 686,    idh: 0.481 }, // DRC
  COG: { pib_per_capita_usd: 2541,   idh: 0.593 }, // Republic of Congo
  COL: { pib_per_capita_usd: 6624,   idh: 0.758 }, // Colombia
  CRI: { pib_per_capita_usd: 17150,  idh: 0.806 }, // Costa Rica
  CUB: { pib_per_capita_usd: 9477,   idh: 0.764 }, // Cuba (2020 reported, post-crisis estimate)
  CYN: { pib_per_capita_usd: null,   idh: null  }, // Northern Cyprus (not in BM/UN)
  CYP: { pib_per_capita_usd: 33807,  idh: 0.907 }, // Cyprus
  CZE: { pib_per_capita_usd: 29856,  idh: 0.895 }, // Czech Republic
  DEU: { pib_per_capita_usd: 52746,  idh: 0.950 }, // Germany
  DJI: { pib_per_capita_usd: 3606,   idh: 0.515 }, // Djibouti
  DNK: { pib_per_capita_usd: 67967,  idh: 0.952 }, // Denmark
  DOM: { pib_per_capita_usd: 11249,  idh: 0.766 }, // República Dominicana
  DZA: { pib_per_capita_usd: 4274,   idh: 0.745 }, // Algeria
  ECU: { pib_per_capita_usd: 6533,   idh: 0.765 }, // Ecuador
  EGY: { pib_per_capita_usd: 3457,   idh: 0.728 }, // Egypt
  ERI: { pib_per_capita_usd: 612,    idh: 0.493 }, // Eritrea
  ESH: { pib_per_capita_usd: null,   idh: null  }, // Western Sahara (disputed, no data)
  ESP: { pib_per_capita_usd: 32677,  idh: 0.911 }, // España
  EST: { pib_per_capita_usd: 30998,  idh: 0.899 }, // Estonia
  ETH: { pib_per_capita_usd: 1027,   idh: 0.492 }, // Ethiopia
  FIN: { pib_per_capita_usd: 53983,  idh: 0.942 }, // Finland
  FLK: { pib_per_capita_usd: null,   idh: null  }, // Falklands (no separate data)
  FRA: { pib_per_capita_usd: 44461,  idh: 0.910 }, // France
  GAB: { pib_per_capita_usd: 8635,   idh: 0.706 }, // Gabon
  GBR: { pib_per_capita_usd: 48867,  idh: 0.940 }, // United Kingdom
  GEO: { pib_per_capita_usd: 8120,   idh: 0.814 }, // Georgia
  GHA: { pib_per_capita_usd: 2238,   idh: 0.602 }, // Ghana
  GIN: { pib_per_capita_usd: 1568,   idh: 0.471 }, // Guinea
  GMB: { pib_per_capita_usd: 822,    idh: 0.495 }, // The Gambia
  GNB: { pib_per_capita_usd: 904,    idh: 0.483 }, // Guinea-Bissau
  GNQ: { pib_per_capita_usd: 7010,   idh: 0.650 }, // Equatorial Guinea
  GRC: { pib_per_capita_usd: 23173,  idh: 0.893 }, // Greece
  GRL: { pib_per_capita_usd: 56000,  idh: null  }, // Greenland (Danish autonomous, no HDI)
  GTM: { pib_per_capita_usd: 5707,   idh: 0.629 }, // Guatemala
  GUY: { pib_per_capita_usd: 21515,  idh: 0.742 }, // Guyana (oil boom)
  HND: { pib_per_capita_usd: 3076,   idh: 0.624 }, // Honduras
  HRV: { pib_per_capita_usd: 22221,  idh: 0.878 }, // Croatia
  HTI: { pib_per_capita_usd: 1745,   idh: 0.552 }, // Haiti
  HUN: { pib_per_capita_usd: 22147,  idh: 0.851 }, // Hungary
  IDN: { pib_per_capita_usd: 4941,   idh: 0.713 }, // Indonesia
  IND: { pib_per_capita_usd: 2612,   idh: 0.644 }, // India
  IRL: { pib_per_capita_usd: 103685, idh: 0.950 }, // Ireland
  IRN: { pib_per_capita_usd: 4503,   idh: 0.780 }, // Iran
  IRQ: { pib_per_capita_usd: 5938,   idh: 0.686 }, // Iraq
  ISL: { pib_per_capita_usd: 78836,  idh: 0.959 }, // Iceland
  ISR: { pib_per_capita_usd: 53196,  idh: 0.915 }, // Israel
  ITA: { pib_per_capita_usd: 38373,  idh: 0.906 }, // Italy
  JAM: { pib_per_capita_usd: 6987,   idh: 0.706 }, // Jamaica
  JOR: { pib_per_capita_usd: 4527,   idh: 0.736 }, // Jordan
  JPN: { pib_per_capita_usd: 33834,  idh: 0.920 }, // Japan
  KAZ: { pib_per_capita_usd: 13136,  idh: 0.802 }, // Kazakhstan
  KEN: { pib_per_capita_usd: 2099,   idh: 0.601 }, // Kenya
  KGZ: { pib_per_capita_usd: 2290,   idh: 0.701 }, // Kyrgyzstan
  KHM: { pib_per_capita_usd: 2479,   idh: 0.600 }, // Cambodia
  KOR: { pib_per_capita_usd: 33121,  idh: 0.929 }, // Korea
  KOS: { pib_per_capita_usd: 6385,   idh: null  }, // Kosovo (not in UN HDR)
  KWT: { pib_per_capita_usd: 32290,  idh: 0.847 }, // Kuwait
  LAO: { pib_per_capita_usd: 2087,   idh: 0.620 }, // Lao PDR
  LBN: { pib_per_capita_usd: 4136,   idh: 0.723 }, // Lebanon (post-crisis)
  LBR: { pib_per_capita_usd: 794,    idh: 0.487 }, // Liberia
  LBY: { pib_per_capita_usd: 7338,   idh: 0.746 }, // Libya
  LKA: { pib_per_capita_usd: 3828,   idh: 0.780 }, // Sri Lanka
  LSO: { pib_per_capita_usd: 1054,   idh: 0.521 }, // Lesotho
  LTU: { pib_per_capita_usd: 27090,  idh: 0.879 }, // Lithuania
  LUX: { pib_per_capita_usd: 128259, idh: 0.927 }, // Luxembourg
  LVA: { pib_per_capita_usd: 23104,  idh: 0.879 }, // Latvia
  MAR: { pib_per_capita_usd: 3711,   idh: 0.698 }, // Morocco
  MDA: { pib_per_capita_usd: 6603,   idh: 0.763 }, // Moldova
  MDG: { pib_per_capita_usd: 545,    idh: 0.487 }, // Madagascar
  MEX: { pib_per_capita_usd: 13804,  idh: 0.781 }, // México
  MKD: { pib_per_capita_usd: 7488,   idh: 0.770 }, // North Macedonia
  MLI: { pib_per_capita_usd: 856,    idh: 0.410 }, // Mali
  MMR: { pib_per_capita_usd: 1198,   idh: 0.585 }, // Myanmar
  MNE: { pib_per_capita_usd: 12387,  idh: 0.844 }, // Montenegro
  MNG: { pib_per_capita_usd: 5366,   idh: 0.741 }, // Mongolia
  MOZ: { pib_per_capita_usd: 627,    idh: 0.461 }, // Mozambique
  MRT: { pib_per_capita_usd: 2147,   idh: 0.540 }, // Mauritania
  MWI: { pib_per_capita_usd: 481,    idh: 0.508 }, // Malawi
  MYS: { pib_per_capita_usd: 11649,  idh: 0.807 }, // Malaysia
  NAM: { pib_per_capita_usd: 4878,   idh: 0.610 }, // Namibia
  NCL: { pib_per_capita_usd: 36800,  idh: null  }, // New Caledonia (French overseas)
  NER: { pib_per_capita_usd: 624,    idh: 0.394 }, // Niger
  NGA: { pib_per_capita_usd: 2163,   idh: 0.548 }, // Nigeria
  NIC: { pib_per_capita_usd: 2533,   idh: 0.669 }, // Nicaragua
  NLD: { pib_per_capita_usd: 62536,  idh: 0.946 }, // Netherlands
  NOR: { pib_per_capita_usd: 87925,  idh: 0.966 }, // Norway
  NPL: { pib_per_capita_usd: 1399,   idh: 0.601 }, // Nepal
  NZL: { pib_per_capita_usd: 47362,  idh: 0.939 }, // New Zealand
  OMN: { pib_per_capita_usd: 21266,  idh: 0.819 }, // Oman
  PAK: { pib_per_capita_usd: 1471,   idh: 0.540 }, // Pakistan
  PAN: { pib_per_capita_usd: 17354,  idh: 0.820 }, // Panamá
  PER: { pib_per_capita_usd: 7791,   idh: 0.762 }, // Perú
  PHL: { pib_per_capita_usd: 3859,   idh: 0.710 }, // Philippines
  PNG: { pib_per_capita_usd: 2906,   idh: 0.568 }, // Papua New Guinea
  POL: { pib_per_capita_usd: 22057,  idh: 0.881 }, // Poland
  PRI: { pib_per_capita_usd: 36084,  idh: null  }, // Puerto Rico (US territory)
  PRK: { pib_per_capita_usd: null,   idh: null  }, // North Korea (no reliable WB/UN data)
  PRT: { pib_per_capita_usd: 27291,  idh: 0.874 }, // Portugal
  PRY: { pib_per_capita_usd: 6232,   idh: 0.731 }, // Paraguay
  PSE: { pib_per_capita_usd: 3517,   idh: 0.716 }, // Palestine
  QAT: { pib_per_capita_usd: 80195,  idh: 0.875 }, // Qatar
  ROU: { pib_per_capita_usd: 18414,  idh: 0.827 }, // Romania
  RUS: { pib_per_capita_usd: 13815,  idh: 0.821 }, // Russia
  RWA: { pib_per_capita_usd: 966,    idh: 0.548 }, // Rwanda
  SAU: { pib_per_capita_usd: 32422,  idh: 0.875 }, // Saudi Arabia
  SDN: { pib_per_capita_usd: 1101,   idh: 0.516 }, // Sudan
  SEN: { pib_per_capita_usd: 1633,   idh: 0.517 }, // Senegal
  SLB: { pib_per_capita_usd: 2466,   idh: 0.562 }, // Solomon Islands
  SLE: { pib_per_capita_usd: 527,    idh: 0.458 }, // Sierra Leone
  SLV: { pib_per_capita_usd: 5391,   idh: 0.674 }, // El Salvador
  SOL: { pib_per_capita_usd: null,   idh: null  }, // Somaliland (not internationally recognized)
  SOM: { pib_per_capita_usd: 592,    idh: null  }, // Somalia (no recent HDI)
  SRB: { pib_per_capita_usd: 11680,  idh: 0.805 }, // Serbia
  SSD: { pib_per_capita_usd: 1115,   idh: 0.381 }, // South Sudan
  SUR: { pib_per_capita_usd: 6688,   idh: 0.690 }, // Suriname
  SVK: { pib_per_capita_usd: 24470,  idh: 0.855 }, // Slovakia
  SVN: { pib_per_capita_usd: 32163,  idh: 0.926 }, // Slovenia
  SWE: { pib_per_capita_usd: 56291,  idh: 0.952 }, // Sweden
  SWZ: { pib_per_capita_usd: 3771,   idh: 0.610 }, // eSwatini
  SYR: { pib_per_capita_usd: 421,    idh: 0.557 }, // Syria (war estimate)
  TCD: { pib_per_capita_usd: 717,    idh: 0.394 }, // Chad
  TGO: { pib_per_capita_usd: 992,    idh: 0.547 }, // Togo
  THA: { pib_per_capita_usd: 7172,   idh: 0.803 }, // Thailand
  TJK: { pib_per_capita_usd: 1278,   idh: 0.679 }, // Tajikistan
  TKM: { pib_per_capita_usd: 11743,  idh: 0.744 }, // Turkmenistan
  TLS: { pib_per_capita_usd: 1404,   idh: 0.566 }, // Timor-Leste
  TTO: { pib_per_capita_usd: 19057,  idh: 0.814 }, // Trinidad and Tobago
  TUN: { pib_per_capita_usd: 3895,   idh: 0.732 }, // Tunisia
  TUR: { pib_per_capita_usd: 12882,  idh: 0.855 }, // Turkey
  TWN: { pib_per_capita_usd: 32443,  idh: null  }, // Taiwan (not in UN HDR)
  TZA: { pib_per_capita_usd: 1192,   idh: 0.532 }, // Tanzania
  UGA: { pib_per_capita_usd: 1014,   idh: 0.550 }, // Uganda
  UKR: { pib_per_capita_usd: 5181,   idh: 0.734 }, // Ukraine
  URY: { pib_per_capita_usd: 22565,  idh: 0.830 }, // Uruguay
  USA: { pib_per_capita_usd: 80035,  idh: 0.927 }, // Estados Unidos
  UZB: { pib_per_capita_usd: 2255,   idh: 0.727 }, // Uzbekistan
  VEN: { pib_per_capita_usd: 3474,   idh: 0.699 }, // Venezuela (BM no publica desde 2014; estimación FMI)
  VNM: { pib_per_capita_usd: 4324,   idh: 0.726 }, // Vietnam
  VUT: { pib_per_capita_usd: 3105,   idh: 0.614 }, // Vanuatu
  YEM: { pib_per_capita_usd: 650,    idh: 0.424 }, // Yemen
  ZAF: { pib_per_capita_usd: 6253,   idh: 0.717 }, // South Africa
  ZMB: { pib_per_capita_usd: 1369,   idh: 0.569 }, // Zambia
  ZWE: { pib_per_capita_usd: 2304,   idh: 0.550 }, // Zimbabwe
}

const output = {
  meta: {
    description:
      'Indicadores comparativos por país. Cobertura: ~190 países UN-reconocidos. ' +
      'null cuando la fuente oficial no publica el dato (territorios disputados, ' +
      'autoridades de facto, Corea del Norte sin transparencia macro, etc.).',
    sources: {
      pib_per_capita_usd:
        'Banco Mundial · World Development Indicators · NY.GDP.PCAP.CD · 2023 (USD nominal)',
      idh:
        'PNUD · Informe sobre Desarrollo Humano 2023/2024 (publicado marzo 2024, datos 2022)',
    },
    notes: {
      VEN:
        'Venezuela: Banco Mundial dejó de publicar PIB desde 2014 por opacidad ' +
        'oficial; valor mostrado es estimación FMI/WEO ajustada por inflación.',
      CUB:
        'Cuba: datos del Banco Mundial discontinuados; valor es último año disponible (2020).',
      PRK:
        'Corea del Norte: sin data oficial publicada (Banco Mundial / UN sin acceso).',
    },
  },
  countries: COUNTRIES,
}

const outputPath = resolve(process.cwd(), 'app/public/data/world-indicators.json')
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n')

const withPib = Object.values(COUNTRIES).filter(c => c.pib_per_capita_usd != null).length
const withIdh = Object.values(COUNTRIES).filter(c => c.idh != null).length
console.log(`✔ ${Object.keys(COUNTRIES).length} países en world-indicators.json`)
console.log(`  · ${withPib} con PIB pc · ${withIdh} con IDH`)
console.log(`  → ${outputPath}`)
