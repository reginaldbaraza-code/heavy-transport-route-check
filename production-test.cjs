const playwright = require('playwright');
const fs = require('fs');

// Test against LOCAL production build
const baseUrl = 'http://localhost:3000';
const bypassParam = ''; // No auth needed for local

// Actual test permits (not Frankfurt - that's not in the list)
const testPermits = [
  'Hamburg',
  'Bremen', 
  'Leipzig',
  'Duisburg',
  'München'  // Note: German spelling with umlaut
];

async function testPermit(browser, permitName, viewport) {
  const page = await browser.newPage({ viewport });
  
  const consoleLogs = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`PAGE_ERROR: ${error.message}\n${error.stack}`);
  });
  
  try {
    console.log(`\n━━━ Testing ${permitName} at ${viewport.width}×${viewport.height} ━━━`);
    
    // First visit with bypass to set cookie
    await page.goto(`${baseUrl}${bypassParam}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
    
    await page.goto(`${baseUrl}/route-checks${bypassParam}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Show test permits
    await page.waitForSelector('button:has-text("Show test permits")', { timeout: 5000 });
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    
    // Click permit
    await page.waitForSelector(`button:has-text("${permitName}")`, { timeout: 5000 });
    await page.click(`button:has-text("${permitName}")`);
    await page.waitForTimeout(1500);
    
    // Click Check route
    await page.waitForSelector('button:has-text("Check route")', { timeout: 5000 });
    await page.click('button:has-text("Check route")');
    
    // Wait for verdict
    await page.waitForSelector('.verdict-banner', { timeout: 20000 });
    await page.waitForTimeout(5000); // Wait for map to render
    
    // Analyze map state
    const analysis = await page.evaluate(() => {
      // Find map container
      const container = document.querySelector('.route-map-gl-container');
      if (!container) return { error: 'No map container' };
      
      const canvas = container.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };
      
      // Access test-instrumented map instance
      let mapInstance = window.__TEST_MAP_INSTANCE__ || null;
      
      // If we can't find the instance, at least check the canvas
      const hasWebGLContext = !!canvas.getContext('webgl') || !!canvas.getContext('webgl2');
      
      // Get route details from UI
      const routeDetails = document.querySelector('.results-summary')?.textContent || '';
      const evidenceHeader = document.querySelector('.evidence-section h3')?.textContent || '';
      
      // Parse evidence count
      const evidenceMatch = evidenceHeader.match(/Evidence \((\d+)\)/);
      const visibleEvidence = evidenceMatch ? parseInt(evidenceMatch[1]) : null;
      
      const evidenceFoundMatch = routeDetails.match(/Evidence found:\s*(\d+)/);
      const totalEvidence = evidenceFoundMatch ? parseInt(evidenceFoundMatch[1]) : null;
      
      // If we have the map instance, query rendered features
      let routeFeatures = null;
      let routeSourceData = null;
      
      if (mapInstance && typeof mapInstance.queryRenderedFeatures === 'function') {
        try {
          const features = mapInstance.queryRenderedFeatures({ layers: ['route-line'] });
          routeFeatures = features ? features.length : 0;
          
          // Check source data
          const routeSource = mapInstance.getSource('route-line');
          if (routeSource && routeSource._data) {
            const data = routeSource._data;
            if (data.geometry && data.geometry.coordinates) {
              const coords = data.geometry.coordinates;
              routeSourceData = {
                type: data.geometry.type,
                coordCount: coords.length,
                firstCoord: coords[0],
                lastCoord: coords[coords.length - 1],
                validCoords: coords.every(c => 
                  Array.isArray(c) && 
                  c.length === 2 && 
                  isFinite(c[0]) && isFinite(c[1]) &&
                  Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90
                )
              };
            }
          }
        } catch (e) {
          routeFeatures = `Error: ${e.message}`;
        }
      }
      
      return {
        hasCanvas: !!canvas,
        canvasSize: `${canvas.width}×${canvas.height}`,
        hasWebGLContext,
        hasMapInstance: !!mapInstance,
        visibleEvidence,
        totalEvidence,
        evidenceMatch: visibleEvidence === totalEvidence,
        routeFeatures,
        routeSourceData,
      };
    });
    
    console.log('Analysis:', JSON.stringify(analysis, null, 2));
    
    // Check console errors
    const workerErrors = errors.filter(e => e.includes('Worker') || e.includes('worker'));
    if (workerErrors.length > 0) {
      console.log('⚠️  Worker errors:', workerErrors);
    }
    
    // Screenshot
    const screenshotPath = `/opt/cursor/artifacts/prod-${permitName.toLowerCase()}-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✓ Screenshot: ${screenshotPath}`);
    
    // Save console logs
    fs.writeFileSync(
      `/opt/cursor/artifacts/prod-${permitName.toLowerCase()}-${viewport.width}x${viewport.height}-console.txt`,
      consoleLogs.join('\n')
    );
    
    return {
      permit: permitName,
      viewport: `${viewport.width}×${viewport.height}`,
      ...analysis,
      errorCount: errors.length,
      workerErrorCount: workerErrors.length,
      screenshot: screenshotPath,
    };
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    return {
      permit: permitName,
      viewport: `${viewport.width}×${viewport.height}`,
      error: error.message,
    };
  } finally {
    await page.close();
  }
}

async function testCorridorMonitor(browser, viewport) {
  const page = await browser.newPage({ viewport });
  
  const errors = [];
  page.on('pageerror', error => {
    errors.push(`PAGE_ERROR: ${error.message}`);
  });
  
  try {
    console.log(`\n━━━ Testing Corridor Monitor at ${viewport.width}×${viewport.height} ━━━`);
    
    // First visit with bypass to set cookie
    await page.goto(`${baseUrl}${bypassParam}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
    
    await page.goto(`${baseUrl}/map-explorer${bypassParam}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(6000);
    
    const analysis = await page.evaluate(() => {
      const container = document.querySelector('.maplibre-map') || document.querySelector('[class*="map"]');
      if (!container) return { error: 'No map container' };
      
      const canvas = container.querySelector('canvas');
      if (!canvas) return { error: 'No canvas' };
      
      // Access test-instrumented map instance
      let mapInstance = window.__TEST_CORRIDOR_MAP__ || null;
      
      let clusterFeatures = null;
      let pointFeatures = null;
      
      if (mapInstance && typeof mapInstance.queryRenderedFeatures === 'function') {
        try {
          const clusters = mapInstance.queryRenderedFeatures({ layers: ['clusters'] });
          const points = mapInstance.queryRenderedFeatures({ layers: ['unclustered-point'] });
          clusterFeatures = clusters ? clusters.length : 0;
          pointFeatures = points ? points.length : 0;
        } catch (e) {
          clusterFeatures = `Error: ${e.message}`;
        }
      }
      
      return {
        hasCanvas: !!canvas,
        canvasSize: `${canvas.width}×${canvas.height}`,
        hasMapInstance: !!mapInstance,
        clusterFeatures,
        pointFeatures,
        totalFeatures: (clusterFeatures || 0) + (pointFeatures || 0),
      };
    });
    
    console.log('Corridor analysis:', JSON.stringify(analysis, null, 2));
    
    const screenshotPath = `/opt/cursor/artifacts/prod-corridor-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotPath });
    console.log(`✓ Screenshot: ${screenshotPath}`);
    
    return {
      viewport: `${viewport.width}×${viewport.height}`,
      ...analysis,
      errorCount: errors.length,
      screenshot: screenshotPath,
    };
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    return {
      viewport: `${viewport.width}×${viewport.height}`,
      error: error.message,
    };
  } finally {
    await page.close();
  }
}

async function testMobileStickyBar(browser) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  
  try {
    console.log(`\n━━━ Testing Mobile Sticky Bar ━━━`);
    
    // First visit with bypass to set cookie
    await page.goto(`${baseUrl}${bypassParam}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
    
    await page.goto(`${baseUrl}/route-checks${bypassParam}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    await page.click('button:has-text("Show test permits")');
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Hamburg")');
    await page.waitForTimeout(1500);
    
    await page.click('button:has-text("Check route")');
    await page.waitForSelector('.verdict-banner', { timeout: 20000 });
    await page.waitForTimeout(3000);
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const stickyBarCheck = await page.evaluate(() => {
      const actionBar = document.querySelector('.mobile-route-actions');
      if (!actionBar) return { error: 'Action bar not found' };
      
      const rect = actionBar.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Check bottom nav tabs too
      const bottomTabs = document.querySelector('.bottom-tab-bar');
      const tabsRect = bottomTabs ? bottomTabs.getBoundingClientRect() : null;
      
      const style = window.getComputedStyle(actionBar);
      
      return {
        actionBar: {
          position: style.position,
          bottom: style.bottom,
          zIndex: style.zIndex,
          rectBottom: rect.bottom,
          rectTop: rect.top,
          isInViewport: rect.bottom <= viewportHeight && rect.top >= 0,
        },
        bottomTabs: tabsRect ? {
          rectBottom: tabsRect.bottom,
          rectTop: tabsRect.top,
        } : null,
        viewportHeight,
        overlaps: tabsRect && rect.top < tabsRect.bottom,
      };
    });
    
    console.log('Sticky bar check:', JSON.stringify(stickyBarCheck, null, 2));
    
    const screenshotPath = '/opt/cursor/artifacts/prod-mobile-sticky-scrolled.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`✓ Screenshot: ${screenshotPath}`);
    
    return stickyBarCheck;
    
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    return { error: error.message };
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  
  console.log('═══════════════════════════════════════════════');
  console.log('  PRODUCTION BUILD TEST - LOCAL');
  console.log('  Testing: setWorkerUrl() with Vite bundled worker');
  console.log('═══════════════════════════════════════════════');
  
  const results = {
    desktop: [],
    mobile: [],
    corridor: {},
    mobileStickyBar: {},
  };
  
  // Test all 5 permits desktop
  for (const permit of testPermits) {
    const result = await testPermit(browser, permit, { width: 1280, height: 800 });
    results.desktop.push(result);
  }
  
  // Test one permit mobile
  const mobileResult = await testPermit(browser, 'Hamburg', { width: 412, height: 915 });
  results.mobile.push(mobileResult);
  
  // Test corridor
  const corridorResult = await testCorridorMonitor(browser, { width: 1280, height: 800 });
  results.corridor.desktop = corridorResult;
  
  // Test sticky bar
  const stickyBarResult = await testMobileStickyBar(browser);
  results.mobileStickyBar = stickyBarResult;
  
  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════');
  
  const desktopWithFeatures = results.desktop.filter(r => r.routeFeatures > 0).length;
  const desktopWithValidCoords = results.desktop.filter(r => r.routeSourceData?.validCoords).length;
  const desktopEvidenceMatch = results.desktop.filter(r => r.evidenceMatch).length;
  const mobileWithFeatures = results.mobile.filter(r => r.routeFeatures > 0).length;
  
  console.log(`\nDesktop (1280×800):`);
  console.log(`  Route features rendered: ${desktopWithFeatures}/${results.desktop.length}`);
  console.log(`  Valid [lng, lat] coordinates: ${desktopWithValidCoords}/${results.desktop.length}`);
  console.log(`  Evidence count matches: ${desktopEvidenceMatch}/${results.desktop.length}`);
  
  console.log(`\nMobile (412×915):`);
  console.log(`  Route features rendered: ${mobileWithFeatures}/${results.mobile.length}`);
  
  console.log(`\nCorridor Monitor:`);
  console.log(`  Clusters/points rendered: ${results.corridor.desktop.totalFeatures || 0}`);
  
  console.log(`\nMobile Sticky Bar:`);
  console.log(`  In viewport after scroll: ${results.mobileStickyBar.actionBar?.isInViewport ? 'YES' : 'NO'}`);
  console.log(`  Overlaps bottom tabs: ${results.mobileStickyBar.overlaps ? 'YES' : 'NO'}`);
  
  // Save detailed results
  fs.writeFileSync('/opt/cursor/artifacts/prod-test-results.json', JSON.stringify(results, null, 2));
  console.log(`\n✓ Detailed results: /opt/cursor/artifacts/prod-test-results.json`);
  
  await browser.close();
})();
