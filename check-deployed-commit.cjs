const playwright = require('playwright');

const deployedUrl = 'https://heavy-transport-route-check-pr2h0bo5o-red-bars-projects.vercel.app';
const bypassParam = '?_vercel_share=AOf09kBx59N78wnwGVaTyD7YnLaX5ABc';

async function checkCommit() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    await page.goto(`${deployedUrl}${bypassParam}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Check if there's a commit SHA in the HTML or meta tags
    const info = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      return {
        scriptHashes: scripts.map(s => {
          const match = s.match(/index-([A-Za-z0-9]+)\./);
          return match ? match[1] : null;
        }).filter(h => h),
        title: document.title
      };
    });
    
    console.log('Deployed bundle info:');
    console.log('  Script hashes:', info.scriptHashes);
    console.log('  Title:', info.title);
    
    // Try getting index from the URL itself
    await page.goto(`${deployedUrl}/route-checks${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/check-deployed-bundle.png' });
    console.log('\n✓ Screenshot saved');
    
    // Compare with local build
    const fs = require('fs');
    const distHtml = fs.readFileSync('/workspace/dist/index.html', 'utf-8');
    const localMatch = distHtml.match(/index-([A-Za-z0-9]+)\.js/);
    
    console.log('\nLocal bundle hash:', localMatch ? localMatch[1] : 'not found');
    console.log('Deployed bundle hash:', info.scriptHashes[0] || 'not found');
    console.log('Match:', localMatch && info.scriptHashes[0] === localMatch[1] ? '✅ SAME' : '❌ DIFFERENT');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkCommit();
