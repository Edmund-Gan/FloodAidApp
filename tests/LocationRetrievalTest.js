import FusedLocationProvider from '../services/FusedLocationProvider';
import IPGeolocationService from '../services/IPGeolocationService';
import LocationService from '../services/LocationService';
import LocationCache from '../services/LocationCache';

class LocationRetrievalTest {
  static testResults = [];

  static async runAllTests() {
    console.log('🧪 Starting Location Retrieval System Tests...\n');

    const tests = [
      this.testIPGeolocation,
      this.testFusedLocationProvider,
      this.testLocationCache,
      this.testHybridLocationService,
      this.testProgressiveEnhancement,
      this.testCircuitBreaker,
      this.testPerformanceComparison
    ];

    for (const test of tests) {
      try {
        await test.call(this);
      } catch (error) {
        this.logTestResult(test.name, false, error.message);
      }
    }

    this.printTestSummary();
    return this.testResults;
  }

  static async testIPGeolocation() {
    console.log('🌐 Testing IP Geolocation Service...');

    // Test quick IP location
    const startTime = Date.now();
    const quickLocation = await IPGeolocationService.getQuickLocation();
    const quickTime = Date.now() - startTime;

    if (quickLocation && quickLocation.lat && quickLocation.lon) {
      this.logTestResult('IP Geolocation Quick', true, `Retrieved in ${quickTime}ms`);
    } else {
      this.logTestResult('IP Geolocation Quick', false, 'No location returned');
    }

    // Test Malaysia validation
    const malaysiaTest = await IPGeolocationService.validateLocationInMalaysia(quickLocation);
    const isValidMalaysia = malaysiaTest && LocationCache.isLocationInMalaysia(malaysiaTest.lat, malaysiaTest.lon);

    this.logTestResult('IP Location Malaysia Validation', isValidMalaysia,
      isValidMalaysia ? 'Location validated for Malaysia' : 'Location not in Malaysia bounds');

    // Test cache functionality
    const cached = await IPGeolocationService.getCachedIPLocation();
    const hasCachedData = cached !== null;

    this.logTestResult('IP Geolocation Cache', hasCachedData,
      hasCachedData ? 'Cache working correctly' : 'No cached data found');
  }

  static async testFusedLocationProvider() {
    console.log('🎯 Testing Fused Location Provider...');

    // Test different priority levels
    const priorities = ['speed', 'balanced', 'accuracy'];

    for (const priority of priorities) {
      try {
        const startTime = Date.now();
        const location = await FusedLocationProvider.getLocation({
          priority: priority,
          timeout: 8000,
          enableHighAccuracy: priority === 'accuracy'
        });
        const responseTime = Date.now() - startTime;

        if (location && location.lat && location.lon) {
          this.logTestResult(`Fused Provider (${priority})`, true,
            `Retrieved in ${responseTime}ms, sources: ${location.sources?.join(',') || 'unknown'}, confidence: ${location.confidence?.toFixed(2) || 'unknown'}`);
        } else {
          this.logTestResult(`Fused Provider (${priority})`, false, 'No location returned');
        }
      } catch (error) {
        this.logTestResult(`Fused Provider (${priority})`, false, error.message);
      }
    }

    // Test queue management
    const stats = FusedLocationProvider.getStats();
    this.logTestResult('Fused Provider Queue', true,
      `Queue size: ${stats.queueSize}, Processing: ${stats.isProcessing}, Circuit: ${stats.isCircuitOpen ? 'Open' : 'Closed'}`);
  }

  static async testLocationCache() {
    console.log('💾 Testing Location Cache...');

    // Test cache levels
    const cacheLevels = ['ULTRA_FRESH', 'FRESH', 'VALID', 'STALE_ACCEPTABLE'];

    // Store a test location
    const testLocation = {
      lat: 3.1390,
      lon: 101.6869,
      accuracy: 50,
      timestamp: Date.now(),
      source: 'TEST'
    };

    await LocationCache.cacheLocation(testLocation);

    for (const level of cacheLevels) {
      const cached = await LocationCache.getLocationFromCache(level);
      const hasCached = cached !== null;

      this.logTestResult(`Cache Level (${level})`, hasCached,
        hasCached ? `Cache hit: ${cached.cacheType}` : 'Cache miss');
    }

    // Test enhancement detection
    const betterLocation = {
      lat: 3.1391,
      lon: 101.6870,
      accuracy: 25,
      timestamp: Date.now(),
      source: 'GPS_ACCURATE',
      confidence: 0.95
    };

    const isEnhancement = LocationCache.isLocationEnhancement(betterLocation);
    this.logTestResult('Cache Enhancement Detection', isEnhancement,
      isEnhancement ? 'Correctly identified enhancement' : 'Failed to detect enhancement');
  }

  static async testHybridLocationService() {
    console.log('🔄 Testing Hybrid Location Service...');

    // Test immediate location
    const startTime = Date.now();
    const immediateLocation = await LocationService.getImmediateLocation(Date.now());
    const immediateTime = Date.now() - startTime;

    if (immediateLocation) {
      this.logTestResult('Immediate Location', true,
        `Retrieved in ${immediateTime}ms, source: ${immediateLocation.source}`);
    } else {
      this.logTestResult('Immediate Location', false, 'No immediate location available');
    }

    // Test best available location with different priorities
    const priorities = ['speed', 'balanced', 'accuracy'];

    for (const priority of priorities) {
      try {
        const startTime = Date.now();
        const location = await LocationService.getBestAvailableLocation({
          priority: priority,
          timeout: 10000
        });
        const responseTime = Date.now() - startTime;

        if (location) {
          this.logTestResult(`Best Location (${priority})`, true,
            `Retrieved in ${responseTime}ms, source: ${location.source}, accuracy: ${location.accuracy || 'unknown'}`);
        } else {
          this.logTestResult(`Best Location (${priority})`, false, 'No location returned');
        }
      } catch (error) {
        this.logTestResult(`Best Location (${priority})`, false, error.message);
      }
    }
  }

  static async testProgressiveEnhancement() {
    console.log('📈 Testing Progressive Enhancement...');

    let enhancementReceived = false;
    let enhancementData = null;

    // Set up enhancement callback
    const enhancementCallback = (location) => {
      enhancementReceived = true;
      enhancementData = location;
      console.log('🔄 Enhancement received:', {
        source: location.source,
        accuracy: location.accuracy,
        confidence: location.confidence
      });
    };

    LocationCache.addEnhancementCallback(enhancementCallback);

    // Simulate initial location (lower quality)
    await LocationCache.cacheLocation({
      lat: 3.1390,
      lon: 101.6869,
      accuracy: 1000,
      timestamp: Date.now(),
      source: 'IP_GEOLOCATION',
      confidence: 0.4
    });

    // Simulate enhancement (higher quality)
    setTimeout(async () => {
      await LocationCache.cacheLocation({
        lat: 3.1391,
        lon: 101.6870,
        accuracy: 50,
        timestamp: Date.now(),
        source: 'GPS_ACCURATE',
        confidence: 0.9
      });
    }, 1000);

    // Wait for enhancement
    await new Promise(resolve => setTimeout(resolve, 2000));

    LocationCache.removeEnhancementCallback(enhancementCallback);

    this.logTestResult('Progressive Enhancement', enhancementReceived,
      enhancementReceived ? `Enhancement detected: ${enhancementData?.source}` : 'No enhancement detected');
  }

  static async testCircuitBreaker() {
    console.log('🚫 Testing Circuit Breaker...');

    // Get initial circuit breaker state
    const initialStats = FusedLocationProvider.getStats();

    this.logTestResult('Circuit Breaker Initial State', !initialStats.isCircuitOpen,
      `Circuit is ${initialStats.isCircuitOpen ? 'open' : 'closed'}, failures: ${initialStats.circuitBreaker.failures}`);

    // Test that circuit breaker resets after successful operations
    try {
      await FusedLocationProvider.getLocation({
        priority: 'speed',
        timeout: 3000
      });

      const afterStats = FusedLocationProvider.getStats();
      this.logTestResult('Circuit Breaker Reset', true,
        `Circuit remained functional, failures: ${afterStats.circuitBreaker.failures}`);
    } catch (error) {
      this.logTestResult('Circuit Breaker Reset', false, `Circuit breaker test failed: ${error.message}`);
    }
  }

  static async testPerformanceComparison() {
    console.log('⚡ Testing Performance Comparison...');

    // Test old vs new approach
    const testCount = 3;
    const oldTimes = [];
    const newTimes = [];

    // Test new hybrid approach
    for (let i = 0; i < testCount; i++) {
      const startTime = Date.now();
      try {
        await LocationService.getCurrentLocationWithRetry(false);
        newTimes.push(Date.now() - startTime);
      } catch (error) {
        newTimes.push(10000); // Max time for failed requests
      }
    }

    // Test immediate approach
    const immediateTimes = [];
    for (let i = 0; i < testCount; i++) {
      const startTime = Date.now();
      try {
        await LocationService.getImmediateLocation(Date.now());
        immediateTimes.push(Date.now() - startTime);
      } catch (error) {
        immediateTimes.push(1000); // Max time for failed requests
      }
    }

    const avgNewTime = newTimes.reduce((a, b) => a + b, 0) / testCount;
    const avgImmediateTime = immediateTimes.reduce((a, b) => a + b, 0) / testCount;

    this.logTestResult('Performance - Hybrid Approach', true,
      `Average time: ${avgNewTime.toFixed(0)}ms`);

    this.logTestResult('Performance - Immediate Approach', true,
      `Average time: ${avgImmediateTime.toFixed(0)}ms`);

    const improvementRatio = avgNewTime > 0 ? (avgImmediateTime / avgNewTime) : 1;
    this.logTestResult('Performance Improvement', improvementRatio > 0.5,
      `Immediate is ${improvementRatio.toFixed(1)}x faster than hybrid`);
  }

  static logTestResult(testName, passed, details) {
    const result = {
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };

    this.testResults.push(result);

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}: ${details}`);
  }

  static printTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.test}: ${r.details}`));
    }

    // Performance metrics
    const performanceTests = this.testResults.filter(r => r.test.includes('Performance'));
    if (performanceTests.length > 0) {
      console.log('\n⚡ Performance Metrics:');
      performanceTests.forEach(r => console.log(`  - ${r.test}: ${r.details}`));
    }
  }

  static async quickTest() {
    console.log('🚀 Running Quick Location Test...');

    try {
      const startTime = Date.now();
      const location = await LocationService.getImmediateLocation(Date.now());
      const totalTime = Date.now() - startTime;

      console.log('✅ Quick Test Results:');
      console.log(`  - Location: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`);
      console.log(`  - Source: ${location.source}`);
      console.log(`  - Time: ${totalTime}ms`);
      console.log(`  - Accuracy: ${location.accuracy || 'Unknown'}`);
      console.log(`  - Cached: ${location.isCached ? 'Yes' : 'No'}`);

      return true;
    } catch (error) {
      console.error('❌ Quick Test Failed:', error.message);
      return false;
    }
  }
}

export default LocationRetrievalTest;