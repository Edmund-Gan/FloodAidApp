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

      // Extract districts from GeoJSON features
      const districts = malaysiaDistricts.features.slice(0, 20).map(feature => {
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
}

export default GeoJSONService;