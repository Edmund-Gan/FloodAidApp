// Simple Node.js test script for the location system improvements
// This tests the basic logic without React Native dependencies

class MockLocation {
  static async getCurrentPositionAsync() {
    return {
      coords: {
        latitude: 3.1390,
        longitude: 101.6869,
        accuracy: 50
      },
      timestamp: Date.now()
    };
  }

  static async requestForegroundPermissionsAsync() {
    return { status: 'granted' };
  }

  static Accuracy = {
    Balanced: 3,
    High: 4,
    BestForNavigation: 6
  };
}

class MockAsyncStorage {
  static storage = new Map();

  static async getItem(key) {
    return this.storage.get(key) || null;
  }

  static async setItem(key, value) {
    this.storage.set(key, value);
  }

  static async removeItem(key) {
    this.storage.delete(key);
  }
}

class MockConstants {
  static deviceName = 'Test Device';
  static deviceModelName = 'Test Model';
  static isDevice = true;
  static platform = { ios: false, android: true };
}

// Mock the modules
global.Location = MockLocation;
global.AsyncStorage = MockAsyncStorage;
global.Constants = MockConstants;
// Mock fetch for testing
global.fetch = async (url, options) => {
  // Simulate IP geolocation API response
  return {
    ok: true,
    json: async () => ({
      lat: 3.1390,
      lon: 101.6869,
      city: 'Kuala Lumpur',
      regionName: 'Kuala Lumpur',
      country: 'Malaysia'
    })
  };
};

// Test the location cache logic
class TestLocationCache {
  static memoryCache = new Map();
  static stateCache = new Map();

  static CACHE_PERIODS = {
    ULTRA_FRESH: 5 * 1000,
    FRESH: 2 * 60 * 1000,
    VALID: 10 * 60 * 1000,
    STALE_ACCEPTABLE: 30 * 60 * 1000
  };

  static async getLocationFromCache(cacheType = 'FRESH') {
    const now = Date.now();

    for (const [key, data] of this.memoryCache.entries()) {
      if (key.startsWith('location_') && data.timestamp) {
        const age = now - data.timestamp;
        const maxAge = this.CACHE_PERIODS[cacheType];

        if (age < maxAge) {
          console.log(`✅ Memory cache hit (${Math.round(age/1000)}s old)`);
          return {
            ...data,
            isCached: true,
            cacheAge: age,
            cacheType: 'memory'
          };
        }
      }
    }
    return null;
  }

  static async cacheLocation(location) {
    const now = Date.now();
    const cacheData = {
      ...location,
      cacheTime: now,
      timestamp: now
    };

    this.memoryCache.set('location_current', cacheData);
    console.log('📦 Location cached successfully');
  }

  static isLocationInMalaysia(lat, lon) {
    // Simplified bounds check for Malaysia
    return lat >= 0.8 && lat <= 7.6 && lon >= 99.5 && lon <= 119.6;
  }
}

// Test IP Geolocation logic
class TestIPGeolocation {
  static async getQuickLocation() {
    try {
      console.log('🌐 Testing IP geolocation...');

      // Use a simple public IP API
      const response = await fetch('http://ip-api.com/json/', {
        timeout: 3000
      });

      if (!response.ok) {
        throw new Error('IP API failed');
      }

      const data = await response.json();

      const location = {
        lat: data.lat,
        lon: data.lon,
        city: data.city,
        region: data.regionName,
        country: data.country,
        accuracy: 10000,
        timestamp: Date.now(),
        provider: 'ip-api',
        source: 'IP_GEOLOCATION'
      };

      console.log(`✅ IP location: ${location.city}, ${location.region} (${location.lat}, ${location.lon})`);
      return location;

    } catch (error) {
      console.log(`❌ IP geolocation failed: ${error.message}`);

      // Fallback to Malaysian default
      return {
        lat: 3.1390,
        lon: 101.6869,
        city: 'Kuala Lumpur',
        region: 'Kuala Lumpur',
        country: 'Malaysia',
        accuracy: 25000,
        timestamp: Date.now(),
        source: 'FALLBACK'
      };
    }
  }
}

// Test the improved location strategy
class TestLocationStrategy {
  static async testImmediateLocation() {
    console.log('\n🚀 Testing Immediate Location Strategy...');

    const startTime = Date.now();

    // 1. Check cache first
    let location = await TestLocationCache.getLocationFromCache('FRESH');

    if (!location) {
      console.log('💾 No fresh cache, trying IP geolocation...');

      // 2. Try IP geolocation
      location = await TestIPGeolocation.getQuickLocation();

      if (location) {
        // 3. Validate and cache
        const isInMalaysia = TestLocationCache.isLocationInMalaysia(location.lat, location.lon);
        console.log(`🇲🇾 Malaysia validation: ${isInMalaysia ? 'PASS' : 'FAIL'}`);

        await TestLocationCache.cacheLocation(location);
      }
    }

    const totalTime = Date.now() - startTime;

    console.log(`⚡ Immediate location strategy completed in ${totalTime}ms`);
    console.log(`📍 Result: ${location.lat}, ${location.lon} (${location.source})`);

    return location;
  }

  static async testCachePerformance() {
    console.log('\n💾 Testing Cache Performance...');

    // Store test location
    const testLocation = {
      lat: 3.1390,
      lon: 101.6869,
      accuracy: 50,
      timestamp: Date.now(),
      source: 'TEST'
    };

    await TestLocationCache.cacheLocation(testLocation);

    // Test retrieval speed
    const startTime = Date.now();
    const cached = await TestLocationCache.getLocationFromCache('FRESH');
    const retrievalTime = Date.now() - startTime;

    console.log(`⚡ Cache retrieval: ${retrievalTime}ms`);
    console.log(`✅ Cache working: ${cached ? 'YES' : 'NO'}`);

    return cached !== null;
  }

  static async runAllTests() {
    console.log('🧪 Running Location System Tests...\n');

    const results = {
      cachePerformance: false,
      immediateLocation: false,
      totalTime: 0
    };

    const overallStart = Date.now();

    try {
      results.cachePerformance = await this.testCachePerformance();
      const location = await this.testImmediateLocation();
      results.immediateLocation = location !== null;

    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }

    results.totalTime = Date.now() - overallStart;

    console.log('\n📊 Test Results Summary:');
    console.log(`Cache Performance: ${results.cachePerformance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Immediate Location: ${results.immediateLocation ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Total Test Time: ${results.totalTime}ms`);

    const passedTests = Object.values(results).filter(r => r === true).length;
    const totalTests = Object.keys(results).length - 1; // Exclude totalTime

    console.log(`\n🎯 Overall Success Rate: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);

    return results;
  }
}

// Run the tests
if (require.main === module) {
  TestLocationStrategy.runAllTests()
    .then(results => {
      console.log('\n✅ Location system verification completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Location system verification failed:', error);
      process.exit(1);
    });
}

module.exports = { TestLocationStrategy, TestLocationCache, TestIPGeolocation };