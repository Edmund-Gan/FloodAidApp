import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { LocationContext } from '../context/LocationContext';
import { UserContext } from '../context/UserContext';
import AddressSearchInput from '../components/AddressSearchInput';
import MapLocationPicker from '../components/MapLocationPicker';
import { COLORS } from '../utils/constants';

const getLocationImage = (locationType) => {
  switch (locationType?.toLowerCase()) {
    case 'home':
      return require('../assets/Location Image/Home.jpg');
    case 'office':
    case 'work':
      return require('../assets/Location Image/Office.jpg');
    case 'school':
      return require('../assets/Location Image/School.jpg');
    default:
      return require('../assets/Location Image/Home.jpg');
  }
};

export default function MyLocationsScreen({ navigation }) {
  const { 
    monitoredLocations, 
    addLocation, 
    removeLocation, 
    refreshLocationRisk,
    updateLocationCustomLabel
  } = useContext(LocationContext);
  const { logFeatureUsage } = useContext(UserContext);

  const [modalVisible, setModalVisible] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [newLocation, setNewLocation] = useState({
    name: '',
    subtitle: 'Home',
    customLabel: '',
    familyMember: '',
  });
  const [refreshingLocation, setRefreshingLocation] = useState(null);

  React.useEffect(() => {
    logFeatureUsage('my_locations');
  }, []);

  const handleAddressSelected = (addressData) => {
    if (addressData.needsMapSelection) {
      setMapPickerVisible(true);
    } else if (addressData.coordinates) {
      const locationData = {
        name: addressData.address,
        subtitle: newLocation.subtitle || 'My Location',
        customLabel: newLocation.customLabel || `${newLocation.familyMember || 'Me'} - ${newLocation.subtitle || 'Location'}`,
        familyMember: newLocation.familyMember || null,
        address: addressData.formattedAddress || addressData.address,
        coordinates: addressData.coordinates,
        image: getLocationImage(newLocation.subtitle || 'Home'),
        source: addressData.source
      };

      handleAddLocationFromData(locationData);
    }
  };

  const handleMapLocationSelected = (locationData) => {
    setMapPickerVisible(false);
    
    const enhancedLocation = {
      name: newLocation.name || locationData.address,
      subtitle: newLocation.subtitle || 'Map Location',
      customLabel: newLocation.customLabel || `${newLocation.familyMember || 'Me'} - ${newLocation.subtitle || 'Location'}`,
      familyMember: newLocation.familyMember || null,
      address: locationData.formattedAddress || locationData.address,
      coordinates: locationData.coordinates,
      image: getLocationImage(newLocation.subtitle || 'Home'),
      source: 'map_selection',
      coverageStatus: locationData.coverageStatus
    };

    handleAddLocationFromData(enhancedLocation);
  };

  const handleAddLocationFromData = async (locationData) => {
    try {
      await addLocation(locationData);
      setNewLocation({ name: '', subtitle: 'Home', customLabel: '', familyMember: '' });
      setModalVisible(false);
      
      Alert.alert(
        'Location Added',
        `${locationData.customLabel} has been added to your monitored locations.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error adding location:', error);
      Alert.alert(
        'Error',
        'Failed to add location. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleDeleteLocation = (id) => {
    const location = monitoredLocations.find(loc => loc.id === id);
    Alert.alert(
      'Delete Location',
      `Are you sure you want to remove "${location?.customLabel || location?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => removeLocation(id)
        }
      ]
    );
  };

  const handleEditLocation = (location) => {
    setSelectedLocation(location);
    setNewLocation({
      name: location.name,
      subtitle: location.subtitle,
      customLabel: location.customLabel || location.subtitle,
      familyMember: location.familyMember || ''
    });
    setEditModalVisible(true);
  };

  const handleUpdateLocation = async () => {
    if (selectedLocation && newLocation.customLabel.trim()) {
      try {
        updateLocationCustomLabel(
          selectedLocation.id, 
          newLocation.customLabel.trim(),
          newLocation.familyMember.trim() || null
        );
        setEditModalVisible(false);
        setSelectedLocation(null);
        setNewLocation({ name: '', subtitle: 'Home', customLabel: '', familyMember: '' });
        
        Alert.alert(
          'Location Updated',
          'Location details have been updated successfully.',
          [{ text: 'OK' }]
        );
      } catch (error) {
        Alert.alert('Error', 'Failed to update location. Please try again.');
      }
    } else {
      Alert.alert('Error', 'Please provide a custom label for this location.');
    }
  };

  const handleRefreshLocation = async (locationId) => {
    setRefreshingLocation(locationId);
    try {
      await refreshLocationRisk(locationId);
    } catch (error) {
      console.error('Failed to refresh location risk:', error);
    } finally {
      setRefreshingLocation(null);
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Locations</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={COLORS.PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {monitoredLocations.map((location) => {
          const isRefreshing = refreshingLocation === location.id;
          
          return (
            <View key={location.id} style={styles.locationCard}>
              <Image 
                source={typeof location.image === 'string' ? { uri: location.image } : location.image}
                style={styles.locationImage}
              />
              <View style={styles.locationInfo}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationName} numberOfLines={1}>
                    {location.customLabel || location.name}
                  </Text>
                </View>
                
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {location.address || location.name}
                </Text>
                
                <View style={styles.riskContainer}>
                  <Text style={styles.riskScoreLabel}>Flood Risk Score: </Text>
                  <Text style={[styles.riskScore, { color: location.riskColor }]}>
                    {location.riskProbability ? `${Math.round(location.riskProbability * 100)}%` : 'N/A'}
                  </Text>
                </View>
                
                
                <Text style={styles.lastUpdated}>
                  Updated: {location.lastUpdated ? 
                    new Date(location.lastUpdated).toLocaleTimeString('en-MY', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 'Never'}
                </Text>
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleEditLocation(location)}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.PRIMARY} />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleRefreshLocation(location.id)}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                  ) : (
                    <Ionicons name="refresh-outline" size={18} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeleteLocation(location.id)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.ERROR} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {monitoredLocations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No locations added yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to add your first location
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Location Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Location</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Address Search</Text>
              <AddressSearchInput
                onAddressSelected={handleAddressSelected}
                placeholder="Search for an address in Malaysia..."
                showMapFallback={true}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Location Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={newLocation.subtitle}
                  style={styles.picker}
                  onValueChange={(itemValue) => setNewLocation({...newLocation, subtitle: itemValue})}
                >
                  <Picker.Item label="Home" value="Home" />
                  <Picker.Item label="Office" value="Office" />
                  <Picker.Item label="School" value="School" />
                </Picker>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Custom Label (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Alice - Home, Parents - House..."
                value={newLocation.customLabel}
                onChangeText={(text) => setNewLocation({...newLocation, customLabel: text})}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Family Member (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Alice, John, Parents..."
                value={newLocation.familyMember}
                onChangeText={(text) => setNewLocation({...newLocation, familyMember: text})}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Location Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Location</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Custom Label</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Alice - Home, Parents - House..."
                value={newLocation.customLabel}
                onChangeText={(text) => setNewLocation({...newLocation, customLabel: text})}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Family Member (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Alice, John, Parents..."
                value={newLocation.familyMember}
                onChangeText={(text) => setNewLocation({...newLocation, familyMember: text})}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addLocationButton}
                onPress={handleUpdateLocation}
              >
                <Text style={styles.addLocationButtonText}>Update Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Map Location Picker */}
      <MapLocationPicker
        visible={mapPickerVisible}
        onLocationSelected={handleMapLocationSelected}
        onCancel={() => setMapPickerVisible(false)}
        initialAddress={newLocation.name}
      />
    </View>
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
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: COLORS.SURFACE,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  locationCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.BACKGROUND,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 15,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  locationAddress: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
    lineHeight: 18,
  },
  riskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  riskScoreLabel: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  riskScore: {
    fontSize: 13,
    fontWeight: '600',
  },
  lastUpdated: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    marginVertical: 2,
  },
  deleteButton: {
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 15,
    padding: 20,
    margin: 20,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: COLORS.SURFACE,
  },
  picker: {
    height: 50,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
  addLocationButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
    marginLeft: 10,
    alignItems: 'center',
  },
  addLocationButtonText: {
    fontSize: 16,
    color: COLORS.TEXT_ON_PRIMARY,
    fontWeight: '500',
  },
});