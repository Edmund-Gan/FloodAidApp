import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

const { width } = Dimensions.get('window');

const LocationSelector = ({
  visible,
  onClose,
  locations,
  selectedMode,
  selectedLocationId,
  onSelectLocation,
  allowStateBrowsing = false,
  stateList = [],
  selectedState = null
}) => {
  const handleSelectCurrentLocation = () => {
    onSelectLocation('current', null);
    onClose();
  };

  const handleSelectSavedLocation = (location) => {
    onSelectLocation('saved', location.id);
    onClose();
  };

  const handleSelectState = (state) => {
    onSelectLocation('state', state);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.locationList} showsVerticalScrollIndicator={false}>
            {/* Current Location Option */}
            <TouchableOpacity
              style={[
                styles.locationItem,
                selectedMode === 'current' && styles.locationItemSelected
              ]}
              onPress={handleSelectCurrentLocation}
              activeOpacity={0.7}
            >
              <View style={styles.locationIcon}>
                <Ionicons
                  name="navigate-circle"
                  size={24}
                  color={selectedMode === 'current' ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
                />
              </View>
              <View style={styles.locationDetails}>
                <Text style={[
                  styles.locationName,
                  selectedMode === 'current' && styles.locationNameSelected
                ]}>
                  Current Location
                </Text>
                <Text style={styles.locationSubtitle}>
                  Use GPS to detect your location
                </Text>
              </View>
              {selectedMode === 'current' && (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.PRIMARY} />
              )}
            </TouchableOpacity>

            {/* Divider */}
            {locations.length > 0 && (
              <View style={styles.divider}>
                <Text style={styles.dividerText}>Saved Locations</Text>
              </View>
            )}

            {/* Saved Locations */}
            {locations.map((location) => {
              const isSelected = selectedMode === 'saved' && selectedLocationId === location.id;
              const locationIcon = getLocationIcon(location.subtitle);

              return (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationItem,
                    isSelected && styles.locationItemSelected
                  ]}
                  onPress={() => handleSelectSavedLocation(location)}
                  activeOpacity={0.7}
                >
                  <View style={styles.locationIcon}>
                    <Ionicons
                      name={locationIcon}
                      size={24}
                      color={isSelected ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
                    />
                  </View>
                  <View style={styles.locationDetails}>
                    <Text style={[
                      styles.locationName,
                      isSelected && styles.locationNameSelected
                    ]}>
                      {location.customLabel || location.name}
                    </Text>
                    <Text style={styles.locationSubtitle} numberOfLines={1}>
                      {location.address || location.name}
                    </Text>
                    {location.riskProbability !== null && location.riskProbability !== undefined && (
                      <View style={styles.riskBadge}>
                        <View style={[styles.riskDot, { backgroundColor: location.riskColor }]} />
                        <Text style={styles.riskText}>
                          {Math.round(location.riskProbability * 100)}% Risk
                        </Text>
                      </View>
                    )}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Empty State */}
            {locations.length === 0 && !allowStateBrowsing && (
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No saved locations</Text>
                <Text style={styles.emptySubtext}>
                  Add locations from the My Locations tab
                </Text>
              </View>
            )}

            {/* Browse All States Section */}
            {allowStateBrowsing && stateList.length > 0 && (
              <>
                <View style={styles.divider}>
                  <Text style={styles.dividerText}>Browse All States</Text>
                </View>
                {stateList.map((state) => {
                  const isSelected = selectedMode === 'state' && selectedState === state;
                  return (
                    <TouchableOpacity
                      key={state}
                      style={[
                        styles.locationItem,
                        isSelected && styles.locationItemSelected
                      ]}
                      onPress={() => handleSelectState(state)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.locationIcon}>
                        <Ionicons
                          name="map"
                          size={24}
                          color={isSelected ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
                        />
                      </View>
                      <View style={styles.locationDetails}>
                        <Text style={[
                          styles.locationName,
                          isSelected && styles.locationNameSelected
                        ]}>
                          {state.replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.locationSubtitle}>
                          Browse emergency services
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color={COLORS.PRIMARY} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const getLocationIcon = (subtitle) => {
  const type = subtitle?.toLowerCase() || '';
  if (type.includes('home')) return 'home';
  if (type.includes('office') || type.includes('work')) return 'briefcase';
  if (type.includes('school')) return 'school';
  return 'location';
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.SURFACE || '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY || '#000000',
  },
  locationList: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginVertical: 5,
    backgroundColor: '#F5F5F5',
  },
  locationItemSelected: {
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY || '#2196F3',
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationDetails: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY || '#000000',
    marginBottom: 4,
  },
  locationNameSelected: {
    color: COLORS.PRIMARY || '#2196F3',
  },
  locationSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY || '#666666',
    marginBottom: 4,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  riskText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY || '#666666',
    fontWeight: '500',
  },
  divider: {
    marginVertical: 10,
    paddingVertical: 8,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY || '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY || '#666666',
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT || '#999999',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default LocationSelector;
