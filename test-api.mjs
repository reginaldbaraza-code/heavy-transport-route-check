import { readFileSync } from 'fs';

const API_URL = 'https://heavy-transport-route-check-6dtqr8sf7-red-bars-projects.vercel.app/api/check-route';
const SHARE_TOKEN = 'qylssVpwvrvUYJ2Zm7suBhjxfuZ3Brw9';

const vehicle = {
  width: 3.5,
  height: 4.2,
  length: 18.75,
  grossWeight: 44
};

const permits = [
  'bremen-dortmund-a1.gpx',
  'duisburg-koln-a3.gpx',
  'hamburg-hannover-a7.gpx',
  'leipzig-nurnberg-a9.gpx',
  'munchen-stuttgart-a8.gpx'
];

async function testPermit(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${filename}`);
  console.log('='.repeat(60));
  
  try {
    const gpxContent = readFileSync(`public/test-permits/${filename}`, 'utf-8');
    
    const response = await fetch(`${API_URL}?_vercel_share=${SHARE_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gpxContent, vehicle })
    });
    
    const status = response.status;
    const data = await response.json();
    
    console.log(`HTTP Status: ${status}`);
    
    if (status === 200) {
      console.log(`Verdict: ${data.verdict}`);
      console.log(`Title: ${data.title}`);
      console.log(`Issues: ${data.issueCount}`);
      console.log(`Distance: ${data.route.distance}km`);
      console.log(`Origin: ${data.route.origin}`);
      console.log(`Destination: ${data.route.destination}`);
      console.log(`Evidence count: ${data.evidence.length}`);
      if (data.evidence.length > 0) {
        console.log(`First evidence: ${data.evidence[0].title}`);
      }
    } else {
      console.log(`Error: ${JSON.stringify(data, null, 2)}`);
    }
    
    return { filename, status, verdict: data.verdict, success: status === 200 };
  } catch (error) {
    console.log(`Exception: ${error.message}`);
    return { filename, status: 'ERROR', verdict: null, success: false, error: error.message };
  }
}

async function testInvalidFile() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: invalid-test.gpx (should fail with 400)`);
  console.log('='.repeat(60));
  
  try {
    const gpxContent = readFileSync('public/test-permits/invalid-test.gpx', 'utf-8');
    
    const response = await fetch(`${API_URL}?_vercel_share=${SHARE_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ gpxContent, vehicle })
    });
    
    const status = response.status;
    const data = await response.json();
    
    console.log(`HTTP Status: ${status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    
    return { filename: 'invalid-test.gpx', status, success: status === 400 };
  } catch (error) {
    console.log(`Exception: ${error.message}`);
    return { filename: 'invalid-test.gpx', status: 'ERROR', success: false, error: error.message };
  }
}

async function runTests() {
  console.log('Testing /api/check-route on deployed preview');
  console.log(`URL: ${API_URL}`);
  
  const results = [];
  
  // Test valid permits
  for (const permit of permits) {
    const result = await testPermit(permit);
    results.push(result);
  }
  
  // Test invalid file
  const invalidResult = await testInvalidFile();
  results.push(invalidResult);
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`${status} ${r.filename}: HTTP ${r.status} ${r.verdict ? `(${r.verdict})` : ''}`);
  });
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`\n${passed}/${total} tests passed`);
  console.log(`\nPR: https://github.com/reginaldbaraza-code/heavy-transport-route-check/pull/2`);
  console.log(`Preview: https://heavy-transport-route-check-6dtqr8sf7-red-bars-projects.vercel.app/?_vercel_share=${SHARE_TOKEN}`);
}

runTests().catch(console.error);
