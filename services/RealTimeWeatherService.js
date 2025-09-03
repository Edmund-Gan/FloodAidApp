/**
 * RealTimeWeatherService.js - Live weather data integration with Open Meteo API
 * Provides real-time weather data for home page risk indicators and forecasts
 */

class RealTimeWeatherService {
  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get comprehensive real-time weather data for home page
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise<Object>} - Complete weather data for home page
   */
  async getHomePageWeatherData(latitude, longitude) {
    const cacheKey = `home_weather_${latitude}_${longitude}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🔄 Using cached home page weather data');
        return cached.data;
      }
    }

    try {
      console.log(`🌤️ Fetching real-time weather data for home page: ${latitude}, ${longitude}`);
      
      // Get current weather + 7-day forecast with all needed parameters
      const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        current: 'temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,pressure_msl',
        hourly: 'temperature_2m,precipitation,rain,relative_humidity_2m',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max',
        forecast_days: '7',
        timezone: 'Asia/Kuala_Lumpur'
      });

      const response = await fetch(`${this.baseUrl}/forecast?${params}`);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Process data for home page components
      const processedData = this.processHomePageData(data);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: processedData,
        timestamp: Date.now()
      });

      console.log('✅ Real-time weather data processed successfully');
      return processedData;
      
    } catch (error) {
      console.error('❌ Error fetching real-time weather data:', error);
      throw error;
    }
  }

  /**
   * Process Open Meteo data for home page components
   * @param {Object} data - Raw Open Meteo API response
   * @returns {Object} - Processed data for home page
   */
  processHomePageData(data) {
    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;

    // Calculate weather indicators from real data (NO flood risk)
    const weatherIndicators = this.calculateWeatherIndicators(daily, hourly);
    
    // Process rain forecast with specific dates
    const rainForecast = this.processRainForecast(daily);
    
    // Current weather summary
    const weatherSummary = {
      current_temp: Math.round(current.temperature_2m || 0),
      current_humidity: Math.round(current.relative_humidity_2m || 0),
      current_precipitation: current.precipitation || 0,
      rainfall_24h_past: this.calculate24hRainfall(hourly), // Historical rainfall (past 24h)
      rainfall_24h_forecast: this.calculateNext24hForecastRainfall(hourly), // Forecast rainfall (next 24h)
      wind_speed: Math.round(current.wind_speed_10m || 0),
      pressure: Math.round(current.pressure_msl || 0)
    };

    return {
      weather_indicators: weatherIndicators, // RENAMED: No longer "risk" indicators
      weather_summary: weatherSummary,
      rain_forecast: rainForecast,
      humidity: {
        current: Math.round(current.relative_humidity_2m || 0),
        trend: this.calculateHumidityTrend(hourly),
        forecast_24h: this.calculateAverage24hHumidity(hourly)
      },
      data_sources: {
        past_24h_rainfall: 'Historical (Open Meteo)',
        next_24h_rainfall: 'Forecast (Open Meteo)',
        next_7_days_rainfall: 'Forecast (Open Meteo)',
        time_reference: new Date().toISOString()
      },
      last_updated: new Date().toISOString(),
      source: 'Open Meteo API'
    };
  }

  /**
   * Calculate weather indicators from weather data (NO flood risk calculations)
   * @param {Object} daily - Daily forecast data
   * @param {Object} hourly - Hourly forecast data
   * @returns {Object} - Weather indicators only
   */
  calculateWeatherIndicators(daily, hourly) {
    // Total forecast rain for next 7 days
    const totalForecastRain = daily.precipitation_sum
      .slice(0, 7)
      .reduce((sum, rain) => sum + (rain || 0), 0);

    // Count consecutive rain days
    const consecutiveRainDays = this.countConsecutiveRainDays(daily);
    
    // Determine warning levels based on weather thresholds (NOT flood risk)
    const warnings = this.calculateWeatherWarnings(daily, hourly);

    return {
      heavy_rain_warning: warnings.heavyRain,
      extreme_rain_warning: warnings.extremeRain,
      high_humidity_warning: warnings.highHumidity,
      consecutive_rain_days: consecutiveRainDays,
      total_forecast_rain: Math.round(totalForecastRain * 10) / 10, // Round to 1 decimal
      next_rain_day: this.findNextRainDay(daily)
      // REMOVED: current_risk_score, risk_level - these are FLOOD PREDICTIONS, not weather data
    };
  }

  /**
   * Process rain forecast to show specific dates with rain
   * @param {Object} daily - Daily forecast data
   * @returns {Object} - Rain forecast with dates
   */
  processRainForecast(daily) {
    const rainDays = [];
    const today = new Date();

    daily.time.slice(0, 7).forEach((dateStr, index) => {
      const rain = daily.precipitation_sum[index] || 0;
      const probability = daily.precipitation_probability_max[index] || 0;
      
      if (rain > 1.0 || probability > 30) { // Significant rain or high probability
        const date = new Date(dateStr);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
        rainDays.push({
          date: dateStr,
          day_name: dayName,
          precipitation: Math.round(rain * 10) / 10,
          probability: Math.round(probability),
          intensity: this.getRainIntensity(rain)
        });
      }
    });

    return {
      upcoming_rain_days: rainDays,
      next_rain_in_hours: this.calculateHoursToNextRain(daily),
      total_upcoming_rain: rainDays.reduce((sum, day) => sum + day.precipitation, 0),
      rain_summary: this.generateRainSummary(rainDays)
    };
  }

  /**
   * Calculate 24-hour rainfall from hourly data (PAST 24 hours)
   * @param {Object} hourly - Hourly weather data
   * @returns {number} - 24h rainfall in mm
   */
  calculate24hRainfall(hourly) {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let rainfall = 0;
    hourly.time.forEach((timeStr, index) => {
      const time = new Date(timeStr);
      if (time >= twentyFourHoursAgo && time <= now) {
        rainfall += hourly.precipitation[index] || 0;
      }
    });
    
    return Math.round(rainfall * 10) / 10;
  }

  /**
   * Calculate next 24-hour forecast rainfall from hourly data (NEXT 24 hours)
   * @param {Object} hourly - Hourly weather data
   * @returns {number} - 24h forecast rainfall in mm
   */
  calculateNext24hForecastRainfall(hourly) {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    let forecastRainfall = 0;
    hourly.time.forEach((timeStr, index) => {
      const time = new Date(timeStr);
      if (time >= now && time <= twentyFourHoursLater) {
        forecastRainfall += hourly.precipitation[index] || 0;
      }
    });
    
    return Math.round(forecastRainfall * 10) / 10;
  }

  /**
   * Count consecutive days with rain in forecast
   * @param {Object} daily - Daily forecast data
   * @returns {number} - Number of consecutive rain days
   */
  countConsecutiveRainDays(daily) {
    let consecutiveDays = 0;
    
    for (let i = 0; i < Math.min(daily.precipitation_sum.length, 7); i++) {
      if ((daily.precipitation_sum[i] || 0) > 1.0) {
        consecutiveDays++;
      } else {
        break; // Stop at first non-rain day
      }
    }
    
    return consecutiveDays;
  }

  // REMOVED: calculateCurrentRiskScore - Weather service should NOT calculate flood risk

  /**
   * Calculate weather warnings based on thresholds
   * @param {Object} daily - Daily forecast data
   * @param {Object} hourly - Hourly forecast data
   * @returns {Object} - Warning flags
   */
  calculateWeatherWarnings(daily, hourly) {
    const maxRain24h = Math.max(...daily.precipitation_sum.slice(0, 1));
    const avgHumidity = hourly.relative_humidity_2m.slice(0, 24).reduce((sum, h) => sum + (h || 0), 0) / 24;

    return {
      heavyRain: maxRain24h > 20, // Heavy rain threshold: 20mm/day
      extremeRain: maxRain24h > 50, // Extreme rain threshold: 50mm/day
      highHumidity: avgHumidity > 85 // High humidity threshold: 85%
    };
  }

  // REMOVED: determineRiskLevel - Weather service should NOT determine flood risk levels

  /**
   * Find next day with rain
   * @param {Object} daily - Daily forecast data
   * @returns {Object|null} - Next rain day info
   */
  findNextRainDay(daily) {
    for (let i = 0; i < Math.min(daily.time.length, 7); i++) {
      if ((daily.precipitation_sum[i] || 0) > 1.0) {
        const date = new Date(daily.time[i]);
        return {
          date: daily.time[i],
          day_name: date.toLocaleDateString('en-US', { weekday: 'long' }),
          precipitation: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
          days_away: i
        };
      }
    }
    return null;
  }

  /**
   * Calculate hours until next rain
   * @param {Object} daily - Daily forecast data
   * @returns {number|null} - Hours until next rain
   */
  calculateHoursToNextRain(daily) {
    const nextRainDay = this.findNextRainDay(daily);
    if (!nextRainDay) return null;
    
    const now = new Date();
    const rainDate = new Date(nextRainDay.date);
    const hoursUntil = Math.round((rainDate - now) / (1000 * 60 * 60));
    
    return Math.max(hoursUntil, 0);
  }

  /**
   * Get rain intensity description
   * @param {number} rain - Rain amount in mm
   * @returns {string} - Intensity description
   */
  getRainIntensity(rain) {
    if (rain >= 50) return 'Heavy';
    if (rain >= 20) return 'Moderate';
    if (rain >= 5) return 'Light';
    return 'Drizzle';
  }

  /**
   * Generate human-readable rain summary
   * @param {Array} rainDays - Array of rain day objects
   * @returns {string} - Rain summary text
   */
  generateRainSummary(rainDays) {
    if (rainDays.length === 0) {
      return 'No significant rain expected in the next 7 days';
    }

    const dayNames = rainDays.slice(0, 3).map(day => day.day_name);
    
    if (rainDays.length === 1) {
      return `Rain expected on ${dayNames[0]}`;
    } else if (rainDays.length <= 3) {
      return `Rain expected: ${dayNames.join(', ')}`;
    } else {
      return `Rain expected on ${rainDays.length} days this week`;
    }
  }

  /**
   * Calculate humidity trend
   * @param {Object} hourly - Hourly weather data
   * @returns {string} - Trend description
   */
  calculateHumidityTrend(hourly) {
    const currentHours = hourly.relative_humidity_2m.slice(0, 6);
    const futureHours = hourly.relative_humidity_2m.slice(6, 12);
    
    const currentAvg = currentHours.reduce((sum, h) => sum + (h || 0), 0) / currentHours.length;
    const futureAvg = futureHours.reduce((sum, h) => sum + (h || 0), 0) / futureHours.length;
    
    if (futureAvg > currentAvg + 5) return 'rising';
    if (futureAvg < currentAvg - 5) return 'falling';
    return 'stable';
  }

  /**
   * Calculate average humidity for next 24 hours
   * @param {Object} hourly - Hourly weather data
   * @returns {number} - Average humidity percentage
   */
  calculateAverage24hHumidity(hourly) {
    const next24h = hourly.relative_humidity_2m.slice(0, 24);
    const sum = next24h.reduce((total, h) => total + (h || 0), 0);
    return Math.round(sum / next24h.length);
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Weather cache cleared');
  }
}

export default RealTimeWeatherService;