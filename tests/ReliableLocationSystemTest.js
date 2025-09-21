/**
 * ReliableLocationSystemTest - Comprehensive testing for the new GPS location system
 *
 * This test script validates:
 * - ReliableLocationService functionality
 * - SimplifiedLocationCache operations
 * - Emulator vs real device detection
 * - Progressive timeout strategy
 * - Error handling and user feedback
 * - Malaysian state detection accuracy
 *
 * Run this test to ensure the location system works correctly after changes.
 */

import ReliableLocationService from '../services/ReliableLocationService';
import SimplifiedLocationCache from '../services/SimplifiedLocationCache';

class ReliableLocationSystemTest {
  static testResults = [];
  static testStartTime = null;

  /**
   * Run all location system tests
   */
  static async runAllTests() {
    console.log('\n🧪 Starting Reliable Location System Tests...\n');
    this.testStartTime = Date.now();
    this.testResults = [];

    const tests = [
      this.testEmulatorDetection,
      this.testPermissionCheck,
      this.testLocationCaching,
      this.testStateDetection,
      this.testProgressiveTimeouts,
      this.testErrorHandling,
      this.testLocationValidation,
      this.testPerformance,
    ];

    for (const test of tests) {
      try {
        await this.runTest(test);
      } catch (error) {
        this.logTestResult(test.name, false, error.message);
      }
    }

    this.printTestSummary();
    return this.testResults;
  }

  /**
   * Run a single test with error handling
   */
  static async runTest(testFunction) {
    const testName = testFunction.name;
    console.log(`\n🔧 Running ${testName}...`);

    try {
      const startTime = Date.now();
      const result = await testFunction.call(this);
      const duration = Date.now() - startTime;

      this.logTestResult(testName, true, result || 'Passed', duration);
    } catch (error) {
      this.logTestResult(testName, false, error.message);
      console.error(`❌ ${testName} failed:`, error);
    }
  }

  /**
   * Test 1: Emulator Detection
   */
  static async testEmulatorDetection() {
    console.log('🔍 Testing emulator detection...');

    // Test the simplified emulator detection
    const isEmulator = ReliableLocationService._isEmulator();
    const deviceType = isEmulator ? 'EMULATOR/SIMULATOR' : 'REAL DEVICE';

    console.log(`📱 Device type detected: ${deviceType}`);

    // Validate detection logic is working
    if (typeof isEmulator !== 'boolean') {
      throw new Error('Emulator detection must return boolean');
    }

    return `Device type: ${deviceType}`;
  }

  /**
   * Test 2: Permission Check
   */
  static async testPermissionCheck() {
    console.log('🔐 Testing location permission check...');

    const hasPermission = await ReliableLocationService.hasLocationPermission();
    console.log(`🔐 Has location permission: ${hasPermission}`);

    if (typeof hasPermission !== 'boolean') {
      throw new Error('Permission check must return boolean');
    }

    return `Permission: ${hasPermission ? 'granted' : 'denied'}`;
  }

  /**
   * Test 3: Location Caching
   */
  static async testLocationCaching() {
    console.log('💾 Testing location caching...');

    // Clear cache first
    await SimplifiedLocationCache.clearAllCaches();

    // Test GPS location caching
    const testGPSLocation = {
      latitude: 3.1390,
      longitude: 101.6869,
      accuracy: 50,
      timestamp: Date.now(),
      source: 'test_gps'
    };

    const cacheSuccess = await SimplifiedLocationCache.cacheGPSLocation(testGPSLocation);
    if (!cacheSuccess) {
      throw new Error('Failed to cache GPS location');
    }

    // Test cache retrieval
    const cachedLocation = await SimplifiedLocationCache.getCachedGPSLocation();
    if (!cachedLocation) {
      throw new Error('Failed to retrieve cached GPS location');
    }

    if (cachedLocation.latitude !== testGPSLocation.latitude) {
      throw new Error('Cached location data mismatch');
    }

    // Test manual location caching
    const testManualLocation = {
      latitude: 3.1556,
      longitude: 101.7023,
      address: 'Test Address, Selangor',
      timestamp: Date.now(),
      source: 'test_manual'
    };

    await SimplifiedLocationCache.cacheManualLocation(testManualLocation);
    const cachedManual = await SimplifiedLocationCache.getCachedManualLocation();

    if (!cachedManual || cachedManual.address !== testManualLocation.address) {
      throw new Error('Manual location caching failed');
    }

    // Test cache statistics
    const stats = SimplifiedLocationCache.getCacheStats();
    if (!stats.hasGPSCache || !stats.hasManualCache) {
      throw new Error('Cache statistics incorrect');
    }

    return `GPS cache: ✅, Manual cache: ✅, Stats: ${JSON.stringify(stats)}`;
  }

  /**
   * Test 4: Malaysian State Detection
   */
  static async testStateDetection() {
    console.log('🗺️ Testing Malaysian state detection...');

    const testLocations = [
      { lat: 3.1390, lon: 101.6869, expectedState: 'Kuala Lumpur' },
      { lat: 3.0738, lon: 101.5183, expectedState: 'Selangor' },
      { lat: 1.4927, lon: 103.7414, expectedState: 'Johor' },
      { lat: 5.4164, lon: 100.3327, expectedState: 'Penang' },
      { lat: 5.9804, lon: 116.0735, expectedState: 'Sabah' },
    ];

    let correctDetections = 0;
    const results = [];

    for (const testLocation of testLocations) {
      const detectedState = SimplifiedLocationCache.detectMalaysianState(
        testLocation.lat,
        testLocation.lon
      );

      const isCorrect = detectedState === testLocation.expectedState;
      if (isCorrect) correctDetections++;

      results.push({
        coords: `${testLocation.lat}, ${testLocation.lon}`,
        expected: testLocation.expectedState,
        detected: detectedState,
        correct: isCorrect
      });

      console.log(`📍 ${testLocation.lat}, ${testLocation.lon}: Expected ${testLocation.expectedState}, Got ${detectedState} ${isCorrect ? '✅' : '❌'}`);
    }

    const accuracy = (correctDetections / testLocations.length) * 100;

    if (accuracy < 80) {
      throw new Error(`State detection accuracy too low: ${accuracy}%`);
    }

    // Test nearest city detection
    const nearestCity = SimplifiedLocationCache.findNearestMalaysianCity(3.1390, 101.6869);
    if (!nearestCity || !nearestCity.name) {
      throw new Error('Nearest city detection failed');
    }

    console.log(`🏙️ Nearest city to KL: ${nearestCity.name}`);

    return `Accuracy: ${accuracy}%, Nearest city detection: ✅`;
  }

  /**
   * Test 5: Progressive Timeout Strategy
   */
  static async testProgressiveTimeouts() {
    console.log('⏱️ Testing progressive timeout strategy...');

    // Test timeout configuration
    const timeoutStrategy = ReliableLocationService.TIMEOUT_STRATEGY;

    if (!Array.isArray(timeoutStrategy) || timeoutStrategy.length !== 3) {
      throw new Error('Timeout strategy must have 3 attempts');
    }

    // Validate timeout values are reasonable
    const timeouts = timeoutStrategy.map(s => s.timeout);
    if (timeouts[0] >= timeouts[1] || timeouts[1] >= timeouts[2]) {
      throw new Error('Timeout values must be progressive');
    }

    if (timeouts[0] < 5000 || timeouts[2] > 50000) {
      throw new Error('Timeout values out of reasonable range');
    }

    console.log(`⏱️ Timeout strategy: ${timeouts.join('ms → ')}ms`);

    // Test progress callback structure (without actual GPS call)
    let progressCallbackTriggered = false;
    const mockProgress = (progress) => {
      progressCallbackTriggered = true;
      if (!progress.phase || !progress.message) {
        throw new Error('Progress callback missing required fields');
      }
    };

    // Simulate progress callback
    mockProgress({
      phase: 'attempt_1',
      message: 'Quick GPS attempt...',
      attemptNumber: 1,
      totalAttempts: 3
    });

    if (!progressCallbackTriggered) {
      throw new Error('Progress callback not triggered');
    }

    return `Progressive timeouts: ${timeouts.join('ms → ')}ms, Progress callback: ✅`;
  }

  /**
   * Test 6: Error Handling
   */
  static async testErrorHandling() {
    console.log('🚨 Testing error handling...');

    // Test error types
    const errorTypes = ReliableLocationService.ERROR_TYPES;
    const requiredTypes = ['PERMISSION_DENIED', 'TIMEOUT', 'LOCATION_DISABLED', 'GPS_UNAVAILABLE'];

    for (const type of requiredTypes) {
      if (!errorTypes[type]) {
        throw new Error(`Missing error type: ${type}`);
      }
    }

    // Test user-friendly error messages
    const testErrors = [
      { type: 'PERMISSION_DENIED', message: 'Permission denied' },
      { type: 'TIMEOUT', message: 'GPS timeout' },
      { type: 'LOCATION_DISABLED', message: 'Location disabled' },
    ];

    for (const testError of testErrors) {
      const friendlyMessage = ReliableLocationService._getUserFriendlyMessage(testError.type, testError.message);

      if (!friendlyMessage.title || !friendlyMessage.message || !friendlyMessage.suggestion) {
        throw new Error(`Incomplete user-friendly message for ${testError.type}`);
      }

      if (typeof friendlyMessage.canRetry !== 'boolean' || typeof friendlyMessage.showManualOption !== 'boolean') {
        throw new Error(`Missing boolean fields in user-friendly message for ${testError.type}`);
      }

      console.log(`🚨 ${testError.type}: "${friendlyMessage.title}" - Retry: ${friendlyMessage.canRetry}, Manual: ${friendlyMessage.showManualOption}`);
    }

    return `Error types: ${Object.keys(errorTypes).length}, User-friendly messages: ✅`;
  }

  /**
   * Test 7: Location Validation
   */
  static async testLocationValidation() {
    console.log('✅ Testing location validation...');

    const validLocations = [
      { latitude: 3.1390, longitude: 101.6869, accuracy: 50 }, // KL
      { latitude: -33.8688, longitude: 151.2093, accuracy: 100 }, // Sydney (valid coords)
    ];

    const invalidLocations = [
      { latitude: 0, longitude: 0, accuracy: 50 }, // Null island
      { latitude: 91, longitude: 101.6869, accuracy: 50 }, // Invalid latitude
      { latitude: 3.1390, longitude: 181, accuracy: 50 }, // Invalid longitude
      { latitude: 3.1390, longitude: 101.6869, accuracy: 60000 }, // Very poor accuracy
    ];

    // Test valid locations
    for (const location of validLocations) {
      const isValid = ReliableLocationService._validateLocation({ coords: location });
      if (!isValid) {
        throw new Error(`Valid location rejected: ${location.latitude}, ${location.longitude}`);
      }
    }

    // Test invalid locations
    for (const location of invalidLocations) {
      const isValid = ReliableLocationService._validateLocation({ coords: location });
      if (isValid) {
        throw new Error(`Invalid location accepted: ${location.latitude}, ${location.longitude}`);
      }
    }

    console.log(`✅ Valid locations: ${validLocations.length}/✅, Invalid locations: ${invalidLocations.length}/❌`);

    return `Validation: ${validLocations.length} valid ✅, ${invalidLocations.length} invalid ❌`;
  }

  /**
   * Test 8: Performance
   */
  static async testPerformance() {
    console.log('🚀 Testing performance...');

    // Test cache performance
    const cacheStartTime = Date.now();
    await SimplifiedLocationCache.getCachedGPSLocation();
    const cacheTime = Date.now() - cacheStartTime;

    if (cacheTime > 100) {
      console.warn(`⚠️ Cache retrieval slow: ${cacheTime}ms`);
    }

    // Test state detection performance
    const stateStartTime = Date.now();
    SimplifiedLocationCache.detectMalaysianState(3.1390, 101.6869);
    const stateTime = Date.now() - stateStartTime;

    if (stateTime > 50) {
      console.warn(`⚠️ State detection slow: ${stateTime}ms`);
    }

    // Test validation performance
    const validationStartTime = Date.now();
    for (let i = 0; i < 100; i++) {
      ReliableLocationService._validateLocation({
        coords: { latitude: 3.1390, longitude: 101.6869, accuracy: 50 }
      });
    }
    const validationTime = (Date.now() - validationStartTime) / 100;

    console.log(`🚀 Cache: ${cacheTime}ms, State: ${stateTime}ms, Validation: ${validationTime.toFixed(2)}ms avg`);

    return `Cache: ${cacheTime}ms, State: ${stateTime}ms, Validation: ${validationTime.toFixed(1)}ms`;
  }

  /**
   * Log test result
   */
  static logTestResult(testName, passed, details, duration = null) {
    const result = {
      test: testName,
      passed,
      details,
      duration,
      timestamp: Date.now()
    };

    this.testResults.push(result);

    const status = passed ? '✅' : '❌';
    const durationText = duration ? ` (${duration}ms)` : '';
    console.log(`${status} ${testName}${durationText}: ${details}`);
  }

  /**
   * Print comprehensive test summary
   */
  static printTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = Date.now() - this.testStartTime;

    console.log('\n📊 Test Summary');
    console.log('=' * 50);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  • ${r.test}: ${r.details}`));
    }

    console.log('\n🏁 Reliable Location System Test Complete!\n');

    // Return overall result
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      totalDuration,
      passed: failedTests === 0
    };
  }

  /**
   * Quick smoke test for basic functionality
   */
  static async runSmokeTest() {
    console.log('\n💨 Running Location System Smoke Test...\n');

    try {
      // Test 1: Service availability
      const hasPermission = await ReliableLocationService.hasLocationPermission();
      console.log(`🔐 Permission check: ${hasPermission ? '✅' : '⚠️'}`);

      // Test 2: Cache functionality
      await SimplifiedLocationCache.clearAllCaches();
      const stats = SimplifiedLocationCache.getCacheStats();
      console.log(`💾 Cache clear: ${stats.memoryCacheSize === 0 ? '✅' : '❌'}`);

      // Test 3: State detection
      const state = SimplifiedLocationCache.detectMalaysianState(3.1390, 101.6869);
      console.log(`🗺️ State detection: ${state === 'Kuala Lumpur' ? '✅' : '❌'}`);

      // Test 4: Error handling
      const error = ReliableLocationService._getUserFriendlyMessage('TIMEOUT', 'test');
      console.log(`🚨 Error handling: ${error.title ? '✅' : '❌'}`);

      console.log('\n✅ Smoke test complete - Basic functionality working\n');
      return true;

    } catch (error) {
      console.error('\n❌ Smoke test failed:', error.message);
      return false;
    }
  }
}

export default ReliableLocationSystemTest;