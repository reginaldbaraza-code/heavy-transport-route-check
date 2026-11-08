const playwright = require('playwright');

const baseUrl = 'https://heavy-transport-route-check-git-cursor-11984a-red-bars-projects.vercel.app';

async function captureAndVerify(browser, url, viewport, name) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  
  try {
    console.log(`  ${name} at ${viewport.width}×${viewport.height}...`);
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Capture screenshot
    const filename = `/opt/cursor/artifacts/qa-final-${name.toLowerCase().replace(/\s+/g, '-')}-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`    ✓ Screenshot saved: ${filename}`);
    
    // Basic visual checks
    const hasCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas !== null;
    });
    
    if (!hasCanvas && (name.includes('Route') || name.includes('Corridor'))) {
      errors.push('No canvas element found');
    }
    
  } catch (error) {
    errors.push(`Error: ${error.message}`);
    console.log(`    ✗ ${error.message}`);
  } finally {
    await page.close();
  }
  
  return errors;
}

(async () => {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  QA VERIFICATION: PR #3 Screenshots & Smoke Check                ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  const browser = await playwright.chromium.launch();
  let totalErrors = 0;
  
  try {
    const viewports = [
      { width: 412, height: 915, name: 'Mobile' },
      { width: 1280, height: 800, name: 'Desktop' }
    ];
    
    const pages = [
      { url: '/route-checks', name: 'Route Import' },
      { url: '/map-explorer', name: 'Corridor Monitor' },
      { url: '/activity', name: 'Alerts' },
      { url: '/settings', name: 'Settings' },
    ];
    
    for (const viewport of viewports) {
      console.log(`\n${viewport.name} (${viewport.width}×${viewport.height})`);
      console.log('─'.repeat(70));
      
      for (const pageInfo of pages) {
        const errors = await captureAndVerify(
          browser,
          baseUrl + pageInfo.url,
          viewport,
          pageInfo.name
        );
        totalErrors += errors.length;
        
        if (errors.length > 0) {
          errors.forEach(err => console.log(`    ✗ ${err}`));
        }
      }
    }
    
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║  SUMMARY                                                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
    if (totalErrors === 0) {
      console.log('✓ All screenshots captured successfully');
      console.log('✓ Basic page loads verified\n');
    } else {
      console.log(`✗ ${totalErrors} error(s) encountered\n`);
    }
    
    console.log('Note: Visual verification of route lines and clusters requires');
    console.log('manual inspection of the deployed preview at:');
    console.log(baseUrl);
    console.log('\nRecommendation: Load the preview in a real browser and verify:');
    console.log('  1. Route line visible on all 5 test permits');
    console.log('  2. Corridor monitor shows cluster markers');
    console.log('  3. Evidence count matches across UI');
    console.log('  4. Layers panel collapsed on mobile\n');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
