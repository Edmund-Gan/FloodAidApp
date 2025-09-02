class OpenMeteoService {
  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1';
    this.elevationUrl = 'https://customer-api.open-meteo.com/v1/elevation';
    this.floodUrl = 'https://flood-api.open-meteo.com/v1/flood';
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Get elevation data for a location
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - Elevation data
   */
  async getElevationData(latitude, longitude) {
    const cacheKey = `elevation_${latitude}_${longitude}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.elevationUrl}?latitude=${latitude}&longitude=${longitude}`);
      
      if (!response.ok) {
        throw new Error(`Elevation API error: ${response.status}`);
      }

      const data = await response.json();
      
      const elevationData = {
        elevation: data.elevation?.[0] || 0,
        latitude: latitude,
        longitude: longitude,
        timestamp: new Date().toISOString(),
        source: 'Open Meteo Elevation API'
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: elevationData,
        timestamp: Date.now()
      });

      return elevationData;
    } catch (error) {
      console.error('Error fetching elevation data:', error);
      return this.getMockElevationData(latitude, longitude);
    }
  }

  /**
   * Get historical river discharge data for a location
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {number} months - Number of months of historical data (default: 12)
   * @returns {Promise} - Historical river discharge data
   */
  async getHistoricalRiverDischarge(latitude, longitude, months = 12) {
    const cacheKey = `river_discharge_${latitude}_${longitude}_${months}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const response = await fetch(
        `${this.floodUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${startStr}&end_date=${endStr}&daily=river_discharge`
      );
      
      if (!response.ok) {
        throw new Error(`River discharge API error: ${response.status}`);
      }

      const data = await response.json();
      
      const dischargeData = this.processRiverDischargeData(data, latitude, longitude);

      // Cache the result
      this.cache.set(cacheKey, {
        data: dischargeData,
        timestamp: Date.now()
      });

      return dischargeData;
    } catch (error) {
      console.error('Error fetching river discharge data:', error);
      return this.getMockRiverDischargeData(latitude, longitude, months);
    }
  }

  /**
   * Get current river discharge data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise} - Current river discharge data
   */
  async getCurrentRiverDischarge(latitude, longitude) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch(
        `${this.floodUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${today}&end_date=${today}&daily=river_discharge`
      );
      
      if (!response.ok) {
        throw new Error(`Current river discharge API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        current: data.daily?.river_discharge?.[0] || 0,
        date: today,
        latitude: latitude,
        longitude: longitude,
        unit: 'm³/s',
        timestamp: new Date().toISOString(),
        source: 'Open Meteo Flood API'
      };
    } catch (error) {
      console.error('Error fetching current river discharge:', error);
      return this.getMockCurrentRiverDischarge(latitude, longitude);
    }
  }

  /**
   * Process river discharge data to calculate statistics
   * @param {Object} data - Raw API response
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Processed discharge data with statistics
   */
  processRiverDischargeData(data, latitude, longitude) {
    const dischargeValues = data.daily?.river_discharge || [];
    const dates = data.daily?.time || [];
    
    if (dischargeValues.length === 0) {
      return this.getMockRiverDischargeData(latitude, longitude);
    }

    // Filter out null/undefined values
    const validDischarges = dischargeValues.filter(val => val !== null && val !== undefined);
    
    if (validDischarges.length === 0) {
      return this.getMockRiverDischargeData(latitude, longitude);
    }

    // Calculate statistics
    const sortedValues = [...validDischarges].sort((a, b) => a - b);
    const current = validDischarges[validDischarges.length - 1] || 0;
    const average = validDischarges.reduce((sum, val) => sum + val, 0) / validDischarges.length;
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    const min = Math.min(...validDischarges);
    const max = Math.max(...validDischarges);
    
    // Calculate percentile ranking for current discharge
    const percentile = this.calculatePercentile(current, sortedValues);
    
    // Determine status based on percentile
    let status, description;
    if (percentile >= 95) {
      status = 'extreme';
      description = `Extremely high - top ${(100 - percentile).toFixed(0)}% of the year`;
    } else if (percentile >= 90) {
      status = 'very_high';
      description = `Very high - top ${(100 - percentile).toFixed(0)}% of the year`;
    } else if (percentile >= 75) {
      status = 'high';
      description = `High - top ${(100 - percentile).toFixed(0)}% of the year`;
    } else if (percentile >= 50) {
      status = 'above_normal';
      description = `Above normal - top ${(100 - percentile).toFixed(0)}% of the year`;
    } else if (percentile >= 25) {
      status = 'normal';
      description = 'Normal range';
    } else {
      status = 'low';
      description = 'Below normal';
    }

    return {
      current,
      statistics: {
        average: average.toFixed(2),
        median: median.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        percentile: percentile.toFixed(1),
        status,
        description
      },
      historicalData: {
        values: validDischarges,
        dates: dates.slice(0, validDischarges.length),
        dataPoints: validDischarges.length
      },
      location: { latitude, longitude },
      unit: 'm³/s',
      timestamp: new Date().toISOString(),
      source: 'Open Meteo Flood API'
    };
  }

  /**
   * Calculate percentile ranking for a value in a sorted array
   * @param {number} value - Value to rank
   * @param {Array} sortedArray - Sorted array of values
   * @returns {number} - Percentile (0-100)
   */
  calculatePercentile(value, sortedArray) {
    if (sortedArray.length === 0) return 0;
    
    let belowCount = 0;
    let equalCount = 0;
    
    for (const val of sortedArray) {
      if (val < value) {
        belowCount++;
      } else if (val === value) {
        equalCount++;
      }
    }
    
    return ((belowCount + 0.5 * equalCount) / sortedArray.length) * 100;
  }

  /**
   * Get comprehensive weather data including hourly forecasts
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {number} forecastDays - Days to forecast (default: 3)
   * @returns {Promise} - Comprehensive weather data
   */
  async getComprehensiveWeatherData(latitude, longitude, forecastDays = 3) {
    try {
      const response = await fetch(
        `${this.baseUrl}/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m,pressure_msl&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_hours&forecast_days=${forecastDays}`
      );
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      
      return this.processWeatherData(data, latitude, longitude);
    } catch (error) {
      console.error('Error fetching comprehensive weather data:', error);
      return this.getMockWeatherData(latitude, longitude);
    }
  }

  /**
   * Process weather data to extract meaningful patterns and descriptions
   * @param {Object} data - Raw weather API response
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Object} - Processed weather data
   */
  processWeatherData(data, latitude, longitude) {
    const hourly = data.hourly || {};
    const daily = data.daily || {};
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Find current conditions (nearest hour)
    const currentTemp = hourly.temperature_2m?.[currentHour] || 28;
    const currentPrecip = hourly.precipitation?.[currentHour] || 0;
    const currentHumidity = hourly.relative_humidity_2m?.[currentHour] || 75;
    const currentWindSpeed = hourly.wind_speed_10m?.[currentHour] || 10;
    const currentPressure = hourly.pressure_msl?.[currentHour] || 1010;

    // Analyze precipitation patterns
    const precipitationAnalysis = this.analyzePrecipitationPatterns(hourly.precipitation || []);
    
    return {
      current: {
        temperature: currentTemp,
        precipitation: currentPrecip,
        humidity: currentHumidity,
        windSpeed: currentWindSpeed,
        pressure: currentPressure,
        conditions: this.determineWeatherConditions(currentTemp, currentPrecip, currentHumidity)
      },
      forecast: {
        hourly: this.processHourlyData(hourly),
        daily: this.processDailyData(daily)
      },
      analysis: precipitationAnalysis,
      location: { latitude, longitude },
      timestamp: new Date().toISOString(),
      source: 'Open Meteo Weather API'
    };
  }

  /**
   * Analyze precipitation patterns to generate descriptions
   * @param {Array} precipitationData - Hourly precipitation data
   * @returns {Object} - Precipitation analysis
   */
  analyzePrecipitationPatterns(precipitationData) {
    if (!precipitationData || precipitationData.length === 0) {
      return { description: 'No precipitation data available', duration: 0, intensity: 'none' };
    }

    const significantPrecip = precipitationData.filter(p => p > 1); // > 1mm/h
    const heavyPrecip = precipitationData.filter(p => p > 10); // > 10mm/h
    
    let description = '';
    let duration = 0;
    let maxIntensity = Math.max(...precipitationData);
    
    if (significantPrecip.length === 0) {
      description = 'No significant rainfall expected';
    } else {
      // Find continuous periods of rain
      const rainPeriods = this.findContinuousRainPeriods(precipitationData);
      const longestPeriod = rainPeriods.reduce((max, period) => 
        period.duration > max.duration ? period : max, { duration: 0 });
      
      duration = longestPeriod.duration;
      
      if (heavyPrecip.length > 0) {
        description = `Heavy rainfall expected to continue for ${duration} hours`;
      } else if (duration > 6) {
        description = `Moderate rainfall expected for ${duration} hours`;
      } else if (duration > 2) {
        description = `Light to moderate rainfall for ${duration} hours`;
      } else {
        description = `Brief periods of rainfall expected`;
      }
    }

    return {
      description,
      duration,
      intensity: this.categorizeRainfallIntensity(maxIntensity),
      maxIntensity,
      periodsCount: this.findContinuousRainPeriods(precipitationData).length,
      totalExpected: precipitationData.reduce((sum, p) => sum + p, 0)
    };
  }

  /**
   * Find continuous periods of rainfall
   * @param {Array} precipitationData - Hourly precipitation data
   * @returns {Array} - Array of rain periods with start, end, duration
   */
  findContinuousRainPeriods(precipitationData) {
    const periods = [];
    let currentPeriod = null;
    
    precipitationData.forEach((precip, hour) => {
      if (precip > 1) { // Significant rainfall threshold
        if (!currentPeriod) {
          currentPeriod = { start: hour, end: hour, duration: 1 };
        } else {
          currentPeriod.end = hour;
          currentPeriod.duration = hour - currentPeriod.start + 1;
        }
      } else if (currentPeriod) {
        periods.push(currentPeriod);
        currentPeriod = null;
      }
    });
    
    if (currentPeriod) {
      periods.push(currentPeriod);
    }
    
    return periods;
  }

  /**
   * Process hourly weather data
   * @param {Object} hourlyData - Raw hourly data
   * @returns {Array} - Processed hourly forecast
   */
  processHourlyData(hourlyData) {
    const hours = [];
    const length = Math.min(48, hourlyData.time?.length || 0); // Next 48 hours
    
    for (let i = 0; i < length; i++) {
      hours.push({
        time: hourlyData.time?.[i],
        temperature: hourlyData.temperature_2m?.[i] || 28,
        precipitation: hourlyData.precipitation?.[i] || 0,
        humidity: hourlyData.relative_humidity_2m?.[i] || 75,
        windSpeed: hourlyData.wind_speed_10m?.[i] || 10,
        pressure: hourlyData.pressure_msl?.[i] || 1010
      });
    }
    
    return hours;
  }

  /**
   * Process daily weather data
   * @param {Object} dailyData - Raw daily data
   * @returns {Array} - Processed daily forecast
   */
  processDailyData(dailyData) {
    const days = [];
    const length = Math.min(3, dailyData.time?.length || 0); // Next 3 days
    
    for (let i = 0; i < length; i++) {
      days.push({
        date: dailyData.time?.[i],
        maxTemp: dailyData.temperature_2m_max?.[i] || 32,
        minTemp: dailyData.temperature_2m_min?.[i] || 24,
        precipitation: dailyData.precipitation_sum?.[i] || 0,
        precipitationHours: dailyData.precipitation_hours?.[i] || 0
      });
    }
    
    return days;
  }

  /**
   * Determine current weather conditions description
   * @param {number} temp - Temperature
   * @param {number} precip - Precipitation
   * @param {number} humidity - Humidity
   * @returns {string} - Weather conditions description
   */
  determineWeatherConditions(temp, precip, humidity) {
    if (precip > 20) return 'Heavy rain';
    if (precip > 5) return 'Moderate rain';
    if (precip > 1) return 'Light rain';
    if (humidity > 85 && temp > 30) return 'Hot and humid';
    if (humidity > 90) return 'Very humid';
    if (temp > 32) return 'Hot';
    if (temp < 20) return 'Cool';
    return 'Clear';
  }

  /**
   * Categorize rainfall intensity
   * @param {number} intensity - Rainfall in mm/h
   * @returns {string} - Intensity category
   */
  categorizeRainfallIntensity(intensity) {
    if (intensity > 50) return 'extreme';
    if (intensity > 20) return 'very_heavy';
    if (intensity > 10) return 'heavy';
    if (intensity > 2.5) return 'moderate';
    if (intensity > 0.5) return 'light';
    return 'none';
  }

  // Mock data methods for fallback when APIs are unavailable
  getMockElevationData(latitude, longitude) {
    // Generate realistic elevation based on coordinates
    const baseElevation = Math.abs(latitude * longitude * 10) % 500;
    return {
      elevation: Math.round(baseElevation),
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
      source: 'Mock Data',
      isMock: true
    };
  }

  getMockRiverDischargeData(latitude, longitude, months = 12) {
    // Generate realistic discharge patterns
    const baseDischarge = 50 + (Math.abs(latitude * longitude) % 200);
    const current = baseDischarge * (0.8 + Math.random() * 0.4);
    const values = Array.from({ length: months * 30 }, () => 
      baseDischarge * (0.3 + Math.random() * 1.4)
    );
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const percentile = this.calculatePercentile(current, sortedValues);
    
    return {
      current: current.toFixed(2),
      statistics: {
        average: (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2),
        median: sortedValues[Math.floor(sortedValues.length / 2)].toFixed(2),
        min: Math.min(...values).toFixed(2),
        max: Math.max(...values).toFixed(2),
        percentile: percentile.toFixed(1),
        status: percentile > 90 ? 'very_high' : percentile > 75 ? 'high' : 'normal',
        description: percentile > 90 ? `Top ${(100 - percentile).toFixed(0)}% of year` : 'Normal range'
      },
      historicalData: {
        values,
        dataPoints: values.length
      },
      location: { latitude, longitude },
      unit: 'm³/s',
      timestamp: new Date().toISOString(),
      source: 'Mock Data',
      isMock: true
    };
  }

  getMockCurrentRiverDischarge(latitude, longitude) {
    const discharge = 50 + (Math.abs(latitude * longitude) % 200) * (0.8 + Math.random() * 0.4);
    return {
      current: discharge.toFixed(2),
      date: new Date().toISOString().split('T')[0],
      latitude,
      longitude,
      unit: 'm³/s',
      timestamp: new Date().toISOString(),
      source: 'Mock Data',
      isMock: true
    };
  }

  getMockWeatherData(latitude, longitude) {
    const precipitationData = Array.from({ length: 48 }, () => Math.random() * 15);
    
    return {
      current: {
        temperature: 25 + Math.random() * 10,
        precipitation: Math.random() * 10,
        humidity: 60 + Math.random() * 30,
        windSpeed: 5 + Math.random() * 15,
        pressure: 1005 + Math.random() * 15,
        conditions: 'Partly cloudy'
      },
      forecast: {
        hourly: Array.from({ length: 48 }, (_, i) => ({
          time: new Date(Date.now() + i * 60 * 60 * 1000).toISOString(),
          temperature: 25 + Math.random() * 8,
          precipitation: precipitationData[i],
          humidity: 60 + Math.random() * 30,
          windSpeed: 5 + Math.random() * 15,
          pressure: 1005 + Math.random() * 15
        })),
        daily: Array.from({ length: 3 }, (_, i) => ({
          date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          maxTemp: 30 + Math.random() * 5,
          minTemp: 22 + Math.random() * 5,
          precipitation: Math.random() * 20,
          precipitationHours: Math.random() * 8
        }))
      },
      analysis: this.analyzePrecipitationPatterns(precipitationData),
      location: { latitude, longitude },
      timestamp: new Date().toISOString(),
      source: 'Mock Data',
      isMock: true
    };
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }
}

// Create singleton instance
const openMeteoService = new OpenMeteoService();

export default openMeteoService;