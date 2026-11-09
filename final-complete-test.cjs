const playwright = require('playwright');
const fs = require('fs');

async function testHamburg(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    console.log('\n━━━ Testing Hamburg Route Check ━━━');
    
    // Mock API
    await page.route('**/api/check-route', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verdict: 'HOLD',
          origin: 'Hamburg Port Terminal',
          destination: 'Hannover Logistics Hub',
          distance: 136,
          evidence: Array.from({length: 6}, (_, i) => ({
            id: `ev-${i}`,
            title: `Evidence ${i+1}`,
            detail: 'Test',
            source: 'Test',
            category: ['closures', 'roadworks', 'observations'][i % 3],
            state: 'danger',
            confidence: 'high',
            age: `${i}h`,
            lat: 53.5 - i * 0.1,
            lng: 10.0 - i * 0.05
          })),
          route: { 
            coordinates: Array.from({length: 6}, (_, i) => [53.5 - i * 0.1, 10.0 - i * 0.05]),
            summary: {} 
          }
        })
      });
    });
    
    await page.goto('http://localhost:3000/route-checks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Hamburg")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Check route")');
    await page.waitForSelector('.verdict-banner', { timeout: 15000 });
    await page.waitForTimeout(4000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_MAP_INSTANCE__;
      if (!map) return { error: 'No map' };
      
      let routeFeatures = 0;
      try {
        routeFeatures = map.queryRenderedFeatures({ layers: ['route-line'] }).length;
      } catch (e) {}
      
      const evidenceText = document.querySelector('.evidence-section h3')?.textContent || '';
      const match = evidenceText.match(/Evidence \((\d+)\)/);
      
      return {
        hasMap: true,
        hasRouteLayer: map.getLayer('route-line') ? true : false,
        routeFeatures,
        evidenceVisible: match ? parseInt(match[1]) : 0
      };
    });
    
    console.log(`  Map: ${result.hasMap ? '✅' : '❌'}`);
    console.log(`  Route layer: ${result.hasRouteLayer ? '✅' : '❌'}`);
    console.log(`  Route features: ${result.routeFeatures > 0 ? '✅' : '❌'} (${result.routeFeatures})`);
    console.log(`  Evidence: ${result.evidenceVisible === 6 ? '✅' : '❌'} (${result.evidenceVisible}/6)`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/final-hamburg-local.png' });
    await page.close();
    
    return {
      success: result.routeFeatures > 0 && result.evidenceVisible === 6,
      ...result
    };
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    await page.close();
    return { error: error.message };
  }
}

async function testCorridor(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    console.log('\n━━━ Testing Corridor Monitor ━━━');
    
    await page.goto('http://localhost:3000/map-explorer', { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_CORRIDOR_MAP__;
      if (!map) return { error: 'No map' };
      
      const source = map.getSource('events');
      let sourceFeatures = 0;
      if (source && source._data && source._data.features) {
        sourceFeatures = source._data.features.length;
      }
      
      let clusterFeatures = 0;
      let pointFeatures = 0;
      try {
        clusterFeatures = map.queryRenderedFeatures({ layers: ['clusters'] }).length;
        pointFeatures = map.queryRenderedFeatures({ layers: ['unclustered-point'] }).length;
      } catch (e) {}
      
      return {
        hasMap: true,
        hasSource: source ? true : false,
        hasClusterLayer: map.getLayer('clusters') ? true : false,
        sourceFeatures,
        clusterFeatures,
        pointFeatures,
        totalRendered: clusterFeatures + pointFeatures
      };
    });
    
    console.log(`  Map: ${result.hasMap ? '✅' : '❌'}`);
    console.log(`  Events source: ${result.hasSource ? '✅' : '❌'}`);
    console.log(`  Cluster layer: ${result.hasClusterLayer ? '✅' : '❌'}`);
    console.log(`  Source features: ${result.sourceFeatures}`);
    console.log(`  Rendered features: ${result.totalRendered > 0 ? '✅' : '❌'} (${result.totalRendered})`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/final-corridor-local.png' });
    await page.close();
    
    return {
      success: result.hasSource && result.totalRendered > 0,
      ...result
    };
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    await page.close();
    return { error: error.message };
  }
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  
  console.log('═══════════════════════════════════════════════');
  console.log('  FINAL LOCAL VERIFICATION');
  console.log('  Both route fix and corridor fix');
  console.log('  Data: Mocked route + Fixture corridor events');
  console.log('═══════════════════════════════════════════════');
  
  const hamburgResult = await testHamburg(browser);
  const corridorResult = await testCorridor(browser);
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`\nHamburg Route Check: ${hamburgResult.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Corridor Monitor: ${corridorResult.success ? '✅ PASS' : '❌ FAIL'}`);
  
  const allSuccess = hamburgResult.success && corridorResult.success;
  console.log(`\n${allSuccess ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
  
  const results = { hamburg: hamburgResult, corridor: corridorResult, allSuccess };
  fs.writeFileSync('/opt/cursor/artifacts/final-test-results.json', JSON.stringify(results, null, 2));
  
  await browser.close();
})();
