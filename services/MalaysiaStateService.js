/**
 * MalaysiaStateService.js - Service to load and manage Malaysia state data for flood risk maps
 */

import StatePolygonProcessor from '../utils/StatePolygonProcessor';
import GeoJSONProcessor from '../utils/GeoJSONProcessor';
import { RISK_COLORS, getRiskColor, getRiskLevel } from '../utils/RiskCalculations';
import FloodPredictionModel from './FloodPredictionModel';
import { apiService } from './ApiService';

class MalaysiaStateService {
  constructor() {
    this.processor = new StatePolygonProcessor();
    this.geoJSONProcessor = new GeoJSONProcessor();
    this.statesData = null;
    this.loading = false;
    this.lastUpdated = null;
    this.updateInterval = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load and process Malaysia GeoJSON data
   * @returns {Promise<Array>} - Array of processed state data
   */
  async loadMalaysiaStates() {
    if (this.loading) {
      console.log('🔄 State data loading already in progress...');
      return this.statesData || [];
    }

    if (this.statesData && this.lastUpdated &&
        Date.now() - this.lastUpdated < this.updateInterval) {
      console.log('📦 Using cached Malaysia state data');
      return this.statesData;
    }

    this.loading = true;

    try {
      console.log('🗺️ Loading Malaysia state data for flood risk maps...');

      // Use the GeoJSONProcessor to get accurate polygon data
      console.log('🗺️ Processing Malaysia state polygons with accurate boundaries...');
      const malaysiaStatesData = await this.geoJSONProcessor.createMalaysiaStateData();

      // Add initial risk data to each state using state-specific defaults
      this.statesData = malaysiaStatesData.map(state => {
        const defaultRisk = this.getDefaultRiskData(state);
        console.log(`🎨 ${state.name}: ${(defaultRisk.floodProbability * 100).toFixed(0)}% risk, ${defaultRisk.riskLevel} level, ${defaultRisk.color} color`);

        return {
          ...state,
          riskData: {
            ...defaultRisk,
            lastUpdated: new Date().toISOString()
          }
        };
      });
      this.lastUpdated = Date.now();

      console.log(`✅ Successfully loaded ${this.statesData.length} Malaysian states with color-coded risk levels`);

      // Start initial flood risk calculation
      await this.updateAllStatesFloodRisk();

      return this.statesData;

    } catch (error) {
      console.error('❌ Error loading Malaysia state data:', error);
      return this.createFallbackStateData();
    } finally {
      this.loading = false;
    }
  }


  /**
   * Create fallback state data if loading fails
   */
  createFallbackStateData() {
    console.log('⚠️ Using fallback state data');
    return [
      {
        id: 'KUL',
        name: 'Kuala Lumpur',
        stateCode: 'KUL',
        center: { latitude: 3.1390, longitude: 101.6869 },
        capital: 'Kuala Lumpur',
        coordinates: [[
          { latitude: 3.0, longitude: 101.5 },
          { latitude: 3.3, longitude: 101.5 },
          { latitude: 3.3, longitude: 101.8 },
          { latitude: 3.0, longitude: 101.8 },
          { latitude: 3.0, longitude: 101.5 }
        ]],
        riskData: { floodProbability: 0.3, riskLevel: 'Moderate', color: RISK_COLORS.Moderate }
      }
    ];
  }

  /**
   * Update flood risk for all states
   */
  async updateAllStatesFloodRisk() {
    if (!this.statesData) return;

    console.log('🔄 Updating flood risk for all Malaysian states...');

    const updatePromises = this.statesData.map(async (state) => {
      try {
        const riskData = await this.calculateStateFloodRisk(state);
        state.riskData = {
          ...state.riskData,
          ...riskData,
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        console.warn(`⚠️ Failed to update ${state.name} flood risk:`, error.message);
        // Keep existing risk data if update fails
      }
    });

    await Promise.allSettled(updatePromises);
    console.log('✅ Flood risk update completed for all states');
  }

  /**
   * Calculate flood risk for a specific state
   * @param {Object} state - State data object
   * @returns {Promise<Object>} - Risk data object
   */
  async calculateStateFloodRisk(state) {
    try {
      console.log(`🧮 Calculating flood risk for ${state.name}...`);

      // Validate state center coordinates
      if (!state.center ||
          typeof state.center.latitude !== 'number' ||
          typeof state.center.longitude !== 'number' ||
          isNaN(state.center.latitude) ||
          isNaN(state.center.longitude)) {
        console.warn(`⚠️ Invalid coordinates for ${state.name}, using default risk`);
        return this.getDefaultRiskData(state);
      }

      // Get weather data for the state capital
      const weatherData = await apiService.getTrainingModelData(
        state.center.latitude,
        state.center.longitude,
        1 // 1 day forecast
      );

      if (!weatherData || !weatherData.features) {
        console.warn(`⚠️ No weather data for ${state.name}, using default risk`);
        return this.getDefaultRiskData(state);
      }

      // Use the existing flood prediction model with proper coordinate format
      const location = {
        lat: state.center.latitude,
        lon: state.center.longitude
      };

      console.log(`📍 Using coordinates for ${state.name}: ${location.lat}, ${location.lon}`);

      const prediction = await FloodPredictionModel.calculateFloodProbability(
        weatherData,
        state.name,
        location
      );

      const probability = prediction.probability || 0.2;
      const riskLevel = getRiskLevel(probability);
      const color = getRiskColor(probability);

      return {
        floodProbability: probability,
        riskLevel: riskLevel,
        color: color,
        confidence: prediction.confidence || 0.7,
        factors: prediction.embedded_data?.contributing_factors || [],
        weatherSummary: {
          temperature: Math.round(weatherData.current?.temperature || 28),
          rainfall: Math.round(weatherData.features?.rain_sum || 0),
          humidity: Math.round(weatherData.features?.humidity_avg || 75),
          windSpeed: Math.round(weatherData.features?.wind_speed_max || 10)
        }
      };

    } catch (error) {
      console.error(`❌ Error calculating risk for ${state.name}:`, error);
      return this.getDefaultRiskData(state);
    }
  }

  /**
   * Get default risk data for a state
   * @param {Object} state - State data object
   * @returns {Object} - Default risk data
   */
  getDefaultRiskData(state) {
    // State-specific default risks based on historical patterns
    const defaultRisks = {
      'Kelantan': 0.4,
      'Terengganu': 0.38,
      'Kuala Lumpur': 0.35,
      'Selangor': 0.32,
      'Pahang': 0.3,
      'Johor': 0.25,
      'Kedah': 0.24
    };

    const probability = defaultRisks[state.name] || 0.2;
    const riskLevel = getRiskLevel(probability);
    const color = getRiskColor(probability);

    return {
      floodProbability: probability,
      riskLevel: riskLevel,
      color: color,
      confidence: 0.6,
      factors: [`Default risk pattern for ${state.name}`],
      weatherSummary: {
        temperature: 28,
        rainfall: 0,
        humidity: 75,
        windSpeed: 10
      }
    };
  }

  /**
   * Get state by name
   * @param {string} stateName - Name of the state
   * @returns {Object|null} - State data object
   */
  getStateByName(stateName) {
    if (!this.statesData) return null;

    return this.statesData.find(state =>
      state.name.toLowerCase() === stateName.toLowerCase() ||
      state.stateCode.toLowerCase() === stateName.toLowerCase()
    );
  }

  /**
   * Get all states data
   * @returns {Array} - Array of all state data
   */
  getAllStates() {
    return this.statesData || [];
  }

  /**
   * Get states by risk level
   * @param {string} riskLevel - Risk level to filter by
   * @returns {Array} - Array of states with matching risk level
   */
  getStatesByRiskLevel(riskLevel) {
    if (!this.statesData) return [];

    return this.statesData.filter(state =>
      state.riskData.riskLevel.toLowerCase() === riskLevel.toLowerCase()
    );
  }

  /**
   * Get Malaysia map region bounds (includes East Malaysia)
   * @returns {Object} - Region object for map initialization
   */
  getMalaysiaRegion() {
    return {
      latitude: 4.2105,     // Center latitude for whole Malaysia
      longitude: 109.0,     // Adjusted to better center all of Malaysia
      latitudeDelta: 8.0,   // Covers from southern peninsular to northern Sabah
      longitudeDelta: 15.0  // Increased to include Sarawak and Sabah
    };
  }

  /**
   * Get West Malaysia focused region
   * @returns {Object} - Region object for West Malaysia
   */
  getWestMalaysiaRegion() {
    // Optimized region to ensure all polygon boundaries fit perfectly
    return {
      latitude: 3.8,        // Centered between Johor (1.2°) and Kedah (6.5°)
      longitude: 101.8,     // Centered for better polygon coverage
      latitudeDelta: 6.0,   // Expanded to accommodate full range from Johor to Perlis
      longitudeDelta: 5.2   // Expanded to ensure complete state boundary visibility
    };
  }

  /**
   * Force refresh all state risk data
   */
  async refreshAllStates() {
    console.log('🔄 Force refreshing all state flood risk data...');
    this.lastUpdated = null; // Clear cache
    await this.updateAllStatesFloodRisk();
  }

  /**
   * Get summary statistics
   * @returns {Object} - Summary of flood risk across all states
   */
  getRiskSummary() {
    if (!this.statesData) return null;

    const summary = {
      total: this.statesData.length,
      low: 0,
      moderate: 0,
      high: 0,
      veryHigh: 0,
      averageRisk: 0
    };

    let totalProbability = 0;

    this.statesData.forEach(state => {
      const level = state.riskData.riskLevel.toLowerCase();
      switch (level) {
        case 'low': summary.low++; break;
        case 'moderate': summary.moderate++; break;
        case 'high': summary.high++; break;
        case 'very high': summary.veryHigh++; break;
      }
      totalProbability += state.riskData.floodProbability;
    });

    summary.averageRisk = totalProbability / this.statesData.length;

    return summary;
  }
}

// Export singleton instance
export default new MalaysiaStateService();