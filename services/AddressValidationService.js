import LocationService from './LocationService';

class AddressValidationService {
  
  constructor() {
    this.malaysianStates = [
      'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
      'Pahang', 'Penang', 'Perak', 'Perlis', 'Sabah', 'Sarawak',
      'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'
    ];
    
    this.malaysianCities = [
      'Kuala Lumpur', 'Johor Bahru', 'George Town', 'Ipoh', 'Shah Alam',
      'Petaling Jaya', 'Klang', 'Kajang', 'Seremban', 'Kuantan',
      'Kota Bharu', 'Alor Setar', 'Kuching', 'Kota Kinabalu', 'Sandakan',
      'Tawau', 'Miri', 'Sibu', 'Kangar', 'Kuala Terengganu', 'Malacca City',
      'Puchong', 'Subang Jaya', 'Ampang', 'Cheras', 'Seri Kembangan'
    ];
    
    this.addressPatterns = {
      malaysian: /^(\d+[\w\-\s]*)?[\w\s\-,\.]+,?\s*(Jalan|Jln|Lorong|Taman|Persiaran|Lebuh|Bandar|Kampung|Kg\.?)\s+[\w\s\-]+,?\s*\d{5}\s+([\w\s]+),?\s*(Malaysia)?$/i,
      postcode: /\b\d{5}\b/,
      roadPrefix: /\b(Jalan|Jln|Lorong|Lor|Taman|Persiaran|Lebuh|Bandar|Kampung|Kg\.?)\b/i,
      houseNumber: /^\d+[\w\-]*\s/
    };
  }

  validateMalaysianAddress(address) {
    if (!address || typeof address !== 'string') {
      return {
        isValid: false,
        score: 0,
        issues: ['Address is required'],
        suggestions: []
      };
    }

    const addressTrimmed = address.trim();
    const issues = [];
    let score = 0;
    let suggestions = [];

    if (addressTrimmed.length < 5) {
      return {
        isValid: false,
        score: 0,
        issues: ['Address is too short'],
        suggestions: ['Please provide a complete address with street, area, and postcode']
      };
    }

    if (this.containsMalaysianState(addressTrimmed)) {
      score += 25;
    } else {
      issues.push('No Malaysian state detected');
      suggestions.push('Include the state name (e.g., Selangor, Johor, Penang)');
    }

    if (this.addressPatterns.postcode.test(addressTrimmed)) {
      score += 20;
    } else {
      issues.push('No valid postcode found');
      suggestions.push('Include a 5-digit Malaysian postcode');
    }

    if (this.addressPatterns.roadPrefix.test(addressTrimmed)) {
      score += 15;
    } else {
      issues.push('No road identifier found');
      suggestions.push('Include road type (Jalan, Lorong, Taman, etc.)');
    }

    if (this.addressPatterns.houseNumber.test(addressTrimmed)) {
      score += 10;
    } else if (!addressTrimmed.match(/\b(Taman|Bandar|Kampung|Plaza|Mall|Building)\b/i)) {
      suggestions.push('Consider including house/unit number if applicable');
    }

    if (this.containsMalaysianCity(addressTrimmed)) {
      score += 15;
    }

    if (addressTrimmed.toLowerCase().includes('malaysia')) {
      score += 5;
    }

    const components = this.parseAddressComponents(addressTrimmed);
    if (Object.keys(components).length >= 3) {
      score += 10;
    }

    const isValid = score >= 50 && issues.length <= 2;
    
    return {
      isValid,
      score,
      issues,
      suggestions,
      components,
      confidence: Math.min(score / 85 * 100, 100)
    };
  }

  calculateAddressSimilarity(query, candidate) {
    if (!query || !candidate) return 0;
    
    const queryLower = this.normalizeAddress(query);
    const candidateLower = this.normalizeAddress(candidate);
    
    if (queryLower === candidateLower) return 1.0;
    if (candidateLower.includes(queryLower)) return 0.9;
    
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
    const candidateWords = candidateLower.split(/\s+/).filter(word => word.length > 1);
    
    if (queryWords.length === 0 || candidateWords.length === 0) return 0;
    
    let exactMatches = 0;
    let partialMatches = 0;
    let positionBonus = 0;
    
    for (let i = 0; i < queryWords.length; i++) {
      const queryWord = queryWords[i];
      let bestMatch = 0;
      let bestPosition = -1;
      
      for (let j = 0; j < candidateWords.length; j++) {
        const candidateWord = candidateWords[j];
        let match = 0;
        
        if (queryWord === candidateWord) {
          match = 1.0;
          exactMatches++;
        } else if (candidateWord.includes(queryWord)) {
          match = 0.8;
          partialMatches++;
        } else if (queryWord.includes(candidateWord)) {
          match = 0.6;
          partialMatches++;
        } else {
          match = this.calculateLevenshteinSimilarity(queryWord, candidateWord);
          if (match > 0.7) partialMatches++;
        }
        
        if (match > bestMatch) {
          bestMatch = match;
          bestPosition = j;
        }
      }
      
      if (bestPosition !== -1 && Math.abs(i - bestPosition) <= 1) {
        positionBonus += 0.1;
      }
    }
    
    const exactScore = exactMatches / queryWords.length * 0.7;
    const partialScore = partialMatches / queryWords.length * 0.2;
    const positionScore = Math.min(positionBonus, 0.1);
    
    return Math.min(exactScore + partialScore + positionScore, 1.0);
  }

  normalizeAddress(address) {
    return address
      .toLowerCase()
      .replace(/[^\w\s\d]/g, ' ')
      .replace(/\b(jln|jalan|lor|lorong|kg|kampung)\b/g, match => {
        const normalized = {
          'jln': 'jalan',
          'jalan': 'jalan',
          'lor': 'lorong',
          'lorong': 'lorong',
          'kg': 'kampung',
          'kampung': 'kampung'
        };
        return normalized[match] || match;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  calculateLevenshteinSimilarity(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i - 1] + 1
          );
        }
      }
    }
    
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (matrix[str2.length][str1.length] / maxLength);
  }

  containsMalaysianState(address) {
    const addressLower = address.toLowerCase();
    return this.malaysianStates.some(state => 
      addressLower.includes(state.toLowerCase())
    );
  }

  containsMalaysianCity(address) {
    const addressLower = address.toLowerCase();
    return this.malaysianCities.some(city => 
      addressLower.includes(city.toLowerCase())
    );
  }

  parseAddressComponents(address) {
    const components = {};
    
    const postcodeMatch = address.match(this.addressPatterns.postcode);
    if (postcodeMatch) {
      components.postcode = postcodeMatch[0];
    }
    
    const roadMatch = address.match(/\b(Jalan|Jln|Lorong|Lor|Taman|Persiaran|Lebuh|Bandar|Kampung|Kg\.?)\s+([^,\d]+)/i);
    if (roadMatch) {
      components.road = `${roadMatch[1]} ${roadMatch[2].trim()}`;
    }
    
    const houseNumberMatch = address.match(/^\d+[\w\-]*/);
    if (houseNumberMatch) {
      components.houseNumber = houseNumberMatch[0];
    }
    
    const stateFound = this.malaysianStates.find(state => 
      address.toLowerCase().includes(state.toLowerCase())
    );
    if (stateFound) {
      components.state = stateFound;
    }
    
    const cityFound = this.malaysianCities.find(city => 
      address.toLowerCase().includes(city.toLowerCase())
    );
    if (cityFound) {
      components.city = cityFound;
    }
    
    return components;
  }

  async validateAddressWithCoordinates(address, coordinates) {
    try {
      const baseValidation = this.validateMalaysianAddress(address);
      
      if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
        return {
          ...baseValidation,
          coordinatesValid: false,
          withinMalaysia: false,
          suggestion: 'Coordinates required for full validation'
        };
      }

      const { latitude, longitude } = coordinates;
      const withinMalaysia = LocationService.isLocationInMalaysia(latitude, longitude);
      
      if (!withinMalaysia) {
        return {
          ...baseValidation,
          coordinatesValid: true,
          withinMalaysia: false,
          suggestion: 'Location appears to be outside Malaysia',
          nearestMalaysian: LocationService.findNearestMalaysianLocation(latitude, longitude)
        };
      }

      const stateFromCoords = await LocationService.getStateFromCoordinates(latitude, longitude);
      const addressComponents = this.parseAddressComponents(address);
      
      let stateMatch = true;
      if (addressComponents.state && stateFromCoords && stateFromCoords !== 'Unknown') {
        stateMatch = addressComponents.state.toLowerCase().includes(stateFromCoords.toLowerCase()) ||
                    stateFromCoords.toLowerCase().includes(addressComponents.state.toLowerCase());
      }

      return {
        ...baseValidation,
        coordinatesValid: true,
        withinMalaysia: true,
        stateMatch,
        detectedState: stateFromCoords,
        suggestion: stateMatch ? 'Address and location match' : 
                   `Address state may not match location (detected: ${stateFromCoords})`
      };

    } catch (error) {
      console.error('Error validating address with coordinates:', error);
      return {
        ...this.validateMalaysianAddress(address),
        coordinatesValid: false,
        error: 'Coordinate validation failed'
      };
    }
  }

  generateAddressSuggestions(partialAddress) {
    if (!partialAddress || partialAddress.length < 2) {
      return [];
    }

    const suggestions = [];
    const normalized = partialAddress.toLowerCase().trim();
    
    if (!this.addressPatterns.roadPrefix.test(partialAddress)) {
      suggestions.push({
        type: 'road_prefix',
        suggestion: `Jalan ${partialAddress}`,
        reason: 'Added road prefix'
      });
    }
    
    if (!this.addressPatterns.postcode.test(partialAddress)) {
      const stateFound = this.malaysianStates.find(state => 
        normalized.includes(state.toLowerCase())
      );
      
      if (stateFound) {
        const samplePostcodes = this.getSamplePostcodesForState(stateFound);
        suggestions.push({
          type: 'postcode',
          suggestion: `${partialAddress}, ${samplePostcodes[0]}`,
          reason: `Added sample postcode for ${stateFound}`
        });
      } else {
        suggestions.push({
          type: 'postcode',
          suggestion: `${partialAddress}, 50100`,
          reason: 'Added sample postcode (Kuala Lumpur)'
        });
      }
    }
    
    if (!this.containsMalaysianState(partialAddress)) {
      suggestions.push({
        type: 'state',
        suggestion: `${partialAddress}, Selangor`,
        reason: 'Added popular state'
      });
    }
    
    return suggestions.slice(0, 3);
  }

  getSamplePostcodesForState(state) {
    const postcodeMap = {
      'Selangor': ['40000', '47000', '46000'],
      'Kuala Lumpur': ['50000', '55000', '53000'],
      'Johor': ['80000', '81000', '83000'],
      'Penang': ['10000', '11000', '14000'],
      'Perak': ['30000', '31000', '32000'],
      'Kedah': ['05000', '06000', '08000'],
      'Kelantan': ['15000', '16000', '17000'],
      'Terengganu': ['20000', '21000', '22000'],
      'Pahang': ['25000', '26000', '27000'],
      'Negeri Sembilan': ['70000', '71000', '72000'],
      'Melaka': ['75000', '76000', '77000'],
      'Sabah': ['88000', '89000', '90000'],
      'Sarawak': ['93000', '94000', '95000']
    };
    
    return postcodeMap[state] || ['50000', '40000', '80000'];
  }

  checkCoverageAvailability(coordinates) {
    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return {
        available: false,
        reason: 'Invalid coordinates',
        suggestion: 'Please provide valid coordinates'
      };
    }

    const { latitude, longitude } = coordinates;
    
    if (!LocationService.isLocationInMalaysia(latitude, longitude)) {
      const nearest = LocationService.findNearestMalaysianLocation(latitude, longitude);
      return {
        available: false,
        reason: 'Outside Malaysia coverage area',
        suggestion: `Nearest monitored area: ${nearest.name}`,
        nearestLocation: nearest
      };
    }

    return {
      available: true,
      reason: 'Full coverage available',
      suggestion: 'Location monitoring active'
    };
  }
}

const addressValidationService = new AddressValidationService();
export default addressValidationService;