const playwright = require('playwright');
const fs = require('fs');

// Use the protected preview URL the user provided
const baseUrl = 'https://heavy-transport-route-check-hg1mgg3iv-red-bars-projects.vercel.app';
const bypassParam = '?_vercel_share=VJT2hIVkNZ0ltgphquhhOAr9j6EWqn1v';

// Test the newly deployed version
const testPermits = [
  { name: 'Hamburg', origin: 'Hamburg Port Terminal', dest: 'Hannover Logistics Hub', expectedDistance: '136 km' },
  { name: 'Duisburg', origin: 'Duisburg Port', dest: 'Stuttgart Distribution Center', expectedDistance: '425 km' },
  { name: 'Bremen', origin: 'Bremen Cargo Terminal', dest: 'München Freight Hub', expectedDistance: '686 km' },
  { name: 'München', origin: 'München Industrial Zone', dest: 'Berlin Logistics Park', expectedDistance: '592 km' },
  { name: 'Frankfurt', origin: 'Frankfurt Freight Terminal', dest: 'Köln Distribution Center', expectedDistance: '186 km' },
];

async function testRouteRendering(browser, permitName, viewport) {
  const page = await browser.newPage({ viewport });
  const consoleLogs = [];
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else {
      consoleLogs.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}`);
  });
  
  try {
    // First visit with bypass to set cookie
    await page.goto(baseUrl + bypassParam, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
    
    // Navigate to app
    await page.goto(baseUrl + '/route-checks' + bypassParam, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
    
    // Show test permits
    const showBtn = await page.waitForSelector('button:has-text("Show test permits")', { timeout: 5000 });
    await showBtn.click();
    await page.waitForTimeout(500);
    
    // Click specific permit
    const permitBtn = await page.waitForSelector(`button:has-text("${permitName}")`, { timeout: 5000 });
    await permitBtn.click();
    await page.waitForTimeout(1500);
    
    // Click Check route
    const checkBtn = await page.waitForSelector('button:has-text("Check route")', { timeout: 5000 });
    await checkBtn.click();
    
    // Wait for result
    await page.waitForSelector('.verdict-banner', { timeout: 15000 });
    await page.waitForTimeout(5000); // Wait for map to fully render
    
    // Query rendered features on the map
    const mapAnalysis = await page.evaluate(() => {
      return new Promise((resolve) => {
        const checkMap = () => {
          const canvas = document.querySelector('.route-map-gl-container canvas');
          if (!canvas) {
            return resolve({ error: 'No canvas found' });
          }
          
          // Try to access MapLibre map instance via global or container
          let mapInstance = null;
          const container = document.querySelector('.route-map-gl-container');
          
          // MapLibre stores map reference on container
          if (container && container._maplibre) {
            mapInstance = container._maplibre;
          }
          
          // Try global reference
          if (!mapInstance && window.maplibreMap) {
            mapInstance = window.maplibreMap;
          }
          
          // Check if map is loaded by looking for style
          const hasCanvas = !!canvas;
          const canvasSize = `${canvas.width}×${canvas.height}`;
          
          // Get evidence panel info
          const evidenceHeader = document.querySelector('.evidence-section h3');
          const evidenceText = evidenceHeader ? evidenceHeader.textContent : '';
          const evidenceMatch = evidenceText.match(/Evidence \((\d+)\)/);
          const evidenceCount = evidenceMatch ? parseInt(evidenceMatch[1]) : null;
          
          // Get summary info
          const summaryText = document.querySelector('.results-summary')?.textContent || '';
          const evidenceFoundMatch = summaryText.match(/Evidence found:\s*(\d+)/);
          const evidenceFoundCount = evidenceFoundMatch ? parseInt(evidenceFoundMatch[1]) : null;
          
          // Sample canvas pixels to detect if route line is rendered
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve({
              hasCanvas,
              canvasSize,
              evidenceCount,
              evidenceFoundCount,
              canvasError: 'No 2D context'
            });
          }
          
          const sampleSize = 300;
          const imageData = ctx.getImageData(
            Math.max(0, Math.floor(canvas.width / 4)), 
            Math.max(0, Math.floor(canvas.height / 4)), 
            Math.min(canvas.width, sampleSize), 
            Math.min(canvas.height, sampleSize)
          );
          const data = imageData.data;
          
          // Count colored pixels (not background)
          let coloredPixels = 0;
          let redPixels = 0, greenPixels = 0, bluePixels = 0;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            
            // Skip white/light background
            if (r > 230 && g > 230 && b > 230) continue;
            
            coloredPixels++;
            
            // Check for typical route colors
            if (r > 200 && g < 100 && b < 100) redPixels++; // HOLD red
            else if (r < 100 && g > 150 && b < 100) greenPixels++; // READY green
            else if (r > 200 && g > 130 && b < 100) bluePixels++; // VERIFY orange
          }
          
          resolve({
            hasCanvas,
            canvasSize,
            evidenceCount,
            evidenceFoundCount,
            evidenceCountMatch: evidenceCount === evidenceFoundCount,
            coloredPixels,
            redPixels,
            greenPixels,
            bluePixels,
            routeLikelyVisible: coloredPixels > 50,
          });
        };
        
        setTimeout(checkMap, 1000);
      });
    });
    
    // Screenshot
    const screenshotName = `/opt/cursor/artifacts/${permitName.toLowerCase()}-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotName });
    
    return {
      permit: permitName,
      viewport: `${viewport.width}×${viewport.height}`,
      ...mapAnalysis,
      errors: errors.length,
      screenshot: screenshotName,
    };
    
  } catch (error) {
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
  
  try {
    // First visit with bypass to set cookie
    await page.goto(baseUrl + bypassParam, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
    
    await page.goto(baseUrl + '/map-explorer' + bypassParam, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(6000);
    
    // Check for clusters
    const corridorAnalysis = await page.evaluate(() => {
      const canvas = document.querySelector('.maplibre-map canvas');
      if (!canvas) return { error: 'No canvas' };
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'No context' };
      
      const sampleSize = 400;
      const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, sampleSize), Math.min(canvas.height, sampleSize));
      const data = imageData.data;
      
      let blueClusterPixels = 0;
      let orangeClusterPixels = 0;
      let coloredPixels = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        
        if (r < 230 || g < 230 || b < 230) coloredPixels++;
        
        // Blue clusters (51, 189, 214)
        if (r < 100 && g > 150 && b > 180) blueClusterPixels++;
        // Orange clusters (245, 158, 11)
        else if (r > 200 && g > 100 && b < 50) orangeClusterPixels++;
      }
      
      return {
        coloredPixels,
        blueClusterPixels,
        orangeClusterPixels,
        clustersLikelyVisible: (blueClusterPixels + orangeClusterPixels) > 10,
      };
    });
    
    const screenshotName = `/opt/cursor/artifacts/corridor-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotName });
    
    return {
      viewport: `${viewport.width}×${viewport.height}`,
      ...corridorAnalysis,
      screenshot: screenshotName,
    };
    
  } catch (error) {
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
    // First visit with bypass to set cookie
    await page.goto(baseUrl + bypassParam, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1000);
    
    await page.goto(baseUrl + '/route-checks' + bypassParam, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
    
    // Show test permits
    const showBtn = await page.waitForSelector('button:has-text("Show test permits")', { timeout: 5000 });
    await showBtn.click();
    await page.waitForTimeout(500);
    
    // Click Hamburg
    const permitBtn = await page.waitForSelector('button:has-text("Hamburg")', { timeout: 5000 });
    await permitBtn.click();
    await page.waitForTimeout(1500);
    
    // Click Check route
    const checkBtn = await page.waitForSelector('button:has-text("Check route")', { timeout: 5000 });
    await checkBtn.click();
    
    // Wait for result
    await page.waitForSelector('.verdict-banner', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000);
    
    // Check if action bar is still visible
    const actionBarVisible = await page.evaluate(() => {
      const actionBar = document.querySelector('.mobile-route-actions');
      if (!actionBar) return { error: 'Action bar not found' };
      
      const rect = actionBar.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      return {
        isInViewport: rect.bottom <= viewportHeight && rect.top >= 0,
        bottom: rect.bottom,
        viewportHeight,
        computedStyle: {
          position: window.getComputedStyle(actionBar).position,
          bottom: window.getComputedStyle(actionBar).bottom,
          zIndex: window.getComputedStyle(actionBar).zIndex,
        }
      };
    });
    
    await page.screenshot({ path: '/opt/cursor/artifacts/mobile-sticky-bar-scrolled.png' });
    
    return actionBarVisible;
    
  } catch (error) {
    return { error: error.message };
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  
  console.log('━━━ FINAL QA TEST ━━━\n');
  
  const results = {
    desktop: [],
    mobile: [],
    corridor: {},
    mobileStickyBar: {},
  };
  
  // Test all 5 permits at desktop resolution
  console.log('Testing route rendering (Desktop 1280×800)...');
  for (const permit of testPermits) {
    const result = await testRouteRendering(browser, permit.name, { width: 1280, height: 800 });
    results.desktop.push(result);
    console.log(`  ${permit.name}: ${result.routeLikelyVisible ? '✓' : '✗'} Route visible | Evidence ${result.evidenceCount}/${result.evidenceFoundCount} ${result.evidenceCountMatch ? '✓' : '✗'}`);
  }
  
  // Test one permit at mobile resolution
  console.log('\nTesting route rendering (Mobile 412×915)...');
  const mobileResult = await testRouteRendering(browser, 'Hamburg', { width: 412, height: 915 });
  results.mobile.push(mobileResult);
  console.log(`  Hamburg: ${mobileResult.routeLikelyVisible ? '✓' : '✗'} Route visible | Evidence ${mobileResult.evidenceCount}/${mobileResult.evidenceFoundCount} ${mobileResult.evidenceCountMatch ? '✓' : '✗'}`);
  
  // Test corridor monitor
  console.log('\nTesting corridor monitor...');
  const corridorDesktop = await testCorridorMonitor(browser, { width: 1280, height: 800 });
  results.corridor.desktop = corridorDesktop;
  console.log(`  Desktop: ${corridorDesktop.clustersLikelyVisible ? '✓' : '✗'} Clusters visible (${corridorDesktop.blueClusterPixels + corridorDesktop.orangeClusterPixels} cluster pixels)`);
  
  // Test mobile sticky bar
  console.log('\nTesting mobile sticky action bar...');
  const stickyBarResult = await testMobileStickyBar(browser);
  results.mobileStickyBar = stickyBarResult;
  console.log(`  Action bar: ${stickyBarResult.isInViewport ? '✓' : '✗'} ${stickyBarResult.isInViewport ? 'Sticky in viewport' : 'Scrolled out of view'}`);
  if (stickyBarResult.computedStyle) {
    console.log(`    Position: ${stickyBarResult.computedStyle.position}, Bottom: ${stickyBarResult.computedStyle.bottom}, Z-index: ${stickyBarResult.computedStyle.zIndex}`);
  }
  
  // Write detailed results
  fs.writeFileSync('/opt/cursor/artifacts/qa-results.json', JSON.stringify(results, null, 2));
  
  console.log('\n━━━ SUMMARY ━━━');
  const desktopPass = results.desktop.filter(r => r.routeLikelyVisible && r.evidenceCountMatch).length;
  const mobilePass = results.mobile.filter(r => r.routeLikelyVisible && r.evidenceCountMatch).length;
  console.log(`Desktop routes: ${desktopPass}/${results.desktop.length} passed`);
  console.log(`Mobile routes: ${mobilePass}/${results.mobile.length} passed`);
  console.log(`Corridor monitor: ${results.corridor.desktop.clustersLikelyVisible ? 'PASS' : 'FAIL'}`);
  console.log(`Mobile sticky bar: ${results.mobileStickyBar.isInViewport ? 'PASS' : 'FAIL'}`);
  
  console.log('\n✓ Results saved to /opt/cursor/artifacts/qa-results.json');
  console.log('✓ Screenshots saved to /opt/cursor/artifacts/');
  
  await browser.close();
})();
