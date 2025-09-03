import floodAPI from './FloodAPI';
import { PRECIPITATION_THRESHOLDS, RIVER_LEVEL_THRESHOLDS } from '../utils/constants';
import { calculateFloodRisk, getPrecipitationIntensity, getRiverLevelStatus, getFloodRecommendation } from '../utils/RiskCalculations';
import MockDataService from '../utils/MockDataService';

class WeatherService {
  constructor() {
    this.floodAPI = floodAPI;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get current weather data for coordinates
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise} - Weather data
   */
  async getCurrentWeather(latitude, longitude, useCache = true) {
    const cacheKey = `weather_${latitude}_${longitude}`;
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const weatherData = await this.floodAPI.getCurrentWeather(latitude, longitude);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now(),
      });
      
      return weatherData;
    } catch (error) {
      console.error('Error getting weather data:', error);
      return MockDataService.getMockWeatherData(latitude, longitude);
    }
  }

  /**
   * Get real-time precipitation data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - Precipitation data
   */
  async getPrecipitationData(latitude, longitude) {
    try {
      const weatherData = await this.getCurrentWeather(latitude, longitude);
      
      return {
        current: weatherData.current_conditions?.precipitation || 0,
        hourly: MockDataService.generateHourlyPrecipitation(),
        forecast24h: weatherData.forecast_24h?.precipitation_sum || 0,
        intensity: getPrecipitationIntensity(weatherData.current_conditions?.precipitation || 0, PRECIPITATION_THRESHOLDS),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting precipitation data:', error);
      return MockDataService.getMockPrecipitationData();
    }
  }

  /**
   * Get river level data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - River level data
   */
  async getRiverLevelData(latitude, longitude) {
    try {
      const weatherData = await this.getCurrentWeather(latitude, longitude);
      const riverLevel = weatherData.river_data?.level || 5.2;
      
      return {
        current: riverLevel,
        normal_range: weatherData.river_data?.normal_range || '4-6',
        discharge: weatherData.river_data?.discharge || 200,
        status: getRiverLevelStatus(riverLevel, RIVER_LEVEL_THRESHOLDS),
        trend: this.getRiverLevelTrend(riverLevel),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting river level data:', error);
      return MockDataService.getMockRiverLevelData();
    }
  }

  /**
   * Check if rainfall exceeds threshold for flood prediction
   * @param {number} latitude - Latitude coordinate  
   * @param {number} longitude - Longitude coordinate
   * @param {number} threshold - Rainfall threshold in mm/hr
   * @returns {Promise<boolean>} - Whether threshold is exceeded
   */
  async isRainfallAboveThreshold(latitude, longitude, threshold = PRECIPITATION_THRESHOLDS.MODERATE) {
    try {
      const precipData = await this.getPrecipitationData(latitude, longitude);
      return precipData.current > threshold;
    } catch (error) {
      console.error('Error checking rainfall threshold:', error);
      return false;
    }
  }

  /**
   * Get comprehensive flood risk assessment for alert system
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - Comprehensive flood risk data
   */
  async getFloodRiskAssessment(latitude, longitude) {
    try {
      const [weatherData, precipData, forecastData] = await Promise.all([
        this.getCurrentWeather(latitude, longitude),
        this.getPrecipitationData(latitude, longitude),
        this.getFloodTimingForecast(latitude, longitude, 48)
      ]);

      // Calculate current flood risk based on multiple factors
      const currentRisk = calculateFloodRisk({
        precipitation: precipData.current,
        forecast24h: precipData.forecast24h,
        riverLevel: weatherData.river_data?.level || 5,
        humidity: weatherData.current_conditions?.humidity || 75,
        pressure: weatherData.current_conditions?.pressure || 1010
      }, PRECIPITATION_THRESHOLDS);

      // Identify critical rainfall periods
      const criticalPeriods = this.identifyCriticalRainfallPeriods(forecastData.forecast);

      return {
        currentRisk,
        currentConditions: {
          precipitation: precipData.current,
          intensity: precipData.intensity,
          temperature: weatherData.current_conditions?.temperature || 28,
          humidity: weatherData.current_conditions?.humidity || 75,
          riverLevel: weatherData.river_data?.level || 5,
          pressure: weatherData.current_conditions?.pressure || 1010
        },
        forecast: {
          next24h: precipData.forecast24h,
          hourlyData: forecastData.forecast,
          criticalPeriods,
          peakRainfall: forecastData.peakRainfall
        },
        floodPrediction: {
          isFloodLikely: currentRisk.probability > 0.6,
          riskLevel: currentRisk.level,
          confidence: currentRisk.confidence,
          timeToFlood: this.estimateTimeToFlood(criticalPeriods),
          expectedDuration: this.estimateFloodDuration(criticalPeriods)
        },
        alerts: {
          thresholdExceeded: precipData.current > PRECIPITATION_THRESHOLDS.MODERATE,
          severeWeatherWarning: precipData.current > PRECIPITATION_THRESHOLDS.HEAVY,
          immediateAction: precipData.current > PRECIPITATION_THRESHOLDS.EXTREME
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting flood risk assessment:', error);
      return MockDataService.getMockFloodRiskAssessment();
    }
  }


  /**
   * Identify critical rainfall periods that could lead to flooding
   * @param {Array} hourlyForecast - Hourly forecast data
   * @returns {Array} - Critical periods
   */
  identifyCriticalRainfallPeriods(hourlyForecast) {
    const criticalPeriods = [];
    let currentPeriod = null;
    
    hourlyForecast.forEach((hour, index) => {
      const isCritical = hour.precipitation > PRECIPITATION_THRESHOLDS.MODERATE || 
                        (hour.precipitation > PRECIPITATION_THRESHOLDS.LIGHT && hour.humidity > 90);
      
      if (isCritical) {
        if (!currentPeriod) {
          currentPeriod = {
            start: hour.time,
            end: hour.time,
            maxPrecipitation: hour.precipitation,
            avgPrecipitation: hour.precipitation,
            duration: 1,
            severity: getPrecipitationIntensity(hour.precipitation, PRECIPITATION_THRESHOLDS),
            floodRisk: hour.precipitation > PRECIPITATION_THRESHOLDS.MODERATE
          };
        } else {
          currentPeriod.end = hour.time;
          currentPeriod.maxPrecipitation = Math.max(currentPeriod.maxPrecipitation, hour.precipitation);
          currentPeriod.avgPrecipitation = (currentPeriod.avgPrecipitation * currentPeriod.duration + hour.precipitation) / (currentPeriod.duration + 1);
          currentPeriod.duration += 1;
          currentPeriod.severity = getPrecipitationIntensity(currentPeriod.maxPrecipitation, PRECIPITATION_THRESHOLDS);
          currentPeriod.floodRisk = currentPeriod.floodRisk || hour.precipitation > PRECIPITATION_THRESHOLDS.MODERATE;
        }
      } else if (currentPeriod) {
        // End of critical period
        criticalPeriods.push(currentPeriod);
        currentPeriod = null;
      }
    });
    
    if (currentPeriod) {
      criticalPeriods.push(currentPeriod);
    }
    
    return criticalPeriods.filter(period => period.floodRisk);
  }

  /**
   * Estimate time until flooding based on critical periods
   * @param {Array} criticalPeriods - Critical rainfall periods
   * @returns {number} - Time to flood in milliseconds
   */
  estimateTimeToFlood(criticalPeriods) {
    if (criticalPeriods.length === 0) return null;
    
    const nextCritical = criticalPeriods[0];
    const now = new Date();
    const startTime = new Date(nextCritical.start);
    
    return Math.max(0, startTime.getTime() - now.getTime());
  }

  /**
   * Estimate flood duration based on critical periods
   * @param {Array} criticalPeriods - Critical rainfall periods
   * @returns {number} - Expected duration in hours
   */
  estimateFloodDuration(criticalPeriods) {
    if (criticalPeriods.length === 0) return 0;
    
    // Sum all critical periods duration
    const totalDuration = criticalPeriods.reduce((sum, period) => sum + period.duration, 0);
    
    // Estimate flood duration (typically longer than rain due to drainage)
    return Math.min(totalDuration * 1.5, 24); // Cap at 24 hours
  }



  /**
   * Get weather forecast for flood timing prediction
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {number} hours - Hours to forecast (default 48)
   * @returns {Promise} - Forecast data
   */
  async getFloodTimingForecast(latitude, longitude, hours = 48) {
    try {
      const weatherData = await this.getCurrentWeather(latitude, longitude);
      
      // Generate forecast based on current conditions
      const hourlyForecast = MockDataService.generateHourlyForecast(hours);
      
      return {
        forecast: hourlyForecast,
        peakRainfall: MockDataService.findPeakRainfall(hourlyForecast),
        floodRiskPeriods: MockDataService.identifyFloodRiskPeriods(hourlyForecast),
        recommendation: MockDataService.generateWeatherRecommendation(hourlyForecast),
      };
    } catch (error) {
      console.error('Error getting flood timing forecast:', error);
      return MockDataService.getMockTimingForecast();
    }
  }

  /**
   * Get river level trend
   * @param {number} level - Current river level
   * @returns {string} - Trend direction
   */
  getRiverLevelTrend(level) {
    const random = Math.random();
    if (random > 0.6) return 'rising';
    if (random < 0.3) return 'falling';
    return 'stable';
  }

  /**
   * Clear weather data cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number} - Number of cached items
   */
  getCacheSize() {
    return this.cache.size;
  }
}

// Create singleton instance
const weatherService = new WeatherService();

export { WeatherService };
export default weatherService;