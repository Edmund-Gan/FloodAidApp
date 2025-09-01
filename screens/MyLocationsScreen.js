import React, { useContext, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocationContext } from '../context/LocationContext';
import { UserContext } from '../context/UserContext';
import { COLORS } from '../utils/constants';

export default function MyLocationsScreen({ navigation }) {
  const { 
    monitoredLocations, 
    addLocation, 
    removeLocation, 
    toggleLocationNotifications 
  } = useContext(LocationContext);
  const { logFeatureUsage } = useContext(UserContext);

  const [modalVisible, setModalVisible] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    subtitle: '',
  });

  React.useEffect(() => {
    logFeatureUsage('my_locations');
  }, []);

  const handleAddLocation = () => {
    if (newLocation.name.trim() && newLocation.subtitle.trim()) {
      addLocation({
        name: newLocation.name,
        subtitle: newLocation.subtitle,
        address: newLocation.name + ', Malaysia',
        coordinates: { 
          latitude: 3.1390 + (Math.random() - 0.5) * 0.1, 
          longitude: 101.6869 + (Math.random() - 0.5) * 0.1 
        },
        image: 'https://via.placeholder.com/80x60/666/FFFFFF?text=New'
      });
      setNewLocation({ name: '', subtitle: '' });
      setModalVisible(false);
    } else {
      Alert.alert('Error', 'Please fill in all fields');
    }
  };

  const handleDeleteLocation = (id) => {
    Alert.alert(
      'Delete Location',
      'Are you sure you want to remove this location?',
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

  const getRiskIcon = (riskLevel) => {
    if (riskLevel.includes('High')) return 'warning';
    if (riskLevel.includes('Moderate')) return 'alert-circle';
    if (riskLevel.includes('Low')) return 'checkmark-circle';
    return 'help-circle';
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
        {monitoredLocations.map((location) => (
          <View key={location.id} style={styles.locationCard}>
            <Image 
              source={{ uri: location.image }}
              style={styles.locationImage}
            />
            <View style={styles.locationInfo}>
              <Text style={styles.locationName}>{location.name}</Text>
              <Text style={styles.locationSubtitle}>{location.subtitle}</Text>
              <View style={styles.riskContainer}>
                <Ionicons 
                  name={getRiskIcon(location.riskLevel)} 
                  size={16} 
                  color={location.riskColor} 
                />
                <Text style={[styles.riskLevel, { color: location.riskColor }]}>
                  {location.riskLevel}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => handleDeleteLocation(location.id)}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
        ))}

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
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter address..."
                value={newLocation.name}
                onChangeText={(text) => setNewLocation({...newLocation, name: text})}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Label</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Home, Work, School..."
                value={newLocation.subtitle}
                onChangeText={(text) => setNewLocation({...newLocation, subtitle: text})}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addLocationButton}
                onPress={handleAddLocation}
              >
                <Text style={styles.addLocationButtonText}>Add Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
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
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 5,
  },
  locationSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  riskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskLevel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  menuButton: {
    padding: 10,
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