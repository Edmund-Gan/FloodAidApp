// services/EmergencyPlacesService.js
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Google Maps API Key from app configuration
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey ||
                            Constants.manifest?.extra?.googleMapsApiKey ||
                            'YOUR_GOOGLE_MAPS_API_KEY_HERE';

// Emergency service place types for Google Places API
const EMERGENCY_PLACE_TYPES = {
  emergency_medical: {
    types: ['hospital', 'emergency_room'],
    icon: 'medical',
    color: '#D32F2F',
    displayName: 'Emergency Medical',
    priority: 1,
    description: '24-hour emergency care, trauma centers',
    emergencyOnly: true
  },
  medical_care: {
    types: ['doctor', 'clinic', 'health'],
    icon: 'medical-outline',
    color: '#4CAF50',
    displayName: 'Medical Centers',
    priority: 2,
    description: 'Primary care, urgent care centers',
    emergencyOnly: false
  },
  police: {
    types: ['police'],
    icon: 'shield',
    color: '#1976D2',
    displayName: 'Police Stations',
    priority: 3,
    description: 'Law enforcement, emergency response',
    emergencyOnly: true
  },
  fire_rescue: {
    types: ['fire_station'],
    icon: 'flame',
    color: '#FF5722',
    displayName: 'Fire & Rescue',
    priority: 4,
    description: 'BOMBA, emergency rescue services',
    emergencyOnly: true
  },
  government_emergency: {
    types: ['local_government_office', 'city_hall'],
    icon: 'business',
    color: '#7B1FA2',
    displayName: 'Emergency Services',
    priority: 5,
    description: 'Civil Defence (APM), disaster management',
    emergencyOnly: true
  },
  evacuation_shelters: {
    types: ['school', 'community_center'],
    icon: 'home',
    color: '#9C27B0',
    displayName: 'Evacuation Centers',
    priority: 6,
    description: 'Designated emergency shelters',
    emergencyOnly: true
  },
  veterinary: {
    types: ['veterinary_care'],
    icon: 'paw',
    color: '#8BC34A',
    displayName: 'Veterinary Care',
    priority: 7,
    description: 'Pet emergency services',
    emergencyOnly: false
  },
  pharmacies: {
    types: ['pharmacy', 'drugstore'],
    icon: 'medical-outline',
    color: '#00BCD4',
    displayName: '24-Hour Pharmacies',
    priority: 8,
    description: 'Emergency medications, medical supplies',
    emergencyOnly: false
  },
  fuel: {
    types: ['gas_station'],
    icon: 'car',
    color: '#FF9800',
    displayName: 'Fuel Stations',
    priority: 9,
    description: 'Emergency transportation fuel',
    emergencyOnly: false
  },
  banking: {
    types: ['bank', 'atm'],
    icon: 'card',
    color: '#795548',
    displayName: 'ATMs & Banks',
    priority: 10,
    description: 'Emergency cash access',
    emergencyOnly: false
  }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const SEARCH_RADIUS = 5000; // 5km radius
const MAX_RESULTS = 20;

class EmergencyPlacesService {
  static performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    apiCalls: 0,
    averageResponseTime: 0,
    errorRate: 0
  };

  /**
   * Get user's current location with comprehensive error handling
   */
  static async getCurrentLocation() {
    try {
      // Check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        throw new Error('Location services are disabled. Please enable location services in your device settings.');
      }

      // Request permission
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status === 'denied') {
        if (canAskAgain) {
          throw new Error('Location permission required. Please grant location access to find nearby emergency services.');
        } else {
          throw new Error('Location permission denied. Please enable location access in Settings > FloodAid > Location.');
        }
      }

      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Get current position with timeout and fallback
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000, // 15 seconds timeout
        });
      } catch (timeoutError) {
        // Fallback to lower accuracy if high accuracy fails
        console.warn('High accuracy location failed, trying balanced accuracy:', timeoutError);
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
        });
      }

      // Validate coordinates
      if (!location || !location.coords) {
        throw new Error('Unable to get location coordinates');
      }

      const { latitude, longitude } = location.coords;

      // Basic validation of coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Invalid GPS coordinates received');
      }

      // Check if location is roughly in Malaysia (basic bounds check)
      const isInMalaysia = this.isLocationInMalaysia(latitude, longitude);
      if (!isInMalaysia) {
        console.warn('Location appears to be outside Malaysia. Results may be limited.');
      }

      return { latitude, longitude };
    } catch (error) {
      console.error('Error getting current location:', error);

      // Provide more specific error messages
      if (error.code === 'E_LOCATION_SERVICES_DISABLED') {
        throw new Error('Location services are disabled. Please enable them in your device settings.');
      } else if (error.code === 'E_LOCATION_UNAVAILABLE') {
        throw new Error('Unable to determine your location. Please check your GPS signal and try again.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Location request timed out. Please check your GPS signal and try again.');
      }

      throw error;
    }
  }

  /**
   * Basic check if coordinates are within Malaysia bounds
   */
  static isLocationInMalaysia(latitude, longitude) {
    // Rough bounds for Malaysia (including East Malaysia)
    const malaysianBounds = {
      north: 7.5,
      south: 0.5,
      east: 119.5,
      west: 99.5
    };

    return latitude >= malaysianBounds.south &&
           latitude <= malaysianBounds.north &&
           longitude >= malaysianBounds.west &&
           longitude <= malaysianBounds.east;
  }

  /**
   * Search for nearby emergency places using Google Places API
   */
  static async searchNearbyPlaces(placeType, userLocation, radius = SEARCH_RADIUS) {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      // Check cache first
      const cacheKey = `places_${placeType}_${userLocation.latitude}_${userLocation.longitude}_${radius}`;
      const cached = await this.getCachedResults(cacheKey);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        return cached;
      }

      const typeConfig = EMERGENCY_PLACE_TYPES[placeType];
      if (!typeConfig) {
        throw new Error(`Unknown place type: ${placeType}`);
      }

      // Search for each type in the configuration
      const allResults = [];

      for (const type of typeConfig.types) {
        const results = await this.searchPlacesByType(type, userLocation, radius);
        allResults.push(...results);
      }

      // Remove duplicates and sort by quality score and distance
      const uniqueResults = this.removeDuplicates(allResults);
      const sortedResults = uniqueResults
        .map(place => ({
          ...place,
          distance: this.calculateDistance(userLocation, place.geometry.location),
          category: typeConfig.displayName,
          icon: typeConfig.icon,
          color: typeConfig.color,
          emergencyOnly: typeConfig.emergencyOnly,
          description: typeConfig.description
        }))
        .sort((a, b) => {
          // First sort by quality score (higher is better)
          const scoreDiff = (b.quality_score || 0) - (a.quality_score || 0);
          if (Math.abs(scoreDiff) > 10) return scoreDiff;

          // Then by distance (closer is better)
          return a.distance - b.distance;
        })
        .slice(0, MAX_RESULTS);

      // Cache results
      await this.cacheResults(cacheKey, sortedResults);

      this.performanceMetrics.apiCalls++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      return sortedResults;
    } catch (error) {
      console.error(`Error searching for ${placeType}:`, error);
      this.performanceMetrics.errorRate =
        (this.performanceMetrics.errorRate * (this.performanceMetrics.totalRequests - 1) + 1) /
        this.performanceMetrics.totalRequests;
      throw error;
    }
  }

  /**
   * Search places by specific type using Google Places API with comprehensive error handling
   */
  static async searchPlacesByType(type, location, radius) {
    if (GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      // Return mock data for development when API key is not configured
      return this.getMockPlaces(type, location);
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
                `location=${location.latitude},${location.longitude}&` +
                `radius=${radius}&` +
                `type=${type}&` +
                `key=${GOOGLE_MAPS_API_KEY}`;

    try {
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle various API response statuses
      switch (data.status) {
        case 'OK':
          const results = data.results || [];
          return this.validateAndFilterResults(results, type);

        case 'ZERO_RESULTS':
          console.log(`No ${type} found near location`);
          return [];

        case 'OVER_QUERY_LIMIT':
          console.error('Google Places API quota exceeded');
          throw new Error('Emergency service search temporarily unavailable. Please try again later.');

        case 'REQUEST_DENIED':
          console.error('Google Places API request denied');
          throw new Error('Unable to access location services. Please check your connection.');

        case 'INVALID_REQUEST':
          console.error('Invalid request to Google Places API');
          return [];

        case 'UNKNOWN_ERROR':
          console.error('Unknown error from Google Places API');
          throw new Error('Location service temporarily unavailable. Please try again.');

        default:
          console.warn(`Places API returned unexpected status: ${data.status}`);
          return [];
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Places API request timed out');
        throw new Error('Search request timed out. Please check your internet connection.');
      }

      console.error('Error calling Places API:', error);

      // Return empty array for network errors to allow graceful degradation
      if (error.message.includes('Network request failed') ||
          error.message.includes('fetch')) {
        console.warn('Network error, returning empty results');
        return [];
      }

      throw error;
    }
  }

  /**
   * Validate and filter Google Places results
   */
  static validateAndFilterResults(results, type) {
    return results.filter(place => {
      // Basic validation
      if (!place.name || !place.geometry || !place.geometry.location) {
        return false;
      }

      // Filter out results that are clearly not emergency services
      const name = place.name.toLowerCase();
      const types = place.types || [];

      // Exclude residential, lodging, and clearly non-emergency places
      const excludeTypes = ['lodging', 'real_estate_agency', 'moving_company', 'storage'];
      if (excludeTypes.some(excludeType => types.includes(excludeType))) {
        return false;
      }

      // For medical searches, exclude beauty/spa services
      if (type === 'doctor' || type === 'health') {
        const excludeKeywords = ['spa', 'beauty', 'massage', 'wellness center', 'meditation'];
        if (excludeKeywords.some(keyword => name.includes(keyword))) {
          return false;
        }
      }

      // For hospital searches, prioritize actual hospitals
      if (type === 'hospital') {
        const hospitalKeywords = ['hospital', 'medical center', 'emergency', 'clinic'];
        if (!hospitalKeywords.some(keyword => name.includes(keyword))) {
          // If it doesn't have hospital keywords, check types
          if (!types.includes('hospital') && !types.includes('emergency_room')) {
            return false;
          }
        }
      }

      return true;
    }).map(place => ({
      ...place,
      // Add quality score for sorting
      quality_score: this.calculatePlaceQualityScore(place, type)
    }));
  }

  /**
   * Calculate quality score for places to prioritize better results
   */
  static calculatePlaceQualityScore(place, type) {
    let score = 0;

    // Base score from rating
    if (place.rating) {
      score += place.rating * 10;
    }

    // Bonus for being currently open
    if (place.opening_hours?.open_now) {
      score += 20;
    }

    // Bonus for having many reviews (indicates legitimacy)
    if (place.user_ratings_total) {
      score += Math.min(place.user_ratings_total / 10, 30);
    }

    // Type-specific bonuses
    const types = place.types || [];
    if (type === 'hospital' && types.includes('emergency_room')) {
      score += 50; // Prioritize emergency rooms
    }

    if (type === 'pharmacy' && place.name.toLowerCase().includes('24')) {
      score += 30; // Prioritize 24-hour pharmacies
    }

    return score;
  }

  /**
   * Get all emergency services near user location
   */
  static async getAllEmergencyServices(userLocation) {
    try {
      const results = {};

      for (const [key, config] of Object.entries(EMERGENCY_PLACE_TYPES)) {
        try {
          const places = await this.searchNearbyPlaces(key, userLocation);
          if (places.length > 0) {
            results[key] = {
              places,
              config,
              count: places.length
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch ${key}:`, error);
          results[key] = {
            places: [],
            config,
            count: 0,
            error: error.message
          };
        }
      }

      return results;
    } catch (error) {
      console.error('Error getting all emergency services:', error);
      throw error;
    }
  }

  /**
   * Open Google Maps directions to a specific place
   */
  static async openDirections(place, userLocation, mode = 'driving') {
    try {
      const destination = `${place.geometry.location.lat},${place.geometry.location.lng}`;
      const origin = userLocation ? `${userLocation.latitude},${userLocation.longitude}` : '';

      // Google Maps URL scheme
      const url = `https://www.google.com/maps/dir/?api=1&` +
                  `origin=${origin}&` +
                  `destination=${destination}&` +
                  `travelmode=${mode}`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        throw new Error('Cannot open Google Maps');
      }
    } catch (error) {
      console.error('Error opening directions:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points in kilometers
   */
  static calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degToRad(point2.lat - point1.latitude);
    const dLon = this.degToRad(point2.lng - point1.longitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.degToRad(point1.latitude)) * Math.cos(this.degToRad(point2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  static degToRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Format distance for display
   */
  static formatDistance(distance) {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else {
      return `${distance.toFixed(1)}km`;
    }
  }

  /**
   * Remove duplicate places based on place_id or name similarity
   */
  static removeDuplicates(places) {
    const seen = new Set();
    return places.filter(place => {
      const key = place.place_id || place.name.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Cache search results
   */
  static async cacheResults(key, results) {
    try {
      const cacheData = {
        results,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache results:', error);
    }
  }

  /**
   * Get cached search results
   */
  static async getCachedResults(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { results, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return results;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cached results:', error);
      return null;
    }
  }

  /**
   * Update average response time metric
   */
  static updateAverageResponseTime(responseTime) {
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const count = this.performanceMetrics.apiCalls;
    this.performanceMetrics.averageResponseTime =
      (currentAvg * (count - 1) + responseTime) / count;
  }

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Clear all cached results
   */
  static async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('places_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Mock data for development when API key is not configured
   */
  static getMockPlaces(type, location) {
    const mockData = {
      hospital: [
        {
          place_id: 'mock_hospital_1',
          name: 'Hospital Kuala Lumpur',
          geometry: {
            location: { lat: location.latitude + 0.008, lng: location.longitude + 0.012 }
          },
          rating: 4.3,
          user_ratings_total: 523,
          opening_hours: { open_now: true },
          types: ['hospital', 'emergency_room'],
          quality_score: 85
        },
        {
          place_id: 'mock_hospital_2',
          name: 'Pantai Hospital KL',
          geometry: {
            location: { lat: location.latitude - 0.015, lng: location.longitude + 0.018 }
          },
          rating: 4.5,
          user_ratings_total: 342,
          opening_hours: { open_now: true },
          types: ['hospital'],
          quality_score: 80
        }
      ],
      emergency_room: [
        {
          place_id: 'mock_emergency_1',
          name: 'HUKM Emergency Department',
          geometry: {
            location: { lat: location.latitude + 0.012, lng: location.longitude - 0.008 }
          },
          rating: 4.1,
          user_ratings_total: 234,
          opening_hours: { open_now: true },
          types: ['hospital', 'emergency_room'],
          quality_score: 90
        }
      ],
      doctor: [
        {
          place_id: 'mock_clinic_1',
          name: 'Klinik Kesihatan Bangsar',
          geometry: {
            location: { lat: location.latitude - 0.005, lng: location.longitude + 0.008 }
          },
          rating: 4.0,
          user_ratings_total: 156,
          opening_hours: { open_now: true },
          types: ['clinic', 'doctor'],
          quality_score: 65
        },
        {
          place_id: 'mock_clinic_2',
          name: '1Malaysia Clinic TTDI',
          geometry: {
            location: { lat: location.latitude + 0.018, lng: location.longitude - 0.012 }
          },
          rating: 3.9,
          user_ratings_total: 89,
          opening_hours: { open_now: false },
          types: ['clinic', 'health'],
          quality_score: 60
        }
      ],
      police: [
        {
          place_id: 'mock_police_1',
          name: 'Dang Wangi Police Station',
          geometry: {
            location: { lat: location.latitude + 0.005, lng: location.longitude - 0.01 }
          },
          rating: 3.8,
          user_ratings_total: 67,
          types: ['police'],
          quality_score: 70
        },
        {
          place_id: 'mock_police_2',
          name: 'Balai Polis Brickfields',
          geometry: {
            location: { lat: location.latitude - 0.008, lng: location.longitude - 0.015 }
          },
          rating: 3.6,
          user_ratings_total: 45,
          types: ['police'],
          quality_score: 65
        }
      ],
      fire_station: [
        {
          place_id: 'mock_fire_1',
          name: 'BOMBA Kuala Lumpur',
          geometry: {
            location: { lat: location.latitude - 0.01, lng: location.longitude - 0.005 }
          },
          rating: 4.2,
          user_ratings_total: 123,
          types: ['fire_station'],
          quality_score: 75
        }
      ],
      local_government_office: [
        {
          place_id: 'mock_gov_1',
          name: 'APM Wilayah Persekutuan',
          geometry: {
            location: { lat: location.latitude + 0.015, lng: location.longitude + 0.005 }
          },
          rating: 3.5,
          user_ratings_total: 34,
          types: ['local_government_office'],
          quality_score: 55
        }
      ],
      school: [
        {
          place_id: 'mock_school_1',
          name: 'SMK Bangsar',
          geometry: {
            location: { lat: location.latitude - 0.012, lng: location.longitude + 0.010 }
          },
          rating: 4.0,
          user_ratings_total: 78,
          types: ['school'],
          quality_score: 50
        }
      ],
      community_center: [
        {
          place_id: 'mock_community_1',
          name: 'Dewan Komuniti Bangsar',
          geometry: {
            location: { lat: location.latitude + 0.020, lng: location.longitude - 0.008 }
          },
          rating: 3.8,
          user_ratings_total: 23,
          types: ['community_center'],
          quality_score: 45
        }
      ],
      veterinary_care: [
        {
          place_id: 'mock_vet_1',
          name: 'Animal Hospital PJ',
          geometry: {
            location: { lat: location.latitude - 0.025, lng: location.longitude + 0.020 }
          },
          rating: 4.4,
          user_ratings_total: 156,
          opening_hours: { open_now: true },
          types: ['veterinary_care'],
          quality_score: 70
        }
      ],
      pharmacy: [
        {
          place_id: 'mock_pharmacy_1',
          name: 'Guardian Pharmacy 24 Hours',
          geometry: {
            location: { lat: location.latitude + 0.006, lng: location.longitude + 0.008 }
          },
          rating: 4.1,
          user_ratings_total: 234,
          opening_hours: { open_now: true },
          types: ['pharmacy'],
          quality_score: 85
        },
        {
          place_id: 'mock_pharmacy_2',
          name: 'Farmasi Bukit Bintang',
          geometry: {
            location: { lat: location.latitude - 0.008, lng: location.longitude + 0.012 }
          },
          rating: 3.9,
          user_ratings_total: 98,
          opening_hours: { open_now: false },
          types: ['pharmacy'],
          quality_score: 60
        }
      ],
      gas_station: [
        {
          place_id: 'mock_gas_1',
          name: 'Petronas Bangsar',
          geometry: {
            location: { lat: location.latitude + 0.009, lng: location.longitude - 0.015 }
          },
          rating: 4.0,
          user_ratings_total: 167,
          opening_hours: { open_now: true },
          types: ['gas_station'],
          quality_score: 70
        }
      ],
      bank: [
        {
          place_id: 'mock_bank_1',
          name: 'Maybank KL Sentral',
          geometry: {
            location: { lat: location.latitude - 0.018, lng: location.longitude - 0.005 }
          },
          rating: 3.7,
          user_ratings_total: 89,
          opening_hours: { open_now: false },
          types: ['bank'],
          quality_score: 55
        }
      ],
      atm: [
        {
          place_id: 'mock_atm_1',
          name: 'CIMB ATM Pavilion',
          geometry: {
            location: { lat: location.latitude + 0.003, lng: location.longitude + 0.005 }
          },
          rating: 3.5,
          user_ratings_total: 23,
          opening_hours: { open_now: true },
          types: ['atm'],
          quality_score: 40
        }
      ]
    };

    return mockData[type] || [];
  }

  /**
   * Get emergency place types configuration
   */
  static getPlaceTypes() {
    return EMERGENCY_PLACE_TYPES;
  }

  /**
   * Get only emergency-critical services (filters out non-emergency services)
   */
  static getEmergencyOnlyServices(allServices) {
    const emergencyServices = {};

    for (const [key, data] of Object.entries(allServices)) {
      const config = EMERGENCY_PLACE_TYPES[key];
      if (config?.emergencyOnly) {
        emergencyServices[key] = data;
      }
    }

    return emergencyServices;
  }

  /**
   * Add emergency context warnings to places
   */
  static addEmergencyContextWarnings(places, userLocation) {
    return places.map(place => {
      const warnings = [];

      // Check if location is in Malaysia
      if (!this.isLocationInMalaysia(userLocation.latitude, userLocation.longitude)) {
        warnings.push('Results may be limited outside Malaysia');
      }

      // Check distance warnings
      if (place.distance > 10) {
        warnings.push('Very far - consider closer alternatives');
      } else if (place.distance > 5) {
        warnings.push('Relatively far distance');
      }

      // Check if place is open
      if (place.opening_hours && !place.opening_hours.open_now) {
        warnings.push('Currently closed');
      }

      return {
        ...place,
        emergency_warnings: warnings
      };
    });
  }

  /**
   * Check if place is currently open (if opening hours available)
   */
  static isPlaceOpen(place) {
    return place.opening_hours?.open_now || null;
  }

  /**
   * Get place details including phone number if available
   */
  static getPlacePhoneNumber(place) {
    // This would require a Place Details API call in production
    // For now, return null as phone numbers aren't in nearby search results
    return null;
  }
}

export default EmergencyPlacesService;