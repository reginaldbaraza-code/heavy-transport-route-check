#!/bin/bash

API_URL="https://heavy-transport-route-check-6dtqr8sf7-red-bars-projects.vercel.app/api/check-route"

# Test vehicle
VEHICLE='{"width":3.5,"height":4.2,"length":18.75,"grossWeight":44}'

echo "Testing /api/check-route on deployed preview"
echo "URL: $API_URL"
echo ""

test_file() {
  local file=$1
  local name=$(basename "$file")
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Testing: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Read GPX content
  gpx_content=$(cat "$file")
  
  # Create JSON payload
  payload=$(jq -n \
    --arg gpx "$gpx_content" \
    --argjson vehicle "$VEHICLE" \
    '{gpxContent: $gpx, vehicle: $vehicle}')
  
  # Make request
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "$payload")
  
  # Split response and status
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  echo "HTTP Status: $http_code"
  
  if [ "$http_code" -eq 200 ]; then
    verdict=$(echo "$body" | jq -r '.verdict // "N/A"')
    title=$(echo "$body" | jq -r '.title // "N/A"')
    issue_count=$(echo "$body" | jq -r '.issueCount // 0')
    echo "Verdict: $verdict"
    echo "Title: $title"
    echo "Issues: $issue_count"
  elif [ "$http_code" -eq 400 ]; then
    error=$(echo "$body" | jq -r '.error // .message // "Bad request"')
    echo "Error (400): $error"
  else
    echo "Response: $body"
  fi
  
  echo ""
}

# Test all valid permits
for file in public/test-permits/*.gpx; do
  if [[ ! "$file" =~ "invalid" ]]; then
    test_file "$file"
  fi
done

# Test invalid file last
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: invalid-test.gpx (should fail)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_file "public/test-permits/invalid-test.gpx"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "All tests complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
