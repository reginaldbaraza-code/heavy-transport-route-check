const playwright = require('playwright');

// Try the git branch deployment URL
const deployedUrl = 'https://heavy-transport-route-check-git-cursor-11984a-red-bars-projects.vercel.app';

async function quickTest() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    console.log('Testing Hamburg on latest deployment...\n');
    
    await page.goto(`${deployedUrl}/route-checks`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Hamburg")');
    await page.waitForTimeout(1500);
    
    await page.click('button:has-text("Check route")');
    await page.waitForSelector('.verdict-banner', { timeout: 20000 });
    await page.waitForTimeout(5000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_MAP_INSTANCE__;
      if (!map) return { error: 'No map' };
      
      const style = map.getStyle();
      const layerIds = style.layers.map(l => l.id);
      
      let routeFeatures = 0;
      try {
        routeFeatures = map.queryRenderedFeatures({ layers: ['route-line'] }).length;
      } catch (e) {}
      
      const hasRouteLayer = map.getLayer('route-line') ? true : false;
      const hasRouteSource = map.getSource('route-line') ? true : false;
      
      let sourceCoords = null;
      const src = map.getSource('route-line');
      if (src && src._data && src._data.geometry) {
        sourceCoords = {
          count: src._data.geometry.coordinates.length,
          first: src._data.geometry.coordinates[0],
          last: src._data.geometry.coordinates[src._data.geometry.coordinates.length - 1]
        };
      }
      
      const evidenceText = document.querySelector('.evidence-section h3')?.textContent || '';
      
      return {
        hasMap: true,
        allLayers: layerIds,
        hasRouteLayer,
        hasRouteSource,
        sourceCoords,
        routeFeatures,
        evidenceText
      };
    });
    
    console.log('Result:');
    console.log('  All layers:', result.allLayers);
    console.log('  Has route layer:', result.hasRouteLayer ? '✅' : '❌');
    console.log('  Has route source:', result.hasRouteSource ? '✅' : '❌');
    console.log('  Source coords:', result.sourceCoords);
    console.log('  Route features:', result.routeFeatures);
    console.log('  Evidence:', result.evidenceText);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/latest-hamburg-test.png' });
    console.log('\n✓ Screenshot saved');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

quickTest();
