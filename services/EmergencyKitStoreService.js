// services/EmergencyKitStoreService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import EmergencyPlacesService from './EmergencyPlacesService';

// Store types optimized for emergency kit preparation
const EMERGENCY_KIT_STORE_TYPES = {
  grocery: {
    googlePlaceTypes: ['grocery_or_supermarket', 'supermarket'],
    searchTerms: ['grocery store', 'supermarket'],
    icon: 'storefront',
    color: '#4CAF50',
    displayName: 'Grocery',
    priority: 1,
    description: 'Water, food, basic supplies',
    itemCategories: ['water', 'food', 'non-perishable', 'supplies', 'cleaning']
  },
  pharmacy: {
    googlePlaceTypes: ['pharmacy', 'drugstore'],
    searchTerms: ['pharmacy', 'drugstore'],
    icon: 'medical',
    color: '#2196F3',
    displayName: 'Pharmacy',
    priority: 2,
    description: 'Medications, first aid',
    itemCategories: ['medication', 'first aid', 'health', 'medical', 'personal care']
  },
  hardware: {
    googlePlaceTypes: ['hardware_store', 'home_goods_store'],
    searchTerms: ['hardware store', 'bunnings'],
    icon: 'hammer',
    color: '#FF5722',
    displayName: 'Hardware',
    priority: 3,
    description: 'Tools, flashlights, batteries',
    itemCategories: ['flashlight', 'battery', 'tool', 'rope', 'tarp', 'emergency gear', 'radio']
  },
  department: {
    googlePlaceTypes: ['department_store', 'shopping_mall'],
    searchTerms: ['department store', 'target', 'big w'],
    icon: 'business',
    color: '#9C27B0',
    displayName: 'Department',
    priority: 4,
    description: 'One-stop shopping',
    itemCategories: ['clothing', 'electronics', 'general', 'blanket', 'sleeping bag']
  },
  electronics: {
    googlePlaceTypes: ['electronics_store'],
    searchTerms: ['electronics store', 'jb hi-fi'],
    icon: 'phone-portrait',
    color: '#FF9800',
    displayName: 'Electronics',
    priority: 5,
    description: 'Radios, chargers, batteries',
    itemCategories: ['radio', 'charger', 'power bank', 'battery', 'electronics']
  },
  outdoor: {
    googlePlaceTypes: ['sporting_goods_store'],
    searchTerms: ['outdoor store', 'camping store', 'bcf'],
    icon: 'hardware-chip',
    color: '#8BC34A',
    displayName: 'Outdoor',
    priority: 6,
    description: 'Camping gear, survival items',
    itemCategories: ['camping', 'sleeping bag', 'waterproof', 'survival', 'outdoor gear']
  },
  bookstore: {
    googlePlaceTypes: ['book_store'],
    searchTerms: ['bookstore', 'book store'],
    icon: 'book',
    color: '#795548',
    displayName: 'Bookstore',
    priority: 7,
    description: 'Educational materials, activity books',
    itemCategories: ['book', 'educational', 'activity', 'reading', 'coloring']
  },
  toy_store: {
    googlePlaceTypes: ['store'],
    searchTerms: ['toy store', 'toys r us', 'kmart', 'target'],
    icon: 'game-controller',
    color: '#E91E63',
    displayName: 'Toy Store',
    priority: 8,
    description: 'Games, comfort items for children',
    itemCategories: ['toy', 'game', 'comfort', 'activity', 'children', 'doll', 'puzzle']
  }
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
const MAX_STORES_PER_TYPE = 3;
const MAX_DISTANCE_KM = 10;

class EmergencyKitStoreService {
  static performanceMetrics = {
    cacheHits: 0,
    apiCalls: 0,
    averageResponseTime: 0
  };

  /**
   * Analyze incomplete emergency kit items and suggest relevant store types
   */
  static analyzeIncompleteItems(incompleteItems, allItems) {
    if (!incompleteItems || incompleteItems.length === 0) {
      return [];
    }

    const storeRelevance = {};

    // Initialize store relevance scores
    Object.keys(EMERGENCY_KIT_STORE_TYPES).forEach(storeType => {
      storeRelevance[storeType] = {
        score: 0,
        itemCount: 0,
        priorityWeight: 0,
        items: []
      };
    });

    // Analyze each incomplete item
    incompleteItems.forEach(item => {
      const relevantStores = this.findRelevantStores(item);
      const priorityMultiplier = this.getPriorityMultiplier(item.priority);

      relevantStores.forEach(storeType => {
        if (storeRelevance[storeType]) {
          storeRelevance[storeType].score += priorityMultiplier;
          storeRelevance[storeType].itemCount += 1;
          storeRelevance[storeType].priorityWeight += priorityMultiplier;
          storeRelevance[storeType].items.push(item.originalItem);
        }
      });
    });

    // Sort stores by relevance score
    const rankedStores = Object.entries(storeRelevance)
      .filter(([_, data]) => data.score > 0)
      .sort((a, b) => {
        // Primary: score (higher is better)
        const scoreDiff = b[1].score - a[1].score;
        if (Math.abs(scoreDiff) > 1) return scoreDiff;

        // Secondary: store priority (lower number = higher priority)
        return EMERGENCY_KIT_STORE_TYPES[a[0]].priority - EMERGENCY_KIT_STORE_TYPES[b[0]].priority;
      })
      .slice(0, 4) // Maximum 4 store types
      .map(([storeType, data]) => ({
        storeType,
        config: EMERGENCY_KIT_STORE_TYPES[storeType],
        relevanceScore: data.score,
        itemCount: data.itemCount,
        relevantItems: data.items
      }));

    return rankedStores;
  }

  /**
   * Find store types relevant to a specific emergency kit item
   */
  static findRelevantStores(item) {
    const itemText = (item.originalItem + ' ' + (item.whereToShop || '')).toLowerCase();

    // Skip items that can't be purchased at stores
    if (itemText.includes('home preparation') || itemText.includes('prepare at home')) {
      return [];
    }

    const relevantStores = [];

    Object.entries(EMERGENCY_KIT_STORE_TYPES).forEach(([storeType, config]) => {
      // Check if item text mentions this store type directly
      const directMatch = config.searchTerms.some(term =>
        itemText.includes(term.toLowerCase())
      );

      // Check if item matches store's item categories
      const categoryMatch = config.itemCategories.some(category =>
        itemText.includes(category.toLowerCase())
      );

      if (directMatch || categoryMatch) {
        relevantStores.push(storeType);
      }
    });

    // Fallback: if no specific matches, suggest general stores
    if (relevantStores.length === 0) {
      if (item.priority === 'HIGH') {
        relevantStores.push('grocery', 'pharmacy');
      } else {
        relevantStores.push('department');
      }
    }

    return relevantStores;
  }

  /**
   * Get priority multiplier for scoring
   */
  static getPriorityMultiplier(priority) {
    switch (priority) {
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 1;
    }
  }

  /**
   * Get nearby stores for emergency kit preparation
   */
  static async getNearbyKitStores(userLocation, relevantStoreTypes) {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = `kit_stores_${userLocation.latitude}_${userLocation.longitude}`;
      const cached = await this.getCachedStores(cacheKey);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        return this.filterByRelevantTypes(cached, relevantStoreTypes);
      }

      // Search for each relevant store type
      const allStores = [];

      for (const storeTypeData of relevantStoreTypes) {
        const storeType = storeTypeData.storeType;
        const config = EMERGENCY_KIT_STORE_TYPES[storeType];

        for (const googlePlaceType of config.googlePlaceTypes) {
          try {
            const places = await EmergencyPlacesService.searchPlacesByType(
              googlePlaceType,
              userLocation,
              5000 // 5km radius
            );

            const enhancedPlaces = places
              .filter(place => place.distance <= MAX_DISTANCE_KM)
              .slice(0, MAX_STORES_PER_TYPE)
              .map(place => ({
                ...place,
                storeType,
                storeConfig: config,
                relevanceScore: storeTypeData.relevanceScore,
                relevantItems: storeTypeData.relevantItems
              }));

            allStores.push(...enhancedPlaces);
          } catch (error) {
            console.warn(`Failed to search for ${googlePlaceType}:`, error);
          }
        }
      }

      // Remove duplicates and sort
      const uniqueStores = this.removeDuplicateStores(allStores);
      const sortedStores = this.sortStoresByRelevance(uniqueStores);

      // Cache results
      await this.cacheStores(cacheKey, sortedStores);

      this.performanceMetrics.apiCalls++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      return sortedStores;
    } catch (error) {
      console.error('Error getting nearby kit stores:', error);
      throw error;
    }
  }

  /**
   * Filter cached stores by currently relevant types
   */
  static filterByRelevantTypes(cachedStores, relevantStoreTypes) {
    const relevantTypeNames = relevantStoreTypes.map(st => st.storeType);
    return cachedStores.filter(store =>
      relevantTypeNames.includes(store.storeType)
    );
  }

  /**
   * Sort stores by relevance and distance
   */
  static sortStoresByRelevance(stores) {
    return stores.sort((a, b) => {
      // Primary: relevance score (higher is better)
      const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (Math.abs(scoreDiff) > 0.5) return scoreDiff;

      // Secondary: store type priority (lower number = higher priority)
      const priorityDiff = a.storeConfig.priority - b.storeConfig.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Tertiary: distance (closer is better)
      return a.distance - b.distance;
    });
  }

  /**
   * Remove duplicate stores based on place_id or name similarity
   */
  static removeDuplicateStores(stores) {
    const seen = new Set();
    return stores.filter(store => {
      const key = store.place_id || store.name?.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Format distance for compact display
   */
  static formatCompactDistance(distance) {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else if (distance < 10) {
      return `${distance.toFixed(1)}km`;
    } else {
      return `${Math.round(distance)}km`;
    }
  }

  /**
   * Get walking time estimate
   */
  static getWalkingTime(distance) {
    if (distance < 0.5) {
      return `${Math.round(distance * 1000 / 80)}min walk`; // 80m/min walking speed
    } else if (distance < 2) {
      return `${Math.round(distance * 12)}min walk`; // 5km/h walking speed
    } else {
      return `${Math.round(distance * 2)}min drive`; // ~30km/h city driving
    }
  }

  /**
   * Generate smart shopping suggestions
   */
  static generateShoppingSuggestions(incompleteItems, nearbyStores) {
    const suggestions = [];

    // Group items by store type for efficient shopping
    const itemsByStore = {};

    incompleteItems.forEach(item => {
      const relevantStores = this.findRelevantStores(item);
      relevantStores.forEach(storeType => {
        if (!itemsByStore[storeType]) {
          itemsByStore[storeType] = [];
        }
        itemsByStore[storeType].push(item.originalItem);
      });
    });

    // Create shopping suggestions
    Object.entries(itemsByStore).forEach(([storeType, items]) => {
      const nearbyStore = nearbyStores.find(store => store.storeType === storeType);
      if (nearbyStore && items.length > 0) {
        suggestions.push({
          storeType,
          storeName: nearbyStore.name,
          distance: nearbyStore.distance,
          items: items.slice(0, 3), // Show max 3 items
          totalItems: items.length,
          config: EMERGENCY_KIT_STORE_TYPES[storeType]
        });
      }
    });

    return suggestions.sort((a, b) =>
      (b.totalItems * b.config.priority) - (a.totalItems * a.config.priority)
    );
  }

  /**
   * Cache stores results
   */
  static async cacheStores(key, stores) {
    try {
      const cacheData = {
        stores,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache stores:', error);
    }
  }

  /**
   * Get cached stores
   */
  static async getCachedStores(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { stores, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return stores;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get cached stores:', error);
      return null;
    }
  }

  /**
   * Update average response time metric
   */
  static updateAverageResponseTime(responseTime) {
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const count = this.performanceMetrics.apiCalls;
    this.performanceMetrics.averageResponseTime =
      (currentAvg * (count - 1) + responseTime) / count;
  }

  /**
   * Get store types configuration
   */
  static getStoreTypes() {
    return EMERGENCY_KIT_STORE_TYPES;
  }

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
}

export default EmergencyKitStoreService;