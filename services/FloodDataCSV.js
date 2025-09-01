/**
 * FloodDataCSV.js - Process 2025 Malaysia flood event data
 * Data source: malaysia_flood_2025_geocoded.json (829 real flood events)
 */

// Import the pre-processed JSON flood data
const floodDataJSON = require('../assets/malaysia_flood_2025_geocoded.json');

class FloodDataCSV {
  static floodEvents = null;
  static isLoaded = false;


  /**
   * Calculate flood severity based on causes
   */
  static calculateSeverity(causes) {
    const severityMap = {
      'Air Sungai Melimpah': 3,
      'Hujan Lebat / Berterusan': 2,
      'Air Laut Pasang': 3,
      'Saliran Dalaman': 1,
      'Longkang Tersumbat': 1,
      'Struktur / Lintasan Menghalang Laluan Air': 2,
      'Pembangunan / Pembukaan Tanah / Sampah Sarap': 1
    };
    
    let totalSeverity = 0;
    causes.forEach(cause => {
      const cleanCause = cause.trim();
      totalSeverity += severityMap[cleanCause] || 1;
    });
    
    return Math.min(totalSeverity, 5); // Cap at 5
  }

  /**
   * Load and process flood data from JSON
   */
  static async loadFloodData() {
    if (this.isLoaded && this.floodEvents) {
      return this.floodEvents;
    }

    try {
      console.log('📊 Loading 2025 Malaysia flood event data from JSON...');
      
      // Process the JSON data and add calculated fields
      this.floodEvents = floodDataJSON.map(event => {
        // Parse date from string
        const dateParts = event.date.split('/');
        const parsedDate = new Date(
          parseInt(dateParts[2]), // year
          parseInt(dateParts[1]) - 1, // month (0-based)
          parseInt(dateParts[0]) // day
        );
        
        // Parse flood causes
        const causes = event.floodCause.split(',').map(cause => cause.trim());
        
        // Calculate severity and days since
        const severity = this.calculateSeverity(causes);
        const daysSince = Math.floor((new Date() - parsedDate) / (1000 * 60 * 60 * 24));
        
        return {
          ...event,
          date: parsedDate,
          causes,
          severity,
          daysSince
        };
      });
      
      this.isLoaded = true;
      
      console.log(`✅ Loaded ${this.floodEvents.length} flood events from JSON`);
      return this.floodEvents;
      
    } catch (error) {
      console.error('❌ Error loading flood data:', error);
      return [];
    }
  }


  /**
   * Get flood events for specific state
   */
  static async getFloodsByState(stateName) {
    const events = await this.loadFloodData();
    return events.filter(event => event.state === stateName);
  }

  /**
   * Get flood events near coordinates (within radius km)
   */
  static async getNearbyFloods(latitude, longitude, radiusKm = 50) {
    const events = await this.loadFloodData();
    
    return events.filter(event => {
      const distance = this.calculateDistance(
        latitude, longitude,
        event.latitude, event.longitude
      );
      return distance <= radiusKm;
    });
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get summary statistics
   */
  static async getFloodStatistics() {
    const events = await this.loadFloodData();
    
    const byState = {};
    const bySeverity = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const recentEvents = events.filter(e => e.daysSince <= 30).length;
    
    events.forEach(event => {
      // Count by state
      byState[event.state] = (byState[event.state] || 0) + 1;
      
      // Count by severity
      bySeverity[event.severity]++;
    });
    
    return {
      totalEvents: events.length,
      recentEvents,
      byState,
      bySeverity,
      highestRiskState: Object.keys(byState).reduce((a, b) => 
        byState[a] > byState[b] ? a : b
      )
    };
  }
}

export default FloodDataCSV;