/**
 * RiskCalculations.js - Shared risk calculation utilities
 * Centralized location for all flood risk calculations to avoid duplication
 */

// Color theme based on risk levels
export const RISK_COLORS = {
  Low: '#4CAF50',
  Moderate: '#FFC107',
  High: '#FF9800',
  'Very High': '#F44336'
};

/**
 * Get color based on probability value
 * @param {number} probability - Flood probability (0-1)
 * @returns {string} - Hex color code
 */
export const getRiskColor = (probability) => {
  if (probability < 0.3) return RISK_COLORS.Low;
  if (probability < 0.6) return RISK_COLORS.Moderate;
  if (probability < 0.8) return RISK_COLORS.High;
  return RISK_COLORS['Very High'];
};

/**
 * Epic 1: Risk Level Classification
 * High: 80-100%, Medium: 60-79%, Low: <60%
 * @param {number} probability - Flood probability (0-1)
 * @returns {string} - Risk level string
 */
export const getRiskLevel = (probability) => {
  if (probability >= 0.8) return 'High';        // 80-100%
  if (probability >= 0.6) return 'Medium';      // 60-79%
  return 'Low';                                 // <60%
};

/**
 * Calculate flood risk based on multiple weather parameters
 * @param {Object} conditions - Weather conditions
 * @returns {Object} - Risk assessment
 */
export const calculateFloodRisk = (conditions, thresholds) => {
  let riskScore = 0;
  let factors = [];

  // Precipitation risk (40% weight)
  if (conditions.precipitation > thresholds.EXTREME) {
    riskScore += 40;
    factors.push('Extreme rainfall detected');
  } else if (conditions.precipitation > thresholds.HEAVY) {
    riskScore += 30;
    factors.push('Heavy rainfall detected');
  } else if (conditions.precipitation > thresholds.MODERATE) {
    riskScore += 20;
    factors.push('Moderate rainfall detected');
  } else if (conditions.precipitation > thresholds.LIGHT) {
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
    recommendation: getFloodRecommendation(level)
  };
};

/**
 * Get flood recommendation based on risk level
 * @param {string} level - Risk level
 * @returns {string} - Recommendation
 */
export const getFloodRecommendation = (level) => {
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
};

/**
 * Get precipitation intensity classification
 * @param {number} precipitation - Precipitation in mm/hr
 * @param {Object} thresholds - Precipitation thresholds
 * @returns {string} - Intensity classification
 */
export const getPrecipitationIntensity = (precipitation, thresholds) => {
  if (precipitation >= thresholds.EXTREME) return 'extreme';
  if (precipitation >= thresholds.HEAVY) return 'heavy';
  if (precipitation >= thresholds.MODERATE) return 'moderate';
  if (precipitation >= thresholds.LIGHT) return 'light';
  return 'none';
};

/**
 * Get river level status
 * @param {number} level - River level in feet
 * @param {Object} thresholds - River level thresholds
 * @returns {string} - Status classification
 */
export const getRiverLevelStatus = (level, thresholds) => {
  if (level >= thresholds.DANGER) return 'danger';
  if (level >= thresholds.WARNING) return 'warning';
  if (level >= thresholds.NORMAL_MIN && level <= thresholds.NORMAL_MAX) return 'normal';
  return 'low';
};

export default {
  RISK_COLORS,
  getRiskColor,
  getRiskLevel,
  calculateFloodRisk,
  getFloodRecommendation,
  getPrecipitationIntensity,
  getRiverLevelStatus
};