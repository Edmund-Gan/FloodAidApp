import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationCache from './LocationCache';

class IPGeolocationService {
  static cache = new Map();
  static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  static FALLBACK_SERVICES = [
    {
      name: 'ipapi',
      url: 'http://ip-api.com/json/',
      timeout: 3000,
      parseResponse: (data) => ({
        lat: data.lat,
        lon: data.lon,
        city: data.city,
        region: data.regionName,
        country: data.country,
        accuracy: 10000 // City-level accuracy
      })
    },
    {
      name: 'ipinfo',
      url: 'https://ipinfo.io/json',
      timeout: 3000,
      parseResponse: (data) => {
        const [lat, lon] = data.loc ? data.loc.split(',').map(Number) : [null, null];
        return {
          lat,
          lon,
          city: data.city,
          region: data.region,
          country: data.country,
          accuracy: 15000
        };
      }
    },
    {
      name: 'geolocation-db',
      url: 'https://geolocation-db.com/json/',
      timeout: 4000,
      parseResponse: (data) => ({
        lat: data.latitude,
        lon: data.longitude,
        city: data.city,
        region: data.state,
        country: data.country_name,
        accuracy: 20000
      })
    }
  ];

  static async getIPLocation(options = {}) {
    const {
      useCache = true,
      timeout = 5000,
      priority = 'speed' // 'speed' or 'accuracy'
    } = options;

    const requestId = Date.now();
    console.log(`🌐 IPGeolocationService [${requestId}]: Getting IP-based location (priority: ${priority})`);

    try {
      if (useCache) {
        const cached = await this.getCachedIPLocation();
        if (cached) {
          console.log(`⚡ [${requestId}]: Using cached IP location`);
          return { ...cached, isCached: true, source: 'IP_CACHE' };
        }
      }

      const location = await this.fetchIPLocationFromServices(requestId, timeout, priority);

      if (location && location.lat && location.lon) {
        await this.cacheIPLocation(location);
        console.log(`✅ [${requestId}]: IP location acquired: ${location.city}, ${location.region}`);
        return { ...location, source: 'IP_GEOLOCATION' };
      }

      throw new Error('No valid IP location data received');

    } catch (error) {
      console.error(`❌ [${requestId}]: IP geolocation failed:`, error.message);

      // No more automatic fallbacks - throw error for manual input
      throw new Error('IP geolocation failed. Manual location input required.');
    }
  }

  static async fetchIPLocationFromServices(requestId, timeout, priority) {
    const services = priority === 'speed'
      ? this.FALLBACK_SERVICES
      : [...this.FALLBACK_SERVICES].reverse(); // Try more accurate services first

    console.log(`🔄 [${requestId}]: Trying ${services.length} IP geolocation services`);

    const promises = services.map(service =>
      this.fetchFromService(service, requestId).catch(error => {
        console.log(`🌐 [${requestId}]: ${service.name} failed: ${error.message}`);
        return null;
      })
    );

    if (priority === 'speed') {
      // Return first successful response
      try {
        const result = await Promise.any(promises);
        return result;
      } catch (error) {
        console.log(`❌ [${requestId}]: All IP services failed in speed mode`);
        return null;
      }
    } else {
      // Try services sequentially for better accuracy
      for (const service of services) {
        try {
          const result = await this.fetchFromService(service, requestId);
          if (result && result.lat && result.lon) {
            return result;
          }
        } catch (error) {
          console.log(`🌐 [${requestId}]: ${service.name} failed: ${error.message}`);
        }
      }
      return null;
    }
  }

  static async fetchFromService(service, requestId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), service.timeout);

    try {
      console.log(`🌐 [${requestId}]: Trying ${service.name}...`);

      const response = await fetch(service.url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const location = service.parseResponse(data);

      if (!location.lat || !location.lon) {
        throw new Error('Invalid coordinates in response');
      }

      // Validate coordinates are reasonable
      if (Math.abs(location.lat) > 90 || Math.abs(location.lon) > 180) {
        throw new Error('Invalid coordinate values');
      }

      console.log(`✅ [${requestId}]: ${service.name} succeeded`);
      return {
        ...location,
        timestamp: Date.now(),
        provider: service.name
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`${service.name}: ${error.message}`);
    }
  }

  static async getCachedIPLocation() {
    try {
      // Check memory cache first
      const memoryKey = 'ip_location';
      if (this.cache.has(memoryKey)) {
        const cached = this.cache.get(memoryKey);
        if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
          return cached;
        }
        this.cache.delete(memoryKey);
      }

      // Check AsyncStorage cache
      const stored = await AsyncStorage.getItem('ip_location_cache');
      if (stored) {
        const cached = JSON.parse(stored);
        if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
          // Store in memory for next time
          this.cache.set(memoryKey, cached);
          return cached;
        }
        // Remove expired cache
        await AsyncStorage.removeItem('ip_location_cache');
      }

    } catch (error) {
      console.error('Error reading IP location cache:', error);
    }

    return null;
  }

  static async cacheIPLocation(location) {
    try {
      const cacheData = {
        ...location,
        timestamp: Date.now()
      };

      // Store in memory
      this.cache.set('ip_location', cacheData);

      // Store in AsyncStorage
      await AsyncStorage.setItem('ip_location_cache', JSON.stringify(cacheData));

      console.log('📦 IP location cached successfully');
    } catch (error) {
      console.error('Error caching IP location:', error);
    }
  }

  static async getQuickLocation() {
    console.log('⚡ IPGeolocationService: Getting quick IP location...');

    try {
      // Try memory cache first (instant)
      const cached = this.cache.get('ip_location');
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log('⚡ Using memory cached IP location');
        return { ...cached, source: 'IP_MEMORY_CACHE' };
      }

      // Try fastest service with short timeout
      const quickService = this.FALLBACK_SERVICES[0]; // ip-api is usually fastest
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // Very short timeout

      try {
        const response = await fetch(quickService.url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const location = quickService.parseResponse(data);

          if (location.lat && location.lon) {
            const enrichedLocation = {
              ...location,
              timestamp: Date.now(),
              provider: quickService.name,
              source: 'IP_QUICK'
            };

            // Cache it
            this.cache.set('ip_location', enrichedLocation);

            console.log('⚡ Quick IP location acquired');
            return enrichedLocation;
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.log('⚡ Quick IP location failed, using fallback');
      }

      // No more fallbacks - throw error
      throw new Error('Quick IP location failed. Manual location input required.');

    } catch (error) {
      console.error('Error in quick IP location:', error);
      throw new Error('IP geolocation service unavailable. Manual location input required.');
    }
  }

  static async validateLocationInMalaysia(location) {
    if (!location || !location.lat || !location.lon) {
      return false;
    }

    // Check if coordinates are within Malaysia bounds
    const isInMalaysia = LocationCache.isLocationInMalaysia(location.lat, location.lon);

    if (!isInMalaysia) {
      console.log('🌐 IP location is outside Malaysia, finding nearest Malaysian city');
      const nearest = LocationCache.findNearestMalaysianLocation(location.lat, location.lon);

      return {
        ...location,
        originalLat: location.lat,
        originalLon: location.lon,
        lat: nearest.lat,
        lon: nearest.lon,
        city: nearest.name,
        region: nearest.state,
        isRedirected: true,
        redirectReason: 'Outside Malaysia boundaries'
      };
    }

    return location;
  }

  static clearCache() {
    this.cache.clear();
    AsyncStorage.removeItem('ip_location_cache');
    console.log('🗑️ IP geolocation cache cleared');
  }

  static getStats() {
    return {
      memoryCacheSize: this.cache.size,
      availableServices: this.FALLBACK_SERVICES.length,
      cacheAge: this.cache.has('ip_location')
        ? Date.now() - this.cache.get('ip_location').timestamp
        : null
    };
  }
}

export default IPGeolocationService;