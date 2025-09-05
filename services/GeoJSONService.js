// GeoJSON Service for Malaysian Districts
import malaysiaDistricts from '../assets/malaysia-districts.json';

class GeoJSONService {
  static malayanDistricts = null;
  static isLoaded = false;

  // Load and parse Malaysian district data
  static async loadMalaysianDistricts() {
    try {
      if (this.isLoaded && this.malayanDistricts) {
        return this.malayanDistricts;
      }

      console.log('📍 Loading Malaysian district GeoJSON data...');
      
      // Parse the actual GeoJSON data
      if (!malaysiaDistricts || !malaysiaDistricts.features) {
        console.error('❌ Invalid GeoJSON data');
        return [];
      }

      // Extract districts from GeoJSON features - load all districts for complete coverage
      const districts = malaysiaDistricts.features.map(feature => {
        const { properties, geometry, id } = feature;
        
        // Calculate bounds and center from coordinates
        let bounds = { north: -90, south: 90, east: -180, west: 180 };
        let totalLat = 0, totalLon = 0, pointCount = 0;
        
        if (geometry && geometry.coordinates) {
          // Handle MultiPolygon or Polygon
          const coords = geometry.type === 'MultiPolygon' 
            ? geometry.coordinates[0][0] 
            : geometry.coordinates[0];
          
          if (coords && coords.length > 0) {
            coords.forEach(coord => {
              const [lon, lat] = coord;
              bounds.north = Math.max(bounds.north, lat);
              bounds.south = Math.min(bounds.south, lat);
              bounds.east = Math.max(bounds.east, lon);
              bounds.west = Math.min(bounds.west, lon);
              totalLat += lat;
              totalLon += lon;
              pointCount++;
            });
          }
        }
        
        // Calculate center point
        const center = pointCount > 0 
          ? { lat: totalLat / pointCount, lon: totalLon / pointCount }
          : { lat: 3.1390, lon: 101.6869 }; // Default to KL
        
        // Map state codes to full names
        const stateNames = {
          'SGR': 'Selangor',
          'KUL': 'Kuala Lumpur',
          'JHR': 'Johor',
          'PNG': 'Pulau Pinang',
          'KTN': 'Kelantan',
          'TRG': 'Terengganu',
          'PHG': 'Pahang',
          'PRK': 'Perak',
          'KDH': 'Kedah',
          'NSN': 'Negeri Sembilan',
          'MLK': 'Melaka',
          'PLS': 'Perlis',
          'SBH': 'Sabah',
          'SWK': 'Sarawak'
        };
        
        return {
          id: id || properties.name.toLowerCase().replace(/\s+/g, '-'),
          name: properties.name,
          state: stateNames[properties.state] || properties.state,
          stateCode: properties.code_state,
          bounds,
          center,
          coordinates: geometry.coordinates
        };
      });

      this.malayanDistricts = districts;
      this.isLoaded = true;
      
      console.log(`✅ Loaded ${districts.length} Malaysian districts from GeoJSON`);
      return districts;
      
    } catch (error) {
      console.error('❌ Error loading Malaysian districts:', error);
      return [];
    }
  }

  // Get districts by state
  static async getDistrictsByState(stateCode) {
    const districts = await this.loadMalaysianDistricts();
    return districts.filter(district => district.state === stateCode);
  }

  // Find nearest district by coordinates
  static async findNearestDistrict(lat, lon) {
    const districts = await this.loadMalaysianDistricts();
    
    let nearestDistrict = null;
    let minDistance = Infinity;
    
    districts.forEach(district => {
      const distance = Math.sqrt(
        Math.pow(district.center.lat - lat, 2) + 
        Math.pow(district.center.lon - lon, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestDistrict = district;
      }
    });
    
    return nearestDistrict;
  }

  // Generate mock flood risk for districts
  static generateDistrictRisks(districts) {
    return districts.map(district => ({
      ...district,
      risk: Math.random() * 0.9 + 0.1, // Random risk between 0.1-1.0
      lastUpdated: new Date().toISOString()
    }));
  }

  // Get risk level string from probability
  static getRiskLevel(probability) {
    if (probability <= 0.3) return 'Low';
    if (probability <= 0.6) return 'Moderate'; 
    if (probability <= 0.8) return 'High';
    return 'Very High';
  }

  // Get risk color from probability
  static getRiskColor(probability) {
    if (probability <= 0.3) return '#4CAF50'; // Green
    if (probability <= 0.6) return '#FF9800'; // Orange  
    if (probability <= 0.8) return '#FF5722'; // Red
    return '#D32F2F'; // Dark Red
  }

  // Create state boundary aggregator - merge district polygons by state
  static async getStateBoundaries() {
    try {
      const districts = await this.loadMalaysianDistricts();
      const stateBoundaries = {};
      
      // Group districts by state
      districts.forEach(district => {
        const stateName = district.state;
        if (!stateBoundaries[stateName]) {
          stateBoundaries[stateName] = {
            name: stateName,
            districts: [],
            polygons: [],
            bounds: { north: -90, south: 90, east: -180, west: 180 }
          };
        }
        
        stateBoundaries[stateName].districts.push(district);
        
        // Collect all polygon coordinates for this state
        if (district.coordinates) {
          stateBoundaries[stateName].polygons.push(district.coordinates);
        }
        
        // Update state bounds
        const bounds = stateBoundaries[stateName].bounds;
        bounds.north = Math.max(bounds.north, district.bounds.north);
        bounds.south = Math.min(bounds.south, district.bounds.south);
        bounds.east = Math.max(bounds.east, district.bounds.east);
        bounds.west = Math.min(bounds.west, district.bounds.west);
      });
      
      // Calculate center points for each state
      Object.values(stateBoundaries).forEach(state => {
        const centerLat = (state.bounds.north + state.bounds.south) / 2;
        const centerLon = (state.bounds.east + state.bounds.west) / 2;
        state.center = { lat: centerLat, lon: centerLon };
      });
      
      console.log(`✅ Generated ${Object.keys(stateBoundaries).length} state boundaries`);
      return stateBoundaries;
      
    } catch (error) {
      console.error('❌ Error creating state boundaries:', error);
      return {};
    }
  }

  // Convert district polygon to React Native Maps coordinate format
  static convertToMapCoordinates(polygonCoordinates) {
    if (!polygonCoordinates || !Array.isArray(polygonCoordinates)) {
      return [];
    }
    
    // Handle MultiPolygon or Polygon format
    let coords = polygonCoordinates;
    if (polygonCoordinates[0] && Array.isArray(polygonCoordinates[0][0])) {
      // MultiPolygon - take the first polygon
      coords = polygonCoordinates[0][0];
    } else if (Array.isArray(polygonCoordinates[0])) {
      // Polygon
      coords = polygonCoordinates[0];
    }
    
    // Convert [longitude, latitude] to {latitude, longitude}
    return coords.map(coord => ({
      latitude: coord[1],
      longitude: coord[0]
    }));
  }

  // Simplify polygon coordinates to improve performance
  static simplifyPolygon(coordinates, tolerance = 0.01) {
    if (!coordinates || coordinates.length < 3) {
      return coordinates;
    }
    
    // More aggressive simplification for better performance with many polygons
    const targetPoints = Math.min(30, Math.max(5, Math.ceil(coordinates.length / 10)));
    const step = Math.ceil(coordinates.length / targetPoints);
    
    const simplified = [];
    for (let i = 0; i < coordinates.length; i += step) {
      simplified.push(coordinates[i]);
    }
    
    // Always include the last point to close the polygon
    if (simplified.length > 0 && simplified[simplified.length - 1] !== coordinates[coordinates.length - 1]) {
      simplified.push(coordinates[coordinates.length - 1]);
    }
    
    return simplified;
  }

  // Get state polygon data ready for React Native Maps
  static async getStatePolygons() {
    const stateBoundaries = await this.getStateBoundaries();
    const statePolygons = {};
    
    Object.entries(stateBoundaries).forEach(([stateName, stateData]) => {
      const polygons = [];
      
      // Process each district polygon in the state
      stateData.districts.forEach(district => {
        if (district.coordinates) {
          const mapCoords = this.convertToMapCoordinates(district.coordinates);
          const simplified = this.simplifyPolygon(mapCoords);
          if (simplified.length > 2) {
            polygons.push(simplified);
          }
        }
      });
      
      statePolygons[stateName] = {
        name: stateName,
        polygons: polygons,
        center: stateData.center,
        bounds: stateData.bounds,
        districtCount: stateData.districts.length
      };
    });
    
    console.log(`✅ Processed ${Object.keys(statePolygons).length} state polygons`);
    return statePolygons;
  }
}

export default GeoJSONService;