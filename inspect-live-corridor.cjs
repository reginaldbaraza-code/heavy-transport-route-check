const playwright = require('playwright');

const deployedUrl = 'https://heavy-transport-route-check-ebxnthsqf-red-bars-projects.vercel.app';
const bypassParam = '?_vercel_share=kEsiprjFJz0lGWlu7rCvSziXTGGPUuZU';

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const consoleLogs = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text);
  });
  
  try {
    console.log('Inspecting Corridor Monitor (21f2102)...\n');
    
    await page.goto(`${deployedUrl}/map-explorer${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(8000);
    
    // Deep inspection of corridor map state
    const state = await page.evaluate(() => {
      const map = window.__TEST_CORRIDOR_MAP__;
      if (!map) return { error: 'No corridor map instance' };
      
      const style = map.getStyle();
      const layers = style.layers.map(l => ({ 
        id: l.id, 
        type: l.type, 
        source: l.source,
        visibility: l.layout?.visibility 
      }));
      
      // Check events source
      const eventsSource = map.getSource('events');
      let sourceData = null;
      if (eventsSource) {
        const data = eventsSource._data || eventsSource.serialize?.();
        if (data && data.features) {
          sourceData = {
            type: data.type,
            featureCount: data.features.length,
            firstFeature: data.features[0],
            sampleCoordinates: data.features.slice(0, 3).map(f => f.geometry?.coordinates)
          };
        }
      }
      
      // Query rendered features
      let clusterFeatures = [];
      let pointFeatures = [];
      try {
        clusterFeatures = map.queryRenderedFeatures({ layers: ['clusters'] });
        pointFeatures = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
      } catch (e) {
        console.error('Query features error:', e.message);
      }
      
      // Get bounds and center
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();
      
      return {
        hasMap: true,
        layers: layers.filter(l => l.id.includes('cluster') || l.id.includes('unclustered') || l.id.includes('events')),
        allLayerIds: layers.map(l => l.id),
        eventsSource: eventsSource ? 'exists' : 'missing',
        sourceData,
        clusterFeatures: clusterFeatures.length,
        pointFeatures: pointFeatures.length,
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        },
        center: { lng: center.lng, lat: center.lat },
        zoom
      };
    });
    
    console.log('\n═══ CORRIDOR MAP STATE ═══');
    console.log(JSON.stringify(state, null, 2));
    
    await page.screenshot({ path: '/opt/cursor/artifacts/live-corridor-inspection.png' });
    console.log('\n✓ Screenshot saved');
    
    require('fs').writeFileSync('/opt/cursor/artifacts/live-corridor-console.txt', consoleLogs.join('\n'));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
