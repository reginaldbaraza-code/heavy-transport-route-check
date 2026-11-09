import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isoNow } from './_lib/autobahnTimes.js'
import { BW_LICENSE, BW_SOURCE } from './_lib/mobidata.js'
import { fetchBwRoadworks } from './_lib/openRoadworks.js'
import { guardApi } from './_lib/httpGuard.js'

export const config = {
  maxDuration: 15,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardApi(req, res, 'GET, OPTIONS')) return

  try {
    const retrievedAt = isoNow()
    const items = await fetchBwRoadworks(retrievedAt)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200')
    return res.status(200).json({
      source: BW_SOURCE,
      license: BW_LICENSE.id,
      attribution: BW_LICENSE.attribution,
      retrievedAt,
      count: items.length,
      items,
    })
  } catch (error) {
    console.error('BEMaS fetch failed', error)
    return res.status(502).json({
      error: 'Failed to fetch MobiData BW BEMaS roadworks',
      source: BW_SOURCE,
      retrievedAt: isoNow(),
      items: [],
    })
  }
}
