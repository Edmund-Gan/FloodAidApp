import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AddressSearchInput from './AddressSearchInput';
import ManualLocationService from '../services/ManualLocationService';
import { COLORS } from '../utils/constants';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LocationInputModal({
  visible,
  onLocationSelected,
  onCancel,
  title = "Set Your Location",
  subtitle = "Choose your location to get accurate flood predictions",
  showSuggestions = true,
  allowSavePreference = true
}) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  useEffect(() => {
    if (visible) {
      loadLastLocation();
    }
  }, [visible]);

  const loadLastLocation = async () => {
    try {
      const last = await ManualLocationService.getLastManualLocation();
      setLastLocation(last);
    } catch (error) {
      console.error('Failed to load last location:', error);
    }
  };

  const handleAddressSelected = async (locationData) => {
    if (locationData.needsMapSelection) {
      Alert.alert(
        'Map Selection',
        'Map-based location selection is not available in this version. Please enter a specific address.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!locationData.coordinates) {
      Alert.alert(
        'Invalid Location',
        'Unable to determine coordinates for this location. Please try a more specific address.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);

    try {
      // Validate coordinates are in Malaysia
      const validation = ManualLocationService.validateMalaysianCoordinates(
        locationData.coordinates.latitude,
        locationData.coordinates.longitude
      );

      if (!validation.valid) {
        Alert.alert(
          'Location Outside Malaysia',
          `This location appears to be outside Malaysia: ${validation.reason}. Please select a location within Malaysia.`,
          [{ text: 'OK' }]
        );
        return;
      }

      const processedLocation = {
        lat: locationData.coordinates.latitude,
        lon: locationData.coordinates.longitude,
        address: locationData.formattedAddress || locationData.address,
        placeName: locationData.placeName,
        placeId: locationData.placeId,
        accuracy: 50, // Assume good accuracy for user-selected places
        timestamp: Date.now(),
        source: 'MANUAL_SELECTED',
        verified: true,
        addressComponents: locationData.addressComponents
      };

      setSelectedLocation(processedLocation);

    } catch (error) {
      console.error('Error processing selected location:', error);
      Alert.alert(
        'Error',
        'Failed to process the selected location. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLocation = async () => {
    if (!selectedLocation) {
      Alert.alert('No Location Selected', 'Please select a location first.', [{ text: 'OK' }]);
      return;
    }

    setIsLoading(true);

    try {
      // Save as last manual location
      await ManualLocationService.saveLastManualLocation(selectedLocation);

      // Save as default preference if requested
      if (saveAsDefault && allowSavePreference) {
        await ManualLocationService.saveLocationPreference({
          mode: 'manual',
          location: selectedLocation
        });
      }

      console.log('✅ Location confirmed:', {
        address: selectedLocation.address,
        coordinates: `${selectedLocation.lat}, ${selectedLocation.lon}`
      });

      onLocationSelected(selectedLocation);

    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert(
        'Error',
        'Failed to save location preference. The location will still be used for this session.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue Anyway', onPress: () => onLocationSelected(selectedLocation) }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSuggestion = (suggestion) => {
    const suggestionLocation = {
      lat: suggestion.lat,
      lon: suggestion.lon,
      address: suggestion.address,
      placeName: suggestion.name,
      accuracy: 1000, // City-level accuracy
      timestamp: Date.now(),
      source: 'MANUAL_SUGGESTION',
      verified: true
    };

    setSelectedLocation(suggestionLocation);
  };

  const handleUseLastLocation = () => {
    if (lastLocation) {
      setSelectedLocation({
        ...lastLocation,
        timestamp: Date.now(),
        source: 'MANUAL_REUSED'
      });
    }
  };

  const renderSuggestions = () => {
    if (!showSuggestions) return null;

    const suggestions = ManualLocationService.getSuggestedLocations();

    return (
      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>Quick Select</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => handleUseSuggestion(suggestion)}
            >
              <Ionicons name="location-outline" size={16} color={COLORS.PRIMARY} />
              <Text style={styles.suggestionText}>{suggestion.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderLastLocation = () => {
    if (!lastLocation) return null;

    return (
      <TouchableOpacity style={styles.lastLocationContainer} onPress={handleUseLastLocation}>
        <View style={styles.lastLocationContent}>
          <Ionicons name="time-outline" size={20} color={COLORS.TEXT_SECONDARY} />
          <View style={styles.lastLocationText}>
            <Text style={styles.lastLocationTitle}>Use Previous Location</Text>
            <Text style={styles.lastLocationAddress} numberOfLines={1}>
              {lastLocation.address}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT_SECONDARY} />
      </TouchableOpacity>
    );
  };

  const renderSelectedLocation = () => {
    if (!selectedLocation) return null;

    return (
      <View style={styles.selectedLocationContainer}>
        <View style={styles.selectedLocationHeader}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
          <Text style={styles.selectedLocationTitle}>Selected Location</Text>
        </View>
        <Text style={styles.selectedLocationAddress}>{selectedLocation.address}</Text>
        <Text style={styles.selectedLocationCoords}>
          {selectedLocation.lat.toFixed(6)}, {selectedLocation.lon.toFixed(6)}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Ionicons name="close" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Last Location */}
          {renderLastLocation()}

          {/* Address Search */}
          <View style={styles.searchContainer}>
            <Text style={styles.sectionTitle}>Enter Address</Text>
            <AddressSearchInput
              onAddressSelected={handleAddressSelected}
              placeholder="Search for your address..."
              style={styles.searchInput}
              showMapFallback={false}
            />
          </View>

          {/* Suggestions */}
          {renderSuggestions()}

          {/* Selected Location */}
          {renderSelectedLocation()}

          {/* Save Preference Option */}
          {allowSavePreference && selectedLocation && (
            <TouchableOpacity
              style={styles.savePreferenceContainer}
              onPress={() => setSaveAsDefault(!saveAsDefault)}
            >
              <View style={styles.savePreferenceContent}>
                <Ionicons
                  name={saveAsDefault ? "checkbox" : "square-outline"}
                  size={20}
                  color={saveAsDefault ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
                />
                <Text style={styles.savePreferenceText}>
                  Save as my default location
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!selectedLocation || isLoading) && styles.confirmButtonDisabled
            ]}
            onPress={handleConfirmLocation}
            disabled={!selectedLocation || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.confirmButtonText}>Confirm Location</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cancelButton: {
    padding: 8,
    marginTop: -8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  lastLocationContainer: {
    backgroundColor: COLORS.CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastLocationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lastLocationText: {
    marginLeft: 12,
    flex: 1,
  },
  lastLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  lastLocationAddress: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  searchContainer: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
  },
  searchInput: {
    marginBottom: 0,
  },
  suggestionsContainer: {
    marginTop: 24,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
  },
  suggestionsScroll: {
    flexDirection: 'row',
  },
  suggestionChip: {
    backgroundColor: COLORS.CARD_BACKGROUND,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 6,
    fontWeight: '500',
  },
  selectedLocationContainer: {
    backgroundColor: COLORS.SUCCESS_LIGHT,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS,
  },
  selectedLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.SUCCESS,
    marginLeft: 8,
  },
  selectedLocationAddress: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
    fontWeight: '500',
  },
  selectedLocationCoords: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  savePreferenceContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  savePreferenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savePreferenceText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 12,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.BACKGROUND,
  },
  confirmButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.TEXT_SECONDARY,
    opacity: 0.6,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

// Default color values if not defined in constants
const defaultColors = {
  BACKGROUND: '#FFFFFF',
  TEXT_PRIMARY: '#000000',
  TEXT_SECONDARY: '#666666',
  PRIMARY: '#007AFF',
  SUCCESS: '#34C759',
  SUCCESS_LIGHT: '#E8F5E8',
  CARD_BACKGROUND: '#F8F9FA',
  BORDER: '#E1E1E1',
};

// Merge with existing colors
Object.keys(defaultColors).forEach(key => {
  if (!COLORS[key]) {
    COLORS[key] = defaultColors[key];
  }
});

<system-reminder>
Background Bash 244a69 (command: npx expo start --no-dev --minify) (status: running) Has new output available. You can check its output using the BashOutput tool.
</system-reminder>