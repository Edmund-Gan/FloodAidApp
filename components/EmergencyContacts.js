import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserContext } from '../context/UserContext';

const { width } = Dimensions.get('window');

const EmergencyContacts = ({ emergencyContactsData }) => {
  const { userProfile } = useContext(UserContext);
  const [expanded, setExpanded] = useState(false);
  const [selectedState, setSelectedState] = useState('SELANGOR');
  const [showStatePicker, setShowStatePicker] = useState(false);

  useEffect(() => {
    loadSelectedState();
  }, []);

  const loadSelectedState = async () => {
    try {
      const stored = await AsyncStorage.getItem('selectedEmergencyState');
      if (stored) {
        setSelectedState(stored);
      } else {
        // Try to auto-detect from user location
        const userLocation = userProfile?.location || '';
        const detectedState = detectStateFromLocation(userLocation);
        if (detectedState) {
          setSelectedState(detectedState);
          saveSelectedState(detectedState);
        }
      }
    } catch (error) {
      console.log('Error loading selected state:', error);
    }
  };

  const saveSelectedState = async (state) => {
    try {
      await AsyncStorage.setItem('selectedEmergencyState', state);
      setSelectedState(state);
    } catch (error) {
      console.log('Error saving selected state:', error);
    }
  };

  const detectStateFromLocation = (location) => {
    const locationMap = {
      'selangor': 'SELANGOR',
      'kuala lumpur': 'KUALA LUMPUR',
      'johor': 'JOHOR',
      'penang': 'PENANG',
      'perak': 'PERAK',
      'kedah': 'KEDAH',
      'kelantan': 'KELANTAN',
      'terengganu': 'TERENGGANU',
      'pahang': 'PAHANG',
      'negeri sembilan': 'NEGERI SEMBILAN',
      'malacca': 'MALACCA',
      'perlis': 'PERLIS',
      'sabah': 'SABAH',
      'sarawak': 'SARAWAK',
      'putrajaya': 'PUTRAJAYA',
      'labuan': 'LABUAN'
    };

    const lowerLocation = location.toLowerCase();
    for (const [key, value] of Object.entries(locationMap)) {
      if (lowerLocation.includes(key)) {
        return value;
      }
    }
    return null;
  };

  const makeCall = (phoneNumber) => {
    Alert.alert(
      'Emergency Call',
      `Call ${phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
            Linking.openURL(`tel:${cleanNumber}`);
          }
        }
      ]
    );
  };

  const getContactType = (contact) => {
    const contactLower = contact.toLowerCase();
    if (contactLower.includes('999') || contactLower.includes('emergency')) {
      return { icon: 'alert-circle', color: '#F44336', priority: 1 };
    } else if (contactLower.includes('fire') || contactLower.includes('994')) {
      return { icon: 'flame', color: '#FF5722', priority: 2 };
    } else if (contactLower.includes('police')) {
      return { icon: 'shield', color: '#3F51B5', priority: 3 };
    } else if (contactLower.includes('hospital') || contactLower.includes('medical')) {
      return { icon: 'medical', color: '#4CAF50', priority: 4 };
    } else if (contactLower.includes('civil defence') || contactLower.includes('apm')) {
      return { icon: 'people', color: '#FF9800', priority: 5 };
    } else if (contactLower.includes('disaster') || contactLower.includes('nadma')) {
      return { icon: 'warning', color: '#9C27B0', priority: 6 };
    } else {
      return { icon: 'call', color: '#607D8B', priority: 7 };
    }
  };

  const parseContact = (contactString) => {
    const parts = contactString.split(':');
    if (parts.length >= 2) {
      return {
        name: parts[0].trim(),
        phone: parts[1].trim()
      };
    }
    return {
      name: contactString,
      phone: null
    };
  };

  const renderContactItem = (contactString, index) => {
    const contact = parseContact(contactString);
    const typeInfo = getContactType(contactString);

    return (
      <TouchableOpacity
        key={index}
        style={styles.contactItem}
        onPress={() => contact.phone && makeCall(contact.phone)}
        activeOpacity={0.7}
        disabled={!contact.phone}
      >
        <View style={[styles.contactIcon, { backgroundColor: typeInfo.color + '20' }]}>
          <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contact.name}</Text>
          {contact.phone && (
            <Text style={styles.contactPhone}>{contact.phone}</Text>
          )}
        </View>
        {contact.phone && (
          <View style={styles.callButton}>
            <Ionicons name="call" size={18} color={typeInfo.color} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderStatePicker = () => {
    const states = Object.keys(emergencyContactsData || {});

    return (
      <Modal
        visible={showStatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State/Territory</Text>
              <TouchableOpacity
                onPress={() => setShowStatePicker(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.stateList}>
              {states.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={[
                    styles.stateItem,
                    selectedState === state && styles.stateItemSelected
                  ]}
                  onPress={() => {
                    saveSelectedState(state);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={[
                    styles.stateText,
                    selectedState === state && styles.stateTextSelected
                  ]}>
                    {state.replace(/_/g, ' ')}
                  </Text>
                  {selectedState === state && (
                    <Ionicons name="checkmark" size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (!emergencyContactsData) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading emergency contacts...</Text>
        </View>
      </View>
    );
  }

  const currentStateData = emergencyContactsData[selectedState];
  const contacts = currentStateData?.contacts || [];

  // Sort contacts by priority (emergency services first)
  const sortedContacts = [...contacts].sort((a, b) => {
    const aPriority = getContactType(a).priority;
    const bPriority = getContactType(b).priority;
    return aPriority - bPriority;
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#4CAF50', '#388E3C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark" size={28} color="#fff" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Emergency Contacts</Text>
                <Text style={styles.headerSubtitle}>
                  Nearby emergency services
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.stateSelector}
                onPress={() => setShowStatePicker(true)}
              >
                <Text style={styles.stateSelectorText}>
                  {selectedState.replace(/_/g, ' ')}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </TouchableOpacity>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#fff"
                style={styles.expandIcon}
              />
            </View>
          </View>

          {!expanded && (
            <View style={styles.quickContact}>
              <Ionicons name="call" size={14} color="#fff" />
              <Text style={styles.quickContactText}>
                Tap to expand - {contacts.length} emergency contacts
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <View style={styles.headerInfo}>
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={16} color="#4CAF50" />
                <Text style={styles.locationText}>
                  Emergency services for {selectedState.replace(/_/g, ' ')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeLocationButton}
                onPress={() => setShowStatePicker(true)}
              >
                <Text style={styles.changeLocationText}>Change Location</Text>
                <Ionicons name="chevron-forward" size={14} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.contactsList}>
              {sortedContacts.map((contact, index) => renderContactItem(contact, index))}
            </View>

            {currentStateData?.sources && (
              <View style={styles.sourcesSection}>
                <Text style={styles.sourcesTitle}>Sources</Text>
                {currentStateData.sources.map((source, index) => (
                  <Text key={index} style={styles.sourceText}>
                    • {source}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.footer}>
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={16} color="#FF9800" />
                <Text style={styles.warningText}>
                  In life-threatening emergencies, always call 999 first
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {renderStatePicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  stateSelectorText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
    marginRight: 4,
  },
  expandIcon: {
    marginLeft: 4,
  },
  quickContact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickContactText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
  },
  content: {
    maxHeight: 400,
    flex: 1,
  },
  scrollContent: {
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
  },
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeLocationText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  contactsList: {
    paddingVertical: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'monospace',
  },
  callButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourcesSection: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sourceText: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
    lineHeight: 14,
  },
  footer: {
    padding: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  stateList: {
    maxHeight: 400,
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  stateItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  stateText: {
    fontSize: 16,
    color: '#333',
  },
  stateTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default EmergencyContacts;