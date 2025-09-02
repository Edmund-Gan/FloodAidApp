import openMeteoService from './OpenMeteoService';
import { PRECIPITATION_THRESHOLDS, RISK_LEVELS } from '../utils/constants';

class EnvironmentalAnalysisService {
  constructor() {
    this.analysisCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate comprehensive environmental analysis for flood alert
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {number} floodProbability - Current flood probability (0-1)
   * @returns {Promise<Object>} - Comprehensive environmental analysis
   */
  async generateComprehensiveAnalysis(latitude, longitude, floodProbability = 0.5) {
    const cacheKey = `analysis_${latitude}_${longitude}_${Math.round(floodProbability * 100)}`;
    
    if (this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Gather all environmental data in parallel
      const [weatherData, riverData, elevationData] = await Promise.all([
        openMeteoService.getComprehensiveWeatherData(latitude, longitude),
        openMeteoService.getHistoricalRiverDischarge(latitude, longitude),
        openMeteoService.getElevationData(latitude, longitude)
      ]);

      // Generate comprehensive analysis
      const analysis = {
        weatherConditions: this.analyzeWeatherConditions(weatherData, floodProbability),
        riverStatus: this.analyzeRiverStatus(riverData, floodProbability),
        geographicalFactors: this.analyzeGeographicalFactors(elevationData, latitude, longitude, floodProbability),
        overallRisk: this.calculateOverallRisk(weatherData, riverData, elevationData, floodProbability),
        location: { latitude, longitude },
        timestamp: new Date().toISOString()
      };

      // Cache the analysis
      this.analysisCache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now()
      });

      return analysis;
    } catch (error) {
      console.error('Error generating environmental analysis:', error);
      return this.generateMockAnalysis(latitude, longitude, floodProbability);
    }
  }

  /**
   * Analyze weather conditions contributing to flood risk
   * @param {Object} weatherData - Comprehensive weather data
   * @param {number} floodProbability - Current flood probability
   * @returns {Object} - Weather conditions analysis
   */
  analyzeWeatherConditions(weatherData, floodProbability) {
    const { current, analysis, forecast } = weatherData;
    
    // Generate primary description based on precipitation analysis
    let primaryDescription = analysis.description;
    
    // Enhance description based on current conditions
    const contributingFactors = [];
    
    if (current.precipitation > PRECIPITATION_THRESHOLDS.MODERATE) {
      contributingFactors.push(`Heavy rainfall currently falling (${current.precipitation.toFixed(1)}mm/h)`);
    } else if (current.precipitation > PRECIPITATION_THRESHOLDS.LIGHT) {
      contributingFactors.push(`Moderate rainfall currently observed (${current.precipitation.toFixed(1)}mm/h)`);
    }
    
    if (current.humidity > 90) {
      contributingFactors.push('Extremely high humidity creating favorable conditions for continued rainfall');
    } else if (current.humidity > 85) {
      contributingFactors.push('Very high humidity supporting storm development');
    }
    
    if (current.pressure < 1005) {
      contributingFactors.push('Low atmospheric pressure indicating unstable weather conditions');
    }
    
    if (current.windSpeed > 20) {
      contributingFactors.push('Strong winds may intensify storm systems');
    }

    // Analyze forecast patterns
    const next24hPrecip = forecast.daily[0]?.precipitation || 0;
    if (next24hPrecip > 50) {
      contributingFactors.push(`Significant rainfall expected in next 24h (${next24hPrecip.toFixed(1)}mm)`);
    }

    // Determine severity level
    let severityLevel, severityDescription;
    if (floodProbability > 0.8) {
      severityLevel = 'critical';
      severityDescription = 'Critical weather conditions with immediate flood threat';
    } else if (floodProbability > 0.6) {
      severityLevel = 'severe';
      severityDescription = 'Severe weather conditions increasing flood likelihood';
    } else if (floodProbability > 0.4) {
      severityLevel = 'moderate';
      severityDescription = 'Concerning weather patterns requiring monitoring';
    } else {
      severityLevel = 'low';
      severityDescription = 'Current weather conditions pose minimal flood risk';
    }

    return {
      primaryDescription,
      severityLevel,
      severityDescription,
      contributingFactors,
      currentConditions: {
        temperature: `${current.temperature.toFixed(1)}°C`,
        precipitation: `${current.precipitation.toFixed(1)}mm/h`,
        humidity: `${current.humidity.toFixed(0)}%`,
        windSpeed: `${current.windSpeed.toFixed(1)}km/h`,
        pressure: `${current.pressure.toFixed(1)}hPa`,
        conditions: current.conditions
      },
      forecast: {
        next6Hours: this.summarizeForecastPeriod(forecast.hourly.slice(0, 6)),
        next24Hours: forecast.daily[0] ? {
          maxTemp: `${forecast.daily[0].maxTemp.toFixed(1)}°C`,
          minTemp: `${forecast.daily[0].minTemp.toFixed(1)}°C`,
          precipitation: `${forecast.daily[0].precipitation.toFixed(1)}mm`,
          precipitationHours: `${forecast.daily[0].precipitationHours}h`
        } : null
      },
      rainPatterns: {
        intensity: analysis.intensity,
        duration: `${analysis.duration} hours`,
        totalExpected: `${analysis.totalExpected.toFixed(1)}mm`,
        periodsCount: analysis.periodsCount
      }
    };
  }

  /**
   * Analyze river/water level status
   * @param {Object} riverData - Historical river discharge data
   * @param {number} floodProbability - Current flood probability
   * @returns {Object} - River status analysis
   */
  analyzeRiverStatus(riverData, floodProbability) {
    const { current, statistics } = riverData;
    
    // Generate status description
    let statusDescription = statistics.description;
    let riskLevel = statistics.status;
    
    // Enhance description based on percentile
    const percentileNum = parseFloat(statistics.percentile);
    let visualIndicator, warningLevel;
    
    if (percentileNum >= 98) {
      visualIndicator = '🔴 EXTREME';
      warningLevel = 'critical';
      statusDescription = `River discharge at extreme levels - highest ${(100 - percentileNum).toFixed(0)}% of the year`;
    } else if (percentileNum >= 95) {
      visualIndicator = '🟠 VERY HIGH';
      warningLevel = 'severe';
      statusDescription = `River discharge very high - top ${(100 - percentileNum).toFixed(0)}% of the year`;
    } else if (percentileNum >= 90) {
      visualIndicator = '🟡 HIGH';
      warningLevel = 'moderate';
      statusDescription = `River discharge elevated - top ${(100 - percentileNum).toFixed(0)}% of the year`;
    } else if (percentileNum >= 75) {
      visualIndicator = '🔵 ABOVE NORMAL';
      warningLevel = 'low';
      statusDescription = `River discharge above normal - top ${(100 - percentileNum).toFixed(0)}% of the year`;
    } else if (percentileNum >= 25) {
      visualIndicator = '🟢 NORMAL';
      warningLevel = 'minimal';
      statusDescription = 'River discharge within normal range';
    } else {
      visualIndicator = '⚪ LOW';
      warningLevel = 'minimal';
      statusDescription = 'River discharge below normal levels';
    }

    // Analyze trend (simplified - in real implementation, would use time series)
    const currentVal = parseFloat(current);
    const averageVal = parseFloat(statistics.average);
    const trendDirection = currentVal > averageVal * 1.2 ? 'rising' : 
                          currentVal < averageVal * 0.8 ? 'falling' : 'stable';
    
    let trendDescription;
    if (trendDirection === 'rising') {
      trendDescription = 'Water levels are rising and may continue to increase';
    } else if (trendDirection === 'falling') {
      trendDescription = 'Water levels are receding from previous highs';
    } else {
      trendDescription = 'Water levels are relatively stable';
    }

    // Calculate flood risk contribution
    let floodRiskContribution = 'minimal';
    if (percentileNum >= 95) {
      floodRiskContribution = 'critical';
    } else if (percentileNum >= 90) {
      floodRiskContribution = 'high';
    } else if (percentileNum >= 75) {
      floodRiskContribution = 'moderate';
    }

    return {
      primaryDescription: statusDescription,
      visualIndicator,
      warningLevel,
      floodRiskContribution,
      currentStatus: {
        discharge: `${current} m³/s`,
        percentile: `${statistics.percentile}%`,
        status: riskLevel
      },
      historicalContext: {
        average: `${statistics.average} m³/s`,
        median: `${statistics.median} m³/s`,
        yearlyRange: `${statistics.min} - ${statistics.max} m³/s`,
        dataPoints: riverData.historicalData?.dataPoints || 0
      },
      trend: {
        direction: trendDirection,
        description: trendDescription
      },
      riskFactors: this.generateRiverRiskFactors(percentileNum, trendDirection)
    };
  }

  /**
   * Analyze geographical factors affecting flood risk
   * @param {Object} elevationData - Elevation data
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {number} floodProbability - Current flood probability
   * @returns {Object} - Geographical factors analysis
   */
  analyzeGeographicalFactors(elevationData, latitude, longitude, floodProbability) {
    const elevation = elevationData.elevation || 0;
    
    // Classify elevation risk
    let elevationRisk, elevationDescription, floodRiskLevel;
    
    if (elevation < 10) {
      elevationRisk = 'critical';
      elevationDescription = `Your area is at very low elevation (${elevation}m) with extremely high flood risk`;
      floodRiskLevel = 'Very High - Near sea level or river basin';
    } else if (elevation < 50) {
      elevationRisk = 'high';
      elevationDescription = `Your area is at low elevation (${elevation}m) with increased flood vulnerability`;
      floodRiskLevel = 'High - Low-lying area prone to flooding';
    } else if (elevation < 100) {
      elevationRisk = 'moderate';
      elevationDescription = `Your area is at moderate elevation (${elevation}m) with some flood risk`;
      floodRiskLevel = 'Moderate - Elevation provides some protection';
    } else if (elevation < 200) {
      elevationRisk = 'low';
      elevationDescription = `Your area is at elevated position (${elevation}m) with reduced flood risk`;
      floodRiskLevel = 'Low - Higher ground reduces risk';
    } else {
      elevationRisk = 'minimal';
      elevationDescription = `Your area is at high elevation (${elevation}m) with minimal flood risk`;
      floodRiskLevel = 'Minimal - Elevated terrain well above flood zones';
    }

    // Generate location-specific insights
    const locationInsights = this.generateLocationInsights(latitude, longitude, elevation);
    
    // Risk mitigation factors
    const mitigationFactors = [];
    if (elevation > 100) {
      mitigationFactors.push('Higher elevation provides natural protection');
    }
    if (latitude > 4) { // Northern Malaysia typically has better drainage
      mitigationFactors.push('Regional topography may aid water drainage');
    }
    
    // Risk amplification factors
    const amplificationFactors = [];
    if (elevation < 50) {
      amplificationFactors.push('Low elevation increases water accumulation risk');
    }
    if (this.isNearCoastal(latitude, longitude)) {
      amplificationFactors.push('Coastal proximity may affect drainage efficiency');
    }
    if (this.isNearUrbanArea(latitude, longitude)) {
      amplificationFactors.push('Urban development may impact natural drainage patterns');
    }

    return {
      primaryDescription: elevationDescription,
      elevationRisk,
      floodRiskLevel,
      elevation: {
        meters: elevation,
        feet: Math.round(elevation * 3.28084),
        category: this.categorizeElevation(elevation)
      },
      locationCharacteristics: locationInsights,
      riskFactors: {
        mitigating: mitigationFactors,
        amplifying: amplificationFactors
      },
      drainageAssessment: this.assessDrainageRisk(latitude, longitude, elevation),
      regionalContext: this.getRegionalContext(latitude, longitude)
    };
  }

  /**
   * Calculate overall environmental risk
   * @param {Object} weatherData - Weather data
   * @param {Object} riverData - River data
   * @param {Object} elevationData - Elevation data
   * @param {number} floodProbability - Current flood probability
   * @returns {Object} - Overall risk assessment
   */
  calculateOverallRisk(weatherData, riverData, elevationData, floodProbability) {
    const weatherRisk = this.calculateWeatherRiskScore(weatherData);
    const riverRisk = this.calculateRiverRiskScore(riverData);
    const geographicalRisk = this.calculateGeographicalRiskScore(elevationData);
    
    const overallScore = (weatherRisk * 0.4 + riverRisk * 0.35 + geographicalRisk * 0.25);
    
    let riskLevel, confidence, summary;
    if (overallScore >= 85) {
      riskLevel = 'Critical';
      confidence = 'Very High';
      summary = 'Multiple environmental factors combine to create extreme flood conditions';
    } else if (overallScore >= 70) {
      riskLevel = 'High';
      confidence = 'High';
      summary = 'Several environmental factors indicate significant flood risk';
    } else if (overallScore >= 50) {
      riskLevel = 'Moderate';
      confidence = 'Moderate';
      summary = 'Environmental conditions create elevated flood potential';
    } else if (overallScore >= 30) {
      riskLevel = 'Low';
      confidence = 'Moderate';
      summary = 'Current environmental conditions pose limited flood threat';
    } else {
      riskLevel = 'Very Low';
      confidence = 'High';
      summary = 'Environmental factors do not support significant flood development';
    }

    return {
      riskLevel,
      confidence,
      summary,
      score: overallScore.toFixed(1),
      components: {
        weather: weatherRisk.toFixed(1),
        river: riverRisk.toFixed(1),
        geographical: geographicalRisk.toFixed(1)
      },
      keyFactors: this.identifyKeyRiskFactors(weatherData, riverData, elevationData)
    };
  }

  // Helper methods
  summarizeForecastPeriod(hourlyData) {
    const avgTemp = hourlyData.reduce((sum, h) => sum + h.temperature, 0) / hourlyData.length;
    const totalPrecip = hourlyData.reduce((sum, h) => sum + h.precipitation, 0);
    const maxPrecip = Math.max(...hourlyData.map(h => h.precipitation));
    
    return {
      averageTemp: `${avgTemp.toFixed(1)}°C`,
      totalPrecipitation: `${totalPrecip.toFixed(1)}mm`,
      maxIntensity: `${maxPrecip.toFixed(1)}mm/h`
    };
  }

  generateRiverRiskFactors(percentile, trend) {
    const factors = [];
    
    if (percentile >= 95) {
      factors.push('River discharge at extreme levels historically associated with flooding');
    }
    if (percentile >= 90) {
      factors.push('Water levels approaching or exceeding typical flood thresholds');
    }
    if (trend === 'rising') {
      factors.push('Continuing upward trend increases flood likelihood');
    }
    if (percentile >= 85 && trend === 'rising') {
      factors.push('High water levels combined with rising trend creates critical conditions');
    }
    
    return factors.length > 0 ? factors : ['Current water levels within manageable range'];
  }

  generateLocationInsights(latitude, longitude, elevation) {
    const insights = [];
    
    // Malaysia-specific insights
    if (latitude >= 5.5) { // Northern Peninsula
      insights.push('Northern Peninsula location with monsoon influence');
    } else if (latitude >= 2.5) { // Central Peninsula
      insights.push('Central Peninsula urban corridor with modified drainage');
    } else if (latitude >= 1) { // Southern Peninsula
      insights.push('Southern Peninsula location with tidal influences');
    } else { // East Malaysia
      insights.push('East Malaysia location with tropical river systems');
    }

    if (longitude <= 103 && latitude >= 1) { // Peninsular Malaysia
      insights.push('Peninsular Malaysia with established drainage infrastructure');
    } else { // East Malaysia (Sabah/Sarawak)
      insights.push('East Malaysia with natural river basin drainage');
    }

    return insights;
  }

  isNearCoastal(latitude, longitude) {
    // Simplified coastal proximity check for Malaysia
    return (
      (latitude <= 6.5 && longitude <= 100.5) || // West coast Peninsula
      (latitude <= 4.5 && longitude >= 103.5) || // East coast Peninsula
      (latitude >= 4.5 && longitude <= 118 && longitude >= 115) || // Sabah coast
      (latitude <= 3 && longitude <= 115 && longitude >= 109) // Sarawak coast
    );
  }

  isNearUrbanArea(latitude, longitude) {
    // Major Malaysian urban areas (simplified)
    const urbanAreas = [
      {lat: 3.139, lng: 101.687, name: 'Kuala Lumpur'}, // KL
      {lat: 5.414, lng: 100.329, name: 'Georgetown'}, // Penang
      {lat: 1.464, lng: 103.761, name: 'Johor Bahru'}, // JB
      {lat: 5.979, lng: 116.075, name: 'Kota Kinabalu'}, // KK
    ];
    
    return urbanAreas.some(area => 
      Math.abs(latitude - area.lat) < 0.5 && Math.abs(longitude - area.lng) < 0.5
    );
  }

  categorizeElevation(elevation) {
    if (elevation < 10) return 'Sea level / River plain';
    if (elevation < 50) return 'Low-lying area';
    if (elevation < 100) return 'Moderate elevation';
    if (elevation < 200) return 'Elevated terrain';
    if (elevation < 500) return 'Hill country';
    return 'Highland area';
  }

  assessDrainageRisk(latitude, longitude, elevation) {
    let drainageEfficiency = 'moderate';
    let description = 'Standard drainage capacity expected';
    
    if (elevation < 10) {
      drainageEfficiency = 'poor';
      description = 'Low elevation severely limits natural drainage';
    } else if (elevation < 50) {
      drainageEfficiency = 'limited';
      description = 'Limited natural drainage due to low elevation';
    } else if (elevation > 100) {
      drainageEfficiency = 'good';
      description = 'Elevation supports natural water runoff';
    }
    
    // Adjust for urban areas
    if (this.isNearUrbanArea(latitude, longitude)) {
      description += ' (urban drainage systems present)';
    }
    
    return { efficiency: drainageEfficiency, description };
  }

  getRegionalContext(latitude, longitude) {
    if (latitude >= 6) {
      return 'Northern Malaysia - monsoon-dominated climate with seasonal flooding patterns';
    } else if (latitude >= 4) {
      return 'Central Malaysia - equatorial climate with year-round precipitation';
    } else if (latitude >= 2 && longitude <= 104) {
      return 'Southern Peninsula - influenced by both monsoons and maritime weather';
    } else {
      return 'East Malaysia - tropical climate with river basin flooding patterns';
    }
  }

  calculateWeatherRiskScore(weatherData) {
    const { current, analysis } = weatherData;
    let score = 0;
    
    // Current precipitation contribution (40%)
    if (current.precipitation > PRECIPITATION_THRESHOLDS.EXTREME) score += 40;
    else if (current.precipitation > PRECIPITATION_THRESHOLDS.HEAVY) score += 30;
    else if (current.precipitation > PRECIPITATION_THRESHOLDS.MODERATE) score += 20;
    else if (current.precipitation > PRECIPITATION_THRESHOLDS.LIGHT) score += 10;
    
    // Duration factor (25%)
    if (analysis.duration > 12) score += 25;
    else if (analysis.duration > 6) score += 18;
    else if (analysis.duration > 3) score += 12;
    else if (analysis.duration > 1) score += 6;
    
    // Atmospheric conditions (35%)
    if (current.humidity > 95 && current.pressure < 1000) score += 35;
    else if (current.humidity > 90 && current.pressure < 1005) score += 25;
    else if (current.humidity > 85) score += 15;
    else if (current.humidity > 80) score += 8;
    
    return Math.min(score, 100);
  }

  calculateRiverRiskScore(riverData) {
    const percentile = parseFloat(riverData.statistics.percentile);
    
    if (percentile >= 98) return 95;
    if (percentile >= 95) return 85;
    if (percentile >= 90) return 75;
    if (percentile >= 75) return 60;
    if (percentile >= 50) return 40;
    if (percentile >= 25) return 25;
    return 10;
  }

  calculateGeographicalRiskScore(elevationData) {
    const elevation = elevationData.elevation || 0;
    
    if (elevation < 5) return 90;
    if (elevation < 10) return 80;
    if (elevation < 25) return 70;
    if (elevation < 50) return 55;
    if (elevation < 100) return 40;
    if (elevation < 200) return 25;
    return 15;
  }

  identifyKeyRiskFactors(weatherData, riverData, elevationData) {
    const factors = [];
    
    // Weather factors
    if (weatherData.current.precipitation > PRECIPITATION_THRESHOLDS.HEAVY) {
      factors.push('Heavy rainfall currently occurring');
    }
    if (weatherData.analysis.duration > 8) {
      factors.push('Extended precipitation duration');
    }
    
    // River factors
    const percentile = parseFloat(riverData.statistics.percentile);
    if (percentile >= 90) {
      factors.push('River discharge at critical levels');
    }
    
    // Elevation factors
    if (elevationData.elevation < 50) {
      factors.push('Low elevation increases flood vulnerability');
    }
    
    return factors;
  }

  // Mock data for testing
  generateMockAnalysis(latitude, longitude, floodProbability) {
    return {
      weatherConditions: {
        primaryDescription: 'Heavy rainfall expected to continue for 6 hours',
        severityLevel: 'moderate',
        severityDescription: 'Concerning weather patterns requiring monitoring',
        contributingFactors: [
          'Moderate rainfall currently observed (8.5mm/h)',
          'Very high humidity supporting storm development',
          'Low atmospheric pressure indicating unstable conditions'
        ],
        currentConditions: {
          temperature: '28.5°C',
          precipitation: '8.5mm/h',
          humidity: '89%',
          windSpeed: '12.3km/h',
          pressure: '1007.2hPa',
          conditions: 'Light rain'
        }
      },
      riverStatus: {
        primaryDescription: 'River discharge elevated - top 15% of the year',
        visualIndicator: '🟡 HIGH',
        warningLevel: 'moderate',
        currentStatus: {
          discharge: '185.4 m³/s',
          percentile: '85.2%',
          status: 'high'
        },
        trend: {
          direction: 'rising',
          description: 'Water levels are rising and may continue to increase'
        }
      },
      geographicalFactors: {
        primaryDescription: `Your area is at moderate elevation (${Math.round(45 + Math.random() * 30)}m) with some flood risk`,
        elevationRisk: 'moderate',
        elevation: {
          meters: Math.round(45 + Math.random() * 30),
          category: 'Moderate elevation'
        }
      },
      overallRisk: {
        riskLevel: 'Moderate',
        confidence: 'High',
        summary: 'Environmental conditions create elevated flood potential'
      },
      isMock: true
    };
  }
}

// Create singleton instance
const environmentalAnalysisService = new EnvironmentalAnalysisService();

export default environmentalAnalysisService;