const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  try {
    console.log('═══════════════════════════════════════');
    console.log('  FIXTURE-BASED ROUTE RENDERING TEST');
    console.log('═══════════════════════════════════════\n');
    
    // Load Hamburg test permit
    const hamburgGpx = fs.readFileSync(path.join(__dirname, 'public/test-permits/hamburg-hannover-a7.gpx'), 'utf-8');
    const hamburgMeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/test-permits/hamburg-hannover-a7.json'), 'utf-8'));
    
    await page.goto('http://localhost:3000/route-checks', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000);
    
    // Inject test data by intercepting the API call
    await page.route('**/api/check-route', async (route) => {
      // Mock response with fixture data
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verdict: 'HOLD',
          origin: hamburgMeta.origin,
          destination: hamburgMeta.destination,
          distance: 136,
          checkpoints: [],
          evidence: [
            { id: 'test-1', title: 'Test Issue 1', detail: 'Test detail', source: 'Test', category: 'closures', state: 'danger', confidence: 'high', age: '2 hours ago', lat: 53.0, lng: 9.5 },
            { id: 'test-2', title: 'Test Issue 2', detail: 'Test detail', source: 'Test', category: 'roadworks', state: 'warning', confidence: 'high', age: '1 day ago', lat: 52.5, lng: 9.7 },
          ],
          route: {
            coordinates: [[53.5, 10.0], [53.0, 9.5], [52.5, 9.7], [52.37, 9.74]], // [lat, lng] format
            summary: { distance: 136000, duration: 7200 }
          }
        })
      });
    });
    
    // Now interact with the UI
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Hamburg")');
    await page.waitForTimeout(1000);
    
    await page.click('button:has-text("Check route")');
    
    // Wait for result
    await page.waitForSelector('.verdict-banner', { timeout: 15000 });
    await page.waitForTimeout(5000); // Let map render
    
    // Check map state
    const analysis = await page.evaluate(() => {
      const map = window.__TEST_MAP_INSTANCE__;
      if (!map) return { error: 'No map instance' };
      
      // Query route layer
      const routeFeatures = map.queryRenderedFeatures({ layers: ['route-line'] });
      
      // Get source data
      const routeSource = map.getSource('route-line');
      let sourceData = null;
      if (routeSource && routeSource._data) {
        const data = routeSource._data;
        if (data.geometry && data.geometry.coordinates) {
          const coords = data.geometry.coordinates;
          sourceData = {
            type: data.geometry.type,
            coordCount: coords.length,
            firstCoord: coords[0],
            lastCoord: coords[coords.length - 1],
            allFinite: coords.every(c => isFinite(c[0]) && isFinite(c[1])),
            lngLatOrder: coords.every(c => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90)
          };
        }
      }
      
      // Check evidence
      const evidenceHeader = document.querySelector('.evidence-section h3')?.textContent || '';
      const evidenceMatch = evidenceHeader.match(/Evidence \((\d+)\)/);
      const visibleEvidence = evidenceMatch ? parseInt(evidenceMatch[1]) : 0;
      
      return {
        hasMapInstance: true,
        routeFeatures: routeFeatures ? routeFeatures.length : 0,
        sourceData,
        visibleEvidence,
        canvasSize: document.querySelector('.route-map-gl-container canvas') ? 
          `${document.querySelector('.route-map-gl-container canvas').width}×${document.querySelector('.route-map-gl-container canvas').height}` : 
          'no canvas'
      };
    });
    
    console.log('═══ RESULTS ═══');
    console.log('Map Instance:', analysis.hasMapInstance ? '✅' : '❌');
    console.log('Route Features Rendered:', analysis.routeFeatures > 0 ? `✅ (${analysis.routeFeatures})` : '❌ (0)');
    console.log('Source Data:', analysis.sourceData ? '✅' : '❌');
    if (analysis.sourceData) {
      console.log('  - Coordinates:', analysis.sourceData.coordCount);
      console.log('  - First:', JSON.stringify(analysis.sourceData.firstCoord));
      console.log('  - Last:', JSON.stringify(analysis.sourceData.lastCoord));
      console.log('  - All Finite:', analysis.sourceData.allFinite ? '✅' : '❌');
      console.log('  - Valid [lng,lat]:', analysis.sourceData.lngLatOrder ? '✅' : '❌');
    }
    console.log('Visible Evidence:', analysis.visibleEvidence);
    console.log('Worker Errors:', errors.filter(e => e.toLowerCase().includes('worker')).length);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/fixture-route-rendered.png' });
    console.log('\n✓ Screenshot saved: fixture-route-rendered.png');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
