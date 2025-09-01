import floodAPI from './FloodAPI';
import { PRECIPITATION_THRESHOLDS, RIVER_LEVEL_THRESHOLDS } from '../utils/constants';

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
      return this.getMockWeatherData(latitude, longitude);
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
        hourly: this.generateHourlyPrecipitation(),
        forecast24h: weatherData.forecast_24h?.precipitation_sum || 0,
        intensity: this.getPrecipitationIntensity(weatherData.current_conditions?.precipitation || 0),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting precipitation data:', error);
      return this.getMockPrecipitationData();
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
        status: this.getRiverLevelStatus(riverLevel),
        trend: this.getRiverLevelTrend(riverLevel),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting river level data:', error);
      return this.getMockRiverLevelData();
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
      const hourlyForecast = this.generateHourlyForecast(weatherData, hours);
      
      return {
        forecast: hourlyForecast,
        peakRainfall: this.findPeakRainfall(hourlyForecast),
        floodRiskPeriods: this.identifyFloodRiskPeriods(hourlyForecast),
        recommendation: this.generateWeatherRecommendation(hourlyForecast),
      };
    } catch (error) {
      console.error('Error getting flood timing forecast:', error);
      return this.getMockTimingForecast();
    }
  }

  /**
   * Get precipitation intensity classification
   * @param {number} precipitation - Precipitation in mm/hr
   * @returns {string} - Intensity classification
   */
  getPrecipitationIntensity(precipitation) {
    if (precipitation >= PRECIPITATION_THRESHOLDS.EXTREME) return 'extreme';
    if (precipitation >= PRECIPITATION_THRESHOLDS.HEAVY) return 'heavy';
    if (precipitation >= PRECIPITATION_THRESHOLDS.MODERATE) return 'moderate';
    if (precipitation >= PRECIPITATION_THRESHOLDS.LIGHT) return 'light';
    return 'none';
  }

  /**
   * Get river level status
   * @param {number} level - River level in feet
   * @returns {string} - Status classification
   */
  getRiverLevelStatus(level) {
    if (level >= RIVER_LEVEL_THRESHOLDS.DANGER) return 'danger';
    if (level >= RIVER_LEVEL_THRESHOLDS.WARNING) return 'warning';
    if (level >= RIVER_LEVEL_THRESHOLDS.NORMAL_MIN && level <= RIVER_LEVEL_THRESHOLDS.NORMAL_MAX) return 'normal';
    return 'low';
  }

  /**
   * Get river level trend
   * @param {number} level - Current river level
   * @returns {string} - Trend direction
   */
  getRiverLevelTrend(level) {
    // Simplified trend calculation (in real implementation, compare with historical data)
    const random = Math.random();
    if (random > 0.6) return 'rising';
    if (random < 0.3) return 'falling';
    return 'stable';
  }

  /**
   * Generate hourly precipitation forecast
   * @returns {Array} - Hourly precipitation data
   */
  generateHourlyPrecipitation() {
    const hours = [];
    const baseTime = new Date();
    
    for (let i = 0; i < 24; i++) {
      const time = new Date(baseTime.getTime() + i * 60 * 60 * 1000);
      const precipitation = Math.random() * 15; // Random precipitation up to 15mm/hr
      
      hours.push({
        time: time.toISOString(),
        precipitation,
        intensity: this.getPrecipitationIntensity(precipitation),
      });
    }
    
    return hours;
  }

  /**
   * Generate hourly weather forecast
   * @param {Object} currentWeather - Current weather data
   * @param {number} hours - Number of hours to forecast
   * @returns {Array} - Hourly forecast
   */
  generateHourlyForecast(currentWeather, hours) {
    const forecast = [];
    const baseTemp = currentWeather.current_conditions?.temperature || 28;
    const basePrecip = currentWeather.current_conditions?.precipitation || 2;
    
    for (let i = 0; i < hours; i++) {
      const time = new Date(Date.now() + i * 60 * 60 * 1000);
      
      // Simulate temperature variation
      const tempVariation = Math.sin(i * Math.PI / 12) * 3; // Daily cycle
      const temperature = baseTemp + tempVariation + (Math.random() - 0.5) * 2;
      
      // Simulate precipitation variation
      const precipVariation = Math.random() * 10;
      const precipitation = Math.max(0, basePrecip + precipVariation - 5);
      
      forecast.push({
        time: time.toISOString(),
        temperature,
        precipitation,
        humidity: 70 + Math.random() * 20,
        windSpeed: 8 + Math.random() * 10,
        pressure: 1010 + Math.random() * 10,
        floodRisk: precipitation > PRECIPITATION_THRESHOLDS.MODERATE,
      });
    }
    
    return forecast;
  }

  /**
   * Find peak rainfall period in forecast
   * @param {Array} forecast - Hourly forecast data
   * @returns {Object} - Peak rainfall information
   */
  findPeakRainfall(forecast) {
    let peak = forecast[0];
    
    forecast.forEach(hour => {
      if (hour.precipitation > peak.precipitation) {
        peak = hour;
      }
    });
    
    return {
      time: peak.time,
      precipitation: peak.precipitation,
      intensity: this.getPrecipitationIntensity(peak.precipitation),
    };
  }

  /**
   * Identify high flood risk periods in forecast
   * @param {Array} forecast - Hourly forecast data
   * @returns {Array} - Risk periods
   */
  identifyFloodRiskPeriods(forecast) {
    const riskPeriods = [];
    let currentPeriod = null;
    
    forecast.forEach((hour, index) => {
      if (hour.floodRisk) {
        if (!currentPeriod) {
          currentPeriod = {
            start: hour.time,
            end: hour.time,
            maxPrecipitation: hour.precipitation,
          };
        } else {
          currentPeriod.end = hour.time;
          currentPeriod.maxPrecipitation = Math.max(currentPeriod.maxPrecipitation, hour.precipitation);
        }
      } else if (currentPeriod) {
        riskPeriods.push(currentPeriod);
        currentPeriod = null;
      }
    });
    
    if (currentPeriod) {
      riskPeriods.push(currentPeriod);
    }
    
    return riskPeriods;
  }

  /**
   * Generate weather-based recommendation
   * @param {Array} forecast - Hourly forecast data
   * @returns {string} - Weather recommendation
   */
  generateWeatherRecommendation(forecast) {
    const riskPeriods = this.identifyFloodRiskPeriods(forecast);
    
    if (riskPeriods.length === 0) {
      return 'Weather conditions are favorable with low flood risk.';
    }
    
    const nearestRisk = riskPeriods[0];
    const hoursToRisk = Math.round((new Date(nearestRisk.start) - new Date()) / (1000 * 60 * 60));
    
    if (hoursToRisk <= 2) {
      return 'Heavy rainfall expected within 2 hours. Take immediate precautions.';
    } else if (hoursToRisk <= 6) {
      return `Heavy rainfall expected in ${hoursToRisk} hours. Prepare flood safety measures.`;
    } else {
      return `Heavy rainfall forecasted in ${hoursToRisk} hours. Monitor conditions closely.`;
    }
  }

  /**
   * Mock weather data for testing/offline mode
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Mock weather data
   */
  getMockWeatherData(latitude, longitude) {
    return {
      latitude,
      longitude,
      current_conditions: {
        temperature: 28.5 + Math.random() * 4,
        humidity: 75 + Math.random() * 10,
        precipitation: Math.random() * 15,
        wind_speed: 8 + Math.random() * 8,
        wind_direction: 'SW',
        pressure: 1010 + Math.random() * 8,
      },
      forecast_24h: {
        max_temperature: 32 + Math.random() * 3,
        min_temperature: 24 + Math.random() * 3,
        precipitation_sum: Math.random() * 25,
        precipitation_hours: Math.floor(Math.random() * 8),
        wind_speed_max: 15 + Math.random() * 10,
      },
      river_data: {
        discharge: 200 + Math.random() * 100,
        level: 5 + Math.random() * 2,
        normal_range: '4-6',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mock precipitation data
   * @returns {Object} - Mock precipitation data
   */
  getMockPrecipitationData() {
    const current = Math.random() * 12;
    
    return {
      current,
      hourly: this.generateHourlyPrecipitation(),
      forecast24h: Math.random() * 30,
      intensity: this.getPrecipitationIntensity(current),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Mock river level data
   * @returns {Object} - Mock river level data
   */
  getMockRiverLevelData() {
    const level = 4 + Math.random() * 4;
    
    return {
      current: level,
      normal_range: '4-6',
      discharge: 150 + Math.random() * 200,
      status: this.getRiverLevelStatus(level),
      trend: this.getRiverLevelTrend(level),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Mock timing forecast
   * @returns {Object} - Mock timing forecast
   */
  getMockTimingForecast() {
    const mockWeather = this.getMockWeatherData(3.1390, 101.6869);
    const forecast = this.generateHourlyForecast(mockWeather, 48);
    
    return {
      forecast,
      peakRainfall: this.findPeakRainfall(forecast),
      floodRiskPeriods: this.identifyFloodRiskPeriods(forecast),
      recommendation: this.generateWeatherRecommendation(forecast),
    };
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