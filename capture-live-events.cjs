const playwright = require('playwright');
const fs = require('fs');

const deployedUrl = 'https://heavy-transport-route-check-ebxnthsqf-red-bars-projects.vercel.app';
const bypassParam = '?_vercel_share=kEsiprjFJz0lGWlu7rCvSziXTGGPUuZU';

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    console.log('Capturing live Autobahn events...\n');
    
    // Intercept network request to capture real API data
    let capturedEvents = null;
    
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('api.autobahn.de') || url.includes('autobahn') || url.includes('events')) {
        try {
          const json = await response.json();
          if (json && Array.isArray(json)) {
            capturedEvents = json;
            console.log(`Captured ${json.length} events from ${url}`);
          }
        } catch (e) {
          // Not JSON or failed to parse
        }
      }
    });
    
    await page.goto(`${deployedUrl}/map-explorer${bypassParam}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(10000);
    
    // If no network capture, try extracting from page state
    if (!capturedEvents) {
      console.log('No network capture, extracting from page state...');
      capturedEvents = await page.evaluate(() => {
        // Try to find events in window or React state
        const map = window.__TEST_CORRIDOR_MAP__;
        if (map) {
          const source = map.getSource('events');
          if (source && source._data && source._data.features) {
            return source._data.features.map(f => ({
              id: f.properties.id,
              type: f.properties.type,
              title: f.properties.title,
              detail: f.properties.detail,
              road: f.properties.road,
              lat: f.properties.lat,
              lng: f.properties.lng,
              updated: f.properties.updated,
              source: f.properties.source,
              confidence: f.properties.confidence,
              dataCategory: f.properties.dataCategory
            }));
          }
        }
        return null;
      });
    }
    
    if (capturedEvents && capturedEvents.length > 0) {
      fs.writeFileSync('/opt/cursor/artifacts/live-autobahn-events.json', JSON.stringify(capturedEvents, null, 2));
      console.log(`\n✓ Saved ${capturedEvents.length} events to live-autobahn-events.json`);
      console.log('\nSample events:');
      capturedEvents.slice(0, 3).forEach((e, i) => {
        console.log(`  ${i+1}. ${e.title || e.type} at [${e.lat}, ${e.lng}]`);
      });
    } else {
      console.log('\n❌ No events captured');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
