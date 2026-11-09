const playwright = require('playwright');
const fs = require('fs');

const TEST_PERMITS = [
  {
    name: 'Hamburg',
    file: 'hamburg-hannover-a7',
    mockResponse: {
      verdict: 'HOLD',
      origin: 'Hamburg Port Terminal',
      destination: 'Hannover Logistics Hub',
      distance: 136,
      evidence: [
        { id: '1', title: 'Bridge height restriction', detail: 'A7 Sottorfer Brücke - 4.2m clearance', source: 'Autobahn GmbH', category: 'closures', state: 'danger', confidence: 'high', age: '2 hours ago', lat: 53.2, lng: 9.8 },
        { id: '2', title: 'Roadworks', detail: 'Lane closure', source: 'Test', category: 'roadworks', state: 'warning', confidence: 'high', age: '1 day', lat: 52.8, lng: 9.7 },
        { id: '3', title: 'Weight limit', detail: '40t restriction', source: 'Test', category: 'observations', state: 'danger', confidence: 'high', age: '3 days', lat: 52.5, lng: 9.6 },
        { id: '4', title: 'Width restriction', detail: '3.5m max', source: 'Test', category: 'closures', state: 'danger', confidence: 'medium', age: '1 week', lat: 52.4, lng: 9.75 },
        { id: '5', title: 'Speed limit', detail: '60 km/h', source: 'Test', category: 'observations', state: 'warning', confidence: 'medium', age: '2 weeks', lat: 52.37, lng: 9.74 },
        { id: '6', title: 'Detour required', detail: 'Exit 58 closed', source: 'Test', category: 'closures', state: 'danger', confidence: 'high', age: '1 month', lat: 52.35, lng: 9.73 }
      ],
      route: { coordinates: [[53.5, 10.0], [53.2, 9.8], [52.8, 9.7], [52.5, 9.6], [52.4, 9.75], [52.37, 9.74]], summary: {} }
    }
  },
  {
    name: 'Bremen',
    file: 'bremen-dortmund-a1',
    mockResponse: {
      verdict: 'VERIFY',
      origin: 'Bremen Cargo Terminal',
      destination: 'Dortmund Industrial Park',
      distance: 232,
      evidence: Array.from({length: 8}, (_, i) => ({
        id: `bremen-${i}`,
        title: `Issue ${i+1}`,
        detail: 'Test issue',
        source: 'Test',
        category: i % 2 === 0 ? 'roadworks' : 'observations',
        state: 'warning',
        confidence: 'high',
        age: `${i} hours ago`,
        lat: 53.0 - i * 0.1,
        lng: 8.8 - i * 0.05
      })),
      route: { coordinates: Array.from({length: 8}, (_, i) => [53.0 - i * 0.1, 8.8 - i * 0.05]), summary: {} }
    }
  },
  {
    name: 'Leipzig',
    file: 'leipzig-nurnberg-a9',
    mockResponse: {
      verdict: 'READY',
      origin: 'Leipzig Distribution Center',
      destination: 'Nürnberg Freight Hub',
      distance: 295,
      evidence: Array.from({length: 3}, (_, i) => ({
        id: `leipzig-${i}`,
        title: `Minor issue ${i+1}`,
        detail: 'Advisory only',
        source: 'Test',
        category: 'observations',
        state: 'clear',
        confidence: 'medium',
        age: `${i+1} days ago`,
        lat: 51.3 - i * 0.3,
        lng: 12.4 - i * 0.2
      })),
      route: { coordinates: Array.from({length: 4}, (_, i) => [51.3 - i * 0.3, 12.4 - i * 0.2]), summary: {} }
    }
  },
  {
    name: 'Duisburg',
    file: 'duisburg-koln-a3',
    mockResponse: {
      verdict: 'VERIFY',
      origin: 'Duisburg Port',
      destination: 'Köln Logistics Center',
      distance: 75,
      evidence: Array.from({length: 9}, (_, i) => ({
        id: `duisburg-${i}`,
        title: `Issue ${i+1}`,
        detail: 'Test',
        source: 'Test',
        category: i < 5 ? 'roadworks' : 'closures',
        state: 'warning',
        confidence: 'high',
        age: `${i} hours`,
        lat: 51.5 - i * 0.05,
        lng: 6.8 - i * 0.03
      })),
      route: { coordinates: Array.from({length: 5}, (_, i) => [51.5 - i * 0.05, 6.8 - i * 0.03]), summary: {} }
    }
  },
  {
    name: 'München',
    file: 'munchen-stuttgart-a8',
    mockResponse: {
      verdict: 'READY',
      origin: 'München Industrial Zone',
      destination: 'Stuttgart Distribution Center',
      distance: 227,
      evidence: [],
      route: { coordinates: [[48.1, 11.6], [48.0, 11.4], [47.9, 11.2], [48.7, 9.2]], summary: {} }
    }
  }
];

async function testPermit(browser, permit) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  try {
    console.log(`\n━━━ Testing ${permit.name} ━━━`);
    
    // Intercept API call
    await page.route('**/api/check-route', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(permit.mockResponse)
      });
    });
    
    await page.goto('http://localhost:3000/route-checks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    
    await page.click(`button:has-text("${permit.name}")`);
    await page.waitForTimeout(1000);
    
    await page.click('button:has-text("Check route")');
    await page.waitForSelector('.verdict-banner', { timeout: 15000 });
    await page.waitForTimeout(4000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_MAP_INSTANCE__;
      if (!map) return { error: 'No map' };
      
      const routeFeatures = map.queryRenderedFeatures({ layers: ['route-line'] });
      const routeSource = map.getSource('route-line');
      
      let sourceInfo = null;
      if (routeSource && routeSource._data && routeSource._data.geometry) {
        sourceInfo = {
          coordCount: routeSource._data.geometry.coordinates.length,
          firstCoord: routeSource._data.geometry.coordinates[0],
          lastCoord: routeSource._data.geometry.coordinates[routeSource._data.geometry.coordinates.length - 1]
        };
      }
      
      const evidenceText = document.querySelector('.evidence-section h3')?.textContent || '';
      const evidenceMatch = evidenceText.match(/Evidence \((\d+)\)/);
      const visibleEvidence = evidenceMatch ? parseInt(evidenceMatch[1]) : null;
      
      return {
        hasMap: true,
        routeFeatures: routeFeatures.length,
        sourceInfo,
        visibleEvidence,
        workerErrors: 0
      };
    });
    
    console.log(`  Map: ${result.hasMap ? '✅' : '❌'}`);
    console.log(`  Route features: ${result.routeFeatures > 0 ? '✅' : '❌'} (${result.routeFeatures})`);
    console.log(`  Source coords: ${result.sourceInfo ? result.sourceInfo.coordCount : 'none'}`);
    console.log(`  Evidence visible: ${result.visibleEvidence === permit.mockResponse.evidence.length ? '✅' : '❌'} (${result.visibleEvidence}/${permit.mockResponse.evidence.length})`);
    console.log(`  Worker errors: ${errors.filter(e => e.toLowerCase().includes('worker')).length}`);
    
    await page.screenshot({ path: `/opt/cursor/artifacts/final-${permit.name.toLowerCase()}-1280x800.png` });
    
    await page.close();
    return {
      permit: permit.name,
      success: result.routeFeatures > 0 && result.visibleEvidence === permit.mockResponse.evidence.length,
      ...result
    };
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    await page.close();
    return { permit: permit.name, error: error.message };
  }
}

async function testCorridorMonitor(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    console.log(`\n━━━ Testing Corridor Monitor ━━━`);
    
    await page.goto('http://localhost:3000/map-explorer', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(6000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_CORRIDOR_MAP__;
      if (!map) return { error: 'No corridor map' };
      
      const clusterFeatures = map.queryRenderedFeatures({ layers: ['clusters'] });
      const pointFeatures = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
      
      return {
        hasMap: true,
        clusterFeatures: clusterFeatures.length,
        pointFeatures: pointFeatures.length,
        totalFeatures: clusterFeatures.length + pointFeatures.length
      };
    });
    
    console.log(`  Map: ${result.hasMap ? '✅' : '❌'}`);
    console.log(`  Features: ${result.totalFeatures > 0 ? '✅' : '❌'} (${result.totalFeatures} total)`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/final-corridor-1280x800.png' });
    await page.close();
    return result;
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    await page.close();
    return { error: error.message };
  }
}

async function testMobileStickyBar(browser) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  
  try {
    console.log(`\n━━━ Testing Mobile Sticky Bar ━━━`);
    
    // Use Hamburg mock
    await page.route('**/api/check-route', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TEST_PERMITS[0].mockResponse)
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
    await page.waitForTimeout(3000);
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const result = await page.evaluate(() => {
      const actionBar = document.querySelector('.mobile-route-actions');
      if (!actionBar) return { error: 'No action bar' };
      
      const rect = actionBar.getBoundingClientRect();
      const tabs = document.querySelector('.bottom-tab-bar');
      const tabsRect = tabs ? tabs.getBoundingClientRect() : null;
      
      return {
        isInViewport: rect.bottom <= window.innerHeight && rect.top >= 0,
        overlapsWithTabs: tabsRect ? rect.top < tabsRect.bottom : false,
        actionBarBottom: rect.bottom,
        viewportHeight: window.innerHeight
      };
    });
    
    console.log(`  In viewport: ${result.isInViewport ? '✅' : '❌'}`);
    console.log(`  Above tabs: ${!result.overlapsWithTabs ? '✅' : '❌'}`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/final-mobile-scrolled-412x915.png' });
    await page.close();
    return result;
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    await page.close();
    return { error: error.message };
  }
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  
  console.log('═══════════════════════════════════════════════');
  console.log('  COMPLETE VERIFICATION TEST');
  console.log('  Build: Local production with ALL fixes');
  console.log('  API: Mocked fixture data (representative)');
  console.log('═══════════════════════════════════════════════');
  
  const results = { permits: [], corridor: null, mobile: null };
  
  // Test all 5 permits
  for (const permit of TEST_PERMITS) {
    const result = await testPermit(browser, permit);
    results.permits.push(result);
  }
  
  // Test corridor
  results.corridor = await testCorridorMonitor(browser);
  
  // Test mobile
  results.mobile = await testMobileStickyBar(browser);
  
  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════');
  
  const successCount = results.permits.filter(r => r.success).length;
  console.log(`\nRoute Rendering: ${successCount}/${results.permits.length} permits`);
  results.permits.forEach(r => {
    console.log(`  ${r.permit}: ${r.success ? '✅' : '❌'} (features: ${r.routeFeatures || 0})`);
  });
  
  console.log(`\nCorridor Monitor: ${results.corridor.totalFeatures > 0 ? '✅' : '❌'} (${results.corridor.totalFeatures || 0} features)`);
  console.log(`Mobile Sticky Bar: ${results.mobile.isInViewport ? '✅' : '❌'}`);
  
  fs.writeFileSync('/opt/cursor/artifacts/complete-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n✓ Results saved to complete-test-results.json');
  console.log('✓ Screenshots saved for all tests');
  
  await browser.close();
})();
