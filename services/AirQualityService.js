/**
 * Air Quality Service
 * Connects React Native app to Python ML backend for air quality data
 * Implements WHO, EPA, and CDC safety thresholds for post-flood recovery
 */

import mlBackendService from './MLBackendService';

const REQUEST_TIMEOUT = 30000; // 30 seconds timeout

class AirQualityService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes cache
  }

  /**
   * Get current air quality data for a location from backend
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - Air quality data with safety assessment
   */
  async getAirQuality(latitude, longitude) {
    const cacheKey = `aq_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('AirQualityService: Returning cached data');
        return cached.data;
      }
    }

    try {
      console.log(`AirQualityService: Fetching air quality from backend for ${latitude}, ${longitude}`);

      const backendURL = mlBackendService.getBackendURL();
      console.log(`AirQualityService: Backend URL: ${backendURL}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const requestBody = {
        latitude: latitude,
        longitude: longitude
      };

      console.log(`AirQualityService: Sending request to ${backendURL}/api/air-quality`);

      const response = await fetch(`${backendURL}/api/air-quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`AirQualityService: Response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend responded with status ${response.status}`);
      }

      const data = await response.json();

      console.log(`AirQualityService: Response success: ${data.success}`);

      // Backend returns success:true for real data, success:false for mock data
      // Both are valid responses, just mark isMock if success:false
      if (data.success === false && !data.isMock) {
        throw new Error(data.error || 'Air quality fetch failed');
      }

      const pollutantCount = data.pollutants ? Object.keys(data.pollutants).length : 0;
      console.log(`✅ Air quality data fetched: ${data.overallSafety.level} (${pollutantCount} pollutants)`);

      // Cache the result
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now(),
      });

      return data;

    } catch (error) {
      console.error('AirQualityService: Error fetching air quality data:', error.message);

      // Check if it's a timeout error
      if (error.name === 'AbortError') {
        return this.getMockAirQualityData(latitude, longitude, 'Request timed out. Please check your connection.');
      }

      return this.getMockAirQualityData(latitude, longitude, error.message);
    }
  }

  /**
   * Generate mock air quality data (fallback when backend unavailable)
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {string} errorMessage - Error message from API call
   * @returns {Object} - Mock air quality data
   */
  getMockAirQualityData(latitude, longitude, errorMessage = 'Backend unavailable') {
    console.warn('AirQualityService: Returning mock data due to:', errorMessage);

    // Generate realistic mock values (within safe range)
    const mockReadings = {
      pm2_5: 10 + Math.random() * 15,        // 10-25 μg/m³ (safe range)
      pm10: 30 + Math.random() * 30,          // 30-60 μg/m³ (safe range)
      formaldehyde: 15 + Math.random() * 20,  // 15-35 μg/m³ (safe range)
      carbon_monoxide: 1145 + Math.random() * 8015, // 1145-9160 μg/m³ = 1-8 ppm (safe range)
      non_methane_volatile_organic_compounds: 150 + Math.random() * 150, // 150-300 μg/m³ (safe range)
    };

    const pollutants = {};

    // PM2.5
    pollutants.pm2_5 = {
      value: Math.round(mockReadings.pm2_5 * 10) / 10,
      unit: 'μg/m³',
      name: 'PM₂.₅',
      fullName: 'Fine Particulate Matter',
      safetyLevel: 'SAFE',
      safetyColor: '#4CAF50',
      standard: 'WHO',
      thresholds: {
        safe: 15,
        caution: 35,
        safeStandard: 'WHO',
        cautionStandard: 'EPA',
      },
    };

    // PM10
    pollutants.pm10 = {
      value: Math.round(mockReadings.pm10 * 10) / 10,
      unit: 'μg/m³',
      name: 'PM₁₀',
      fullName: 'Coarse Particulate Matter',
      safetyLevel: 'SAFE',
      safetyColor: '#4CAF50',
      standard: 'WHO',
      thresholds: {
        safe: 45,
        caution: 150,
        safeStandard: 'WHO',
        cautionStandard: 'EPA',
      },
    };

    // Formaldehyde
    pollutants.formaldehyde = {
      value: Math.round(mockReadings.formaldehyde * 10) / 10,
      unit: 'μg/m³',
      name: 'Formaldehyde',
      fullName: 'Formaldehyde',
      safetyLevel: 'SAFE',
      safetyColor: '#4CAF50',
      standard: 'CDC ATSDR',
      thresholds: {
        safe: 30,
        caution: 100,
        safeStandard: 'CDC ATSDR',
        cautionStandard: 'WHO',
      },
    };

    // Carbon Monoxide
    pollutants.carbon_monoxide = {
      value: Math.round(mockReadings.carbon_monoxide * 10) / 10,
      unit: 'μg/m³',
      name: 'CO',
      fullName: 'Carbon Monoxide',
      safetyLevel: 'SAFE',
      safetyColor: '#4CAF50',
      standard: 'WHO/EPA (9 ppm)',
      thresholds: {
        safe: 10305,
        caution: 40075,
        safeStandard: 'WHO/EPA (9 ppm)',
        cautionStandard: 'EPA (35 ppm)',
      },
    };

    // TVOC
    pollutants.non_methane_volatile_organic_compounds = {
      value: Math.round(mockReadings.non_methane_volatile_organic_compounds * 10) / 10,
      unit: 'μg/m³',
      name: 'TVOC',
      fullName: 'Total Volatile Organic Compounds',
      safetyLevel: 'SAFE',
      safetyColor: '#4CAF50',
      standard: 'WHO Europe',
      thresholds: {
        safe: 300,
        caution: 500,
        safeStandard: 'WHO Europe',
        cautionStandard: 'LEED/WELL',
      },
    };

    return {
      success: false,
      isMock: true,
      error: errorMessage,
      location: {
        latitude,
        longitude,
      },
      timestamp: new Date().toISOString(),
      overallSafety: {
        level: 'SAFE',
        color: '#4CAF50',
        message: 'OK to return home (Mock Data)',
        description: 'This is simulated data. Backend unavailable.',
        icon: 'checkmark-circle',
      },
      pollutants,
      recommendations: [
        'Air quality data is currently unavailable',
        'This is simulated data for demonstration purposes',
        'Ensure good ventilation during cleanup',
        'Monitor for any unusual odors or respiratory symptoms',
      ],
      source: 'Mock Data (Backend unavailable)',
    };
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    console.log('AirQualityService: Cache cleared');
  }

  /**
   * Get detailed threshold information for user education
   * @returns {Object} - Formatted threshold information
   */
  getThresholdInfo() {
    return {
      pm2_5: {
        name: 'PM₂.₅ (Fine Particulate Matter)',
        description: 'Particles smaller than 2.5 micrometers that can penetrate deep into lungs',
        safe: {
          value: 15,
          unit: 'μg/m³',
          standard: 'WHO (2021)',
          timeframe: '24-hour mean',
        },
        caution: {
          value: 35,
          unit: 'μg/m³',
          standard: 'EPA (2024)',
          timeframe: '24-hour mean',
        },
        unsafe: {
          value: '>35',
          unit: 'μg/m³',
          description: 'Exposure can aggravate heart and lung diseases',
        },
      },
      pm10: {
        name: 'PM₁₀ (Coarse Particulate Matter)',
        description: 'Particles smaller than 10 micrometers from dust, mold, and debris',
        safe: {
          value: 45,
          unit: 'μg/m³',
          standard: 'WHO (2021)',
          timeframe: '24-hour mean',
        },
        caution: {
          value: 150,
          unit: 'μg/m³',
          standard: 'EPA',
          timeframe: '24-hour mean',
        },
        unsafe: {
          value: '>150',
          unit: 'μg/m³',
          description: 'Can cause respiratory irritation and breathing difficulties',
        },
      },
      formaldehyde: {
        name: 'Formaldehyde (CH₂O)',
        description: 'Volatile organic compound released from wet building materials and mold',
        safe: {
          value: 30,
          unit: 'μg/m³',
          standard: 'CDC ATSDR',
          timeframe: '15-364 days',
        },
        caution: {
          value: 100,
          unit: 'μg/m³',
          standard: 'WHO (2010)',
          timeframe: '30-minute exposure',
        },
        unsafe: {
          value: '>100',
          unit: 'μg/m³',
          description: 'Can cause eye, nose, and throat irritation; may cause cancer',
        },
      },
      carbon_monoxide: {
        name: 'Carbon Monoxide (CO)',
        description: 'Odorless gas from generators, stoves, or stagnant water decomposition',
        safe: {
          value: 12,
          unit: 'μg/m³',
          standard: 'WHO/EPA',
          timeframe: '8-hour mean',
          note: '(9 ppm converted)',
        },
        caution: {
          value: 50,
          unit: 'μg/m³',
          standard: 'EPA',
          timeframe: '1-hour mean',
          note: '(35 ppm converted)',
        },
        unsafe: {
          value: '>50',
          unit: 'μg/m³',
          description: 'DANGEROUS: Can cause death. Evacuate immediately.',
        },
      },
      non_methane_volatile_organic_compounds: {
        name: 'TVOCs (Total Volatile Organic Compounds)',
        description: 'Chemicals evaporating from paints, cleaners, mold, and wet materials',
        safe: {
          value: 300,
          unit: 'μg/m³',
          standard: 'WHO Europe',
          timeframe: 'Target level',
        },
        caution: {
          value: 500,
          unit: 'μg/m³',
          standard: 'LEED/WELL',
          timeframe: 'Industry standard',
        },
        unsafe: {
          value: '>500',
          unit: 'μg/m³',
          description: 'Can cause headaches, dizziness, and respiratory issues',
        },
      },
    };
  }

  /**
   * Get backend URL being used
   * @returns {string} Backend URL
   */
  getBackendURL() {
    return mlBackendService.getBackendURL();
  }
}

// Create singleton instance
const airQualityService = new AirQualityService();

export default airQualityService;
