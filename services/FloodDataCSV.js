/**
 * FloodDataCSV.js - Process Malaysia flood event data from combined CSV
 * Data source: combined_flood_data.json (1,891 historical flood events 2000-2025)
 * Original CSV: combined_flood_data.csv converted to JSON asset for app usage
 */

import { Asset } from 'expo-asset';
import { getStateCoordinates, MALAYSIAN_STATES } from '../utils/MalaysianStates';

class FloodDataCSV {
  static floodEvents = null;
  static isLoaded = false;


  /**
   * Parse CSV content into array of objects
   */
  static parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(value => value.trim());
      if (values.length === headers.length) {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index];
        });
        data.push(obj);
      }
    }
    
    return data;
  }

  /**
   * Get sample CSV data - fallback method if JSON asset fails to load
   * This represents a small subset of the combined_flood_data.csv for development
   */
  static getSampleCSVData() {
    return [
      { date: '2024-12-15', state: 'Kelantan', is_flood: 'True' },
      { date: '2024-11-28', state: 'Terengganu', is_flood: 'True' },
      { date: '2024-10-12', state: 'Pahang', is_flood: 'True' },
      { date: '2024-09-05', state: 'Johor', is_flood: 'True' },
      { date: '2024-08-18', state: 'Selangor', is_flood: 'True' },
      { date: '2024-07-22', state: 'Perak', is_flood: 'True' },
      { date: '2023-12-10', state: 'Sabah', is_flood: 'True' },
      { date: '2023-11-05', state: 'Sarawak', is_flood: 'True' },
      { date: '2023-10-15', state: 'Kedah', is_flood: 'True' },
      { date: '2023-09-25', state: 'Perlis', is_flood: 'True' },
      { date: '2023-08-30', state: 'Pulau Pinang', is_flood: 'True' },
      { date: '2023-07-18', state: 'Melaka', is_flood: 'True' },
      { date: '2023-06-12', state: 'Negeri Sembilan', is_flood: 'True' },
      // Additional historical events to simulate the dataset
      { date: '2022-12-20', state: 'Kelantan', is_flood: 'True' },
      { date: '2022-11-15', state: 'Terengganu', is_flood: 'True' },
      { date: '2022-03-10', state: 'Selangor', is_flood: 'True' },
      { date: '2021-12-25', state: 'Pahang', is_flood: 'True' },
      { date: '2021-11-30', state: 'Kelantan', is_flood: 'True' },
      { date: '2021-01-15', state: 'Johor', is_flood: 'True' },
      { date: '2020-12-05', state: 'Selangor', is_flood: 'True' },
      { date: '2020-11-18', state: 'Perak', is_flood: 'True' },
      { date: '2020-03-22', state: 'Sabah', is_flood: 'True' },
      { date: '2019-12-08', state: 'Kelantan', is_flood: 'True' },
      { date: '2019-11-12', state: 'Terengganu', is_flood: 'True' },
      { date: '2019-02-28', state: 'Sarawak', is_flood: 'True' }
    ];
  }

  /**
   * Load and process flood data from the combined CSV dataset
   */
  static async loadFloodData() {
    if (this.isLoaded && this.floodEvents) {
      return this.floodEvents;
    }

    try {
      console.log('📊 Loading Malaysia flood event data from combined dataset...');
      
      // Load the actual combined flood data (1,891 records)
      const floodDataAsset = require('../assets/combined_flood_data.json');
      console.log(`📈 Loaded ${floodDataAsset.length} flood records from dataset`);
      
      // Process CSV data and group by state with coordinates
      const stateFloodData = this.aggregateFloodsByState(floodDataAsset);
      this.floodEvents = this.createStateMarkers(stateFloodData);
      
      this.isLoaded = true;
      console.log(`✅ Processed ${this.floodEvents.length} state flood aggregations from ${floodDataAsset.length} records`);
      return this.floodEvents;
      
    } catch (error) {
      console.error('❌ Error loading flood data:', error);
      console.warn('⚠️ Falling back to sample data');
      
      // Fallback to sample data if JSON asset fails to load
      const csvData = this.getSampleCSVData();
      const stateFloodData = this.aggregateFloodsByState(csvData);
      this.floodEvents = this.createStateMarkers(stateFloodData);
      return this.floodEvents;
    }
  }

  /**
   * Aggregate flood events by state
   */
  static aggregateFloodsByState(csvData) {
    const stateData = {};
    
    csvData.forEach(row => {
      if (row.is_flood === 'True') {
        const state = row.state;
        if (!stateData[state]) {
          stateData[state] = {
            state,
            events: [],
            totalEvents: 0,
            recentEvents: 0,
            yearlyEvents: {}
          };
        }
        
        const date = new Date(row.date);
        const year = date.getFullYear();
        const daysSince = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
        
        stateData[state].events.push({
          date,
          daysSince
        });
        stateData[state].totalEvents++;
        
        if (daysSince <= 365) { // Recent events in last year
          stateData[state].recentEvents++;
        }
        
        stateData[state].yearlyEvents[year] = (stateData[state].yearlyEvents[year] || 0) + 1;
      }
    });
    
    return stateData;
  }

  /**
   * Create map markers for each state
   */
  static createStateMarkers(stateFloodData) {
    const markers = [];
    
    Object.values(stateFloodData).forEach(stateInfo => {
      const coordinates = getStateCoordinates(stateInfo.state);
      
      if (coordinates) {
        markers.push({
          id: `state-${stateInfo.state}`,
          state: stateInfo.state,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          totalEvents: stateInfo.totalEvents,
          recentEvents: stateInfo.recentEvents,
          yearlyEvents: stateInfo.yearlyEvents,
          events: stateInfo.events,
          severity: this.calculateStateSeverity(stateInfo.totalEvents),
          daysSince: Math.min(...stateInfo.events.map(e => e.daysSince))
        });
      }
    });
    
    return markers.sort((a, b) => b.totalEvents - a.totalEvents);
  }

  /**
   * Calculate state severity based on total events
   */
  static calculateStateSeverity(totalEvents) {
    if (totalEvents >= 100) return 5; // Very high
    if (totalEvents >= 50) return 4;  // High
    if (totalEvents >= 20) return 3;  // Moderate
    if (totalEvents >= 10) return 2;  // Low
    return 1; // Very low
  }

  /**
   * Fallback mock data for development
   */
  static getMockFloodData() {
    return Object.keys(MALAYSIAN_STATES).map(stateName => {
      const state = MALAYSIAN_STATES[stateName];
      const mockEvents = Math.floor(Math.random() * 50) + 10;
      
      return {
        id: `state-${stateName}`,
        state: stateName,
        latitude: state.latitude,
        longitude: state.longitude,
        totalEvents: mockEvents,
        recentEvents: Math.floor(mockEvents * 0.2),
        severity: this.calculateStateSeverity(mockEvents),
        daysSince: Math.floor(Math.random() * 365)
      };
    });
  }


  /**
   * Get flood data for specific state
   */
  static async getFloodsByState(stateName) {
    const events = await this.loadFloodData();
    return events.filter(event => event.state === stateName);
  }

  /**
   * Get flood events near coordinates (within radius km)
   */
  static async getNearbyFloods(latitude, longitude, radiusKm = 200) {
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
    let totalFloodEvents = 0;
    let recentEvents = 0;
    
    events.forEach(event => {
      // Count by state (using totalEvents for each state)
      byState[event.state] = event.totalEvents;
      totalFloodEvents += event.totalEvents;
      
      // Count recent events
      recentEvents += event.recentEvents;
      
      // Count by severity
      bySeverity[event.severity]++;
    });
    
    return {
      totalEvents: totalFloodEvents,
      recentEvents,
      byState,
      bySeverity,
      stateCount: events.length,
      highestRiskState: Object.keys(byState).reduce((a, b) => 
        byState[a] > byState[b] ? a : b
      )
    };
  }

  /**
   * Get events filtered by time period
   */
  static async getFloodsByTimePeriod(days = 30) {
    const events = await this.loadFloodData();
    return events.filter(event => event.daysSince <= days);
  }

  /**
   * Get top flood-prone states
   */
  static async getTopFloodStates(limit = 5) {
    const events = await this.loadFloodData();
    return events
      .sort((a, b) => b.totalEvents - a.totalEvents)
      .slice(0, limit);
  }
}

export default FloodDataCSV;