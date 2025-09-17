/**
 * AccurateGeoJSONProcessor.js - Process real Malaysia GeoJSON data for optimal React Native Maps rendering
 * Uses actual malaysia.state.geojson file with coordinate simplification for performance
 */

import malaysiaGeoJSONData from '../assets/malaysiadata';

class AccurateGeoJSONProcessor {
  constructor() {
    // State capital coordinates for centering
    this.stateCapitals = {
      'Johor': { latitude: 1.4927, longitude: 103.7414, name: 'Johor Bahru' },
      'Kedah': { latitude: 6.1248, longitude: 100.3678, name: 'Alor Setar' },
      'Kelantan': { latitude: 6.1254, longitude: 102.2381, name: 'Kota Bharu' },
      'WP K Lumpur': { latitude: 3.1390, longitude: 101.6869, name: 'Kuala Lumpur' },
      'WP Labuan': { latitude: 5.2931, longitude: 115.2275, name: 'Labuan' },
      'Melaka': { latitude: 2.2966, longitude: 102.2501, name: 'Melaka' },
      'Negeri Sembilan': { latitude: 2.7297, longitude: 101.9381, name: 'Seremban' },
      'Pahang': { latitude: 3.8126, longitude: 103.3256, name: 'Kuantan' },
      'Pulau Pinang': { latitude: 5.4164, longitude: 100.3327, name: 'George Town' },
      'Perak': { latitude: 4.5975, longitude: 101.0901, name: 'Ipoh' },
      'Perlis': { latitude: 6.4449, longitude: 100.2080, name: 'Kangar' },
      'WP Putrajaya': { latitude: 2.9264, longitude: 101.6964, name: 'Putrajaya' },
      'Sabah': { latitude: 5.9804, longitude: 116.0735, name: 'Kota Kinabalu' },
      'Sarawak': { latitude: 1.5533, longitude: 110.3592, name: 'Kuching' },
      'Selangor': { latitude: 3.0738, longitude: 101.5183, name: 'Shah Alam' },
      'Terengganu': { latitude: 5.3302, longitude: 103.1408, name: 'Kuala Terengganu' }
    };

    // State code mapping for consistency
    this.stateCodeMapping = {
      'Johor': 'JHR',
      'Kedah': 'KDH',
      'Kelantan': 'KTN',
      'WP K Lumpur': 'KUL',
      'WP Labuan': 'LBN',
      'Melaka': 'MLK',
      'Negeri Sembilan': 'NSN',
      'Pahang': 'PHG',
      'Pulau Pinang': 'PNG',
      'Perak': 'PRK',
      'Perlis': 'PLS',
      'WP Putrajaya': 'PJY',
      'Sabah': 'SBH',
      'Sarawak': 'SWK',
      'Selangor': 'SGR',
      'Terengganu': 'TRG'
    };

    // Display names for consistency with existing code
    this.displayNames = {
      'WP K Lumpur': 'Kuala Lumpur',
      'WP Labuan': 'Labuan',
      'WP Putrajaya': 'Putrajaya',
      'Pulau Pinang': 'Penang'
    };
  }

  /**
   * Load and process the actual malaysia.state.geojson file
   * @returns {Promise<Array>} Array of processed state data
   */
  async loadMalaysiaGeoJSON() {
    try {
      console.log('🗺️ Loading actual malaysia.state.geojson file...');

      // Use the imported GeoJSON data
      const geoJsonData = malaysiaGeoJSONData;

      if (!geoJsonData || !geoJsonData.features) {
        throw new Error('Invalid GeoJSON structure');
      }

      console.log(`📊 Processing ${geoJsonData.features.length} states from GeoJSON`);

      const processedStates = geoJsonData.features.map(feature => {
        const stateName = feature.properties.name;
        const stateId = feature.properties.state || this.stateCodeMapping[stateName];

        // Get display name or use original
        const displayName = this.displayNames[stateName] || stateName;

        console.log(`🏛️ Processing ${displayName} (${stateId})`);

        // Process coordinates from MultiPolygon format
        const coordinates = this.processMultiPolygonCoordinates(
          feature.geometry.coordinates,
          displayName
        );

        // Get state capital or calculate center from coordinates
        const center = this.stateCapitals[stateName] || this.calculatePolygonCenter(coordinates[0]);

        return {
          id: stateId,
          name: displayName,
          stateCode: stateId,
          center: center,
          capital: this.stateCapitals[stateName]?.name || displayName,
          coordinates: coordinates
        };
      });

      console.log(`✅ Successfully processed ${processedStates.length} states with accurate boundaries`);
      return processedStates;

    } catch (error) {
      console.error('❌ Error loading GeoJSON file:', error);
      console.log('⚠️ Falling back to embedded coordinates');
      return this.createFallbackStateData();
    }
  }

  /**
   * Process MultiPolygon coordinates from GeoJSON format
   * Converts [longitude, latitude] to [latitude, longitude] and simplifies geometry
   */
  processMultiPolygonCoordinates(multiPolygonCoords, stateName) {
    const processedPolygons = [];

    multiPolygonCoords.forEach((polygon, polygonIndex) => {
      // Each polygon is an array of rings (first is exterior, others are holes)
      const exteriorRing = polygon[0]; // We'll focus on the main exterior boundary

      if (!exteriorRing || exteriorRing.length < 3) {
        console.warn(`⚠️ Invalid polygon ring for ${stateName} polygon ${polygonIndex}`);
        return;
      }

      // Convert GeoJSON [longitude, latitude] to React Native Maps [latitude, longitude]
      const convertedCoordinates = exteriorRing.map(coord => ({
        latitude: coord[1], // GeoJSON longitude becomes latitude
        longitude: coord[0]  // GeoJSON latitude becomes longitude
      }));

      // Simplify coordinates for performance (keep every 3rd point for very detailed polygons)
      const simplifiedCoordinates = this.simplifyCoordinates(convertedCoordinates, stateName);

      if (simplifiedCoordinates.length >= 3) {
        processedPolygons.push(simplifiedCoordinates);
        console.log(`📐 ${stateName} polygon ${polygonIndex}: ${convertedCoordinates.length} → ${simplifiedCoordinates.length} points`);
      }
    });

    return processedPolygons;
  }

  /**
   * Simplify coordinates for better performance while maintaining shape accuracy
   */
  simplifyCoordinates(coordinates, stateName) {
    // For very detailed polygons (>200 points), apply smart simplification
    if (coordinates.length > 200) {
      console.log(`🔧 Simplifying detailed polygon for ${stateName}: ${coordinates.length} points`);

      // Keep every 2nd point for shapes with 200-500 points
      // Keep every 3rd point for shapes with 500+ points
      const step = coordinates.length > 500 ? 3 : 2;
      const simplified = [];

      // Always keep first point
      simplified.push(coordinates[0]);

      // Sample intermediate points
      for (let i = step; i < coordinates.length - 1; i += step) {
        simplified.push(coordinates[i]);
      }

      // Always keep last point to ensure polygon closure
      if (coordinates.length > 1) {
        simplified.push(coordinates[coordinates.length - 1]);
      }

      return simplified;
    }

    // For reasonable polygon sizes, keep all points
    return coordinates;
  }

  /**
   * Calculate polygon center from coordinates
   */
  calculatePolygonCenter(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return { latitude: 4.0, longitude: 101.5 }; // Default Malaysia center
    }

    const sum = coordinates.reduce(
      (acc, coord) => ({
        latitude: acc.latitude + coord.latitude,
        longitude: acc.longitude + coord.longitude
      }),
      { latitude: 0, longitude: 0 }
    );

    return {
      latitude: sum.latitude / coordinates.length,
      longitude: sum.longitude / coordinates.length
    };
  }

  /**
   * Create fallback state data if GeoJSON loading fails
   */
  createFallbackStateData() {
    console.log('⚠️ Using minimal fallback state data');
    return [
      {
        id: 'KUL',
        name: 'Kuala Lumpur',
        stateCode: 'KUL',
        center: this.stateCapitals['WP K Lumpur'],
        capital: 'Kuala Lumpur',
        coordinates: [[
          { latitude: 3.0, longitude: 101.5 },
          { latitude: 3.3, longitude: 101.5 },
          { latitude: 3.3, longitude: 101.8 },
          { latitude: 3.0, longitude: 101.8 },
          { latitude: 3.0, longitude: 101.5 }
        ]]
      }
    ];
  }

  /**
   * Create Malaysia state data using accurate GeoJSON
   */
  async createMalaysiaStateData() {
    return await this.loadMalaysiaGeoJSON();
  }
}

export default AccurateGeoJSONProcessor;