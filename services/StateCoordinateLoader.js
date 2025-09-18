import * as FileSystem from 'expo-file-system';

class StateCoordinateLoader {
  static coordinatesCache = null;
  static isLoading = false;

  // State name mapping between GeoJSON and CSV
  static stateNameMapping = {
    // GeoJSON name -> CSV name
    "WP K Lumpur": "Wilayah Persekutuan",
    "WP Labuan": "Wilayah Persekutuan Labuan",
    "WP Putrajaya": "Wilayah Persekutuan", // Will use KL coordinates as fallback
    "Johor": "Johor",
    "Kedah": "Kedah",
    "Kelantan": "Kelantan",
    "Melaka": "Melaka",
    "Negeri Sembilan": "Negeri Sembilan",
    "Pahang": "Pahang",
    "Pulau Pinang": "Pulau Pinang",
    "Perak": "Perak",
    "Perlis": "Perlis",
    "Selangor": "Selangor",
    "Terengganu": "Terengganu",
    "Sabah": "Sabah",
    "Sarawak": "Sarawak"
  };

  static reverseStateMapping = null;

  /**
   * Load and parse state coordinates from CSV file
   * @returns {Promise<Object>} - State coordinates mapped by state name
   */
  static async loadStateCoordinates() {
    if (this.coordinatesCache) {
      return this.coordinatesCache;
    }

    if (this.isLoading) {
      // Wait for existing load to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.coordinatesCache;
    }

    this.isLoading = true;

    try {
      console.log('🗺️ StateCoordinateLoader: Loading state coordinates from CSV...');

      // For bundled assets, we need to read from the app bundle
      const csvContent = await this.loadCSVFromAssets();

      if (!csvContent) {
        throw new Error('Failed to load CSV content');
      }

      const coordinates = this.parseCSVContent(csvContent);

      console.log(`✅ StateCoordinateLoader: Loaded coordinates for ${Object.keys(coordinates).length} states`);

      this.coordinatesCache = coordinates;
      return coordinates;

    } catch (error) {
      console.error('❌ StateCoordinateLoader: Failed to load coordinates:', error);

      // Return fallback coordinates for major states
      const fallbackCoordinates = this.getFallbackCoordinates();
      this.coordinatesCache = fallbackCoordinates;
      return fallbackCoordinates;

    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load CSV content from app assets
   * @returns {Promise<string>} - CSV content as string
   */
  static async loadCSVFromAssets() {
    try {
      // Try to read from bundled asset
      const assetUri = require('../assets/state_coordinates.csv');

      if (assetUri) {
        // For local assets, we need to use a different approach
        return this.getHardcodedCSVContent();
      }

    } catch (error) {
      console.warn('StateCoordinateLoader: Could not load from assets, using hardcoded data');
      return this.getHardcodedCSVContent();
    }
  }

  /**
   * Hardcoded CSV content as fallback
   * @returns {string} - CSV content
   */
  static getHardcodedCSVContent() {
    return `state,latitude,longitude
Negeri Sembilan,2.8707497,102.2547919
Sarawak,2.5574285,113.0011989
Pulau Pinang,5.4140975,100.3285271
Johor,1.9343998,103.3587288
Perak,4.807294,100.8000051
Sabah,5.4204043,116.7967849
Wilayah Persekutuan,3.1319197,101.6840589
Selangor,3.509247,101.5248055
Melaka,2.189594,102.2500868
Terengganu,5.0936342,102.989615
Pahang,3.9743406,102.4380581
Kelantan,5.115146,101.8891721
Kedah,6.0498656,100.5296115
Perlis,6.5170189,100.2151578
Wilayah Persekutuan Labuan,5.2831456,115.230825`;
  }

  /**
   * Parse CSV content into coordinate objects
   * @param {string} csvContent - Raw CSV content
   * @returns {Object} - Parsed coordinates by state name
   */
  static parseCSVContent(csvContent) {
    const lines = csvContent.trim().split('\n');
    const coordinates = {};

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const [state, latitude, longitude] = lines[i].split(',');

      if (state && latitude && longitude) {
        coordinates[state.trim()] = {
          latitude: parseFloat(latitude.trim()),
          longitude: parseFloat(longitude.trim())
        };
      }
    }

    return coordinates;
  }

  /**
   * Get coordinates for a specific state by GeoJSON name
   * @param {string} geoJsonStateName - State name from GeoJSON
   * @returns {Object|null} - Coordinates object or null if not found
   */
  static async getStateCoordinates(geoJsonStateName) {
    const coordinates = await this.loadStateCoordinates();

    // Map GeoJSON state name to CSV state name
    const csvStateName = this.stateNameMapping[geoJsonStateName];

    if (!csvStateName) {
      console.warn(`StateCoordinateLoader: No mapping found for state: ${geoJsonStateName}`);
      return null;
    }

    const coords = coordinates[csvStateName];

    if (!coords) {
      console.warn(`StateCoordinateLoader: No coordinates found for CSV state: ${csvStateName}`);
      return null;
    }

    return coords;
  }

  /**
   * Get all state coordinates with GeoJSON names as keys
   * @returns {Promise<Object>} - All coordinates mapped by GeoJSON state names
   */
  static async getAllStateCoordinates() {
    const csvCoordinates = await this.loadStateCoordinates();
    const geoJsonCoordinates = {};

    // Map all coordinates using GeoJSON state names as keys
    Object.entries(this.stateNameMapping).forEach(([geoJsonName, csvName]) => {
      const coords = csvCoordinates[csvName];
      if (coords) {
        geoJsonCoordinates[geoJsonName] = coords;
      }
    });

    return geoJsonCoordinates;
  }

  /**
   * Get fallback coordinates for major Malaysian states
   * @returns {Object} - Fallback coordinates
   */
  static getFallbackCoordinates() {
    return {
      "Wilayah Persekutuan": { latitude: 3.1319197, longitude: 101.6840589 },
      "Selangor": { latitude: 3.509247, longitude: 101.5248055 },
      "Johor": { latitude: 1.9343998, longitude: 103.3587288 },
      "Perak": { latitude: 4.807294, longitude: 100.8000051 },
      "Sabah": { latitude: 5.4204043, longitude: 116.7967849 },
      "Sarawak": { latitude: 2.5574285, longitude: 113.0011989 },
      "Pahang": { latitude: 3.9743406, longitude: 102.4380581 },
      "Kedah": { latitude: 6.0498656, longitude: 100.5296115 },
      "Kelantan": { latitude: 5.115146, longitude: 101.8891721 },
      "Terengganu": { latitude: 5.0936342, longitude: 102.989615 },
      "Pulau Pinang": { latitude: 5.4140975, longitude: 100.3285271 },
      "Melaka": { latitude: 2.189594, longitude: 102.2500868 },
      "Negeri Sembilan": { latitude: 2.8707497, longitude: 102.2547919 },
      "Perlis": { latitude: 6.5170189, longitude: 100.2151578 },
      "Wilayah Persekutuan Labuan": { latitude: 5.2831456, longitude: 115.230825 }
    };
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  static clearCache() {
    this.coordinatesCache = null;
    console.log('🧹 StateCoordinateLoader: Cache cleared');
  }
}

export default StateCoordinateLoader;