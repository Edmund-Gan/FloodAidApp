/**
 * StatePolygonProcessor.js - Utility to process Malaysia GeoJSON for react-native-maps
 * Converts state boundary data for flood risk visualization
 */

import { readFileSync } from 'react-native-fs';

class StatePolygonProcessor {
  constructor() {
    this.stateData = null;
    this.stateCapitals = {
      'Johor': { lat: 1.4927, lon: 103.7414, name: 'Johor Bahru' },
      'Kedah': { lat: 6.1248, lon: 100.3678, name: 'Alor Setar' },
      'Kelantan': { lat: 6.1254, lon: 102.2381, name: 'Kota Bharu' },
      'Kuala Lumpur': { lat: 3.1390, lon: 101.6869, name: 'Kuala Lumpur' },
      'Labuan': { lat: 5.2931, lon: 115.2275, name: 'Labuan' },
      'Melaka': { lat: 2.2966, lon: 102.2501, name: 'Melaka' },
      'Negeri Sembilan': { lat: 2.7297, lon: 101.9381, name: 'Seremban' },
      'Pahang': { lat: 3.8126, lon: 103.3256, name: 'Kuantan' },
      'Penang': { lat: 5.4164, lon: 100.3327, name: 'George Town' },
      'Perak': { lat: 4.5975, lon: 101.0901, name: 'Ipoh' },
      'Perlis': { lat: 6.4449, lon: 100.2080, name: 'Kangar' },
      'Putrajaya': { lat: 2.9264, lon: 101.6964, name: 'Putrajaya' },
      'Sabah': { lat: 5.9804, lon: 116.0735, name: 'Kota Kinabalu' },
      'Sarawak': { lat: 1.5533, lon: 110.3592, name: 'Kuching' },
      'Selangor': { lat: 3.0738, lon: 101.5183, name: 'Shah Alam' },
      'Terengganu': { lat: 5.3302, lon: 103.1408, name: 'Kuala Terengganu' }
    };
  }

  /**
   * Process GeoJSON file to extract state polygons
   * @param {string} geoJsonData - Raw GeoJSON string data
   * @returns {Array} - Processed state data for react-native-maps
   */
  processGeoJSONData(geoJsonData) {
    try {
      console.log('🗺️ Processing Malaysia GeoJSON data for maps...');

      const geoData = JSON.parse(geoJsonData);
      const processedStates = [];

      if (!geoData.features || !Array.isArray(geoData.features)) {
        throw new Error('Invalid GeoJSON format - no features array found');
      }

      geoData.features.forEach((feature, index) => {
        if (feature.type === 'Feature' && feature.geometry && feature.properties) {
          const stateName = feature.properties.name || feature.properties.state || `State_${index}`;
          const stateId = feature.properties.state_id || feature.id || index;

          // Process geometry coordinates
          const coordinates = this.processGeometryCoordinates(feature.geometry);

          if (coordinates && coordinates.length > 0) {
            // Get state capital coordinates
            const capital = this.stateCapitals[stateName] || this.calculateCentroid(coordinates[0]);

            const stateData = {
              id: stateId,
              name: stateName,
              stateCode: feature.properties.state || feature.id,
              coordinates: coordinates,
              center: {
                latitude: capital.lat,
                longitude: capital.lon
              },
              capital: capital.name || stateName,
              // Initialize with default risk data
              riskData: {
                floodProbability: 0.2,
                riskLevel: 'Low',
                lastUpdated: new Date().toISOString(),
                color: '#4CAF50'
              }
            };

            processedStates.push(stateData);
            console.log(`✅ Processed state: ${stateName} with ${coordinates.length} polygon(s)`);
          } else {
            console.warn(`⚠️ Skipping ${stateName} - no valid coordinates found`);
          }
        }
      });

      console.log(`🎯 Successfully processed ${processedStates.length} Malaysian states`);
      this.stateData = processedStates;
      return processedStates;

    } catch (error) {
      console.error('❌ Error processing GeoJSON data:', error);
      throw new Error(`Failed to process Malaysia state data: ${error.message}`);
    }
  }

  /**
   * Process geometry coordinates for different geometry types
   * @param {Object} geometry - GeoJSON geometry object
   * @returns {Array} - Array of coordinate arrays for polygons
   */
  processGeometryCoordinates(geometry) {
    const coordinates = [];

    try {
      if (geometry.type === 'Polygon') {
        // Single polygon
        const polygon = this.convertCoordinatesToMapFormat(geometry.coordinates[0]);
        if (polygon && polygon.length >= 3) {
          coordinates.push(polygon);
        }
      } else if (geometry.type === 'MultiPolygon') {
        // Multiple polygons (like islands)
        geometry.coordinates.forEach(polygonCoords => {
          const polygon = this.convertCoordinatesToMapFormat(polygonCoords[0]);
          if (polygon && polygon.length >= 3) {
            coordinates.push(polygon);
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Error processing geometry coordinates:', error);
    }

    return coordinates;
  }

  /**
   * Convert GeoJSON coordinates to react-native-maps format
   * @param {Array} coords - Array of [longitude, latitude] pairs
   * @returns {Array} - Array of {latitude, longitude} objects
   */
  convertCoordinatesToMapFormat(coords) {
    if (!Array.isArray(coords)) return [];

    return coords.map(coord => {
      if (Array.isArray(coord) && coord.length >= 2) {
        return {
          latitude: parseFloat(coord[1]),
          longitude: parseFloat(coord[0])
        };
      }
      return null;
    }).filter(coord => coord !== null);
  }

  /**
   * Calculate centroid of a polygon for state center
   * @param {Array} coordinates - Array of coordinate objects
   * @returns {Object} - {lat, lon, name} object
   */
  calculateCentroid(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return { lat: 3.1390, lon: 101.6869, name: 'Malaysia' };
    }

    let latSum = 0;
    let lonSum = 0;
    let count = 0;

    coordinates.forEach(coord => {
      if (coord.latitude && coord.longitude) {
        latSum += coord.latitude;
        lonSum += coord.longitude;
        count++;
      }
    });

    if (count === 0) {
      return { lat: 3.1390, lon: 101.6869, name: 'Malaysia' };
    }

    return {
      lat: latSum / count,
      lon: lonSum / count,
      name: 'Calculated Center'
    };
  }

  /**
   * Get state data by name
   * @param {string} stateName - Name of the state
   * @returns {Object|null} - State data object or null
   */
  getStateByName(stateName) {
    if (!this.stateData) return null;

    return this.stateData.find(state =>
      state.name.toLowerCase() === stateName.toLowerCase() ||
      state.stateCode.toLowerCase() === stateName.toLowerCase()
    );
  }

  /**
   * Update flood risk data for a specific state
   * @param {string} stateName - Name of the state
   * @param {Object} riskData - Risk data object
   */
  updateStateRiskData(stateName, riskData) {
    if (!this.stateData) return;

    const state = this.getStateByName(stateName);
    if (state) {
      state.riskData = {
        ...state.riskData,
        ...riskData,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Get all processed state data
   * @returns {Array} - Array of all state data
   */
  getAllStates() {
    return this.stateData || [];
  }

  /**
   * Get state capitals for weather data fetching
   * @returns {Object} - Object with state names as keys and capital coordinates as values
   */
  getStateCapitals() {
    return this.stateCapitals;
  }

  /**
   * Filter states by risk level
   * @param {string} riskLevel - Risk level to filter by
   * @returns {Array} - Array of states matching the risk level
   */
  getStatesByRiskLevel(riskLevel) {
    if (!this.stateData) return [];

    return this.stateData.filter(state =>
      state.riskData.riskLevel.toLowerCase() === riskLevel.toLowerCase()
    );
  }

  /**
   * Get Malaysia bounding box for map region
   * @returns {Object} - Region object for react-native-maps
   */
  getMalaysiaBounds() {
    return {
      latitude: 4.2105, // Center of Malaysia
      longitude: 108.9758,
      latitudeDelta: 10.0, // Covers all of Malaysia
      longitudeDelta: 15.0
    };
  }

  /**
   * Get West Malaysia bounding box (more focused view)
   * @returns {Object} - Region object for West Malaysia
   */
  getWestMalaysiaBounds() {
    return {
      latitude: 3.5, // Center of West Malaysia
      longitude: 101.5,
      latitudeDelta: 5.0,
      longitudeDelta: 4.0
    };
  }

  /**
   * Validate if coordinates are within Malaysia bounds
   * @param {number} latitude - Latitude to check
   * @param {number} longitude - Longitude to check
   * @returns {boolean} - True if within Malaysia bounds
   */
  isWithinMalaysiaBounds(latitude, longitude) {
    // Malaysia rough bounds
    const minLat = 0.8;
    const maxLat = 7.5;
    const minLon = 99.5;
    const maxLon = 119.5;

    return latitude >= minLat && latitude <= maxLat &&
           longitude >= minLon && longitude <= maxLon;
  }
}

export default StatePolygonProcessor;