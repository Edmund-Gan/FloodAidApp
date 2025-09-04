// services/LocationCache.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class LocationCache {
  static memoryCache = new Map();
  static stateCache = new Map();
  static requestCache = new Map();

  // Cache validity periods (in milliseconds)
  static CACHE_PERIODS = {
    ULTRA_FRESH: 5 * 1000,        // 5 seconds - for rapid successive calls
    FRESH: 2 * 60 * 1000,         // 2 minutes - for normal operations  
    VALID: 10 * 60 * 1000,        // 10 minutes - for background operations
    STALE_ACCEPTABLE: 30 * 60 * 1000  // 30 minutes - for offline/poor GPS
  };

  // Malaysian state coordinate boundaries (optimized ranges)
  static STATE_BOUNDARIES = {
    'Selangor': { latMin: 2.6, latMax: 3.9, lonMin: 100.8, lonMax: 102.2 },
    'Kuala Lumpur': { latMin: 3.0, latMax: 3.3, lonMin: 101.5, lonMax: 101.8 },
    'Putrajaya': { latMin: 2.85, latMax: 3.0, lonMin: 101.6, lonMax: 101.8 },
    'Johor': { latMin: 1.2, latMax: 2.8, lonMin: 102.3, lonMax: 104.8 },
    'Kedah': { latMin: 5.0, latMax: 6.8, lonMin: 99.8, lonMax: 101.2 },
    'Kelantan': { latMin: 4.5, latMax: 6.3, lonMin: 101.3, lonMax: 102.8 },
    'Melaka': { latMin: 2.0, latMax: 2.4, lonMin: 102.0, lonMax: 102.6 },
    'Negeri Sembilan': { latMin: 2.3, latMax: 3.0, lonMin: 101.4, lonMax: 102.8 },
    'Pahang': { latMin: 2.8, latMax: 4.8, lonMin: 101.4, lonMax: 103.8 },
    'Penang': { latMin: 5.2, latMax: 5.6, lonMin: 100.1, lonMax: 100.6 },
    'Perak': { latMin: 3.7, latMax: 5.7, lonMin: 100.4, lonMax: 102.2 },
    'Perlis': { latMin: 6.3, latMax: 6.8, lonMin: 100.0, lonMax: 100.6 },
    'Sabah': { latMin: 4.0, latMax: 7.6, lonMin: 115.0, lonMax: 119.6 },
    'Sarawak': { latMin: 0.8, latMax: 5.2, lonMin: 109.3, lonMax: 115.7 },
    'Terengganu': { latMin: 4.0, latMax: 5.9, lonMin: 102.4, lonMax: 103.9 },
    'Labuan': { latMin: 5.2, latMax: 5.4, lonMin: 115.1, lonMax: 115.3 }
  };

  // Pre-computed major Malaysian cities
  static MAJOR_CITIES = {
    'Kuala Lumpur': { lat: 3.1390, lon: 101.6869, state: 'Kuala Lumpur' },
    'Puchong': { lat: 3.0738, lon: 101.5183, state: 'Selangor' },
    'Shah Alam': { lat: 3.0733, lon: 101.5185, state: 'Selangor' },
    'Petaling Jaya': { lat: 3.1073, lon: 101.6421, state: 'Selangor' },
    'Johor Bahru': { lat: 1.4927, lon: 103.7414, state: 'Johor' },
    'George Town': { lat: 5.4164, lon: 100.3327, state: 'Penang' },
    'Ipoh': { lat: 4.5975, lon: 101.0901, state: 'Perak' },
    'Kota Kinabalu': { lat: 5.9804, lon: 116.0735, state: 'Sabah' },
    'Kuching': { lat: 1.5533, lon: 110.3592, state: 'Sarawak' },
    'Malacca City': { lat: 2.2055, lon: 102.2501, state: 'Melaka' },
    'Alor Setar': { lat: 6.1248, lon: 100.3678, state: 'Kedah' },
    'Kuantan': { lat: 3.8077, lon: 103.3260, state: 'Pahang' }
  };

  /**
   * Get location from cache with tiered validity check
   */
  static async getLocationFromCache(cacheType = 'FRESH') {
    const now = Date.now();
    
    // Check memory cache first (fastest)
    for (const [key, data] of this.memoryCache.entries()) {
      if (key.startsWith('location_') && data.timestamp) {
        const age = now - data.timestamp;
        const maxAge = this.CACHE_PERIODS[cacheType];
        
        if (age < maxAge) {
          console.log(`⚡ Memory cache hit (${Math.round(age/1000)}s old, ${cacheType} validity)`);
          return {
            ...data,
            isCached: true,
            cacheAge: age,
            cacheType: 'memory'
          };
        }
      }
    }

    // Check AsyncStorage cache
    try {
      const cached = await AsyncStorage.getItem('cached_location');
      if (cached) {
        const location = JSON.parse(cached);
        const age = now - location.cacheTime;
        const maxAge = this.CACHE_PERIODS[cacheType];
        
        if (age < maxAge) {
          // Store in memory cache for next time
          this.memoryCache.set('location_current', {
            ...location,
            timestamp: location.cacheTime
          });
          
          console.log(`💾 Storage cache hit (${Math.round(age/1000)}s old, ${cacheType} validity)`);
          return {
            ...location,
            isCached: true,
            cacheAge: age,
            cacheType: 'storage'
          };
        }
      }
    } catch (error) {
      console.error('Error reading cache:', error);
    }
    
    return null;
  }

  /**
   * Cache location with both memory and storage
   */
  static async cacheLocation(location) {
    const now = Date.now();
    const cacheData = {
      ...location,
      cacheTime: now,
      timestamp: now
    };

    // Store in memory cache
    this.memoryCache.set('location_current', cacheData);

    // Store in AsyncStorage
    try {
      await AsyncStorage.setItem('cached_location', JSON.stringify(cacheData));
      console.log('📦 Location cached in memory and storage');
    } catch (error) {
      console.error('Error caching location:', error);
    }
  }

  /**
   * Get Malaysian state from coordinates using offline detection first
   */
  static getStateFromCoordinates(lat, lon) {
    console.log('🗺️ Using offline state detection...');
    
    // Check cache first
    const cacheKey = `state_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    if (this.stateCache.has(cacheKey)) {
      const cached = this.stateCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hour cache
        console.log('🔄 State cache hit:', cached.state);
        return cached.state;
      }
    }

    // Offline detection using coordinate boundaries
    for (const [state, bounds] of Object.entries(this.STATE_BOUNDARIES)) {
      if (lat >= bounds.latMin && lat <= bounds.latMax && 
          lon >= bounds.lonMin && lon <= bounds.lonMax) {
        
        // Cache the result
        this.stateCache.set(cacheKey, {
          state,
          timestamp: Date.now()
        });
        
        console.log(`🎯 Offline state detected: ${state}`);
        return state;
      }
    }
    
    console.log('❓ State could not be determined offline, defaulting to Selangor');
    return 'Selangor';
  }

  /**
   * Find nearest Malaysian location using pre-computed cities
   */
  static findNearestMalaysianLocation(lat, lon) {
    let nearestCity = null;
    let minDistance = Infinity;

    for (const [name, city] of Object.entries(this.MAJOR_CITIES)) {
      const distance = this.calculateDistance(lat, lon, city.lat, city.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = { ...city, name };
      }
    }

    console.log(`🎯 Nearest Malaysian city: ${nearestCity.name} (distance: ${minDistance.toFixed(2)} units)`);
    return nearestCity;
  }

  /**
   * Calculate distance between coordinates
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;
    return Math.sqrt(deltaLat * deltaLat + deltaLon * deltaLon);
  }

  /**
   * Check if coordinates are within Malaysia (optimized)
   */
  static isLocationInMalaysia(lat, lon) {
    // Quick bounds check for all of Malaysia
    if (lat < 0.8 || lat > 7.6 || lon < 99.5 || lon > 119.6) {
      return false;
    }

    // Check against all state boundaries
    for (const bounds of Object.values(this.STATE_BOUNDARIES)) {
      if (lat >= bounds.latMin && lat <= bounds.latMax &&
          lon >= bounds.lonMin && lon <= bounds.lonMax) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clean expired cache entries
   */
  static cleanExpiredCache() {
    const now = Date.now();
    const maxAge = this.CACHE_PERIODS.STALE_ACCEPTABLE;

    // Clean memory cache
    for (const [key, data] of this.memoryCache.entries()) {
      if (data.timestamp && (now - data.timestamp) > maxAge) {
        this.memoryCache.delete(key);
      }
    }

    // Clean state cache
    for (const [key, data] of this.stateCache.entries()) {
      if (now - data.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
        this.stateCache.delete(key);
      }
    }

    console.log('🧹 Expired cache entries cleaned');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      stateCacheSize: this.stateCache.size,
      requestCacheSize: this.requestCache.size
    };
  }

  /**
   * Clear all caches
   */
  static clearAllCaches() {
    this.memoryCache.clear();
    this.stateCache.clear();
    this.requestCache.clear();
    AsyncStorage.removeItem('cached_location');
    console.log('🗑️ All caches cleared');
  }
}

export default LocationCache;