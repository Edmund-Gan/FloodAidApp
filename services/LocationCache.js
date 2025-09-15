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

  // Progressive enhancement tracking
  static enhancementCallbacks = new Set();
  static lastEnhancement = null;

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

    // Check if this is an enhancement (better accuracy/newer source)
    const isEnhancement = this.isLocationEnhancement(cacheData);

    // Store in memory cache
    this.memoryCache.set('location_current', cacheData);

    // Store in AsyncStorage
    try {
      await AsyncStorage.setItem('cached_location', JSON.stringify(cacheData));
      console.log(`📦 Location cached in memory and storage${isEnhancement ? ' (enhancement)' : ''}`);

      // Notify enhancement callbacks if this is an improvement
      if (isEnhancement) {
        this.notifyEnhancementCallbacks(cacheData);
        this.lastEnhancement = cacheData;
      }
    } catch (error) {
      console.error('Error caching location:', error);
    }
  }

  /**
   * Check if new location is an enhancement over current cached location
   */
  static isLocationEnhancement(newLocation) {
    const current = this.memoryCache.get('location_current');
    if (!current) return true;

    // Consider it an enhancement if:
    // 1. Better accuracy (lower accuracy value)
    // 2. More recent timestamp
    // 3. Higher confidence source
    // 4. Fused location with multiple sources

    const sourceWeights = {
      'MANUAL_SELECTED': 15,     // User-selected locations have highest priority
      'MANUAL_GEOCODED': 14,     // Geocoded manual addresses
      'GPS_ACCURATE': 12,
      'FUSED': 11,
      'GPS': 10,
      'MANUAL_SUGGESTION': 8,    // Pre-defined location suggestions
      'NETWORK': 6,
      'IP_GEOLOCATION': 4,
      'MANUAL_REUSED': 3,        // Previously used manual locations
      'CACHED': 2
    };

    const currentWeight = sourceWeights[current.source] || 5;
    const newWeight = sourceWeights[newLocation.source] || 5;

    // Better source type
    if (newWeight > currentWeight) return true;

    // Same source type but better accuracy
    if (newWeight === currentWeight) {
      if (newLocation.accuracy && current.accuracy) {
        return newLocation.accuracy < current.accuracy;
      }

      // More recent for same source
      if (newLocation.timestamp > current.timestamp + 60000) { // 1 minute newer
        return true;
      }
    }

    // Fused location with multiple sources
    if (newLocation.isFused && newLocation.sourceCount > 1) {
      return true;
    }

    return false;
  }

  /**
   * Add callback for location enhancements
   */
  static addEnhancementCallback(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Enhancement callback must be a function');
    }
    this.enhancementCallbacks.add(callback);
    console.log(`📍 Added location enhancement callback (${this.enhancementCallbacks.size} total)`);
  }

  /**
   * Remove enhancement callback
   */
  static removeEnhancementCallback(callback) {
    const removed = this.enhancementCallbacks.delete(callback);
    if (removed) {
      console.log(`📍 Removed location enhancement callback (${this.enhancementCallbacks.size} remaining)`);
    }
  }

  /**
   * Notify all enhancement callbacks
   */
  static notifyEnhancementCallbacks(enhancedLocation) {
    if (this.enhancementCallbacks.size === 0) return;

    console.log(`📍 Notifying ${this.enhancementCallbacks.size} enhancement callbacks`);

    this.enhancementCallbacks.forEach(callback => {
      try {
        callback(enhancedLocation);
      } catch (error) {
        console.error('Error in enhancement callback:', error);
      }
    });
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
   * Check if location is from manual input
   */
  static isManualLocation(location) {
    if (!location || !location.source) return false;

    const manualSources = [
      'MANUAL_SELECTED',
      'MANUAL_GEOCODED',
      'MANUAL_SUGGESTION',
      'MANUAL_REUSED'
    ];

    return manualSources.includes(location.source);
  }

  /**
   * Get location source display name
   */
  static getSourceDisplayName(source) {
    const sourceNames = {
      'MANUAL_SELECTED': 'Manually Selected',
      'MANUAL_GEOCODED': 'Address Search',
      'MANUAL_SUGGESTION': 'Quick Select',
      'MANUAL_REUSED': 'Previous Location',
      'GPS_ACCURATE': 'High-Accuracy GPS',
      'GPS': 'GPS',
      'FUSED': 'Multiple Sources',
      'NETWORK': 'Network Location',
      'IP_GEOLOCATION': 'IP Location',
      'CACHED': 'Cached Location'
    };

    return sourceNames[source] || 'Unknown Source';
  }

  /**
   * Store manual location preference
   */
  static async storeManualLocationPreference(location) {
    try {
      await AsyncStorage.setItem('manual_location_preference', JSON.stringify({
        ...location,
        storedAt: Date.now()
      }));
      console.log('💾 Manual location preference stored');
    } catch (error) {
      console.error('Error storing manual location preference:', error);
    }
  }

  /**
   * Get manual location preference
   */
  static async getManualLocationPreference() {
    try {
      const stored = await AsyncStorage.getItem('manual_location_preference');
      if (stored) {
        const preference = JSON.parse(stored);
        // Check if preference is less than 30 days old
        const age = Date.now() - preference.storedAt;
        if (age < 30 * 24 * 60 * 60 * 1000) {
          console.log('📖 Retrieved manual location preference');
          return preference;
        } else {
          console.log('⏰ Manual location preference expired, removing');
          await AsyncStorage.removeItem('manual_location_preference');
        }
      }
    } catch (error) {
      console.error('Error retrieving manual location preference:', error);
    }
    return null;
  }

  /**
   * Clear all caches including manual preferences
   */
  static clearAllCaches() {
    this.memoryCache.clear();
    this.stateCache.clear();
    this.requestCache.clear();
    this.enhancementCallbacks.clear();
    this.lastEnhancement = null;
    AsyncStorage.removeItem('cached_location');
    AsyncStorage.removeItem('manual_location_preference');
    console.log('🗑️ All caches and manual preferences cleared');
  }
}

export default LocationCache;