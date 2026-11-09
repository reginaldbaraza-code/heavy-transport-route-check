const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  const consoleLogs = [];
  const errors = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      errors.push(text);
      console.log(text);
    }
  });
  
  try {
    console.log('Testing Corridor Monitor (Local Build with Fixture Data)...\n');
    
    await page.goto('http://localhost:3000/map-explorer', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(8000);
    
    const result = await page.evaluate(() => {
      const map = window.__TEST_CORRIDOR_MAP__;
      if (!map) return { error: 'No corridor map' };
      
      const style = map.getStyle();
      const layers = style.layers.map(l => ({ id: l.id, type: l.type, source: l.source }));
      
      // Check source
      const eventsSource = map.getSource('events');
      let sourceData = null;
      if (eventsSource) {
        const data = eventsSource._data || eventsSource.serialize?.();
        if (data && data.features) {
          sourceData = {
            featureCount: data.features.length,
            sampleCoordinates: data.features.slice(0, 5).map(f => ({
              coords: f.geometry.coordinates,
              type: f.properties.type,
              title: f.properties.title
            }))
          };
        }
      }
      
      // Query rendered features
      let clusterFeatures = [];
      let pointFeatures = [];
      try {
        clusterFeatures = map.queryRenderedFeatures({ layers: ['clusters'] });
        pointFeatures = map.queryRenderedFeatures({ layers: ['unclustered-point'] });
      } catch (e) {
        console.error('Query error:', e.message);
      }
      
      return {
        hasMap: true,
        hasEventsSource: eventsSource ? true : false,
        hasClusterLayer: map.getLayer('clusters') ? true : false,
        hasPointLayer: map.getLayer('unclustered-point') ? true : false,
        allLayers: layers.map(l => l.id),
        sourceData,
        clusterFeatures: clusterFeatures.length,
        pointFeatures: pointFeatures.length,
        totalRendered: clusterFeatures.length + pointFeatures.length
      };
    });
    
    console.log('═══ CORRIDOR TEST RESULT ═══');
    console.log(`Map instance: ${result.hasMap ? '✅' : '❌'}`);
    console.log(`Events source: ${result.hasEventsSource ? '✅' : '❌'}`);
    console.log(`Cluster layer: ${result.hasClusterLayer ? '✅' : '❌'}`);
    console.log(`Point layer: ${result.hasPointLayer ? '✅' : '❌'}`);
    console.log(`Source features: ${result.sourceData?.featureCount || 0}`);
    console.log(`Rendered clusters: ${result.clusterFeatures}`);
    console.log(`Rendered points: ${result.pointFeatures}`);
    console.log(`Total rendered: ${result.totalRendered > 0 ? '✅' : '❌'} (${result.totalRendered})`);
    console.log(`Worker errors: ${errors.filter(e => e.includes('worker')).length}`);
    
    if (result.sourceData && result.sourceData.sampleCoordinates) {
      console.log('\nSample events:');
      result.sourceData.sampleCoordinates.forEach((e, i) => {
        console.log(`  ${i+1}. ${e.type}: ${e.title} at [${e.coords[0].toFixed(2)}, ${e.coords[1].toFixed(2)}]`);
      });
    }
    
    console.log('\nAll layers:', result.allLayers.join(', '));
    
    await page.screenshot({ path: '/opt/cursor/artifacts/local-corridor-test.png', fullPage: true });
    console.log('\n✓ Screenshot saved to local-corridor-test.png');
    
    require('fs').writeFileSync('/opt/cursor/artifacts/local-corridor-result.json', JSON.stringify(result, null, 2));
    
    const success = result.hasEventsSource && result.hasClusterLayer && result.totalRendered > 0;
    console.log(`\n${success ? '🎉 SUCCESS' : '❌ FAILED'}: Corridor ${success ? 'working' : 'not working'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
