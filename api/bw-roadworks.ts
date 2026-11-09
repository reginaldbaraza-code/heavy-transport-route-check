import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isoNow } from './_lib/autobahnTimes.js'
import { BW_LICENSE, BW_SOURCE } from './_lib/mobidata.js'
import { fetchBwRoadworks } from './_lib/openRoadworks.js'

export const config = {
  maxDuration: 15,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

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
