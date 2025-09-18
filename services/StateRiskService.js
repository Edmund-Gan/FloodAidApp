import FloodPredictionModel from './FloodPredictionModel';
import StateCoordinateLoader from './StateCoordinateLoader';
import { getRiskLevel, getRiskColor } from '../utils/RiskCalculations';

class StateRiskService {
  static stateRiskCache = null;
  static cacheTimestamp = null;
  static cacheTimeout = 30 * 60 * 1000; // 30 minutes
  static isCalculating = false;

  /**
   * Calculate flood risk for all Malaysian states
   * @param {boolean} forceRefresh - Force refresh of cached data
   * @returns {Promise<Object>} - State risk data mapped by state name
   */
  static async calculateAllStateRisks(forceRefresh = false) {
    // Check cache validity
    if (!forceRefresh && this.isCacheValid()) {
      console.log('🔄 StateRiskService: Using cached state risk data');
      return this.stateRiskCache;
    }

    // Prevent concurrent calculations
    if (this.isCalculating) {
      console.log('⏳ StateRiskService: Calculation in progress, waiting...');
      while (this.isCalculating) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return this.stateRiskCache || {};
    }

    this.isCalculating = true;

    try {
      console.log('🗺️ StateRiskService: Starting flood risk calculation for all states...');

      // Load state coordinates
      const stateCoordinates = await StateCoordinateLoader.getAllStateCoordinates();
      const stateNames = Object.keys(stateCoordinates);

      console.log(`📍 StateRiskService: Processing ${stateNames.length} states...`);

      // Calculate risks concurrently with rate limiting
      const stateRisks = await this.calculateRisksConcurrently(stateCoordinates);

      // Cache the results
      this.stateRiskCache = stateRisks;
      this.cacheTimestamp = Date.now();

      console.log(`✅ StateRiskService: Completed risk calculation for ${Object.keys(stateRisks).length} states`);

      return stateRisks;

    } catch (error) {
      console.error('❌ StateRiskService: Failed to calculate state risks:', error);

      // Return cached data if available, otherwise return fallback
      if (this.stateRiskCache) {
        console.log('🔄 StateRiskService: Returning cached data due to error');
        return this.stateRiskCache;
      }

      // Return fallback risks for major states
      return this.getFallbackStateRisks();

    } finally {
      this.isCalculating = false;
    }
  }

  /**
   * Calculate risks for all states with concurrency control
   * @param {Object} stateCoordinates - Coordinates for all states
   * @returns {Promise<Object>} - Risk data for all states
   */
  static async calculateRisksConcurrently(stateCoordinates) {
    const stateRisks = {};
    const concurrencyLimit = 3; // Process 3 states at a time
    const stateEntries = Object.entries(stateCoordinates);

    // Process states in batches
    for (let i = 0; i < stateEntries.length; i += concurrencyLimit) {
      const batch = stateEntries.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(([stateName, coordinates]) =>
        this.calculateSingleStateRisk(stateName, coordinates)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Process batch results
      batchResults.forEach((result, index) => {
        const [stateName] = batch[index];

        if (result.status === 'fulfilled') {
          stateRisks[stateName] = result.value;
        } else {
          console.warn(`StateRiskService: Failed to calculate risk for ${stateName}:`, result.reason);
          stateRisks[stateName] = this.getFallbackRiskForState(stateName);
        }
      });

      // Small delay between batches to avoid overwhelming the API
      if (i + concurrencyLimit < stateEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return stateRisks;
  }

  /**
   * Calculate flood risk for a single state
   * @param {string} stateName - Name of the state
   * @param {Object} coordinates - Latitude and longitude
   * @returns {Promise<Object>} - Risk data for the state
   */
  static async calculateSingleStateRisk(stateName, coordinates) {
    try {
      console.log(`🔍 StateRiskService: Calculating risk for ${stateName}...`);

      const { latitude, longitude } = coordinates;

      // Use the existing ML model to get prediction
      const prediction = await FloodPredictionModel.getPredictionWithML(latitude, longitude, false);

      if (!prediction || prediction.flood_probability === undefined) {
        throw new Error('Invalid prediction data received');
      }

      // Extract key data
      const floodProbability = prediction.flood_probability;
      const riskLevel = getRiskLevel(floodProbability);
      const riskColor = getRiskColor(floodProbability);

      const riskData = {
        stateName,
        coordinates: { latitude, longitude },
        floodProbability,
        riskLevel,
        riskColor,
        confidence: prediction.confidence || 0.75,
        lastUpdated: new Date().toISOString(),
        weatherSummary: {
          temperature: prediction.weather_summary?.current_temp || null,
          rainfall: prediction.weather_summary?.rainfall_24h || 0,
          windSpeed: prediction.weather_summary?.wind_speed || null,
          humidity: prediction.weather_summary?.humidity || null,
        },
        contributingFactors: prediction.contributing_factors || [],
        recommendation: this.getStateRecommendation(riskLevel, stateName)
      };

      console.log(`✅ StateRiskService: ${stateName} - ${riskLevel} risk (${(floodProbability * 100).toFixed(1)}%)`);

      return riskData;

    } catch (error) {
      console.error(`❌ StateRiskService: Error calculating risk for ${stateName}:`, error);
      throw error;
    }
  }

  /**
   * Get risk data for a specific state
   * @param {string} stateName - Name of the state
   * @returns {Promise<Object|null>} - Risk data for the state
   */
  static async getStateRisk(stateName) {
    const allRisks = await this.calculateAllStateRisks();
    return allRisks[stateName] || null;
  }

  /**
   * Get recommendation text for a state based on risk level
   * @param {string} riskLevel - Risk level (Low, Medium, High)
   * @param {string} stateName - State name
   * @returns {string} - Recommendation text
   */
  static getStateRecommendation(riskLevel, stateName) {
    switch (riskLevel) {
      case 'High':
        return `High flood risk detected in ${stateName}. Residents should prepare for possible evacuation and avoid low-lying areas.`;
      case 'Medium':
        return `Moderate flood risk in ${stateName}. Stay alert and monitor local weather conditions.`;
      case 'Low':
      default:
        return `Low flood risk in ${stateName}. Continue normal activities but stay weather-aware.`;
    }
  }

  /**
   * Check if cached data is still valid
   * @returns {boolean} - True if cache is valid
   */
  static isCacheValid() {
    if (!this.stateRiskCache || !this.cacheTimestamp) {
      return false;
    }

    const now = Date.now();
    const isValid = (now - this.cacheTimestamp) < this.cacheTimeout;

    if (!isValid) {
      console.log('🕐 StateRiskService: Cache expired, will refresh data');
    }

    return isValid;
  }

  /**
   * Get fallback risk data for all states
   * @returns {Object} - Fallback risk data
   */
  static getFallbackStateRisks() {
    const fallbackStates = [
      'Wilayah Persekutuan', 'Selangor', 'Johor', 'Perak', 'Sabah',
      'Sarawak', 'Pahang', 'Kedah', 'Kelantan', 'Terengganu',
      'Pulau Pinang', 'Melaka', 'Negeri Sembilan', 'Perlis'
    ];

    const fallbackRisks = {};

    fallbackStates.forEach(stateName => {
      fallbackRisks[stateName] = this.getFallbackRiskForState(stateName);
    });

    return fallbackRisks;
  }

  /**
   * Get fallback risk data for a single state
   * @param {string} stateName - State name
   * @returns {Object} - Fallback risk data
   */
  static getFallbackRiskForState(stateName) {
    // Assign moderate risk as fallback
    const floodProbability = 0.4; // 40% - Low risk
    const riskLevel = getRiskLevel(floodProbability);
    const riskColor = getRiskColor(floodProbability);

    return {
      stateName,
      coordinates: { latitude: 3.1390, longitude: 101.6869 }, // Default to KL
      floodProbability,
      riskLevel,
      riskColor,
      confidence: 0.5, // Low confidence for fallback data
      lastUpdated: new Date().toISOString(),
      weatherSummary: {
        temperature: null,
        rainfall: null,
        windSpeed: null,
        humidity: null,
      },
      contributingFactors: ['Fallback data - unable to calculate actual risk'],
      recommendation: 'Weather data unavailable. Please check local conditions.',
      isFallback: true
    };
  }

  /**
   * Clear cache (useful for manual refresh)
   */
  static clearCache() {
    this.stateRiskCache = null;
    this.cacheTimestamp = null;
    console.log('🧹 StateRiskService: Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache information
   */
  static getCacheInfo() {
    return {
      hasCache: !!this.stateRiskCache,
      cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
      isValid: this.isCacheValid(),
      stateCount: this.stateRiskCache ? Object.keys(this.stateRiskCache).length : 0
    };
  }
}

export default StateRiskService;