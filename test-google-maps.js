/**
 * Simple test script to verify Google Maps API key is working
 * Run this with: node test-google-maps.js
 */

const https = require('https');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'YOUR_TEST_API_KEY_HERE';

// Test 1: Static Maps API (should work if key is valid and billing enabled)
const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=3.1390,101.6869&zoom=10&size=400x400&key=${API_KEY}`;

console.log('🔍 Testing Google Maps API key...\n');

console.log('Test URL:', staticMapUrl);
console.log('\n📍 Testing Static Maps API...');

https.get(staticMapUrl, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Content Type: ${res.headers['content-type']}`);
  
  if (res.statusCode === 200 && res.headers['content-type']?.includes('image')) {
    console.log('✅ SUCCESS: Google Maps API key is working!');
    console.log('✅ Static Maps API responded with image');
    console.log('✅ Your API key has proper permissions');
  } else if (res.statusCode === 403) {
    console.log('❌ ERROR: API key forbidden (403)');
    console.log('🔧 Check: API key restrictions or quotas');
  } else if (res.statusCode === 400) {
    console.log('❌ ERROR: Bad request (400)');
    console.log('🔧 Check: API key format or parameters');
  } else {
    console.log('⚠️  Unexpected response');
  }
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (data.includes('API_KEY_INVALID')) {
      console.log('❌ ERROR: Invalid API key');
    } else if (data.includes('BILLING_NOT_ENABLED')) {
      console.log('❌ ERROR: Billing not enabled for this project');
    } else if (data.includes('REQUEST_DENIED')) {
      console.log('❌ ERROR: Request denied - check API restrictions');
    }
  });
  
}).on('error', (err) => {
  console.log('❌ Network error:', err.message);
});

// Test 2: Check required APIs
console.log('\n🔧 Required APIs for react-native-maps:');
console.log('• Maps SDK for Android - REQUIRED');
console.log('• Maps SDK for iOS - REQUIRED');  
console.log('• Static Maps API - OPTIONAL');
console.log('• Places API - OPTIONAL (for location search)');

console.log('\n📋 If map still not showing, check:');
console.log('1. Google Cloud Console - Enable Maps SDK for Android/iOS');
console.log('2. Billing - Must be enabled for Google Maps APIs');
console.log('3. API Key restrictions - Check allowed apps/domains');
console.log('4. Expo development build - Rebuild after config changes');
console.log('5. Test on physical device - Emulator may have issues');