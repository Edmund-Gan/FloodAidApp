/**
 * FilterHelpers.js - Utility functions for flood hotspots filtering
 * Provides clean separation of filtering logic from UI components
 */

export const FILTER_PERIODS = {
  RECENT_30D: { key: 'recent_30d', label: 'Last 30 Days', days: 30 },
  RECENT_3M: { key: 'recent_3m', label: 'Last 3 Months', days: 90 },
  RECENT_6M: { key: 'recent_6m', label: 'Last 6 Months', days: 180 },
  RECENT_1Y: { key: 'recent_1y', label: 'Last Year', days: 365 },
  HISTORICAL: { key: 'historical', label: 'All Time', days: null }
};

export const FILTER_TYPES = {
  RECENT: 'recent',
  HISTORICAL: 'historical', 
  HIGH_RISK: 'high_risk',
  REGIONAL: 'regional'
};

export const RISK_LEVELS = {
  LOW: { min: 1, max: 2, label: 'Low Risk', color: '#4CAF50' },
  MODERATE: { min: 3, max: 3, label: 'Moderate Risk', color: '#FF9800' },
  HIGH: { min: 4, max: 5, label: 'High Risk', color: '#F44336' }
};

export const REGIONS = {
  PENINSULAR: {
    key: 'peninsular',
    label: 'Peninsular Malaysia',
    states: ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Selangor', 'Terengganu']
  },
  EAST_MALAYSIA: {
    key: 'east_malaysia',
    label: 'East Malaysia',
    states: ['Sabah', 'Sarawak']
  },
  FEDERAL_TERRITORIES: {
    key: 'federal_territories',
    label: 'Federal Territories',
    states: ['Kuala Lumpur', 'Labuan', 'Putrajaya']
  }
};

/**
 * Filter states by time period
 */
export const filterByTimePeriod = (states, period) => {
  if (!period || period === FILTER_PERIODS.HISTORICAL.key) {
    return states;
  }
  
  const filterPeriod = Object.values(FILTER_PERIODS).find(p => p.key === period);
  if (!filterPeriod || !filterPeriod.days) {
    return states;
  }

  return states.filter(state => {
    if (!state.events || state.events.length === 0) return false;
    
    return state.events.some(event => event.daysSince <= filterPeriod.days);
  });
};

/**
 * Filter states by risk level
 */
export const filterByRiskLevel = (states, riskLevel) => {
  if (!riskLevel) return states;
  
  const risk = RISK_LEVELS[riskLevel.toUpperCase()];
  if (!risk) return states;
  
  return states.filter(state => 
    state.severity >= risk.min && state.severity <= risk.max
  );
};

/**
 * Filter states by region
 */
export const filterByRegion = (states, region) => {
  if (!region) return states;
  
  const regionInfo = REGIONS[region.toUpperCase()];
  if (!regionInfo) return states;
  
  return states.filter(state => 
    regionInfo.states.includes(state.state)
  );
};

/**
 * Filter states by selected state names
 */
export const filterBySelectedStates = (states, selectedStates) => {
  if (!selectedStates || selectedStates.length === 0) {
    return states;
  }
  
  return states.filter(state => 
    selectedStates.includes(state.state)
  );
};

/**
 * Get filter counts for UI display
 */
export const getFilterCounts = (allStates) => {
  const counts = {
    all: allStates.length,
    recent: 0,
    historical: allStates.length,
    high_risk: 0,
    peninsular: 0,
    east_malaysia: 0,
    federal_territories: 0
  };

  allStates.forEach(state => {
    // Count recent activity (last year)
    if (state.recentEvents > 0) {
      counts.recent++;
    }
    
    // Count high risk states
    if (state.severity >= 4) {
      counts.high_risk++;
    }
    
    // Count by region
    if (REGIONS.PENINSULAR.states.includes(state.state)) {
      counts.peninsular++;
    } else if (REGIONS.EAST_MALAYSIA.states.includes(state.state)) {
      counts.east_malaysia++;
    } else if (REGIONS.FEDERAL_TERRITORIES.states.includes(state.state)) {
      counts.federal_territories++;
    }
  });

  return counts;
};

/**
 * Apply all filters to states
 */
export const applyFilters = (allStates, filters) => {
  let filteredStates = [...allStates];

  // Apply primary filter type
  switch (filters.primaryFilter) {
    case FILTER_TYPES.RECENT:
      filteredStates = filterByTimePeriod(filteredStates, filters.timePeriod || FILTER_PERIODS.RECENT_1Y.key);
      break;
    case FILTER_TYPES.HIGH_RISK:
      filteredStates = filterByRiskLevel(filteredStates, 'HIGH');
      break;
    case FILTER_TYPES.REGIONAL:
      if (filters.region) {
        filteredStates = filterByRegion(filteredStates, filters.region);
      }
      break;
    case FILTER_TYPES.HISTORICAL:
    default:
      // Show all states for historical view
      break;
  }

  // Apply secondary filters
  if (filters.selectedStates && filters.selectedStates.length > 0) {
    filteredStates = filterBySelectedStates(filteredStates, filters.selectedStates);
  }

  if (filters.riskLevel) {
    filteredStates = filterByRiskLevel(filteredStates, filters.riskLevel);
  }

  return filteredStates;
};

/**
 * Get quick filter presets for common use cases
 */
export const getQuickFilters = () => [
  {
    id: 'alice_region',
    label: "Alice's Region",
    icon: 'home',
    description: 'Selangor and nearby states',
    filters: {
      selectedStates: ['Selangor', 'Kuala Lumpur', 'Putrajaya'],
      primaryFilter: FILTER_TYPES.RECENT
    }
  },
  {
    id: 'top_risk',
    label: 'Top Risk States',
    icon: 'warning',
    description: 'States with highest flood frequency',
    filters: {
      primaryFilter: FILTER_TYPES.HIGH_RISK
    }
  },
  {
    id: 'east_coast',
    label: 'East Coast',
    icon: 'water',
    description: 'Monsoon-affected eastern states',
    filters: {
      selectedStates: ['Kelantan', 'Terengganu', 'Pahang'],
      primaryFilter: FILTER_TYPES.RECENT
    }
  },
  {
    id: 'recent_activity',
    label: 'Recent Activity',
    icon: 'clock',
    description: 'States with floods in last 30 days',
    filters: {
      primaryFilter: FILTER_TYPES.RECENT,
      timePeriod: FILTER_PERIODS.RECENT_30D.key
    }
  }
];

/**
 * Get state abbreviations for compact display
 */
export const getStateAbbreviation = (stateName) => {
  const abbreviations = {
    'Johor': 'JHR',
    'Kedah': 'KDH', 
    'Kelantan': 'KTN',
    'Kuala Lumpur': 'KL',
    'Labuan': 'LBN',
    'Melaka': 'MLK',
    'Negeri Sembilan': 'NSN',
    'Pahang': 'PHG',
    'Perak': 'PRK',
    'Perlis': 'PLS',
    'Pulau Pinang': 'PNG',
    'Putrajaya': 'PJY',
    'Sabah': 'SBH',
    'Sarawak': 'SWK',
    'Selangor': 'SGR',
    'Terengganu': 'TRG',
    'Wilayah Persekutuan': 'WP'
  };
  
  return abbreviations[stateName] || stateName.substring(0, 3).toUpperCase();
};

/**
 * Sort states by different criteria
 */
export const sortStates = (states, sortBy = 'flood_count') => {
  const sortedStates = [...states];
  
  switch (sortBy) {
    case 'flood_count':
      return sortedStates.sort((a, b) => b.totalEvents - a.totalEvents);
    case 'recent_activity':
      return sortedStates.sort((a, b) => b.recentEvents - a.recentEvents);
    case 'risk_level':
      return sortedStates.sort((a, b) => b.severity - a.severity);
    case 'alphabetical':
      return sortedStates.sort((a, b) => a.state.localeCompare(b.state));
    case 'last_flood':
      return sortedStates.sort((a, b) => (a.daysSince || 999999) - (b.daysSince || 999999));
    default:
      return sortedStates;
  }
};