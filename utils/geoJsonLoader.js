/**
 * GeoJSON Loader Utility for Epic 3: Flood Hotspot Maps
 * Processes Malaysia district boundaries and matches with flood statistics
 */

import { DISTRICT_FLOOD_STATS, RISK_COLORS } from './districtDataProcessor';

// Performance optimization: cache processed polygons
// Structure: { floodDataOnly: [...], allDistricts: [...] }
let cachedPolygons = null;

/**
 * Load and parse the Malaysia district GeoJSON file from local assets
 */
export const loadMalaysiaDistrictGeoJSON = () => {
  try {
    const geoJsonData = require('../assets/malaysia-districts.json');
    return geoJsonData;
  } catch (error) {
    console.error('Failed to load GeoJSON file from assets:', error);
    return null;
  }
};

/**
 * Process GeoJSON features and match with flood statistics
 * @param {Object} geoJsonData - The loaded GeoJSON data
 * @param {boolean} floodDataOnly - If true, only process districts with flood data
 * @returns {Array} Array of processed district polygons with flood data
 */
export const processDistrictPolygons = (geoJsonData, floodDataOnly = false) => {
  if (!geoJsonData || !geoJsonData.features) {
    console.error('Invalid GeoJSON data');
    return [];
  }

  const processedDistricts = [];
  console.log(`🔄 Processing ${geoJsonData.features.length} GeoJSON features${floodDataOnly ? ' (flood data districts only)' : ''}`);
  
  geoJsonData.features.forEach((feature, index) => {
    try {
      const districtName = feature.properties?.name;
      const districtId = feature.id;
      const state = feature.properties?.state;
      
      if (!districtName) {
        console.warn(`⚠️ District at index ${index} has no name property`);
        return;
      }
      
      // Try to match with our flood statistics data
      const floodStats = findMatchingFloodStats(districtName, state);
      
      // Skip districts without flood data if floodDataOnly is true
      if (floodDataOnly && !floodStats) {
        return;
      }
      
      // Process coordinates for react-native-maps
      const coordinates = processCoordinates(feature.geometry);
      
      if (coordinates && coordinates.length > 0) {
        const districtPolygon = {
          id: districtId || `district-${index}`,
          name: districtName,
          state: state,
          coordinates: coordinates,
          floodData: floodStats,
          riskLevel: floodStats ? floodStats.riskLevel : 'NoData',
          totalEvents: floodStats ? floodStats.totalEvents : 0,
          fillColor: floodStats ? RISK_COLORS[floodStats.riskLevel] : RISK_COLORS.NoData,
          strokeColor: floodStats ? RISK_COLORS[floodStats.riskLevel] : RISK_COLORS.NoData,
        };
        
        processedDistricts.push(districtPolygon);
        
        if (floodStats) {
          console.log(`✅ Matched district: ${districtName} (${floodStats.totalEvents} events)`);
        }
      } else {
        console.warn(`⚠️ Could not process coordinates for district: ${districtName}`);
      }
    } catch (error) {
      console.error(`❌ Error processing district at index ${index}:`, error.message);
    }
  });
  
  console.log(`🗺️ Processed ${processedDistricts.length} district polygons from GeoJSON`);
  console.log(`📊 Matched ${processedDistricts.filter(d => d.floodData).length} districts with flood data`);
  
  return processedDistricts;
};

/**
 * Find matching flood statistics for a district
 * Handles various name matching strategies
 */
const findMatchingFloodStats = (districtName, state) => {
  // Special case mappings for known variations
  const nameVariations = {
    'W.P. Labuan': 'Labuan',
    'WP Labuan': 'Labuan',
    'Labuan WP': 'Labuan',
    'W.P. Kuala Lumpur': 'Petaling', // KL area -> Petaling district for flood stats
    'WP Kuala Lumpur': 'Petaling',
    'Kuala Lumpur': 'Petaling',
    'W.P. Putrajaya': 'Petaling', // Putrajaya -> Petaling area
    'WP Putrajaya': 'Petaling'
  };
  
  // Check special variations first
  if (nameVariations[districtName]) {
    const mappedName = nameVariations[districtName];
    if (DISTRICT_FLOOD_STATS[mappedName]) {
      return DISTRICT_FLOOD_STATS[mappedName];
    }
  }
  
  // Direct name match
  let floodStats = DISTRICT_FLOOD_STATS[districtName];
  if (floodStats) return floodStats;
  
  // Try without spaces and special characters
  const cleanName = districtName.replace(/[^a-zA-Z]/g, '').toLowerCase();
  
  for (const [key, stats] of Object.entries(DISTRICT_FLOOD_STATS)) {
    const cleanKey = key.replace(/[^a-zA-Z]/g, '').toLowerCase();
    
    // Exact match after cleaning
    if (cleanKey === cleanName) {
      return stats;
    }
    
    // Try partial matches for common variations (but be more strict)
    if (cleanName.length >= 4 && (cleanKey.includes(cleanName) || cleanName.includes(cleanKey))) {
      return stats;
    }
  }
  
  // Try state-based matching for common district names
  if (state) {
    const stateMap = {
      'SGR': 'Selangor',
      'JHR': 'Johor', 
      'KDH': 'Kedah',
      'SWK': 'Sarawak',
      'SBH': 'Sabah',
      'KUL': 'Kuala Lumpur',
      'LBN': 'WP Labuan'
    };
    
    const fullStateName = stateMap[state] || state;
    
    for (const [key, stats] of Object.entries(DISTRICT_FLOOD_STATS)) {
      if (stats.state === fullStateName) {
        // Try exact match within same state
        if (key.toLowerCase() === districtName.toLowerCase()) {
          return stats;
        }
        
        // Try display name matching
        if (stats.displayName.toLowerCase().includes(districtName.toLowerCase()) ||
            districtName.toLowerCase().includes(key.toLowerCase())) {
          return stats;
        }
      }
    }
  }
  
  return null;
};

/**
 * Process GeoJSON coordinates for react-native-maps
 * Handles MultiPolygon and Polygon geometries with performance optimizations
 */
const processCoordinates = (geometry) => {
  if (!geometry || !geometry.coordinates) {
    return null;
  }
  
  try {
    let coordinates = [];
    
    if (geometry.type === 'Polygon') {
      // Single polygon - take the outer ring (first array)
      coordinates = geometry.coordinates[0].map(coord => {
        if (!coord || coord.length < 2) {
          console.warn('⚠️ Invalid coordinate array:', coord);
          return null;
        }
        return {
          latitude: parseFloat(coord[1]),
          longitude: parseFloat(coord[0])
        };
      }).filter(coord => coord !== null);
    } else if (geometry.type === 'MultiPolygon') {
      // Multiple polygons - take the largest one (most coordinates)
      let largestPolygon = [];
      let maxLength = 0;
      
      geometry.coordinates.forEach(polygon => {
        const outerRing = polygon[0]; // First ring is the outer boundary
        if (outerRing.length > maxLength) {
          maxLength = outerRing.length;
          largestPolygon = outerRing;
        }
      });
      
      coordinates = largestPolygon.map(coord => {
        if (!coord || coord.length < 2) {
          console.warn('⚠️ Invalid coordinate array:', coord);
          return null;
        }
        return {
          latitude: parseFloat(coord[1]),
          longitude: parseFloat(coord[0])
        };
      }).filter(coord => coord !== null);
    }
    
    // Validate coordinates
    if (coordinates.length < 3) {
      console.warn('Invalid polygon: less than 3 coordinates');
      return null;
    }
    
    // Performance optimization: simplify complex polygons for mobile rendering
    if (coordinates.length > 50) {
      console.log(`📐 Simplifying polygon with ${coordinates.length} coordinates`);
      coordinates = simplifyPolygon(coordinates, 30);
      console.log(`📐 Simplified to ${coordinates.length} coordinates`);
    }
    
    // Validate all coordinates are numbers and within reasonable bounds
    const validCoords = coordinates.filter(coord => {
      const latValid = typeof coord.latitude === 'number' && !isNaN(coord.latitude) && 
                       coord.latitude >= -90 && coord.latitude <= 90;
      const lonValid = typeof coord.longitude === 'number' && !isNaN(coord.longitude) && 
                       coord.longitude >= -180 && coord.longitude <= 180;
      
      if (!latValid || !lonValid) {
        console.warn(`⚠️ Invalid coordinate: lat=${coord.latitude}, lon=${coord.longitude}`);
        return false;
      }
      
      // Check if within Malaysia bounds (rough bounds)
      const inMalaysiaBounds = coord.latitude >= 1 && coord.latitude <= 7 &&
                               coord.longitude >= 99 && coord.longitude <= 119;
      return inMalaysiaBounds;
    });
    
    if (validCoords.length < coordinates.length * 0.8) {
      console.warn(`⚠️ ${coordinates.length - validCoords.length}/${coordinates.length} coordinates outside Malaysia bounds for this polygon`);
      console.warn(`Sample coords:`, coordinates.slice(0, 3));
    } else if (coordinates.length > 0) {
      console.log(`✅ Valid polygon: ${coordinates.length} coordinates (${validCoords.length} within bounds)`);
    }
    
    return coordinates;
    
  } catch (error) {
    console.error('Error processing coordinates:', error);
    return null;
  }
};

/**
 * Simplify polygon coordinates for better rendering performance
 * Uses Douglas-Peucker-like algorithm to reduce coordinate count
 */
const simplifyPolygon = (coordinates, maxPoints) => {
  if (coordinates.length <= maxPoints) {
    return coordinates;
  }
  
  // Simple decimation - take every nth point while preserving first and last
  const step = Math.ceil(coordinates.length / maxPoints);
  const simplified = [];
  
  for (let i = 0; i < coordinates.length; i += step) {
    simplified.push(coordinates[i]);
  }
  
  // Ensure polygon is closed
  if (simplified.length > 0) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first.latitude !== last.latitude || first.longitude !== last.longitude) {
      simplified.push(first);
    }
  }
  
  return simplified;
};

/**
 * Get processed district polygons with flood data
 * Main function to call from components - uses caching for performance
 * @param {boolean} floodDataOnly - If true, only return districts with flood data (default: true for performance)
 * @param {number} limit - Maximum number of districts to return (default: 15 for performance)
 */
export const getDistrictPolygons = (floodDataOnly = true, limit = 15) => {
  // Create cache key including limit
  const cacheKey = `${floodDataOnly ? 'floodDataOnly' : 'allDistricts'}_${limit}`;
  
  // Return cached data if available
  if (cachedPolygons && cachedPolygons[cacheKey]) {
    console.log(`🚀 Using cached polygon data (${cacheKey}):`, cachedPolygons[cacheKey].length, 'districts');
    return cachedPolygons[cacheKey];
  }
  
  try {
    console.log('📊 Loading and processing GeoJSON data...');
    const geoJsonData = loadMalaysiaDistrictGeoJSON();
    if (!geoJsonData) {
      console.error('❌ Failed to load GeoJSON data');
      return [];
    }
    
    console.log('✅ GeoJSON loaded, features count:', geoJsonData.features?.length || 0);
    
    const processedDistricts = processDistrictPolygons(geoJsonData, floodDataOnly);
    
    // Apply limit for performance - prioritize high-risk districts first
    const limitedDistricts = processedDistricts
      .sort((a, b) => {
        // Sort by risk level first (High > Medium > Low > NoData)
        const riskOrder = { 'High': 4, 'Medium': 3, 'Low': 2, 'NoData': 1 };
        const riskDiff = (riskOrder[b.riskLevel] || 0) - (riskOrder[a.riskLevel] || 0);
        if (riskDiff !== 0) return riskDiff;
        
        // Then by event count
        return (b.totalEvents || 0) - (a.totalEvents || 0);
      })
      .slice(0, limit);
    
    if (limitedDistricts.length === 0) {
      console.warn('⚠️ No districts were processed successfully');
      return [];
    }
    
    // Initialize cache object if needed
    if (!cachedPolygons) {
      cachedPolygons = {};
    }
    
    // Cache the results
    cachedPolygons[cacheKey] = limitedDistricts;
    console.log(`✅ Cached ${limitedDistricts.length} polygon districts (${cacheKey}) for future use (limited from ${processedDistricts.length} total)`);
    
    return limitedDistricts;
    
  } catch (error) {
    console.error('❌ Error getting district polygons:', error.message);
    return [];
  }
};

/**
 * Get polygon data for a specific district
 */
export const getDistrictPolygon = (districtName) => {
  const allPolygons = getDistrictPolygons();
  return allPolygons.find(polygon => 
    polygon.name.toLowerCase() === districtName.toLowerCase() ||
    (polygon.floodData && polygon.floodData.displayName.toLowerCase().includes(districtName.toLowerCase()))
  );
};

/**
 * Get polygons filtered by risk level
 */
export const getPolygonsByRiskLevel = (riskLevel) => {
  const allPolygons = getDistrictPolygons();
  return allPolygons.filter(polygon => polygon.riskLevel === riskLevel);
};

/**
 * Get summary statistics for polygon data
 */
export const getPolygonStatsSummary = () => {
  const allPolygons = getDistrictPolygons();
  const withFloodData = allPolygons.filter(p => p.floodData);
  
  return {
    totalDistricts: allPolygons.length,
    districtsWithFloodData: withFloodData.length,
    highRiskDistricts: allPolygons.filter(p => p.riskLevel === 'High').length,
    mediumRiskDistricts: allPolygons.filter(p => p.riskLevel === 'Medium').length,
    lowRiskDistricts: allPolygons.filter(p => p.riskLevel === 'Low').length,
    noDataDistricts: allPolygons.filter(p => p.riskLevel === 'NoData').length,
  };
};

export default {
  loadMalaysiaDistrictGeoJSON,
  processDistrictPolygons,
  getDistrictPolygons,
  getDistrictPolygon,
  getPolygonsByRiskLevel,
  getPolygonStatsSummary
};