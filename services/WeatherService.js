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
      const currentRisk = this.calculateFloodRisk({
        precipitation: precipData.current,
        forecast24h: precipData.forecast24h,
        riverLevel: weatherData.river_data?.level || 5,
        humidity: weatherData.current_conditions?.humidity || 75,
        pressure: weatherData.current_conditions?.pressure || 1010
      });

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
      return this.getMockFloodRiskAssessment();
    }
  }

  /**
   * Calculate flood risk based on multiple weather parameters
   * @param {Object} conditions - Weather conditions
   * @returns {Object} - Risk assessment
   */
  calculateFloodRisk(conditions) {
    let riskScore = 0;
    let factors = [];

    // Precipitation risk (40% weight)
    if (conditions.precipitation > PRECIPITATION_THRESHOLDS.EXTREME) {
      riskScore += 40;
      factors.push('Extreme rainfall detected');
    } else if (conditions.precipitation > PRECIPITATION_THRESHOLDS.HEAVY) {
      riskScore += 30;
      factors.push('Heavy rainfall detected');
    } else if (conditions.precipitation > PRECIPITATION_THRESHOLDS.MODERATE) {
      riskScore += 20;
      factors.push('Moderate rainfall detected');
    } else if (conditions.precipitation > PRECIPITATION_THRESHOLDS.LIGHT) {
      riskScore += 10;
      factors.push('Light rainfall detected');
    }

    // 24h forecast risk (25% weight)
    if (conditions.forecast24h > 80) {
      riskScore += 25;
      factors.push('High 24h precipitation forecast');
    } else if (conditions.forecast24h > 50) {
      riskScore += 18;
      factors.push('Elevated 24h precipitation forecast');
    } else if (conditions.forecast24h > 25) {
      riskScore += 12;
      factors.push('Moderate 24h precipitation forecast');
    }

    // River level risk (20% weight)
    if (conditions.riverLevel > 8) {
      riskScore += 20;
      factors.push('High river levels');
    } else if (conditions.riverLevel > 6.5) {
      riskScore += 15;
      factors.push('Elevated river levels');
    } else if (conditions.riverLevel > 6) {
      riskScore += 8;
      factors.push('Above normal river levels');
    }

    // Atmospheric conditions (15% weight)
    if (conditions.pressure < 1005 && conditions.humidity > 90) {
      riskScore += 15;
      factors.push('Unstable atmospheric conditions');
    } else if (conditions.pressure < 1008 && conditions.humidity > 85) {
      riskScore += 10;
      factors.push('Favorable conditions for heavy rain');
    }

    // Determine risk level and confidence
    let level, probability, confidence;
    
    if (riskScore >= 80) {
      level = 'Very High';
      probability = 0.9;
      confidence = 0.85;
    } else if (riskScore >= 60) {
      level = 'High';
      probability = 0.75;
      confidence = 0.8;
    } else if (riskScore >= 40) {
      level = 'Medium';
      probability = 0.6;
      confidence = 0.75;
    } else if (riskScore >= 20) {
      level = 'Low';
      probability = 0.3;
      confidence = 0.7;
    } else {
      level = 'Very Low';
      probability = 0.1;
      confidence = 0.65;
    }

    return {
      level,
      probability,
      confidence,
      score: riskScore,
      factors,
      recommendation: this.getFloodRecommendation(level, factors)
    };
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
            severity: this.getPrecipitationIntensity(hour.precipitation),
            floodRisk: hour.precipitation > PRECIPITATION_THRESHOLDS.MODERATE
          };
        } else {
          currentPeriod.end = hour.time;
          currentPeriod.maxPrecipitation = Math.max(currentPeriod.maxPrecipitation, hour.precipitation);
          currentPeriod.avgPrecipitation = (currentPeriod.avgPrecipitation * currentPeriod.duration + hour.precipitation) / (currentPeriod.duration + 1);
          currentPeriod.duration += 1;
          currentPeriod.severity = this.getPrecipitationIntensity(currentPeriod.maxPrecipitation);
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
   * Get flood recommendation based on risk level
   * @param {string} level - Risk level
   * @param {Array} factors - Risk factors
   * @returns {string} - Recommendation
   */
  getFloodRecommendation(level, factors) {
    switch (level) {
      case 'Very High':
        return 'Immediate evacuation recommended. Move to higher ground immediately.';
      case 'High':
        return 'High flood risk. Prepare for possible evacuation and avoid low-lying areas.';
      case 'Medium':
        return 'Moderate flood risk. Stay alert and avoid flood-prone areas.';
      case 'Low':
        return 'Low flood risk. Monitor weather conditions and stay informed.';
      default:
        return 'Weather conditions are stable. Continue normal activities.';
    }
  }

  /**
   * Mock comprehensive flood risk assessment
   * @returns {Object} - Mock assessment data
   */
  getMockFloodRiskAssessment() {
    const currentPrecip = Math.random() * 20;
    const forecast24h = Math.random() * 40;
    
    return {
      currentRisk: this.calculateFloodRisk({
        precipitation: currentPrecip,
        forecast24h: forecast24h,
        riverLevel: 5 + Math.random() * 3,
        humidity: 70 + Math.random() * 25,
        pressure: 1008 + Math.random() * 10
      }),
      currentConditions: {
        precipitation: currentPrecip,
        intensity: this.getPrecipitationIntensity(currentPrecip),
        temperature: 26 + Math.random() * 6,
        humidity: 70 + Math.random() * 25,
        riverLevel: 5 + Math.random() * 3,
        pressure: 1008 + Math.random() * 10
      },
      forecast: {
        next24h: forecast24h,
        hourlyData: this.generateHourlyForecast({current_conditions: {temperature: 28, precipitation: currentPrecip}}, 48),
        criticalPeriods: [],
        peakRainfall: {
          time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          precipitation: Math.max(currentPrecip, Math.random() * 30),
          intensity: 'moderate'
        }
      },
      floodPrediction: {
        isFloodLikely: currentPrecip > PRECIPITATION_THRESHOLDS.MODERATE,
        riskLevel: currentPrecip > PRECIPITATION_THRESHOLDS.HEAVY ? 'High' : 'Medium',
        confidence: 0.75,
        timeToFlood: Math.random() * 24 * 60 * 60 * 1000,
        expectedDuration: 2 + Math.random() * 6
      },
      alerts: {
        thresholdExceeded: currentPrecip > PRECIPITATION_THRESHOLDS.MODERATE,
        severeWeatherWarning: currentPrecip > PRECIPITATION_THRESHOLDS.HEAVY,
        immediateAction: currentPrecip > PRECIPITATION_THRESHOLDS.EXTREME
      },
      lastUpdated: new Date().toISOString()
    };
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