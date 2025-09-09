import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { COLORS } from '../utils/constants';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || 'fallback-key-not-configured';

export default function AddressSearchInput({ 
  onAddressSelected, 
  placeholder = "Enter address...", 
  initialValue = "",
  style = {},
  showMapFallback = true 
}) {
  const [searchText, setSearchText] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const words = searchText.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length >= 3 || searchText.length > 10) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      searchTimeoutRef.current = setTimeout(() => {
        searchAddresses(searchText);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText]);

  const searchAddresses = async (query) => {
    if (!query || query.length < 3) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(query)}&` +
        `key=${GOOGLE_MAPS_API_KEY}&` +
        `components=country:MY&` +
        `language=en&` +
        `types=geocode|establishment`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK') {
        const malaysianSuggestions = data.predictions.slice(0, 5).map(prediction => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || '',
          types: prediction.types || [],
          isEstablishment: prediction.types?.includes('establishment') || false
        }));
        
        setSuggestions(malaysianSuggestions);
        setShowSuggestions(true);
      } else if (data.status === 'ZERO_RESULTS') {
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        console.warn('Google Places API error:', data.status, data.error_message);
        handleAPIError();
      }
    } catch (error) {
      console.error('Address search error:', error);
      handleAPIError();
    } finally {
      setIsLoading(false);
    }
  };


  const handleAPIError = () => {
    setSuggestions([{
      placeId: 'fallback',
      description: 'Address search temporarily unavailable',
      mainText: 'Use map selection instead',
      secondaryText: 'Tap to select location on map',
      similarity: 0,
      isFallback: true
    }]);
    setShowSuggestions(true);
  };

  const selectAddress = async (suggestion) => {
    if (suggestion.isFallback) {
      handleMapFallback();
      return;
    }

    setIsLoading(true);
    setSelectedAddress(suggestion);
    setSearchText(suggestion.mainText);
    setShowSuggestions(false);

    try {
      const placeDetails = await getPlaceDetails(suggestion.placeId);
      
      if (placeDetails) {
        const isEstablishment = suggestion.isEstablishment;
        
        const locationData = {
          address: isEstablishment ? (placeDetails.name || suggestion.mainText) : suggestion.description,
          formattedAddress: placeDetails.formatted_address,
          placeName: placeDetails.name,
          vicinity: placeDetails.vicinity,
          coordinates: {
            latitude: placeDetails.geometry.location.lat,
            longitude: placeDetails.geometry.location.lng
          },
          placeId: suggestion.placeId,
          addressComponents: placeDetails.address_components,
          verified: true,
          source: 'google_places',
          isEstablishment: isEstablishment
        };
        
        if (onAddressSelected) {
          onAddressSelected(locationData);
        }
      } else {
        throw new Error('Unable to get place details');
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      Alert.alert(
        'Address Error',
        'Unable to verify this address. Please try a different address or use map selection.',
        [
          { text: 'Try Again', style: 'default' },
          showMapFallback ? { text: 'Use Map', onPress: handleMapFallback } : null
        ].filter(Boolean)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getPlaceDetails = async (placeId) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}&` +
        `key=${GOOGLE_MAPS_API_KEY}&` +
        `fields=formatted_address,geometry,address_components,name,vicinity`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK') {
        return data.result;
      } else {
        throw new Error(`Place details error: ${data.status}`);
      }
    } catch (error) {
      console.error('Place details fetch error:', error);
      return null;
    }
  };

  const handleMapFallback = () => {
    if (onAddressSelected) {
      onAddressSelected({
        address: searchText || 'Map Location',
        coordinates: null,
        needsMapSelection: true,
        source: 'map_fallback'
      });
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedAddress(null);
  };

  const renderSuggestionItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.suggestionItem,
        item.isFallback && styles.fallbackSuggestion
      ]} 
      onPress={() => selectAddress(item)}
    >
      <View style={styles.suggestionContent}>
        <Ionicons 
          name={item.isFallback ? "map-outline" : "location-outline"} 
          size={20} 
          color={item.isFallback ? COLORS.WARNING : COLORS.PRIMARY} 
          style={styles.suggestionIcon}
        />
        <View style={styles.suggestionText}>
          <Text style={[
            styles.suggestionMain,
            item.isFallback && styles.fallbackText
          ]}>
            {item.mainText}
          </Text>
          <Text style={[
            styles.suggestionSecondary,
            item.isFallback && styles.fallbackSecondary
          ]}>
            {item.secondaryText}
          </Text>
        </View>
        {item.isEstablishment && !item.isFallback && (
          <View style={styles.establishmentBadge}>
            <Text style={styles.establishmentText}>Place</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.TEXT_SECONDARY} style={styles.searchIcon} />
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor={COLORS.TEXT_LIGHT}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {isLoading && (
          <ActivityIndicator size="small" color={COLORS.PRIMARY} style={styles.loadingIcon} />
        )}
        {searchText.length > 0 && !isLoading && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={COLORS.TEXT_SECONDARY} />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestionItem}
            keyExtractor={item => item.placeId}
            style={styles.suggestionsList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
          {showMapFallback && !suggestions.some(s => s.isFallback) && (
            <TouchableOpacity style={styles.mapFallbackButton} onPress={handleMapFallback}>
              <Ionicons name="map" size={16} color={COLORS.PRIMARY} />
              <Text style={styles.mapFallbackText}>Can't find your address? Select on map</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    paddingVertical: 12,
  },
  loadingIcon: {
    marginLeft: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    marginTop: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    maxHeight: 250,
    zIndex: 1000,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fallbackSuggestion: {
    backgroundColor: '#fff9e6',
    borderBottomColor: '#ffeb99',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  suggestionIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  suggestionSecondary: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  fallbackText: {
    color: COLORS.WARNING,
    fontWeight: '600',
  },
  fallbackSecondary: {
    color: '#b8860b',
    fontStyle: 'italic',
  },
  establishmentBadge: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  establishmentText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.TEXT_ON_PRIMARY,
  },
  mapFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  mapFallbackText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    marginLeft: 6,
    fontWeight: '500',
  },
});