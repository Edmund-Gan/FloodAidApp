/**
 * MalaysianStates.js - Malaysian state coordinates and mapping utilities
 * Provides central coordinates for all Malaysian states for Google Maps visualization
 */

export const MALAYSIAN_STATES = {
  'Johor': {
    latitude: 1.4927,
    longitude: 103.7414,
    name: 'Johor',
    region: 'Peninsular'
  },
  'Kedah': {
    latitude: 6.1184,
    longitude: 100.3685,
    name: 'Kedah',
    region: 'Peninsular'
  },
  'Kelantan': {
    latitude: 6.1254,
    longitude: 102.2381,
    name: 'Kelantan',
    region: 'Peninsular'
  },
  'Melaka': {
    latitude: 2.1896,
    longitude: 102.2501,
    name: 'Melaka',
    region: 'Peninsular'
  },
  'Negeri Sembilan': {
    latitude: 2.7258,
    longitude: 101.9424,
    name: 'Negeri Sembilan',
    region: 'Peninsular'
  },
  'Pahang': {
    latitude: 3.8126,
    longitude: 103.3256,
    name: 'Pahang',
    region: 'Peninsular'
  },
  'Perak': {
    latitude: 4.5975,
    longitude: 101.0901,
    name: 'Perak',
    region: 'Peninsular'
  },
  'Perlis': {
    latitude: 6.4414,
    longitude: 100.1986,
    name: 'Perlis',
    region: 'Peninsular'
  },
  'Pulau Pinang': {
    latitude: 5.4164,
    longitude: 100.3327,
    name: 'Pulau Pinang',
    region: 'Peninsular'
  },
  'Sabah': {
    latitude: 5.9788,
    longitude: 116.0753,
    name: 'Sabah',
    region: 'East Malaysia'
  },
  'Sarawak': {
    latitude: 1.5533,
    longitude: 110.3592,
    name: 'Sarawak',
    region: 'East Malaysia'
  },
  'Selangor': {
    latitude: 3.0738,
    longitude: 101.5183,
    name: 'Selangor',
    region: 'Peninsular'
  },
  'Terengganu': {
    latitude: 5.3117,
    longitude: 103.1324,
    name: 'Terengganu',
    region: 'Peninsular'
  },
  'Kuala Lumpur': {
    latitude: 3.1390,
    longitude: 101.6869,
    name: 'Kuala Lumpur',
    region: 'Federal Territory'
  },
  'Labuan': {
    latitude: 5.2831,
    longitude: 115.2308,
    name: 'Labuan',
    region: 'Federal Territory'
  },
  'Putrajaya': {
    latitude: 2.9264,
    longitude: 101.6964,
    name: 'Putrajaya',
    region: 'Federal Territory'
  },
  'Wilayah Persekutuan': {
    latitude: 3.1390,
    longitude: 101.6869,
    name: 'Wilayah Persekutuan',
    region: 'Federal Territory'
  }
};

export const MALAYSIA_BOUNDS = {
  southwest: {
    latitude: 0.8,
    longitude: 99.5
  },
  northeast: {
    latitude: 7.5,
    longitude: 119.5
  }
};

export const MALAYSIA_CENTER = {
  latitude: 4.2105,
  longitude: 101.9758
};

/**
 * Get state coordinates by name
 */
export const getStateCoordinates = (stateName) => {
  const state = MALAYSIAN_STATES[stateName];
  if (!state) {
    console.warn(`State not found: ${stateName}`);
    return null;
  }
  return {
    latitude: state.latitude,
    longitude: state.longitude
  };
};

/**
 * Get all state names
 */
export const getAllStateNames = () => {
  return Object.keys(MALAYSIAN_STATES);
};

/**
 * Group states by region
 */
export const getStatesByRegion = () => {
  const regions = {};
  Object.values(MALAYSIAN_STATES).forEach(state => {
    if (!regions[state.region]) {
      regions[state.region] = [];
    }
    regions[state.region].push(state.name);
  });
  return regions;
};

/**
 * Calculate flood density color based on event count
 */
export const getFloodDensityColor = (eventCount, maxCount) => {
  if (eventCount === 0) return '#E8F5E8';
  
  const intensity = eventCount / maxCount;
  if (intensity > 0.8) return '#D32F2F'; // Dark red - very high
  if (intensity > 0.6) return '#F44336'; // Red - high
  if (intensity > 0.4) return '#FF5722'; // Red-orange - moderate high  
  if (intensity > 0.2) return '#FF9800'; // Orange - moderate
  return '#FFC107'; // Amber - low
};

/**
 * Get marker size based on flood event count
 */
export const getMarkerSize = (eventCount, maxCount) => {
  const intensity = eventCount / maxCount;
  return Math.max(20, intensity * 40); // Size between 20-60
};