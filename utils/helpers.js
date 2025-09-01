import { COLORS, RISK_THRESHOLDS, RISK_LEVELS } from './constants';

/**
 * Get risk color based on probability
 * @param {number} probability - Risk probability (0-1)
 * @returns {string} - Hex color code
 */
export const getRiskColor = (probability) => {
  if (probability >= RISK_THRESHOLDS.HIGH) {
    return COLORS.RISK_VERY_HIGH;
  } else if (probability >= RISK_THRESHOLDS.MEDIUM) {
    return COLORS.RISK_HIGH;
  } else if (probability >= RISK_THRESHOLDS.LOW) {
    return COLORS.RISK_MEDIUM;
  } else {
    return COLORS.RISK_LOW;
  }
};

/**
 * Get risk level based on probability
 * @param {number} probability - Risk probability (0-1)
 * @returns {string} - Risk level string
 */
export const getRiskLevel = (probability) => {
  if (probability >= RISK_THRESHOLDS.HIGH) {
    return RISK_LEVELS.VERY_HIGH;
  } else if (probability >= RISK_THRESHOLDS.MEDIUM) {
    return RISK_LEVELS.HIGH;
  } else if (probability >= RISK_THRESHOLDS.LOW) {
    return RISK_LEVELS.MEDIUM;
  } else {
    return RISK_LEVELS.LOW;
  }
};

/**
 * Format time remaining for countdown
 * @param {Object} timeObj - Object with hours, minutes, seconds
 * @returns {string} - Formatted time string
 */
export const formatTimeRemaining = (timeObj) => {
  const { hours, minutes, seconds } = timeObj;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Format probability as percentage
 * @param {number} probability - Risk probability (0-1)
 * @returns {string} - Formatted percentage
 */
export const formatProbability = (probability) => {
  return `${Math.round(probability * 100)}%`;
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format time for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted time string
 */
export const formatTime = (date) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format date and time for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date and time string
 */
export const formatDateTime = (date) => {
  return `${formatDate(date)} at ${formatTime(date)}`;
};

/**
 * Get time-based gradient colors
 * @returns {Array} - Array of gradient colors
 */
export const getTimeBasedGradient = () => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return COLORS.GRADIENT_MORNING;
  } else if (hour >= 12 && hour < 18) {
    return COLORS.GRADIENT_AFTERNOON;
  } else if (hour >= 18 && hour < 21) {
    return COLORS.GRADIENT_EVENING;
  } else {
    return COLORS.GRADIENT_NIGHT;
  }
};

/**
 * Calculate distance between two coordinates
 * @param {Object} coord1 - First coordinate {latitude, longitude}
 * @param {Object} coord2 - Second coordinate {latitude, longitude}
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
  const dLon = (coord2.longitude - coord1.longitude) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * (Math.PI / 180)) *
    Math.cos(coord2.latitude * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Malaysian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Whether phone is valid
 */
export const isValidMalaysianPhone = (phone) => {
  // Malaysian phone format: +60xxxxxxxxx or 0xxxxxxxxx
  const phoneRegex = /^(\+?60|0)[1-9]\d{7,9}$/;
  return phoneRegex.test(phone.replace(/\s|-/g, ''));
};

/**
 * Format phone number for display
 * @param {string} phone - Phone number to format
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('60')) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0')) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  
  return phone;
};

/**
 * Generate unique ID
 * @returns {string} - Unique ID
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} - Whether object is empty
 */
export const isEmpty = (obj) => {
  if (obj == null) return true;
  if (typeof obj === 'string' || Array.isArray(obj)) return obj.length === 0;
  return Object.keys(obj).length === 0;
};

/**
 * Deep clone object
 * @param {any} obj - Object to clone
 * @returns {any} - Cloned object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (Array.isArray(obj)) return obj.map(deepClone);
  
  const cloned = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone(obj[key]);
  });
  return cloned;
};

/**
 * Convert meters to feet
 * @param {number} meters - Distance in meters
 * @returns {number} - Distance in feet
 */
export const metersToFeet = (meters) => {
  return meters * 3.28084;
};

/**
 * Convert millimeters to inches
 * @param {number} mm - Distance in millimeters
 * @returns {number} - Distance in inches
 */
export const mmToInches = (mm) => {
  return mm / 25.4;
};

/**
 * Get relative time string
 * @param {string|Date} date - Date to compare
 * @returns {string} - Relative time string
 */
export const getRelativeTime = (date) => {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return formatDate(date);
};

/**
 * Validate Malaysian coordinates
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {boolean} - Whether coordinates are within Malaysia
 */
export const isWithinMalaysia = (latitude, longitude) => {
  // Approximate boundaries for Malaysia
  const MALAYSIA_BOUNDS = {
    north: 7.5,
    south: 0.5,
    east: 119.5,
    west: 99.5
  };
  
  return (
    latitude >= MALAYSIA_BOUNDS.south &&
    latitude <= MALAYSIA_BOUNDS.north &&
    longitude >= MALAYSIA_BOUNDS.west &&
    longitude <= MALAYSIA_BOUNDS.east
  );
};