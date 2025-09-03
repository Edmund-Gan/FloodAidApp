// FloodAid App Constants

// Colors
export const COLORS = {
  // Risk Level Colors
  RISK_LOW: '#44AA44',
  RISK_MEDIUM: '#FFBB00',
  RISK_HIGH: '#FF8800',
  RISK_VERY_HIGH: '#FF4444',
  RISK_UNKNOWN: '#666666',

  // Primary Colors
  PRIMARY: '#2196F3',
  PRIMARY_DARK: '#1976D2',
  PRIMARY_LIGHT: '#BBDEFB',

  // Background Colors
  BACKGROUND: '#F5F5F5',
  SURFACE: '#FFFFFF',
  CARD_BACKGROUND: 'rgba(255,255,255,0.95)',

  // Text Colors
  TEXT_PRIMARY: '#333333',
  TEXT_SECONDARY: '#666666',
  TEXT_LIGHT: '#999999',
  TEXT_ON_PRIMARY: '#FFFFFF',

  // Gradient Colors
  GRADIENT_MORNING: ['#56CCF2', '#2F80ED'],
  GRADIENT_AFTERNOON: ['#4FACFE', '#00F2FE'],
  GRADIENT_EVENING: ['#FA709A', '#FEE140'],
  GRADIENT_NIGHT: ['#0F2027', '#203A43', '#2C5364'],

  // Status Colors
  SUCCESS: '#4CAF50',
  WARNING: '#FF9800',
  ERROR: '#F44336',
  INFO: '#2196F3',

  // Transparency
  TRANSPARENT: 'transparent',
  SEMI_TRANSPARENT: 'rgba(0,0,0,0.5)',
};

// Risk Thresholds
export const RISK_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.6,
  HIGH: 0.8,
};

// ML Model Probability Thresholds for Alerts
export const ML_ALERT_THRESHOLDS = {
  WARNING: 0.6,    // 60% - Generate warning alert
  HIGH: 0.8,       // 80% - Generate high priority alert
  TESTING_MIN: 0.5, // 50% - Minimum for developer testing
  TESTING_MAX: 0.95 // 95% - Maximum for developer testing
};

// State-Specific Accuracy Data for Confidence Descriptions
export const STATE_ACCURACY_DATA = {
  'Selangor': { 
    accuracy: 78, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Kuala Lumpur': { 
    accuracy: 82, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Johor': { 
    accuracy: 75, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Penang': { 
    accuracy: 80, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Kedah': { 
    accuracy: 74, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Perak': { 
    accuracy: 76, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Pahang': { 
    accuracy: 73, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Terengganu': { 
    accuracy: 77, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Kelantan': { 
    accuracy: 79, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Sabah': { 
    accuracy: 71, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Sarawak': { 
    accuracy: 72, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Melaka': { 
    accuracy: 81, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  'Negeri Sembilan': { 
    accuracy: 77, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  },
  // Default for unknown states
  'DEFAULT': { 
    accuracy: 75, 
    sources: ['Open Meteo', 'mywater.gov.my', 'archive.data.gov.my'] 
  }
};

// Risk Levels
export const RISK_LEVELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  VERY_HIGH: 'Very High',
  UNKNOWN: 'Unknown',
};

// Countdown Thresholds (in hours)
export const COUNTDOWN_THRESHOLDS = {
  IMMEDIATE: 2,
  URGENT: 6,
  WARNING: 12,
  ADVISORY: 24,
};

// Precipitation Thresholds (mm/hr)
export const PRECIPITATION_THRESHOLDS = {
  LIGHT: 2.5,
  MODERATE: 10,
  HEAVY: 50,
  EXTREME: 100,
};

// River Level Thresholds (ft)
export const RIVER_LEVEL_THRESHOLDS = {
  NORMAL_MIN: 4,
  NORMAL_MAX: 6,
  WARNING: 8,
  DANGER: 10,
};

// API Configuration
export const API_CONFIG = {
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  GOOGLE_MAPS_API_KEY: 'AIzaSyC-0v96Q4G43rh8tuLfzTaACTfVA-oSwGM',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  FLOOD_WARNING: 'flood_warning',
  FLOOD_WATCH: 'flood_watch',
  LOCATION_ALERT: 'location_alert',
  WEATHER_UPDATE: 'weather_update',
  EMERGENCY: 'emergency',
};

// Notification Priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  MAX: 'max',
};

// Map Styles
export const MAP_STYLES = {
  STANDARD: 'standard',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
};

// Animation Durations
export const ANIMATION_DURATION = {
  SHORT: 200,
  MEDIUM: 300,
  LONG: 500,
  EXTRA_LONG: 1000,
};

// Screen Names
export const SCREEN_NAMES = {
  FORECAST: 'Forecast',
  LIVE_DATA: 'Live Data',
  MY_LOCATIONS: 'My Locations',
  MORE: 'More',
  PREPAREDNESS: 'PreparednessScreen',
  EMERGENCY_NAVIGATION: 'EmergencyNavigationScreen',
  EMERGENCY_RESPONSE: 'EmergencyResponseScreen',
  COMMUNICATION: 'CommunicationScreen',
  POST_FLOOD: 'PostFloodScreen',
};

// Data Refresh Intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  FLOOD_DATA: 15 * 60 * 1000, // 15 minutes
  WEATHER_DATA: 5 * 60 * 1000, // 5 minutes
  LOCATION_DATA: 30 * 60 * 1000, // 30 minutes
  HOTSPOT_DATA: 10 * 60 * 1000, // 10 minutes
};

// Storage Keys
export const STORAGE_KEYS = {
  USER_PROFILE: 'userProfile',
  NOTIFICATION_SETTINGS: 'notificationSettings',
  PREFERENCES: 'preferences',
  EMERGENCY_CONTACTS: 'emergencyContacts',
  APP_USAGE: 'appUsage',
  MONITORED_LOCATIONS: 'monitoredLocations',
  CACHED_FLOOD_DATA: 'cachedFloodData',
};

// Malaysian States
export const MALAYSIAN_STATES = [
  'PERLIS',
  'KEDAH',
  'PULAU PINANG',
  'PERAK',
  'SELANGOR',
  'WILAYAH PERSEKUTUAN',
  'NEGERI SEMBILAN',
  'MELAKA',
  'JOHOR',
  'PAHANG',
  'TERENGGANU',
  'KELANTAN',
  'SABAH',
  'SARAWAK',
];

// Emergency Contact Types
export const CONTACT_TYPES = {
  EMERGENCY: 'emergency',
  FAMILY: 'family',
  FRIEND: 'friend',
  INSTITUTION: 'institution',
  AUTHORITY: 'authority',
};

// Units
export const UNITS = {
  TEMPERATURE: {
    CELSIUS: '°C',
    FAHRENHEIT: '°F',
  },
  PRECIPITATION: {
    MM: 'mm',
    INCHES: 'in',
  },
  DISTANCE: {
    KM: 'km',
    MILES: 'mi',
    METERS: 'm',
    FEET: 'ft',
  },
  SPEED: {
    KMH: 'km/h',
    MPH: 'mph',
    MS: 'm/s',
  },
};

// Feature Flags
export const FEATURES = {
  ENABLE_NOTIFICATIONS: true,
  ENABLE_LOCATION_TRACKING: true,
  ENABLE_OFFLINE_MODE: false,
  ENABLE_ANALYTICS: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_BETA_FEATURES: false,
};

// Default Values
export const DEFAULTS = {
  LOCATION_ACCURACY: 100, // meters
  MAP_ZOOM_LEVEL: 10,
  NOTIFICATION_FREQUENCY: 'important',
  LANGUAGE: 'en',
  THEME: 'auto',
  RISK_TOLERANCE: 'moderate',
};