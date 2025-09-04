/**
 * EnhancedFloodDataService.js - Enhanced flood data service with detailed 2025 events
 * Features: District/state search, individual event details, comprehensive summaries
 */

import { getStateCoordinates, MALAYSIAN_STATES } from '../utils/MalaysianStates';

class EnhancedFloodDataService {
  static floodEvents = null;
  static detailedEvents = null;
  static searchIndex = null;
  static isLoaded = false;

  /**
   * Load and process both historical aggregated data and detailed 2025 events
   */
  static async loadAllFloodData() {
    if (this.isLoaded && this.floodEvents && this.detailedEvents) {
      return {
        aggregated: this.floodEvents,
        detailed: this.detailedEvents,
        searchIndex: this.searchIndex
      };
    }

    try {
      // Load detailed 2025 flood events
      const detailedFloodData = require('../assets/malaysia_flood_2025_detailed.json');
      
      // Process detailed events for search and display
      this.detailedEvents = this.processDetailedEvents(detailedFloodData);
      
      // Create aggregated data for map visualization
      this.floodEvents = this.createAggregatedData(detailedFloodData);
      
      // Build search index for districts and states
      this.searchIndex = this.buildSearchIndex(detailedFloodData);
      
      this.isLoaded = true;
      console.log(`✅ Processed ${this.floodEvents.length} state aggregations and ${this.detailedEvents.length} detailed events`);
      
      return {
        aggregated: this.floodEvents,
        detailed: this.detailedEvents,
        searchIndex: this.searchIndex
      };
      
    } catch (error) {
      console.error('❌ Error loading enhanced flood data:', error);
      console.error('❌ Error details:', error.message);
      console.warn('⚠️ Falling back to basic data');
      
      // Fallback to basic aggregated data
      const fallbackData = this.getFallbackData();
      this.floodEvents = fallbackData;
      this.detailedEvents = [];
      
      // Create a basic search index from fallback data
      this.searchIndex = this.buildSearchIndexFromFallback(fallbackData);
      
      return {
        aggregated: this.floodEvents,
        detailed: this.detailedEvents,
        searchIndex: this.searchIndex
      };
    }
  }

  /**
   * Process detailed events with enhanced metadata
   */
  static processDetailedEvents(rawEvents) {
    if (!rawEvents || !Array.isArray(rawEvents)) {
      console.warn('⚠️ Invalid rawEvents data, returning empty array');
      return [];
    }
    
    return rawEvents.map(event => {
      try {
        return {
          ...event,
          // Parse date for sorting and filtering
          parsedDate: this.parseDate(event.date),
          // Clean and categorize flood causes
          causes: this.parseFloodCauses(event.floodCause),
          // Clean river basin information
          riverBasins: this.parseRiverBasins(event.riverBasin),
          // Add search-friendly text
          searchText: `${event.state || ''} ${event.district || ''} ${event.floodCause || ''}`.toLowerCase()
        };
      } catch (error) {
        console.warn('⚠️ Error processing event:', event, error);
        return {
          ...event,
          parsedDate: new Date(),
          causes: [],
          riverBasins: [],
          searchText: `${event.state || ''} ${event.district || ''}`.toLowerCase()
        };
      }
    }).sort((a, b) => b.parsedDate - a.parsedDate); // Sort by date, newest first
  }

  /**
   * Parse date string to Date object
   */
  static parseDate(dateString) {
    try {
      // Handle various date formats: DD/MM/YYYY, D/M/YYYY, etc.
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    } catch (error) {
      console.warn(`⚠️ Could not parse date: ${dateString}`);
    }
    return new Date();
  }

  /**
   * Parse and categorize flood causes
   */
  static parseFloodCauses(causeString) {
    if (!causeString) return [];
    
    return causeString.split(',').map(cause => cause.trim()).filter(cause => cause.length > 0);
  }

  /**
   * Parse river basin information
   */
  static parseRiverBasins(basinString) {
    if (!basinString || basinString === '-' || basinString === '') return [];
    
    // Split by common delimiters and clean up
    return basinString.split(/[;,]/).map(basin => basin.trim()).filter(basin => basin.length > 0);
  }

  /**
   * Normalize state name for consistency
   */
  static normalizeStateName(stateName) {
    // Handle WP variations - normalize to match MalaysianStates.js keys
    if (stateName === 'WP Kuala Lumpur') return 'Kuala Lumpur';
    if (stateName === 'WP Labuan') return 'Labuan';
    if (stateName === 'WP Putrajaya') return 'Putrajaya';
    return stateName;
  }

  /**
   * Create aggregated data for map visualization from detailed events
   */
  static createAggregatedData(detailedEvents) {
    const stateData = {};
    
    // Group events by state
    detailedEvents.forEach(event => {
      const stateName = event.state;
      const normalizedStateName = this.normalizeStateName(stateName);
      
      if (!stateData[normalizedStateName]) {
        stateData[normalizedStateName] = {
          state: stateName, // Keep original for display
          normalizedState: normalizedStateName, // For coordinate lookup
          events: [],
          districts: new Set(),
          totalEvents: 0,
          recentEvents: 0,
          yearlyEvents: {},
          causes: {},
          riverBasins: new Set()
        };
      }
      
      const parsedDate = this.parseDate(event.date);
      const year = parsedDate.getFullYear();
      const daysSince = Math.floor((new Date() - parsedDate) / (1000 * 60 * 60 * 24));
      
      // Add event info
      stateData[normalizedStateName].events.push({
        ...event,
        parsedDate,
        daysSince
      });
      
      stateData[normalizedStateName].districts.add(event.district);
      stateData[normalizedStateName].totalEvents++;
      
      if (daysSince <= 365) { // Recent events in last year
        stateData[normalizedStateName].recentEvents++;
      }
      
      // Track yearly events
      stateData[normalizedStateName].yearlyEvents[year] = (stateData[normalizedStateName].yearlyEvents[year] || 0) + 1;
      
      // Track causes
      const causes = this.parseFloodCauses(event.floodCause);
      causes.forEach(cause => {
        stateData[normalizedStateName].causes[cause] = (stateData[normalizedStateName].causes[cause] || 0) + 1;
      });
      
      // Track river basins
      const basins = this.parseRiverBasins(event.riverBasin);
      basins.forEach(basin => stateData[normalizedStateName].riverBasins.add(basin));
    });

    // Create map markers for each state
    const markers = [];
    
    Object.values(stateData).forEach(stateInfo => {
      // Use normalized state name for coordinate lookup
      const coordinates = getStateCoordinates(stateInfo.normalizedState);
      
      if (coordinates) {
        markers.push({
          id: `state-${stateInfo.normalizedState}`,
          state: stateInfo.state, // Keep original for display
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          totalEvents: stateInfo.totalEvents,
          recentEvents: stateInfo.recentEvents,
          yearlyEvents: stateInfo.yearlyEvents,
          events: stateInfo.events,
          districts: Array.from(stateInfo.districts),
          causes: stateInfo.causes,
          riverBasins: Array.from(stateInfo.riverBasins),
          severity: this.calculateStateSeverity(stateInfo.totalEvents),
          daysSince: Math.min(...stateInfo.events.map(e => e.daysSince))
        });
      }
    });
    
    return markers.sort((a, b) => b.totalEvents - a.totalEvents);
  }

  /**
   * Build search index for districts and states
   */
  static buildSearchIndex(detailedEvents) {
    const districts = new Set();
    const states = new Set();
    const searchItems = [];

    detailedEvents.forEach(event => {
      const originalState = event.state;
      const normalizedState = this.normalizeStateName(originalState);
      
      states.add(originalState);
      districts.add(`${event.district}, ${originalState}`);
      
      // Create searchable items for districts
      searchItems.push({
        type: 'district',
        name: event.district,
        fullName: `${event.district}, ${originalState}`,
        state: originalState,
        normalizedState: normalizedState,
        searchText: `${event.district} ${originalState} ${normalizedState}`.toLowerCase(),
        coordinates: {
          latitude: event.latitude,
          longitude: event.longitude
        }
      });
    });

    // Add state-level items with both original and normalized names
    Array.from(states).forEach(originalStateName => {
      const normalizedStateName = this.normalizeStateName(originalStateName);
      
      // Try to get coordinates using original state name first, then normalized
      let coordinates = getStateCoordinates(originalStateName);
      if (!coordinates) {
        coordinates = getStateCoordinates(normalizedStateName);
      }
      
      if (coordinates) {
        searchItems.push({
          type: 'state',
          name: originalStateName,
          fullName: originalStateName,
          state: originalStateName,
          normalizedState: normalizedStateName,
          searchText: `${originalStateName} ${normalizedStateName}`.toLowerCase(),
          coordinates
        });
      }
    });

    return {
      districts: Array.from(districts).sort(),
      states: Array.from(states).sort(),
      searchItems: this.removeDuplicateSearchItems(searchItems)
    };
  }

  /**
   * Remove duplicate search items (keep unique district-state combinations)
   */
  static removeDuplicateSearchItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.type}-${item.fullName}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate state severity based on total events
   */
  static calculateStateSeverity(totalEvents) {
    if (totalEvents >= 50) return 5;  // Very high
    if (totalEvents >= 30) return 4;  // High
    if (totalEvents >= 15) return 3;  // Moderate
    if (totalEvents >= 5) return 2;   // Low
    return 1; // Very low
  }

  /**
   * Search for areas (districts or states) by query
   */
  static async searchAreas(query) {
    const data = await this.loadAllFloodData();
    
    if (!query || query.length < 2) {
      return [];
    }
    
    const lowercaseQuery = query.toLowerCase();
    
    // Enhanced search that looks for matches in all search text
    const results = data.searchIndex.searchItems
      .filter(item => {
        // Check if query matches any part of the search text
        const searchText = item.searchText || '';
        return searchText.includes(lowercaseQuery);
      })
      .slice(0, 15) // Increased limit for better results
      .sort((a, b) => {
        // Enhanced sorting algorithm
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // 1. Exact matches first
        const aExact = aName === lowercaseQuery;
        const bExact = bName === lowercaseQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // 2. Starts with query
        const aStarts = aName.startsWith(lowercaseQuery);
        const bStarts = bName.startsWith(lowercaseQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // 3. States before districts for same name match
        if (aName === bName) {
          if (a.type === 'state' && b.type === 'district') return -1;
          if (a.type === 'district' && b.type === 'state') return 1;
        }
        
        // 4. Alphabetical order
        return aName.localeCompare(bName);
      });
    
    return results;
  }

  /**
   * Get detailed flood events for a specific area
   */
  static async getFloodEventsForArea(areaName, areaType = 'district') {
    const data = await this.loadAllFloodData();
    
    if (areaType === 'district') {
      // Extract district name if it includes state (e.g., "Kuala Lumpur, Selangor")
      const districtName = areaName.split(',')[0].trim();
      return data.detailed.filter(event => 
        event.district.toLowerCase() === districtName.toLowerCase()
      );
    } else {
      return data.detailed.filter(event => 
        event.state.toLowerCase() === areaName.toLowerCase()
      );
    }
  }

  /**
   * Get summary for a specific area
   */
  static async getAreaSummary(areaName, areaType = 'district') {
    const events = await this.getFloodEventsForArea(areaName, areaType);
    
    if (events.length === 0) {
      return {
        totalEvents: 0,
        recentEvents: 0,
        mostRecentEvent: null,
        topCauses: [],
        riverBasins: [],
        yearlyBreakdown: {}
      };
    }

    const now = new Date();
    const recentEvents = events.filter(event => {
      const eventDate = this.parseDate(event.date);
      const daysSince = Math.floor((now - eventDate) / (1000 * 60 * 60 * 24));
      return daysSince <= 365;
    });

    // Most recent event
    const sortedEvents = events.sort((a, b) => this.parseDate(b.date) - this.parseDate(a.date));
    const mostRecentEvent = sortedEvents[0];

    // Count causes
    const causeCount = {};
    events.forEach(event => {
      const causes = this.parseFloodCauses(event.floodCause);
      causes.forEach(cause => {
        causeCount[cause] = (causeCount[cause] || 0) + 1;
      });
    });

    const topCauses = Object.entries(causeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cause, count]) => ({ cause, count }));

    // Collect river basins
    const riverBasins = new Set();
    events.forEach(event => {
      const basins = this.parseRiverBasins(event.riverBasin);
      basins.forEach(basin => riverBasins.add(basin));
    });

    // Yearly breakdown
    const yearlyBreakdown = {};
    events.forEach(event => {
      const year = this.parseDate(event.date).getFullYear();
      yearlyBreakdown[year] = (yearlyBreakdown[year] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      recentEvents: recentEvents.length,
      mostRecentEvent,
      topCauses,
      riverBasins: Array.from(riverBasins),
      yearlyBreakdown,
      events: events.slice(0, 20) // Return up to 20 most recent events
    };
  }

  /**
   * Build search index from fallback data
   */
  static buildSearchIndexFromFallback(fallbackData) {
    const searchItems = [];
    const states = new Set();
    
    fallbackData.forEach(stateData => {
      const stateName = stateData.state;
      states.add(stateName);
      
      // Add state to search items
      searchItems.push({
        type: 'state',
        name: stateName,
        fullName: stateName,
        state: stateName,
        normalizedState: this.normalizeStateName(stateName),
        searchText: `${stateName} ${this.normalizeStateName(stateName)}`.toLowerCase(),
        coordinates: {
          latitude: stateData.latitude,
          longitude: stateData.longitude
        }
      });
    });
    
    return {
      districts: [],
      states: Array.from(states).sort(),
      searchItems: searchItems
    };
  }

  /**
   * Fallback data for development/testing
   */
  static getFallbackData() {
    return Object.keys(MALAYSIAN_STATES).map(stateName => {
      const state = MALAYSIAN_STATES[stateName];
      const mockEvents = Math.floor(Math.random() * 30) + 5;
      
      return {
        id: `state-${stateName}`,
        state: stateName,
        latitude: state.latitude,
        longitude: state.longitude,
        totalEvents: mockEvents,
        recentEvents: Math.floor(mockEvents * 0.3),
        severity: this.calculateStateSeverity(mockEvents),
        daysSince: Math.floor(Math.random() * 365),
        districts: ['Mock District 1', 'Mock District 2'],
        causes: { 'Heavy Rain': mockEvents },
        riverBasins: ['Mock River Basin']
      };
    });
  }

  /**
   * Get flood statistics
   */
  static async getFloodStatistics() {
    const data = await this.loadAllFloodData();
    
    const byState = {};
    const bySeverity = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalFloodEvents = 0;
    let recentEvents = 0;
    
    data.aggregated.forEach(event => {
      byState[event.state] = event.totalEvents;
      totalFloodEvents += event.totalEvents;
      recentEvents += event.recentEvents;
      bySeverity[event.severity]++;
    });
    
    return {
      totalEvents: totalFloodEvents,
      recentEvents,
      byState,
      bySeverity,
      stateCount: data.aggregated.length,
      districtCount: data.searchIndex.districts.length,
      highestRiskState: Object.keys(byState).reduce((a, b) => 
        byState[a] > byState[b] ? a : b
      )
    };
  }
}

export default EnhancedFloodDataService;