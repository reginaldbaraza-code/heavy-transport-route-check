const playwright = require('playwright');

const deployedUrl = 'https://heavy-transport-route-check-pr2h0bo5o-red-bars-projects.vercel.app';
const bypassParam = '?_vercel_share=AOf09kBx59N78wnwGVaTyD7YnLaX5ABc';

const TEST_PERMITS = [
  { name: 'Hamburg', verdict: 'HOLD', expectedEvidence: 6 },
  { name: 'Bremen', verdict: 'VERIFY', expectedEvidence: 8 },
  { name: 'Leipzig', verdict: 'READY', expectedEvidence: 3 },
  { name: 'Duisburg', verdict: 'VERIFY', expectedEvidence: 9 },
  { name: 'München', verdict: 'READY', expectedEvidence: 0 }
];

async function testPermit(browser, permit) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const errors = [];
  const logs = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  try {
    console.log(`\n━━━ Testing ${permit.name} (Deployed 21f2102) ━━━`);
    
    await page.goto(`${deployedUrl}${bypassParam}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    await page.goto(`${deployedUrl}/route-checks${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    
    await page.click(`button:has-text("${permit.name}")`);
    await page.waitForTimeout(1500);
    
    await page.click('button:has-text("Check route")');
    await page.waitForSelector('.verdict-banner', { timeout: 20000 });
    await page.waitForTimeout(5000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_MAP_INSTANCE__;
      if (!map) return { error: 'No map' };
      
      let routeFeatures = 0;
      try {
        routeFeatures = map.queryRenderedFeatures({ layers: ['route-line'] }).length;
      } catch (e) {
        // Layer might not exist
      }
      
      const hasRouteLayer = map.getLayer('route-line') ? true : false;
      const hasRouteSource = map.getSource('route-line') ? true : false;
      
      const evidenceText = document.querySelector('.evidence-section h3')?.textContent || '';
      const evidenceMatch = evidenceText.match(/Evidence \((\d+)\)/);
      const visibleEvidence = evidenceMatch ? parseInt(evidenceMatch[1]) : null;
      
      return {
        hasMap: true,
        hasRouteLayer,
        hasRouteSource,
        routeFeatures,
        visibleEvidence,
        evidenceText
      };
    });
    
    const workerErrors = errors.filter(e => e.toLowerCase().includes('worker')).length;
    
    console.log(`  Map instance: ${result.hasMap ? '✅' : '❌'}`);
    console.log(`  Route layer: ${result.hasRouteLayer ? '✅' : '❌'}`);
    console.log(`  Route source: ${result.hasRouteSource ? '✅' : '❌'}`);
    console.log(`  Route features: ${result.routeFeatures > 0 ? '✅' : '❌'} (${result.routeFeatures})`);
    console.log(`  Evidence visible: ${result.visibleEvidence === permit.expectedEvidence ? '✅' : '❌'} (${result.visibleEvidence}/${permit.expectedEvidence})`);
    console.log(`  Worker errors: ${workerErrors === 0 ? '✅' : '❌'} (${workerErrors})`);
    console.log(`  Evidence text: "${result.evidenceText}"`);
    
    if (errors.length > 0) {
      console.log(`\n  Errors:`);
      errors.forEach(e => console.log(`    ${e}`));
    }
    
    await page.screenshot({ path: `/opt/cursor/artifacts/deployed-${permit.name.toLowerCase()}-21f2102.png` });
    
    await page.close();
    
    return {
      permit: permit.name,
      success: result.routeFeatures > 0 && result.visibleEvidence === permit.expectedEvidence && workerErrors === 0,
      hasRouteLayer: result.hasRouteLayer,
      hasRouteSource: result.hasRouteSource,
      routeFeatures: result.routeFeatures,
      evidenceMatch: result.visibleEvidence === permit.expectedEvidence,
      workerErrors
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
    console.log(`\n━━━ Testing Corridor Monitor (Deployed) ━━━`);
    
    await page.goto(`${deployedUrl}/map-explorer${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(8000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_CORRIDOR_MAP__;
      if (!map) return { error: 'No corridor map' };
      
      let clusterFeatures = 0;
      let pointFeatures = 0;
      
      try {
        clusterFeatures = map.queryRenderedFeatures({ layers: ['clusters'] }).length;
        pointFeatures = map.queryRenderedFeatures({ layers: ['unclustered-point'] }).length;
      } catch (e) {
        // Layers might not exist
      }
      
      return {
        hasMap: true,
        clusterFeatures,
        pointFeatures,
        totalFeatures: clusterFeatures + pointFeatures
      };
    });
    
    console.log(`  Map: ${result.hasMap ? '✅' : '❌'}`);
    console.log(`  Features: ${result.totalFeatures > 0 ? '✅' : '⏳'} (${result.totalFeatures} total)`);
    console.log(`  Note: Requires live Autobahn API data`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/deployed-corridor-21f2102.png' });
    await page.close();
    return result;
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    await page.close();
    return { error: error.message };
  }
}

async function testMobile(browser) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  
  try {
    console.log(`\n━━━ Testing Mobile (Deployed) ━━━`);
    
    await page.goto(`${deployedUrl}${bypassParam}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    await page.goto(`${deployedUrl}/route-checks${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Hamburg")');
    await page.waitForTimeout(1500);
    await page.click('button:has-text("Check route")');
    await page.waitForSelector('.verdict-banner', { timeout: 20000 });
    await page.waitForTimeout(4000);
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    
    const result = await page.evaluate(() => {
      const actionBar = document.querySelector('.mobile-route-actions');
      if (!actionBar) return { error: 'No action bar' };
      
      const rect = actionBar.getBoundingClientRect();
      const tabs = document.querySelector('.bottom-tab-bar');
      const tabsRect = tabs ? tabs.getBoundingClientRect() : null;
      
      return {
        isInViewport: rect.bottom <= window.innerHeight && rect.top >= 0,
        overlapsWithTabs: tabsRect ? rect.bottom > tabsRect.top : false,
        actionBarBottom: rect.bottom,
        tabsTop: tabsRect?.top,
        viewportHeight: window.innerHeight
      };
    });
    
    console.log(`  In viewport: ${result.isInViewport ? '✅' : '❌'}`);
    console.log(`  Above tabs: ${!result.overlapsWithTabs ? '✅' : '❌'}`);
    console.log(`  Action bar bottom: ${result.actionBarBottom}px`);
    console.log(`  Tabs top: ${result.tabsTop}px`);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/deployed-mobile-21f2102.png' });
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
  console.log('  DEPLOYED BUILD VERIFICATION');
  console.log('  Commit: 21f2102');
  console.log('  URL: ' + deployedUrl);
  console.log('  API: Live Vercel serverless functions');
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
  results.mobile = await testMobile(browser);
  
  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  DEPLOYED BUILD SUMMARY');
  console.log('═══════════════════════════════════════════════');
  
  const successCount = results.permits.filter(r => r.success).length;
  console.log(`\nRoute Rendering: ${successCount}/${results.permits.length} permits`);
  results.permits.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const details = r.error ? r.error : `features: ${r.routeFeatures}, evidence: ${r.evidenceMatch ? '✅' : '❌'}`;
    console.log(`  ${r.permit}: ${status} (${details})`);
  });
  
  console.log(`\nCorridor Monitor: ${results.corridor.totalFeatures > 0 ? '✅' : '⏳'} (${results.corridor.totalFeatures || 0} features)`);
  console.log(`Mobile Sticky Bar: ${results.mobile.isInViewport && !results.mobile.overlapsWithTabs ? '✅' : '❌'}`);
  
  const allSuccess = successCount === TEST_PERMITS.length && results.mobile.isInViewport && !results.mobile.overlapsWithTabs;
  
  console.log('\n' + (allSuccess ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'));
  console.log('\n✓ Results saved to /opt/cursor/artifacts/deployed-*-21f2102.png');
  
  require('fs').writeFileSync('/opt/cursor/artifacts/deployed-test-results-21f2102.json', JSON.stringify(results, null, 2));
  
  await browser.close();
})();
