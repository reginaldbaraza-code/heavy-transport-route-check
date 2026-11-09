const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const errors = [];
  const workerErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
      if (text.toLowerCase().includes('worker')) {
        workerErrors.push(text);
      }
    }
  });
  
  page.on('pageerror', error => {
    errors.push(`PAGE_ERROR: ${error.message}`);
  });
  
  try {
    console.log('Testing worker load...');
    
    await page.goto('http://localhost:3000/map-explorer', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Wait for map to initialize
    await page.waitForTimeout(5000);
    
    const mapCheck = await page.evaluate(() => {
      return {
        hasTestMap: !!window.__TEST_CORRIDOR_MAP__,
        workerUrl: window.__TEST_CORRIDOR_MAP__ ? 'accessible' : 'not accessible'
      };
    });
    
    console.log('\n═══ RESULTS ═══');
    console.log('Map accessible:', mapCheck.hasTestMap);
    console.log('Total errors:', errors.length);
    console.log('Worker errors:', workerErrors.length);
    
    if (workerErrors.length > 0) {
      console.log('\n⚠️  Worker Errors:');
      workerErrors.forEach(e => console.log('  -', e));
    } else {
      console.log('\n✅ NO WORKER ERRORS!');
    }
    
    if (errors.length > 0 && workerErrors.length === 0) {
      console.log('\nOther errors:');
      errors.slice(0, 5).forEach(e => console.log('  -', e.substring(0, 100)));
    }
    
    await page.screenshot({ path: '/opt/cursor/artifacts/worker-test.png' });
    console.log('\n✓ Screenshot saved');
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await browser.close();
  }
})();
