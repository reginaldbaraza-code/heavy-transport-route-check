const playwright = require('playwright');

const deployedUrl = 'https://heavy-transport-route-check-pr2h0bo5o-red-bars-projects.vercel.app';
const bypassParam = '?_vercel_share=AOf09kBx59N78wnwGVaTyD7YnLaX5ABc';

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const consoleLogs = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(text);
    }
  });
  
  try {
    console.log('Testing deployed build aaa33dd...\n');
    
    // Set bypass cookie
    await page.goto(`${deployedUrl}${bypassParam}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // Go to route checks
    await page.goto(`${deployedUrl}/route-checks${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Show test permits
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    
    // Click Hamburg
    await page.click('button:has-text("Hamburg")');
    await page.waitForTimeout(1500);
    
    // Click Check route
    await page.click('button:has-text("Check route")');
    await page.waitForSelector('.verdict-banner', { timeout: 20000 });
    await page.waitForTimeout(5000);
    
    // Deep inspection of map state
    const mapState = await page.evaluate(() => {
      const map = window.__TEST_MAP_INSTANCE__;
      if (!map) return { error: 'No test map instance' };
      
      // Get all layers and sources
      const style = map.getStyle();
      const layers = style.layers.map(l => ({ id: l.id, type: l.type, source: l.source }));
      
      // Check route line source
      const routeSource = map.getSource('route-line');
      let routeSourceData = null;
      if (routeSource) {
        const data = routeSource._data || routeSource.serialize?.();
        if (data && data.geometry) {
          routeSourceData = {
            type: data.geometry.type,
            coordinateCount: data.geometry.coordinates ? data.geometry.coordinates.length : 0,
            firstCoord: data.geometry.coordinates?.[0],
            lastCoord: data.geometry.coordinates?.[data.geometry.coordinates.length - 1],
            bbox: data.bbox
          };
        }
      }
      
      // Get route line layer
      const routeLayer = map.getLayer('route-line');
      const routeLayerInfo = routeLayer ? {
        id: routeLayer.id,
        type: routeLayer.type,
        paint: routeLayer.paint,
        layout: routeLayer.layout,
        visibility: map.getLayoutProperty('route-line', 'visibility')
      } : null;
      
      // Query rendered features
      const routeFeatures = map.queryRenderedFeatures({ layers: ['route-line'] });
      
      // Get map bounds and center
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();
      
      // Get evidence panel state
      const evidenceText = document.querySelector('.evidence-section h3')?.textContent || '';
      
      return {
        hasMapInstance: true,
        layers: layers.filter(l => l.id.includes('route') || l.id.includes('corridor')),
        allLayerIds: layers.map(l => l.id),
        routeSource: routeSource ? 'exists' : 'missing',
        routeSourceData,
        routeLayer: routeLayerInfo,
        routeFeatures: routeFeatures.length,
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        },
        center: { lng: center.lng, lat: center.lat },
        zoom,
        evidenceText
      };
    });
    
    console.log('═══ MAP STATE ═══');
    console.log(JSON.stringify(mapState, null, 2));
    
    console.log('\n═══ ERRORS ═══');
    console.log('Total:', errors.length);
    if (errors.length > 0) {
      errors.forEach(e => console.log(e));
    }
    
    await page.screenshot({ path: '/opt/cursor/artifacts/deployed-hamburg-inspection.png' });
    console.log('\n✓ Screenshot saved');
    
    // Save full console log
    require('fs').writeFileSync('/opt/cursor/artifacts/deployed-console.txt', consoleLogs.join('\n'));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
