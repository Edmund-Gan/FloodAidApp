// utils/OptimizedLocationIntegration.js
import LocationService from '../services/LocationService';
import LocationCache from '../services/LocationCache';
import BackgroundLocationManager from '../services/BackgroundLocationManager';
import OptimizedLocationTest from '../tests/OptimizedLocationTest';

/**
 * Integration utilities for the optimized GPS location system
 * Provides easy integration points for the FloodAidApp
 */
class OptimizedLocationIntegration {

  /**
   * Initialize the optimized location system
   * Call this early in your app lifecycle (e.g., App.js)
   */
  static async initializeOptimizedLocationSystem() {
    console.log('🚀 Initializing Optimized Location System...');
    
    try {
      // Initialize background location manager with optimized settings
      await BackgroundLocationManager.initialize({
        updateIntervalMs: 2 * 60 * 1000,  // 2 minutes for active updates
        backgroundUpdateIntervalMs: 5 * 60 * 1000, // 5 minutes for background updates
        significantDistanceThreshold: 100, // 100 meters
        enableBackgroundUpdates: true,
        enableSignificantLocationChanges: true
      });
      
      // Run a quick preemptive location acquisition
      BackgroundLocationManager.preemptiveGPSAcquisition();
      
      console.log('✅ Optimized Location System initialized');
      
      // Return system status
      return {
        success: true,
        backgroundManager: BackgroundLocationManager.getStatus(),
        locationService: LocationService.getPerformanceStats(),
        cacheStats: LocationCache.getCacheStats()
      };
      
    } catch (error) {
      console.error('❌ Failed to initialize Optimized Location System:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get optimized location with best performance settings
   * Use this instead of direct LocationService calls for best performance
   */
  static async getOptimizedLocation(options = {}) {
    const {
      skipGPS = false,
      priority = 'normal',
      includeMalaysiaValidation = true,
      cacheStrategy = 'FRESH'
    } = options;

    console.log(`📍 OptimizedLocationIntegration: Getting location (priority: ${priority})...`);
    
    try {
      // Try cache first if requested
      if (!skipGPS) {
        const cached = await LocationCache.getLocationFromCache(cacheStrategy);
        if (cached) {
          console.log(`⚡ Using cached location (${Math.round(cached.cacheAge/1000)}s old)`);
          return {
            ...cached,
            source: 'cache',
            optimization: 'cache_hit'
          };
        }
      }

      // Get location with optimization
      let location;
      if (includeMalaysiaValidation) {
        location = await LocationService.getCurrentLocationWithMalaysiaCheck(skipGPS);
      } else {
        location = await LocationService.getCurrentLocation(skipGPS, priority);
      }

      return {
        ...location,
        source: location.isCached ? 'cache' : 'gps',
        optimization: location.isDeduplicated ? 'deduplicated' : 'direct'
      };

    } catch (error) {
      console.error('❌ OptimizedLocationIntegration: Location failed:', error);
      throw error;
    }
  }

  /**
   * Get location with parallel state and display name resolution
   * Optimized version of common location + metadata pattern
   */
  static async getLocationWithMetadata(lat = null, lon = null, skipGPS = false) {
    console.log('🔄 Getting location with parallel metadata resolution...');
    
    try {
      // Get location first
      const location = await this.getOptimizedLocation({ 
        skipGPS, 
        priority: 'normal',
        includeMalaysiaValidation: true 
      });

      // Resolve metadata in parallel
      const startTime = Date.now();
      const [stateResult, displayNameResult] = await Promise.allSettled([
        LocationService.getStateFromCoordinates(location.lat, location.lon),
        LocationService.getLocationDisplayName(location.lat, location.lon)
      ]);

      const metadataTime = Date.now() - startTime;
      console.log(`⚡ Parallel metadata resolution: ${metadataTime}ms`);

      return {
        location: {
          lat: location.lat,
          lon: location.lon,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          source: location.source,
          optimization: location.optimization,
          isCached: location.isCached,
          isDefault: location.isDefault
        },
        state: stateResult.status === 'fulfilled' ? stateResult.value : 'Unknown',
        displayName: displayNameResult.status === 'fulfilled' ? displayNameResult.value : 'Unknown Location, Malaysia',
        metadata: {
          resolution_time_ms: metadataTime,
          state_success: stateResult.status === 'fulfilled',
          display_name_success: displayNameResult.status === 'fulfilled'
        }
      };

    } catch (error) {
      console.error('❌ Location with metadata failed:', error);
      throw error;
    }
  }

  /**
   * Run optimization tests
   * Use this to validate the system is working correctly
   */
  static async runOptimizationTests() {
    console.log('🧪 Running GPS optimization tests...');
    return await OptimizedLocationTest.runAllTests();
  }

  /**
   * Get comprehensive system performance report
   */
  static getPerformanceReport() {
    const locationStats = LocationService.getPerformanceStats();
    const cacheStats = LocationCache.getCacheStats();
    const backgroundStatus = BackgroundLocationManager.getStatus();

    return {
      locationService: {
        totalRequests: locationStats.totalRequests,
        cacheHits: locationStats.cacheHits,
        cacheHitRate: locationStats.cacheHitRate,
        gpsAcquisitions: locationStats.gpsAcquisitions,
        averageGpsTime: locationStats.averageGpsTime,
        failureRate: locationStats.failureRate
      },
      cache: {
        memoryCacheSize: cacheStats.memoryCacheSize,
        stateCacheSize: cacheStats.stateCacheSize,
        requestCacheSize: cacheStats.requestCacheSize
      },
      backgroundManager: {
        isRunning: backgroundStatus.isRunning,
        hasActiveServices: backgroundStatus.hasUpdateInterval || backgroundStatus.hasSignificantLocationWatcher
      },
      recommendations: this.generateOptimizationRecommendations(locationStats, cacheStats)
    };
  }

  /**
   * Generate optimization recommendations based on performance data
   */
  static generateOptimizationRecommendations(locationStats, cacheStats) {
    const recommendations = [];

    // Cache performance analysis
    if (locationStats.cacheHitRate < 0.5 && locationStats.totalRequests > 10) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        message: 'Low cache hit rate detected. Consider longer cache validity periods.',
        metric: `Cache hit rate: ${(locationStats.cacheHitRate * 100).toFixed(1)}%`
      });
    }

    // GPS performance analysis
    if (locationStats.averageGpsTime > 10000) {
      recommendations.push({
        type: 'gps',
        priority: 'medium',
        message: 'GPS acquisition is slow. Consider using background location updates.',
        metric: `Average GPS time: ${(locationStats.averageGpsTime / 1000).toFixed(1)}s`
      });
    }

    // Failure rate analysis
    if (locationStats.failureRate > 0.2) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: 'High failure rate detected. Check GPS permissions and device capabilities.',
        metric: `Failure rate: ${(locationStats.failureRate * 100).toFixed(1)}%`
      });
    }

    // Memory usage analysis
    if (cacheStats.memoryCacheSize > 100) {
      recommendations.push({
        type: 'memory',
        priority: 'low',
        message: 'Large memory cache detected. Consider running cache cleanup.',
        metric: `Memory cache entries: ${cacheStats.memoryCacheSize}`
      });
    }

    // Success case
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        priority: 'info',
        message: 'GPS optimization system is performing well!',
        metric: `Cache hit rate: ${(locationStats.cacheHitRate * 100).toFixed(1)}%, Avg GPS: ${(locationStats.averageGpsTime / 1000).toFixed(1)}s`
      });
    }

    return recommendations;
  }

  /**
   * Optimize system performance
   * Run this periodically to clean up and optimize
   */
  static optimizeSystem() {
    console.log('🚀 Optimizing GPS location system...');
    
    // Clean expired cache entries
    LocationCache.cleanExpiredCache();
    
    // Optimize LocationService performance
    LocationService.optimizePerformance();
    
    // Optimize BackgroundLocationManager
    if (BackgroundLocationManager.getStatus().isRunning) {
      BackgroundLocationManager.optimize();
    }
    
    console.log('✅ System optimization completed');
  }

  /**
   * Emergency fallback when all optimizations fail
   * Provides basic location functionality
   */
  static async getEmergencyLocation() {
    console.log('🚨 Using emergency location fallback...');
    
    try {
      // Try simplest approach first
      const location = await LocationService.getCurrentLocation(true); // Skip GPS
      return {
        ...location,
        source: 'emergency_fallback',
        optimization: 'none',
        isEmergency: true
      };
    } catch (error) {
      // Ultimate fallback to default coordinates
      console.log('🏠 Using default emergency coordinates');
      return {
        lat: 3.1390,
        lon: 101.6869,
        accuracy: null,
        timestamp: Date.now(),
        source: 'emergency_default',
        optimization: 'none',
        isEmergency: true,
        isDefault: true
      };
    }
  }

  /**
   * Integration helper for React components
   * Provides hooks-friendly interface
   */
  static createLocationHook() {
    return {
      getOptimizedLocation: this.getOptimizedLocation.bind(this),
      getLocationWithMetadata: this.getLocationWithMetadata.bind(this),
      getEmergencyLocation: this.getEmergencyLocation.bind(this),
      optimizeSystem: this.optimizeSystem.bind(this),
      getPerformanceReport: this.getPerformanceReport.bind(this)
    };
  }
}

export default OptimizedLocationIntegration;