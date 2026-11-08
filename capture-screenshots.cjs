const playwright = require('playwright');

const baseUrl = 'https://heavy-transport-route-check-git-cursor-11984a-red-bars-projects.vercel.app';

(async () => {
  const browser = await playwright.chromium.launch();
  
  try {
    // Mobile screenshots (412x915 - Samsung Galaxy S20 FE)
    console.log('📱 Capturing mobile screenshots (412x915)...');
    const mobile = await browser.newPage({ viewport: { width: 412, height: 915 } });
    
    // Import page
    await mobile.goto(baseUrl + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobile.waitForTimeout(2000);
    await mobile.screenshot({ path: '/opt/cursor/artifacts/mobile-01-import.png' });
    console.log('✓ mobile-01-import.png');
    
    // Corridor monitor
    await mobile.goto(baseUrl + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobile.waitForTimeout(3000);
    await mobile.screenshot({ path: '/opt/cursor/artifacts/mobile-02-corridor.png' });
    console.log('✓ mobile-02-corridor.png');
    
    // Alerts
    await mobile.goto(baseUrl + '/activity', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobile.waitForTimeout(2000);
    await mobile.screenshot({ path: '/opt/cursor/artifacts/mobile-03-alerts.png' });
    console.log('✓ mobile-03-alerts.png');
    
    // Settings
    await mobile.goto(baseUrl + '/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobile.waitForTimeout(2000);
    await mobile.screenshot({ path: '/opt/cursor/artifacts/mobile-04-settings.png' });
    console.log('✓ mobile-04-settings.png');
    
    await mobile.close();
    
    // Desktop screenshots (1280x800)
    console.log('🖥️  Capturing desktop screenshots (1280x800)...');
    const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    
    // Import page
    await desktop.goto(baseUrl + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await desktop.waitForTimeout(2000);
    await desktop.screenshot({ path: '/opt/cursor/artifacts/desktop-01-import.png' });
    console.log('✓ desktop-01-import.png');
    
    // Corridor monitor
    await desktop.goto(baseUrl + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await desktop.waitForTimeout(3000);
    await desktop.screenshot({ path: '/opt/cursor/artifacts/desktop-02-corridor.png' });
    console.log('✓ desktop-02-corridor.png');
    
    await desktop.close();
    
    console.log('✅ All screenshots captured successfully!');
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
})();
