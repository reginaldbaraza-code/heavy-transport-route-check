export const MOBIDATA_USER_AGENT =
  'heavy-transport-route-check/1.0 (open roadworks; https://github.com/reginaldbaraza-code/heavy-transport-route-check)'

export const MOBIDATA_FEEDS = {
  bwGeojson: 'https://api.mobidata-bw.de/datasets/traffic/roadworks/roadworks_geojson.json',
  miaShort: 'https://api.mobidata-bw.de/datasets/traffic/roadworks/roadworks_adb_short_term.datex2.xml',
  miaLong: 'https://api.mobidata-bw.de/datasets/traffic/roadworks/roadworks_adb_long_term.datex2.xml',
} as const

export const DL_DE_BY_20 = 'dl-de/by-2.0'

export const BW_LICENSE = {
  id: DL_DE_BY_20,
  name: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
  url: 'https://www.govdata.de/dl-de/by-2-0',
  attribution: 'Verkehrsministerium Baden-Württemberg / BEMaS via MobiData BW. License: dl-de/by-2.0.',
}

export const MIA_LICENSE = {
  id: DL_DE_BY_20,
  name: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
  url: 'https://www.govdata.de/dl-de/by-2-0',
  attribution: 'Autobahn GmbH des Bundes / Mobilithek, republished by MobiData BW. License: dl-de/by-2.0.',
}

export const BW_SOURCE = 'MobiData BW (BEMaS)'
export const MIA_SOURCE = 'Autobahn GmbH MIA via Mobilithek/MobiData BW'
export const MIA_STALE_MS = 12 * 60 * 60 * 1000
export const BW_CACHE_MS = 10 * 60 * 1000
