import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import LocationService from '../services/LocationService';
import addressValidationService from '../services/AddressValidationService';
import { COLORS } from '../utils/constants';

const { width, height } = Dimensions.get('window');

export default function MapLocationPicker({ 
  visible, 
  onLocationSelected, 
  onCancel, 
  initialAddress = '',
  initialCoordinates = null 
}) {
  const [selectedCoordinates, setSelectedCoordinates] = useState(
    initialCoordinates || {
      latitude: 3.1390,
      longitude: 101.6869,
    }
  );
  const [locationDetails, setLocationDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingLocation, setIsValidatingLocation] = useState(false);
  const [coverageStatus, setCoverageStatus] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (visible) {
      if (initialCoordinates) {
        setSelectedCoordinates(initialCoordinates);
        validateSelectedLocation(initialCoordinates);
      } else {
        getCurrentLocationForMap();
      }
    }
  }, [visible, initialCoordinates]);

  const getCurrentLocationForMap = async () => {
    try {
      setIsLoading(true);
      const location = await LocationService.getCurrentLocationWithMalaysiaCheck(false);
      
      if (location) {
        const coords = {
          latitude: location.lat,
          longitude: location.lon
        };
        setSelectedCoordinates(coords);
        
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...coords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
        
        await validateSelectedLocation(coords);
      }
    } catch (error) {
      console.error('Error getting current location for map:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. You can still select a location on the map.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapPress = async (event) => {
    const coordinates = event.nativeEvent.coordinate;
    setSelectedCoordinates(coordinates);
    await validateSelectedLocation(coordinates);
  };

  const validateSelectedLocation = async (coordinates) => {
    setIsValidatingLocation(true);
    
    try {
      const coverage = addressValidationService.checkCoverageAvailability(coordinates);
      setCoverageStatus(coverage);
      
      if (coverage.available) {
        const displayName = await LocationService.getLocationDisplayName(
          coordinates.latitude, 
          coordinates.longitude
        );
        
        setLocationDetails({
          formattedAddress: displayName,
          coordinates: coordinates,
          withinCoverage: true
        });
      } else {
        setLocationDetails({
          formattedAddress: 'Location outside coverage area',
          coordinates: coordinates,
          withinCoverage: false,
          nearestLocation: coverage.nearestLocation
        });
      }
    } catch (error) {
      console.error('Error validating location:', error);
      setLocationDetails({
        formattedAddress: 'Unable to validate location',
        coordinates: coordinates,
        withinCoverage: false,
        error: error.message
      });
    } finally {
      setIsValidatingLocation(false);
    }
  };

  const handleConfirmLocation = () => {
    if (!selectedCoordinates) {
      Alert.alert('No Location Selected', 'Please select a location on the map.');
      return;
    }

    const locationData = {
      address: initialAddress || locationDetails?.formattedAddress || 'Selected Location',
      formattedAddress: locationDetails?.formattedAddress || 'Map Selected Location',
      coordinates: selectedCoordinates,
      source: 'map_selection',
      verified: true,
      withinCoverage: locationDetails?.withinCoverage,
      coverageStatus: coverageStatus,
      nearestLocation: locationDetails?.nearestLocation
    };

    if (onLocationSelected) {
      onLocationSelected(locationData);
    }
  };

  const handleUseNearestLocation = () => {
    if (coverageStatus?.nearestLocation) {
      const nearestCoords = {
        latitude: coverageStatus.nearestLocation.lat,
        longitude: coverageStatus.nearestLocation.lon
      };
      
      setSelectedCoordinates(nearestCoords);
      
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...nearestCoords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
      
      validateSelectedLocation(nearestCoords);
    }
  };

  const handleMyLocation = () => {
    getCurrentLocationForMap();
  };

  const renderLocationInfo = () => {
    if (isValidatingLocation) {
      return (
        <View style={styles.locationInfoContainer}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY} />
          <Text style={styles.validatingText}>Validating location...</Text>
        </View>
      );
    }

    if (!locationDetails) return null;

    return (
      <View style={[
        styles.locationInfoContainer,
        !locationDetails.withinCoverage && styles.outOfCoverageContainer
      ]}>
        <View style={styles.locationInfoHeader}>
          <Ionicons 
            name={locationDetails.withinCoverage ? "checkmark-circle" : "warning"} 
            size={20} 
            color={locationDetails.withinCoverage ? COLORS.SUCCESS : COLORS.WARNING} 
          />
          <Text style={[
            styles.locationInfoTitle,
            !locationDetails.withinCoverage && styles.warningText
          ]}>
            {locationDetails.withinCoverage ? 'Location Available' : 'Coverage Limited'}
          </Text>
        </View>
        
        <Text style={styles.locationAddress}>
          {locationDetails.formattedAddress}
        </Text>
        
        {!locationDetails.withinCoverage && coverageStatus?.nearestLocation && (
          <View style={styles.nearestLocationInfo}>
            <Text style={styles.nearestLocationText}>
              Nearest monitored area: {coverageStatus.nearestLocation.name}
            </Text>
            <TouchableOpacity style={styles.useNearestButton} onPress={handleUseNearestLocation}>
              <Text style={styles.useNearestButtonText}>Use Nearest Location</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <Text style={styles.coordinatesText}>
          {selectedCoordinates.latitude.toFixed(6)}, {selectedCoordinates.longitude.toFixed(6)}
        </Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Ionicons name="close" size={24} color={COLORS.TEXT_PRIMARY} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Select Location</Text>
          
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation}>
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          {isLoading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                ...selectedCoordinates,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}
            >
              {selectedCoordinates && (
                <Marker
                  coordinate={selectedCoordinates}
                  draggable={true}
                  onDragEnd={handleMapPress}
                >
                  <View style={styles.customMarker}>
                    <Ionicons name="location" size={30} color={COLORS.PRIMARY} />
                  </View>
                </Marker>
              )}
              
              {!locationDetails?.withinCoverage && coverageStatus?.nearestLocation && (
                <Marker
                  coordinate={{
                    latitude: coverageStatus.nearestLocation.lat,
                    longitude: coverageStatus.nearestLocation.lon
                  }}
                  title="Nearest Monitored Area"
                  description={coverageStatus.nearestLocation.name}
                >
                  <View style={styles.nearestMarker}>
                    <Ionicons name="business" size={24} color={COLORS.SUCCESS} />
                  </View>
                </Marker>
              )}
            </MapView>
          )}
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity style={styles.myLocationButton} onPress={handleMyLocation}>
            <Ionicons name="locate" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.myLocationButtonText}>My Location</Text>
          </TouchableOpacity>
        </View>

        {renderLocationInfo()}

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            Tap on the map to select a location, or drag the marker to adjust your selection.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  confirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_ON_PRIMARY,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 10,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearestMarker: {
    backgroundColor: COLORS.SUCCESS,
    borderRadius: 15,
    padding: 5,
    borderWidth: 2,
    borderColor: COLORS.SURFACE,
  },
  controlsContainer: {
    position: 'absolute',
    top: 120,
    right: 20,
    alignItems: 'flex-end',
  },
  myLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  myLocationButtonText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    marginLeft: 5,
    fontWeight: '500',
  },
  locationInfoContainer: {
    backgroundColor: COLORS.SURFACE,
    margin: 20,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  outOfCoverageContainer: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.WARNING,
  },
  locationInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 8,
  },
  warningText: {
    color: COLORS.WARNING,
  },
  locationAddress: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
    lineHeight: 20,
  },
  coordinatesText: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    fontFamily: 'monospace',
  },
  nearestLocationInfo: {
    marginVertical: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nearestLocationText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  useNearestButton: {
    backgroundColor: COLORS.SUCCESS,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  useNearestButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_ON_PRIMARY,
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  instructionsText: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
    lineHeight: 16,
  },
  validatingText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 8,
  },
});