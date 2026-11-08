import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mock Vercel request/response types
interface MockRequest {
  method: string;
  body: {
    gpxContent: string;
    vehicle: {
      width: number;
      height: number;
      length: number;
      grossWeight: number;
    };
  };
}

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  _statusCode?: number;
  _jsonData?: any;
}

// Import the handler (will use live Autobahn API)
async function loadHandler() {
  const modulePath = resolve(process.cwd(), 'api/check-route.ts');
  
  // Use dynamic import with tsx/ts-node
  try {
    const module = await import(modulePath);
    return module.default;
  } catch (error) {
    console.error('Failed to load handler. Make sure to run with tsx or ts-node:');
    console.error('  pnpm tsx scripts/smoke-check-route.ts');
    throw error;
  }
}

const vehicle = {
  width: 3.5,
  height: 4.2,
  length: 18.75,
  grossWeight: 44
};

const testFiles = [
  { file: 'bremen-dortmund-a1.gpx', shouldPass: true },
  { file: 'duisburg-koln-a3.gpx', shouldPass: true },
  { file: 'hamburg-hannover-a7.gpx', shouldPass: true },
  { file: 'leipzig-nurnberg-a9.gpx', shouldPass: true },
  { file: 'munchen-stuttgart-a8.gpx', shouldPass: true },
  { file: 'invalid-test.gpx', shouldPass: false },
];

async function testPermit(handler: any, filename: string, shouldPass: boolean) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${filename} (expect ${shouldPass ? '200' : '400'})`);
  console.log('='.repeat(70));
  
  try {
    const gpxContent = readFileSync(`public/test-permits/${filename}`, 'utf-8');
    
    const mockReq: MockRequest = {
      method: 'POST',
      body: { gpxContent, vehicle }
    };
    
    const mockRes: MockResponse = {
      _statusCode: 200,
      _jsonData: null,
      status: function(code: number) {
        this._statusCode = code;
        return this;
      },
      json: function(data: any) {
        this._jsonData = data;
      },
      setHeader: () => {}
    };
    
    await handler(mockReq, mockRes);
    
    const status = mockRes._statusCode!;
    const data = mockRes._jsonData;
    
    console.log(`✓ HTTP Status: ${status}`);
    
    if (status === 200) {
      console.log(`  Verdict: ${data.verdict}`);
      console.log(`  Title: ${data.title}`);
      console.log(`  Distance: ${data.route?.distance || 0}km`);
      console.log(`  Origin: ${data.route?.origin || 'N/A'}`);
      console.log(`  Destination: ${data.route?.destination || 'N/A'}`);
      console.log(`  Evidence count: ${data.evidence?.length || 0}`);
      console.log(`  Issue count: ${data.issueCount || 0}`);
      
      if (data.degraded) {
        console.log(`  ⚠️  DEGRADED: ${data.summary}`);
      }
      
      // Validate coordinates are [lng, lat] in Germany bounds
      const germanBounds = { minLng: 5.8, maxLng: 15.1, minLat: 47.2, maxLat: 55.1 };
      const coordErrors: string[] = [];
      
      if (data.route?.coordinates && data.route.coordinates.length > 0) {
        // API returns [lat, lng], check if first coord is valid
        const [first, second] = data.route.coordinates[0];
        
        // If first value is latitude (>40), it's in [lat, lng] format (correct for API)
        if (first > 40 && first < 60) {
          // Check if coords are within Germany
          const inBounds = data.route.coordinates.every(([lat, lng]: [number, number]) => 
            lat >= germanBounds.minLat && lat <= germanBounds.maxLat &&
            lng >= germanBounds.minLng && lng <= germanBounds.maxLng
          );
          if (!inBounds) {
            coordErrors.push('Some coordinates outside Germany bounds');
          }
        } else if (first > 5 && first < 16) {
          // Likely [lng, lat] - wrong for API
          coordErrors.push('Coordinates appear to be [lng, lat] instead of [lat, lng]');
        }
      }
      
      // Validate evidence count for HOLD/VERIFY
      const evidenceErrors: string[] = [];
      if ((data.verdict === 'HOLD' || data.verdict === 'VERIFY') && data.issueCount > 0) {
        const evidenceLength = data.evidence?.length || 0;
        if (evidenceLength < data.issueCount) {
          evidenceErrors.push(`Evidence count (${evidenceLength}) < issueCount (${data.issueCount})`);
        }
      }
      
      const errors = [...coordErrors, ...evidenceErrors];
      if (errors.length > 0) {
        errors.forEach(err => console.log(`  ✗ VALIDATION: ${err}`));
      }
      
      return {
        filename,
        status,
        verdict: data.verdict,
        distance: data.route?.distance || 0,
        evidenceCount: data.evidence?.length || 0,
        issueCount: data.issueCount || 0,
        validationErrors: errors,
        success: shouldPass && status === 200 && (data.route?.distance || 0) > 0 && errors.length === 0
      };
    } else if (status === 400) {
      console.log(`  Error: ${data.error || data.message}`);
      return {
        filename,
        status,
        error: data.error || data.message,
        success: !shouldPass && status === 400
      };
    } else {
      console.log(`  Unexpected response: ${JSON.stringify(data, null, 2)}`);
      return {
        filename,
        status,
        success: false
      };
    }
  } catch (error: any) {
    console.error(`✗ Exception: ${error.message}`);
    console.error(error.stack);
    return {
      filename,
      status: 'ERROR',
      error: error.message,
      success: false
    };
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  SMOKE CHECK: /api/check-route with LIVE Autobahn API            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('\nLoading handler...');
  
  const handler = await loadHandler();
  
  console.log('✓ Handler loaded successfully');
  console.log('\nRunning tests against LIVE Autobahn API (verkehr.autobahn.de)...');
  console.log('⚠️  Network requests may take 5-10 seconds per test');
  
  const results: any[] = [];
  
  for (const { file, shouldPass } of testFiles) {
    const result = await testPermit(handler, file, shouldPass);
    results.push(result);
  }
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  
  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    const details = r.distance 
      ? `${r.distance}km, ${r.evidenceCount} evidence, ${r.verdict}` 
      : r.error || `HTTP ${r.status}`;
    const validation = r.validationErrors?.length ? ` [${r.validationErrors.join('; ')}]` : '';
    console.log(`${status} ${r.filename.padEnd(30)} ${details}${validation}`);
  });
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n✓ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log(`\n✗ ${total - passed} TEST(S) FAILED`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
