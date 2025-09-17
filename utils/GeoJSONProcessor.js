/**
 * GeoJSONProcessor.js - Process real Malaysia GeoJSON data
 * Uses accurate state boundary data for flood risk visualization
 */

import AccurateGeoJSONProcessor from './AccurateGeoJSONProcessor';

class GeoJSONProcessor {
  constructor() {
    this.accurateProcessor = new AccurateGeoJSONProcessor();
  }

  /**
   * Create Malaysia state data with accurate polygons from actual GeoJSON file
   */
  async createMalaysiaStateData() {
    console.log('🗺️ Using actual malaysia.state.geojson file for precise state boundaries');
    return await this.accurateProcessor.createMalaysiaStateData();
  }
}

export default GeoJSONProcessor;