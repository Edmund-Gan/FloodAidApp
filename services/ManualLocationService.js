import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

class ManualLocationService {
  static GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || 'fallback-key-not-configured';
  static STORAGE_KEY = 'manual_location_preference';
  static LAST_LOCATION_KEY = 'last_manual_location';

  /**
   * Convert address to coordinates using Google Maps Geocoding API
   */
  static async geocodeAddress(address) {
    if (!address || address.trim().length < 3) {
      throw new Error('Address must be at least 3 characters long');
    }

    const requestId = Date.now();
    console.log(`🗺️ ManualLocationService [${requestId}]: Geocoding address: "${address}"`);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
        `address=${encodeURIComponent(address)}&` +
        `key=${this.GOOGLE_MAPS_API_KEY}&` +
        `region=MY&` +
        `language=en`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`🗺️ [${requestId}]: Geocoding response status: ${data.status}`);

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];

        // Validate it's in Malaysia
        const isInMalaysia = this.isResultInMalaysia(result);
        if (!isInMalaysia) {
          throw new Error('Address is not located in Malaysia');
        }

        const location = {
          lat: result.geometry.location.lat,
          lon: result.geometry.location.lng,
          address: result.formatted_address,
          addressComponents: result.address_components,
          placeId: result.place_id,
          accuracy: this.getLocationAccuracy(result.geometry),
          timestamp: Date.now(),
          source: 'MANUAL_GEOCODED',
          verified: true
        };

        console.log(`✅ [${requestId}]: Successfully geocoded to: ${location.lat}, ${location.lon}`);
        return location;

      } else if (data.status === 'ZERO_RESULTS') {
        throw new Error('No locations found for this address in Malaysia');
      } else if (data.status === 'INVALID_REQUEST') {
        throw new Error('Invalid address format');
      } else if (data.status === 'REQUEST_DENIED') {
        throw new Error('Geocoding service unavailable');
      } else {
        throw new Error(`Geocoding failed: ${data.status}`);
      }

    } catch (error) {
      console.error(`❌ [${requestId}]: Geocoding failed:`, error.message);
      throw error;
    }
  }

  /**
   * Check if geocoding result is in Malaysia
   */
  static isResultInMalaysia(result) {
    // Check coordinates are in Malaysia bounds
    const lat = result.geometry.location.lat;
    const lng = result.geometry.location.lng;

    if (lat < 0.8 || lat > 7.6 || lng < 99.5 || lng > 119.6) {
      return false;
    }

    // Check address components for Malaysia
    const hasMalaysia = result.address_components.some(component =>
      component.types.includes('country') &&
      (component.short_name === 'MY' || component.long_name === 'Malaysia')
    );

    return hasMalaysia;
  }

  /**
   * Get estimated accuracy from geometry type
   */
  static getLocationAccuracy(geometry) {
    switch (geometry.location_type) {
      case 'ROOFTOP': return 10; // Building level
      case 'RANGE_INTERPOLATED': return 50; // Street level
      case 'GEOMETRIC_CENTER': return 100; // Area center
      case 'APPROXIMATE': return 1000; // City level
      default: return 500; // Default estimate
    }
  }

  /**
   * Save user's location preference
   */
  static async saveLocationPreference(preference) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        mode: preference.mode, // 'manual' or 'auto'
        location: preference.location,
        timestamp: Date.now()
      }));
      console.log(`💾 Saved location preference: ${preference.mode}`);
    } catch (error) {
      console.error('❌ Failed to save location preference:', error);
    }
  }

  /**
   * Get user's location preference
   */
  static async getLocationPreference() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const preference = JSON.parse(stored);
        console.log(`📖 Retrieved location preference: ${preference.mode}`);
        return preference;
      }
    } catch (error) {
      console.error('❌ Failed to retrieve location preference:', error);
    }
    return null;
  }

  /**
   * Save last manual location for quick reuse
   */
  static async saveLastManualLocation(location) {
    try {
      await AsyncStorage.setItem(this.LAST_LOCATION_KEY, JSON.stringify({
        ...location,
        savedAt: Date.now()
      }));
      console.log(`💾 Saved last manual location: ${location.address}`);
    } catch (error) {
      console.error('❌ Failed to save last manual location:', error);
    }
  }

  /**
   * Get last manual location
   */
  static async getLastManualLocation() {
    try {
      const stored = await AsyncStorage.getItem(this.LAST_LOCATION_KEY);
      if (stored) {
        const location = JSON.parse(stored);
        const age = Date.now() - location.savedAt;

        // Consider location valid for 30 days
        if (age < 30 * 24 * 60 * 60 * 1000) {
          console.log(`📖 Retrieved last manual location: ${location.address}`);
          return location;
        } else {
          console.log(`⏰ Last manual location is too old (${Math.round(age / (24 * 60 * 60 * 1000))} days)`);
          await this.clearLastManualLocation();
        }
      }
    } catch (error) {
      console.error('❌ Failed to retrieve last manual location:', error);
    }
    return null;
  }

  /**
   * Clear saved location preferences
   */
  static async clearLocationPreference() {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Cleared location preference');
    } catch (error) {
      console.error('❌ Failed to clear location preference:', error);
    }
  }

  /**
   * Clear last manual location
   */
  static async clearLastManualLocation() {
    try {
      await AsyncStorage.removeItem(this.LAST_LOCATION_KEY);
      console.log('🗑️ Cleared last manual location');
    } catch (error) {
      console.error('❌ Failed to clear last manual location:', error);
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  static async reverseGeocode(lat, lon) {
    const requestId = Date.now();
    console.log(`🗺️ ManualLocationService [${requestId}]: Reverse geocoding: ${lat}, ${lon}`);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
        `latlng=${lat},${lon}&` +
        `key=${this.GOOGLE_MAPS_API_KEY}&` +
        `language=en`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];

        console.log(`✅ [${requestId}]: Reverse geocoded to: ${result.formatted_address}`);
        return {
          address: result.formatted_address,
          addressComponents: result.address_components,
          placeId: result.place_id,
          lat,
          lon,
          timestamp: Date.now(),
          source: 'REVERSE_GEOCODED'
        };
      } else {
        throw new Error(`Reverse geocoding failed: ${data.status}`);
      }

    } catch (error) {
      console.error(`❌ [${requestId}]: Reverse geocoding failed:`, error.message);
      throw error;
    }
  }

  /**
   * Validate if coordinates are reasonable for Malaysia
   */
  static validateMalaysianCoordinates(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return { valid: false, reason: 'Coordinates must be numbers' };
    }

    if (isNaN(lat) || isNaN(lon)) {
      return { valid: false, reason: 'Invalid coordinate values' };
    }

    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { valid: false, reason: 'Coordinates out of global bounds' };
    }

    if (lat < 0.8 || lat > 7.6 || lon < 99.5 || lon > 119.6) {
      return { valid: false, reason: 'Coordinates are outside Malaysia' };
    }

    return { valid: true };
  }

  /**
   * Get suggested locations for quick selection
   */
  static getSuggestedLocations() {
    return [
      {
        name: 'Kuala Lumpur City Centre',
        address: 'Kuala Lumpur City Centre, Kuala Lumpur, Malaysia',
        lat: 3.1390,
        lon: 101.6869,
        type: 'city'
      },
      {
        name: 'Petaling Jaya',
        address: 'Petaling Jaya, Selangor, Malaysia',
        lat: 3.1073,
        lon: 101.6421,
        type: 'city'
      },
      {
        name: 'Shah Alam',
        address: 'Shah Alam, Selangor, Malaysia',
        lat: 3.0733,
        lon: 101.5185,
        type: 'city'
      },
      {
        name: 'Johor Bahru',
        address: 'Johor Bahru, Johor, Malaysia',
        lat: 1.4927,
        lon: 103.7414,
        type: 'city'
      },
      {
        name: 'George Town',
        address: 'George Town, Penang, Malaysia',
        lat: 5.4164,
        lon: 100.3327,
        type: 'city'
      }
    ];
  }

  /**
   * Clear all manual location data
   */
  static async clearAllData() {
    await Promise.all([
      this.clearLocationPreference(),
      this.clearLastManualLocation()
    ]);
    console.log('🗑️ Cleared all manual location data');
  }
}

export default ManualLocationService;