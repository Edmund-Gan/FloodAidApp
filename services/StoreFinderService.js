// services/StoreFinderService.js
import Constants from 'expo-constants';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey ||
                             Constants.manifest?.extra?.googleMapsApiKey ||
                             'YOUR_API_KEY_HERE';

class StoreFinderService {
  /**
   * Map Emergency Kit store categories to Google Places API types and keywords
   */
  static getPlacesType(category) {
    const mapping = {
      // Exact matches
      'Grocery store': { type: 'supermarket', keyword: null },
      'Pharmacy': { type: 'pharmacy', keyword: null },
      'Hardware store': { type: 'hardware_store', keyword: null },
      'department stores': { type: 'department_store', keyword: null },
      'Electronics': { type: 'electronics_store', keyword: null },
      'Any store with electronics': { type: 'electronics_store', keyword: null },
      'Bank': { type: 'bank', keyword: null },
      'ATM': { type: 'atm', keyword: null },

      // Keyword-based searches
      'bulk stores': { type: 'supermarket', keyword: 'warehouse bulk' },
      'camping stores': { type: 'store', keyword: 'camping outdoor equipment' },
      'Outdoor stores': { type: 'store', keyword: 'outdoor camping hiking' },
      'Sporting goods': { type: 'store', keyword: 'sporting goods sports equipment' },
      'Office supply stores': { type: 'store', keyword: 'office supply stationery' },
    };

    // Return mapping or default to general store with category as keyword
    return mapping[category] || { type: 'store', keyword: category };
  }

  /**
   * Find nearby stores using Google Places API
   */
  static async findNearbyStores(location, category, options = {}) {
    const {
      radius = 5000, // 5km default search radius
      maxResults = 20
    } = options;

    if (!location || !location.latitude || !location.longitude) {
      throw new Error('Valid location required for store search');
    }

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY_HERE') {
      throw new Error('Google Maps API key not configured');
    }

    const { type, keyword } = this.getPlacesType(category);

    console.log(`🏪 Searching for ${category} stores:`, {
      type,
      keyword,
      radius: `${radius}m`,
      location: `${location.latitude},${location.longitude}`
    });

    // Build Places API URL
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${location.latitude},${location.longitude}` +
      `&radius=${radius}` +
      `&type=${type}`;

    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`;
    }

    url += `&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'ZERO_RESULTS') {
        console.log(`⚠️ No ${category} stores found within ${radius}m`);
        return [];
      }

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Places API error:', data.status, data.error_message);
        throw new Error(`Places API: ${data.status}`);
      }

      const stores = (data.results || []).slice(0, maxResults).map(place => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity || place.formatted_address,
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        rating: place.rating,
        isOpen: place.opening_hours?.open_now,
        types: place.types,
        placeId: place.place_id
      }));

      console.log(`✅ Found ${stores.length} ${category} stores`);
      return stores;

    } catch (error) {
      console.error('Error finding nearby stores:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // Round to 1 decimal
  }

  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Parse whereToShop string and return array of categories
   */
  static parseStoreCategories(whereToShop) {
    if (!whereToShop) return [];

    const categories = [];
    const shopText = whereToShop.toLowerCase();

    const categoryMap = {
      'grocery store': 'Grocery store',
      'pharmacy': 'Pharmacy',
      'hardware store': 'Hardware store',
      'department store': 'department stores',
      'electronics': 'Electronics',
      'bank': 'Bank',
      'atm': 'ATM',
      'bulk stores': 'bulk stores',
      'camping': 'camping stores',
      'outdoor': 'Outdoor stores',
      'sporting goods': 'Sporting goods',
      'office supply': 'Office supply stores'
    };

    Object.entries(categoryMap).forEach(([key, value]) => {
      if (shopText.includes(key)) {
        categories.push(value);
      }
    });

    // Remove duplicates
    return [...new Set(categories)];
  }
}

export default StoreFinderService;
