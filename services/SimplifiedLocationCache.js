/**
 * SimplifiedLocationCache - Clean, focused caching for reliable GPS results
 *
 * This replaces the over-complex LocationCache with a simple, focused approach:
 * - Only caches verified GPS results
 * - Maximum 5-minute cache validity
 * - Separate manual location cache
 * - Clear cache invalidation rules
 * - Malaysia validation warnings (not rejections)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import AsyncStorageHelper from '../utils/AsyncStorageHelper';

class SimplifiedLocationCache {
  static memoryCache = new Map();
  static manualLocationCache = new Map();
  static lastCacheTime = null;

  // Cache validity periods
  static CACHE_VALIDITY = {
    GPS_FRESH: 2 * 60 * 1000,     // 2 minutes for fresh GPS
    GPS_VALID: 5 * 60 * 1000,     // 5 minutes maximum for GPS
    MANUAL_VALID: 24 * 60 * 60 * 1000, // 24 hours for manual locations
    STATE_VALID: 60 * 60 * 1000   // 1 hour for state detection
  };

  // Malaysian state boundaries for validation
  static MALAYSIA_BOUNDS = {
    LAT_MIN: 0.8,   // Southern tip of Malaysia
    LAT_MAX: 7.6,   // Northern tip including Perlis
    LON_MIN: 99.5,  // Western tip of Peninsular Malaysia
    LON_MAX: 119.6  // Eastern tip of Sabah
  };

  // Major Malaysian cities for fallback
  static MALAYSIAN_CITIES = {
    'Kuala Lumpur': { lat: 3.1390, lon: 101.6869, state: 'Kuala Lumpur' },
    'Petaling Jaya': { lat: 3.1073, lon: 101.6421, state: 'Selangor' },
    'Shah Alam': { lat: 3.0733, lon: 101.5185, state: 'Selangor' },
    'Johor Bahru': { lat: 1.4927, lon: 103.7414, state: 'Johor' },
    'George Town': { lat: 5.4164, lon: 100.3327, state: 'Penang' },
    'Ipoh': { lat: 4.5975, lon: 101.0901, state: 'Perak' }
  };

  // Simple state detection based on coordinates
  static STATE_REGIONS = {
    'Kuala Lumpur': { latMin: 3.0, latMax: 3.3, lonMin: 101.5, lonMax: 101.8 },
    'Selangor': { latMin: 2.6, latMax: 3.9, lonMin: 100.8, lonMax: 102.2 },
    'Johor': { latMin: 1.2, latMax: 2.8, lonMin: 102.3, lonMax: 104.8 },
    'Penang': { latMin: 5.2, latMax: 5.6, lonMin: 100.1, lonMax: 100.6 },
    'Perak': { latMin: 3.7, latMax: 5.7, lonMin: 100.4, lonMax: 102.2 },
    'Kedah': { latMin: 5.0, latMax: 6.8, lonMin: 99.8, lonMax: 101.2 },
    'Kelantan': { latMin: 4.5, latMax: 6.3, lonMin: 101.3, lonMax: 102.8 },
    'Terengganu': { latMin: 4.0, latMax: 5.9, lonMin: 102.4, lonMax: 103.9 },
    'Pahang': { latMin: 2.8, latMax: 4.8, lonMin: 101.4, lonMax: 103.8 },
    'Negeri Sembilan': { latMin: 2.3, latMax: 3.0, lonMin: 101.4, lonMax: 102.8 },
    'Melaka': { latMin: 2.0, latMax: 2.4, lonMin: 102.0, lonMax: 102.6 },
    'Perlis': { latMin: 6.3, latMax: 6.8, lonMin: 100.0, lonMax: 100.6 },
    'Sabah': { latMin: 4.0, latMax: 7.6, lonMin: 115.0, lonMax: 119.6 },
    'Sarawak': { latMin: 0.8, latMax: 5.2, lonMin: 109.3, lonMax: 115.7 },
    'Putrajaya': { latMin: 2.85, latMax: 3.0, lonMin: 101.6, lonMax: 101.8 },
    'Labuan': { latMin: 5.2, latMax: 5.4, lonMin: 115.1, lonMax: 115.3 }
  };

  /**
   * Cache a GPS location (only from verified sources)
   */
  static async cacheGPSLocation(location) {
    if (!this._isValidGPSLocation(location)) {
      console.warn('⚠️ Invalid GPS location not cached:', location);
      return false;
    }

    const cacheEntry = {
      ...location,
      cachedAt: Date.now(),
      type: 'gps',
      isVerified: true
    };

    // Store in memory cache
    this.memoryCache.set('gps_current', cacheEntry);
    this.lastCacheTime = Date.now();

    // Store in AsyncStorage with AsyncStorageHelper for iOS reliability
    try {
      await AsyncStorageHelper.setItem(
        'gps_location_cache',
        JSON.stringify(cacheEntry),
        {
          priority: 'high', // GPS location is critical
          verify: true // Verify write on iOS
        }
      );

      const malaysiaInfo = this._validateMalaysiaLocation(location.latitude, location.longitude);
      console.log(`📦 GPS location cached: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} ${malaysiaInfo.inMalaysia ? '🇲🇾' : '🌏'}`);

      if (!malaysiaInfo.inMalaysia) {
        console.log(`⚠️ Note: Location outside Malaysia bounds, but cached for user reference`);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to cache GPS location:', error);

      // Fallback to direct AsyncStorage
      try {
        await AsyncStorage.setItem('gps_location_cache', JSON.stringify(cacheEntry));
        console.log('✅ GPS location cached via fallback');
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback GPS cache also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Cache a manual location (user-selected)
   */
  static async cacheManualLocation(location) {
    const cacheEntry = {
      ...location,
      cachedAt: Date.now(),
      type: 'manual',
      isUserSelected: true
    };

    // Store in separate manual cache
    this.manualLocationCache.set('manual_current', cacheEntry);

    try {
      await AsyncStorageHelper.setItem(
        'manual_location_cache',
        JSON.stringify(cacheEntry),
        {
          priority: 'high', // Manual selection is important
          verify: true // Verify write on iOS
        }
      );
      console.log(`📍 Manual location cached: ${location.address || `${location.latitude}, ${location.longitude}`}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to cache manual location:', error);

      // Fallback to direct AsyncStorage
      try {
        await AsyncStorage.setItem('manual_location_cache', JSON.stringify(cacheEntry));
        console.log('✅ Manual location cached via fallback');
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback manual cache also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Get cached GPS location if still valid
   */
  static async getCachedGPSLocation(maxAge = this.CACHE_VALIDITY.GPS_VALID) {
    const now = Date.now();

    // Check memory cache first
    const memoryLocation = this.memoryCache.get('gps_current');
    if (memoryLocation && (now - memoryLocation.cachedAt) < maxAge) {
      const age = now - memoryLocation.cachedAt;
      console.log(`⚡ Memory cache hit: GPS location (${Math.round(age/1000)}s old)`);
      return {
        ...memoryLocation,
        cacheAge: age,
        source: 'memory_cache'
      };
    }

    // Check AsyncStorage cache
    try {
      const stored = await AsyncStorage.getItem('gps_location_cache');
      if (stored) {
        const location = JSON.parse(stored);
        const age = now - location.cachedAt;

        if (age < maxAge) {
          // Update memory cache
          this.memoryCache.set('gps_current', location);

          console.log(`💾 Storage cache hit: GPS location (${Math.round(age/1000)}s old)`);
          return {
            ...location,
            cacheAge: age,
            source: 'storage_cache'
          };
        } else {
          console.log(`⏰ Cached GPS location expired (${Math.round(age/1000)}s old, max ${maxAge/1000}s)`);
        }
      }
    } catch (error) {
      console.error('❌ Error reading GPS cache:', error);
    }

    return null;
  }

  /**
   * Get cached manual location if available
   */
  static async getCachedManualLocation() {
    const now = Date.now();

    // Check memory cache first
    const memoryLocation = this.manualLocationCache.get('manual_current');
    if (memoryLocation && (now - memoryLocation.cachedAt) < this.CACHE_VALIDITY.MANUAL_VALID) {
      const age = now - memoryLocation.cachedAt;
      console.log(`📍 Manual location from memory (${Math.round(age/1000/60)}min old)`);
      return {
        ...memoryLocation,
        cacheAge: age,
        source: 'manual_memory'
      };
    }

    // Check AsyncStorage
    try {
      const stored = await AsyncStorage.getItem('manual_location_cache');
      if (stored) {
        const location = JSON.parse(stored);
        const age = now - location.cachedAt;

        if (age < this.CACHE_VALIDITY.MANUAL_VALID) {
          // Update memory cache
          this.manualLocationCache.set('manual_current', location);

          console.log(`📍 Manual location from storage (${Math.round(age/1000/60)}min old)`);
          return {
            ...location,
            cacheAge: age,
            source: 'manual_storage'
          };
        }
      }
    } catch (error) {
      console.error('❌ Error reading manual location cache:', error);
    }

    return null;
  }

  /**
   * Get any cached location (GPS preferred, then manual)
   */
  static async getAnyCachedLocation() {
    // Try GPS first (more accurate)
    const gpsLocation = await this.getCachedGPSLocation();
    if (gpsLocation) {
      return gpsLocation;
    }

    // Fallback to manual location
    const manualLocation = await this.getCachedManualLocation();
    if (manualLocation) {
      return manualLocation;
    }

    console.log('📍 No cached location available');
    return null;
  }

  /**
   * Detect Malaysian state from coordinates
   */
  static detectMalaysianState(latitude, longitude) {
    console.log(`🗺️ Detecting state for coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

    // Check if coordinates are in Malaysia
    const malaysiaInfo = this._validateMalaysiaLocation(latitude, longitude);
    if (!malaysiaInfo.inMalaysia) {
      console.log(`⚠️ Coordinates outside Malaysia bounds, defaulting to Selangor`);
      return 'Selangor';
    }

    // Find matching state
    for (const [state, bounds] of Object.entries(this.STATE_REGIONS)) {
      if (latitude >= bounds.latMin && latitude <= bounds.latMax &&
          longitude >= bounds.lonMin && longitude <= bounds.lonMax) {
        console.log(`🎯 State detected: ${state}`);
        return state;
      }
    }

    // Default to Selangor if no specific state matches
    console.log(`❓ No specific state match, defaulting to Selangor`);
    return 'Selangor';
  }

  /**
   * Find nearest Malaysian city
   */
  static findNearestMalaysianCity(latitude, longitude) {
    let nearestCity = null;
    let minDistance = Infinity;

    for (const [name, city] of Object.entries(this.MALAYSIAN_CITIES)) {
      const distance = this._calculateDistance(latitude, longitude, city.lat, city.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = { ...city, name, distance };
      }
    }

    if (nearestCity) {
      console.log(`🎯 Nearest Malaysian city: ${nearestCity.name} (${nearestCity.distance.toFixed(2)} units away)`);
    }

    return nearestCity;
  }

  /**
   * Validate GPS location
   */
  static _isValidGPSLocation(location) {
    if (!location) return false;

    const { latitude, longitude, accuracy } = location;

    // Basic coordinate validation
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return false;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return false;
    }

    // Check for null island
    if (latitude === 0 && longitude === 0) {
      return false;
    }

    // Check for unreasonably poor accuracy (>50km)
    if (accuracy && accuracy > 50000) {
      return false;
    }

    return true;
  }

  /**
   * Public method to check if location is in Malaysia
   * Used by FloodPredictionModel and other services
   */
  static isLocationInMalaysia(latitude, longitude) {
    const validation = this._validateMalaysiaLocation(latitude, longitude);
    return validation.inMalaysia;
  }

  /**
   * Validate if location is in Malaysia (with warning, not rejection)
   */
  static _validateMalaysiaLocation(latitude, longitude) {
    const inMalaysia = latitude >= this.MALAYSIA_BOUNDS.LAT_MIN &&
                      latitude <= this.MALAYSIA_BOUNDS.LAT_MAX &&
                      longitude >= this.MALAYSIA_BOUNDS.LON_MIN &&
                      longitude <= this.MALAYSIA_BOUNDS.LON_MAX;

    return {
      inMalaysia,
      warning: !inMalaysia ? 'Location appears to be outside Malaysia' : null,
      bounds: this.MALAYSIA_BOUNDS
    };
  }

  /**
   * Calculate simple distance between coordinates
   */
  static _calculateDistance(lat1, lon1, lat2, lon2) {
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;
    return Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
  }

  /**
   * Clear all caches
   */
  static async clearAllCaches() {
    this.memoryCache.clear();
    this.manualLocationCache.clear();
    this.lastCacheTime = null;

    try {
      await AsyncStorage.multiRemove(['gps_location_cache', 'manual_location_cache']);
      console.log('🗑️ All location caches cleared');
    } catch (error) {
      console.error('❌ Error clearing caches:', error);
    }
  }

  /**
   * Clear only GPS cache (keep manual locations)
   */
  static async clearGPSCache() {
    this.memoryCache.delete('gps_current');
    this.lastCacheTime = null;

    try {
      await AsyncStorage.removeItem('gps_location_cache');
      console.log('🗑️ GPS cache cleared');
    } catch (error) {
      console.error('❌ Error clearing GPS cache:', error);
    }
  }

  /**
   * Clear only manual cache
   */
  static async clearManualCache() {
    this.manualLocationCache.clear();

    try {
      await AsyncStorage.removeItem('manual_location_cache');
      console.log('🗑️ Manual location cache cleared');
    } catch (error) {
      console.error('❌ Error clearing manual cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      hasGPSCache: this.memoryCache.has('gps_current'),
      hasManualCache: this.manualLocationCache.has('manual_current'),
      lastCacheTime: this.lastCacheTime,
      memoryCacheSize: this.memoryCache.size,
      manualCacheSize: this.manualLocationCache.size
    };
  }

  /**
   * Check if GPS cache is fresh (< 2 minutes)
   */
  static async hasRecentGPSLocation() {
    const cached = await this.getCachedGPSLocation(this.CACHE_VALIDITY.GPS_FRESH);
    return cached !== null;
  }

  /**
   * Get location info summary for debugging
   */
  static async getLocationSummary() {
    const gpsLocation = await this.getCachedGPSLocation();
    const manualLocation = await this.getCachedManualLocation();

    return {
      gps: gpsLocation ? {
        coordinates: `${gpsLocation.latitude.toFixed(4)}, ${gpsLocation.longitude.toFixed(4)}`,
        age: Math.round(gpsLocation.cacheAge / 1000),
        accuracy: gpsLocation.accuracy,
        source: gpsLocation.source
      } : null,
      manual: manualLocation ? {
        coordinates: `${manualLocation.latitude.toFixed(4)}, ${manualLocation.longitude.toFixed(4)}`,
        address: manualLocation.address,
        age: Math.round(manualLocation.cacheAge / 1000 / 60),
        source: manualLocation.source
      } : null,
      stats: this.getCacheStats()
    };
  }
}

export default SimplifiedLocationCache;