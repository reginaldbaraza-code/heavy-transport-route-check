const playwright = require('playwright');

const deployedUrl = 'https://heavy-transport-route-check-git-cursor-11984a-red-bars-projects.vercel.app';

async function inspect() {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    await page.goto(`${deployedUrl}/route-checks`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: '/opt/cursor/artifacts/deployment-route-checks.png' });
    
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
    });
    
    console.log('Available buttons:');
    buttons.forEach(b => console.log(' -', b));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspect();
