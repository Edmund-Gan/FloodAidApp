/**
 * District Data Processing Utilities for Epic 3: Flood Hotspot Maps
 * Processes flood predictions data and Malaysian district GeoJSON for visualization
 */

// Import the CSV data and GeoJSON (in a real app, these would be loaded dynamically)
const FLOOD_DATA_PATH = '../../Datasets/flood_predictions_2025_real_weather.csv';
const GEOJSON_PATH = '../../Datasets/malaysia.district.geojson';

/**
 * District flood statistics data structure based on analysis of the CSV
 * Top districts by flood frequency:
 * - Sarawak/Sibu: 102 events
 * - Sarawak/Samarahan: 52 events  
 * - Sarawak/Selangau: 43 events
 * - Sarawak/Bintulu: 36 events
 * - WP Labuan/Labuan: 27 events
 * - Sarawak/Sri Aman: 27 events
 */

// Pre-processed district statistics from the CSV analysis
export const DISTRICT_FLOOD_STATS = {
  // High Risk Districts (20+ events)
  'Sibu': {
    state: 'Sarawak',
    displayName: 'Sibu, Sarawak',
    totalEvents: 102,
    riskLevel: 'High',
    lastFloodDate: '2025-08-20',
    coordinates: [2.3, 111.8], // Approximate center
    floodCauses: [
      'Air Sungai Melimpah',
      'Hujan Lebat / Berterusan', 
      'Saliran Dalaman'
    ],
    riverBasins: ['Batang Rajang']
  },
  'Samarahan': {
    state: 'Sarawak',
    displayName: 'Samarahan, Sarawak',
    totalEvents: 52,
    riskLevel: 'High',
    lastFloodDate: '2025-06-27',
    coordinates: [1.4427573, 110.4977108],
    floodCauses: [
      'Hujan Lebat / Berterusan',
      'Saliran Dalaman',
      'Air Laut Pasang'
    ],
    riverBasins: ['Batang Samarahan', 'Sungai Sarawak']
  },
  'Selangau': {
    state: 'Sarawak',
    displayName: 'Selangau, Sarawak',
    totalEvents: 43,
    riskLevel: 'High',
    lastFloodDate: '2025-08-15',
    coordinates: [2.9, 111.9], // Approximate
    floodCauses: [
      'Air Sungai Melimpah',
      'Hujan Lebat / Berterusan'
    ],
    riverBasins: ['Batang Rajang']
  },
  'Bintulu': {
    state: 'Sarawak',
    displayName: 'Bintulu, Sarawak',
    totalEvents: 36,
    riskLevel: 'High',
    lastFloodDate: '2025-06-19',
    coordinates: [3.1738542, 113.0428485],
    floodCauses: [
      'Air Sungai Melimpah',
      'Hujan Lebat / Berterusan',
      'Struktur / Lintasan Menghalang Laluan Air'
    ],
    riverBasins: ['Batang Kemena']
  },
  'Labuan': {
    state: 'WP Labuan',
    displayName: 'Labuan',
    totalEvents: 27,
    riskLevel: 'High',
    lastFloodDate: '2025-08-20',
    coordinates: [5.3109549, 115.2244853],
    floodCauses: [
      'Air Laut Pasang',
      'Hujan Lebat / Berterusan',
      'Longkang Tersumbat',
      'Saliran Dalaman'
    ],
    riverBasins: []
  },
  'Sri Aman': {
    state: 'Sarawak',
    displayName: 'Sri Aman, Sarawak',
    totalEvents: 27,
    riskLevel: 'High',
    lastFloodDate: '2025-08-04',
    coordinates: [1.237031, 111.462079],
    floodCauses: [
      'Hujan Lebat / Berterusan',
      'Air Sungai Melimpah',
      'Pembangunan / Pembukaan Tanah / Sampah Sarap'
    ],
    riverBasins: ['Batang Lupar']
  },

  // Medium Risk Districts (10-19 events)
  'Kanowit': {
    state: 'Sarawak',
    displayName: 'Kanowit, Sarawak',
    totalEvents: 24,
    riskLevel: 'Medium',
    lastFloodDate: '2025-08-10',
    coordinates: [2.17, 111.47], // Approximate
    floodCauses: ['Air Sungai Melimpah', 'Hujan Lebat / Berterusan'],
    riverBasins: ['Batang Rajang']
  },
  'Serian': {
    state: 'Sarawak',
    displayName: 'Serian, Sarawak',
    totalEvents: 22,
    riskLevel: 'Medium',
    lastFloodDate: '2025-08-08',
    coordinates: [1.167035, 110.5665059],
    floodCauses: [
      'Saliran Dalaman',
      'Struktur / Lintasan Menghalang Laluan Air'
    ],
    riverBasins: ['Batang Sadong']
  },
  'Keningau': {
    state: 'Sabah',
    displayName: 'Keningau, Sabah', 
    totalEvents: 21,
    riskLevel: 'Medium',
    lastFloodDate: '2025-07-30',
    coordinates: [5.34, 116.16], // Approximate
    floodCauses: ['Hujan Lebat / Berterusan', 'Air Sungai Melimpah'],
    riverBasins: ['Sungai Pegalan']
  },
  'Miri': {
    state: 'Sarawak',
    displayName: 'Miri, Sarawak',
    totalEvents: 20,
    riskLevel: 'Medium',
    lastFloodDate: '2025-07-25',
    coordinates: [4.4, 114.0], // Approximate
    floodCauses: ['Hujan Lebat / Berterusan', 'Saliran Dalaman'],
    riverBasins: ['Sungai Miri']
  },
  'Pontian': {
    state: 'Johor',
    displayName: 'Pontian, Johor',
    totalEvents: 20,
    riskLevel: 'Medium',
    lastFloodDate: '2025-07-22',
    coordinates: [1.48, 103.39], // Approximate
    floodCauses: ['Air Laut Pasang', 'Hujan Lebat / Berterusan'],
    riverBasins: []
  },

  // Lower frequency districts (5-15 events)
  'Batu Pahat': {
    state: 'Johor',
    displayName: 'Batu Pahat, Johor',
    totalEvents: 13,
    riskLevel: 'Medium',
    lastFloodDate: '2025-08-05',
    coordinates: [1.8545065, 102.9464372],
    floodCauses: [
      'Air Sungai Melimpah',
      'Hujan Lebat / Berterusan',
      'Saliran Dalaman',
      'Struktur / Lintasan Menghalang Laluan Air'
    ],
    riverBasins: ['Sungai Batu Pahat']
  },
  'Hulu Langat': {
    state: 'Selangor',
    displayName: 'Hulu Langat, Selangor',
    totalEvents: 11,
    riskLevel: 'Medium',
    lastFloodDate: '2025-07-15',
    coordinates: [3.04, 101.85], // Approximate
    floodCauses: ['Hujan Lebat / Berterusan', 'Air Sungai Melimpah'],
    riverBasins: ['Sungai Langat']
  },
  'Klang': {
    state: 'Selangor',
    displayName: 'Klang, Selangor',
    totalEvents: 9,
    riskLevel: 'Low',
    lastFloodDate: '2025-07-10',
    coordinates: [3.04, 101.45], // Approximate
    floodCauses: ['Air Laut Pasang', 'Hujan Lebat / Berterusan'],
    riverBasins: ['Sungai Klang']
  },

  // Alice Chen's area - Puchong (Note: Not in top flood districts, which is good!)
  'Petaling': {
    state: 'Selangor',
    displayName: 'Petaling, Selangor',
    totalEvents: 4,
    riskLevel: 'Low',
    lastFloodDate: '2025-06-15',
    coordinates: [3.1, 101.6], // Approximate, includes Puchong area
    floodCauses: ['Hujan Lebat / Berterusan', 'Saliran Dalaman'],
    riverBasins: ['Sungai Klang'],
    isAliceLocation: true // Special flag for Alice Chen persona
  }
};

/**
 * Risk level classification based on total flood events
 */
export const getRiskLevel = (totalEvents) => {
  if (totalEvents >= 20) return 'High';
  if (totalEvents >= 10) return 'Medium';
  return 'Low';
};

/**
 * Risk level colors for map visualization
 */
export const RISK_COLORS = {
  'High': '#F44336',    // Red
  'Medium': '#FF9800',  // Orange  
  'Low': '#4CAF50',     // Green
  'NoData': '#E0E0E0'   // Gray
};

/**
 * Get color for district based on flood frequency
 */
export const getDistrictColor = (districtName) => {
  const district = DISTRICT_FLOOD_STATS[districtName];
  if (!district) return RISK_COLORS.NoData;
  return RISK_COLORS[district.riskLevel];
};

/**
 * Search districts by name (for autocomplete functionality)
 */
export const searchDistricts = (query) => {
  if (!query || query.length < 2) return [];
  
  const searchTerm = query.toLowerCase();
  const results = Object.keys(DISTRICT_FLOOD_STATS)
    .map(key => ({
      key,
      ...DISTRICT_FLOOD_STATS[key]
    }))
    .filter(district => 
      district.key.toLowerCase().includes(searchTerm) ||
      district.displayName.toLowerCase().includes(searchTerm) ||
      district.state.toLowerCase().includes(searchTerm)
    )
    .sort((a, b) => b.totalEvents - a.totalEvents); // Sort by flood frequency
    
  return results.slice(0, 10); // Return top 10 results
};

/**
 * Get all districts sorted by risk level and flood frequency
 */
export const getAllDistrictsOrderedByRisk = () => {
  return Object.keys(DISTRICT_FLOOD_STATS)
    .map(key => ({
      key,
      ...DISTRICT_FLOOD_STATS[key]
    }))
    .sort((a, b) => {
      // First sort by risk level (High > Medium > Low)
      const riskOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const riskDiff = riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      
      // Then by total events
      return b.totalEvents - a.totalEvents;
    });
};

/**
 * Get district statistics by name
 */
export const getDistrictStats = (districtName) => {
  return DISTRICT_FLOOD_STATS[districtName] || null;
};

/**
 * Get districts by risk level
 */
export const getDistrictsByRiskLevel = (riskLevel) => {
  return Object.keys(DISTRICT_FLOOD_STATS)
    .map(key => ({
      key,
      ...DISTRICT_FLOOD_STATS[key]
    }))
    .filter(district => district.riskLevel === riskLevel)
    .sort((a, b) => b.totalEvents - a.totalEvents);
};

/**
 * Get summary statistics for all districts
 */
export const getFloodStatsSummary = () => {
  const allDistricts = Object.values(DISTRICT_FLOOD_STATS);
  const totalEvents = allDistricts.reduce((sum, d) => sum + d.totalEvents, 0);
  const highRiskCount = allDistricts.filter(d => d.riskLevel === 'High').length;
  const mediumRiskCount = allDistricts.filter(d => d.riskLevel === 'Medium').length;
  const lowRiskCount = allDistricts.filter(d => d.riskLevel === 'Low').length;

  return {
    totalDistricts: allDistricts.length,
    totalFloodEvents: totalEvents,
    highRiskDistricts: highRiskCount,
    mediumRiskDistricts: mediumRiskCount,
    lowRiskDistricts: lowRiskCount,
    mostAffectedDistrict: allDistricts.reduce((max, d) => 
      d.totalEvents > max.totalEvents ? d : max
    )
  };
};

/**
 * User Story 3.1: Get flood events for a specific district
 */
export const getDistrictFloodHistory = (districtName) => {
  const district = DISTRICT_FLOOD_STATS[districtName];
  
  if (!district) {
    return {
      found: false,
      message: `No flood records found for ${districtName}`,
      district: districtName
    };
  }

  return {
    found: true,
    district: district.displayName,
    state: district.state,
    totalEvents: district.totalEvents,
    riskLevel: district.riskLevel,
    lastFloodDate: district.lastFloodDate,
    floodCauses: district.floodCauses,
    riverBasins: district.riverBasins,
    coordinates: district.coordinates,
    isAliceLocation: district.isAliceLocation || false
  };
};

/**
 * Alice Chen Persona: Get flood intelligence for Puchong area
 */
export const getAliceAreaFloodIntelligence = () => {
  const puchoDistrict = getDistrictStats('Petaling'); // Puchong is in Petaling district
  
  return {
    userLocation: 'Puchong, Selangor',
    district: puchoDistrict,
    personalizedInsights: [
      '✅ Good news! Your area (Petaling district) has relatively low flood frequency',
      `📊 Only ${puchoDistrict.totalEvents} flood events recorded in your district`,
      '🏠 Suitable area for family living with manageable flood risk',
      '⚠️ Main risks: Heavy rain and drainage issues during monsoon season'
    ],
    comparisonWithWorstAreas: [
      'Your area is much safer than high-risk districts like Sibu (102 events)',
      'Petaling district: 4 events vs Samarahan: 52 events',
      'You chose a relatively flood-safe location for your family'
    ],
    recommendations: [
      'Monitor drainage systems during heavy rain',
      'Keep emergency supplies ready during monsoon season', 
      'Stay informed about flash flood warnings in Klang Valley'
    ]
  };
};

export default {
  DISTRICT_FLOOD_STATS,
  getRiskLevel,
  RISK_COLORS,
  getDistrictColor,
  searchDistricts,
  getAllDistrictsOrderedByRisk,
  getDistrictStats,
  getDistrictsByRiskLevel,
  getFloodStatsSummary,
  getDistrictFloodHistory,
  getAliceAreaFloodIntelligence
};