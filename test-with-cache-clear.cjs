const playwright = require('playwright');

const deployedUrl = 'https://heavy-transport-route-check-pr2h0bo5o-red-bars-projects.vercel.app';
const bypassParam = '?_vercel_share=AOf09kBx59N78wnwGVaTyD7YnLaX5ABc';

async function testWithCacheClear() {
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Clear all cache
  await context.clearCookies();
  
  const page = await context.newPage({ viewport: { width: 1280, height: 800 } });
  
  // Disable cache
  await page.route('**/*', route => {
    route.continue({
      headers: {
        ...route.request().headers(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  });
  
  try {
    console.log('Testing with cache cleared...\n');
    
    // Force full reload
    await page.goto(`${deployedUrl}${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const info = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      return {
        scriptHash: scripts.map(s => {
          const match = s.match(/index-([A-Za-z0-9]+)\./);
          return match ? match[1] : null;
        }).filter(h => h)[0]
      };
    });
    
    console.log('Bundle hash after cache clear:', info.scriptHash);
    console.log('Expected (local):', 'ZGZPknJL');
    console.log('Match:', info.scriptHash === 'ZGZPknJL' ? '✅' : '❌ Still old build');
    
    if (info.scriptHash === 'ZGZPknJL') {
      console.log('\n✅ New build deployed! Running full test...\n');
      
      await page.goto(`${deployedUrl}/route-checks${bypassParam}`, { waitUntil: 'networkidle' });
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
        
        let routeFeatures = 0;
        try {
          routeFeatures = map.queryRenderedFeatures({ layers: ['route-line'] }).length;
        } catch (e) {}
        
        const evidenceText = document.querySelector('.evidence-section h3')?.textContent || '';
        
        return {
          hasMap: true,
          hasRouteLayer: map.getLayer('route-line') ? true : false,
          routeFeatures,
          evidenceText
        };
      });
      
      console.log('Hamburg test:');
      console.log('  Route layer:', result.hasRouteLayer ? '✅' : '❌');
      console.log('  Route features:', result.routeFeatures);
      console.log('  Evidence:', result.evidenceText);
      
      await page.screenshot({ path: '/opt/cursor/artifacts/new-build-hamburg.png' });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testWithCacheClear();
