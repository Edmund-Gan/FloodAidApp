import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';
import { UserContext } from '../context/UserContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, notificationSettings, updateUserProfile, updateNotificationSettings } = useContext(UserContext);

  // Local state for UI
  const [notifications, setNotifications] = useState(notificationSettings.floodAlerts);
  const [locationServices, setLocationServices] = useState(true);
  const [mobilityAssistance, setMobilityAssistance] = useState(userProfile.mobilityAssistance);
  const [householdMembers, setHouseholdMembers] = useState(userProfile.familySize.toString());
  const [children, setChildren] = useState(userProfile.childrenAges ? userProfile.childrenAges.length.toString() : '0');

  // Child age input modal state
  const [childAgeModalVisible, setChildAgeModalVisible] = useState(false);
  const [tempChildAges, setTempChildAges] = useState(userProfile.childrenAges || []);

  // Sync local state with context when context changes
  useEffect(() => {
    setNotifications(notificationSettings.floodAlerts);
    setMobilityAssistance(userProfile.mobilityAssistance);
    setHouseholdMembers(userProfile.familySize.toString());
    setChildren(userProfile.childrenAges ? userProfile.childrenAges.length.toString() : '0');
    setTempChildAges(userProfile.childrenAges || []);
  }, [userProfile, notificationSettings]);

  // Update context when local state changes
  const updateNotificationsSettings = (value) => {
    setNotifications(value);
    updateNotificationSettings({ floodAlerts: value });
  };

  const updateMobilityAssistanceSettings = (value) => {
    setMobilityAssistance(value);
    updateUserProfile({ mobilityAssistance: value });
  };

  const updateHouseholdMembersSettings = (value) => {
    setHouseholdMembers(value);
    const numericValue = parseInt(value) || 1;
    updateUserProfile({ familySize: numericValue });
  };

  const updateChildrenSettings = (value) => {
    setChildren(value);
    const numChildren = parseInt(value) || 0;

    if (numChildren === 0) {
      // No children, clear everything
      updateUserProfile({
        hasChildren: false,
        childrenAges: []
      });
      setTempChildAges([]);
    } else {
      // Adjust tempChildAges array to match number of children
      const currentAges = [...tempChildAges];

      if (currentAges.length < numChildren) {
        // Add default ages for new children
        while (currentAges.length < numChildren) {
          currentAges.push(5); // Default age of 5
        }
      } else if (currentAges.length > numChildren) {
        // Remove excess ages
        currentAges.splice(numChildren);
      }

      setTempChildAges(currentAges);
      updateUserProfile({
        hasChildren: true,
        childrenAges: currentAges
      });
    }
  };

  // Child age modal functions
  const openChildAgeModal = () => {
    setChildAgeModalVisible(true);
  };

  const closeChildAgeModal = () => {
    setChildAgeModalVisible(false);
  };

  const saveChildAges = () => {
    // Validate ages
    const validAges = tempChildAges.every(age => age >= 0 && age <= 18);

    if (!validAges) {
      Alert.alert('Invalid Ages', 'Please enter ages between 0 and 18 years.');
      return;
    }

    updateUserProfile({
      hasChildren: tempChildAges.length > 0,
      childrenAges: tempChildAges
    });

    setChildAgeModalVisible(false);
  };

  const updateChildAge = (index, age) => {
    const newAges = [...tempChildAges];
    newAges[index] = parseInt(age) || 0;
    setTempChildAges(newAges);
  };

  const scrollContentStyle = [
    styles.scrollContent,
    { paddingBottom: 40 + insets.bottom + 60 + 20 }
  ];

  const renderSettingRow = (icon, title, subtitle, rightComponent) => (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={styles.iconWrapper}>
          <Ionicons name={icon} size={20} color={COLORS.PRIMARY} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent}
    </View>
  );

  const renderToggleRow = (icon, title, subtitle, value, onValueChange) =>
    renderSettingRow(icon, title, subtitle,
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: COLORS.PRIMARY_LIGHT }}
        thumbColor={value ? COLORS.PRIMARY : '#F4F3F4'}
        ios_backgroundColor="#E0E0E0"
      />
    );

  const renderNumberInputRow = (icon, title, subtitle, value, onChangeText) =>
    renderSettingRow(icon, title, subtitle,
      <TextInput
        style={styles.numberInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        maxLength={2}
        textAlign="center"
      />
    );

  const renderNavigationRow = (icon, title, subtitle, onPress) =>
    renderSettingRow(icon, title, subtitle,
      <TouchableOpacity onPress={onPress} style={styles.navigationButton}>
        <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT_SECONDARY} />
      </TouchableOpacity>
    );

  const getChildAgesSummary = () => {
    if (!userProfile.childrenAges || userProfile.childrenAges.length === 0) {
      return 'No children';
    }

    const sortedAges = [...userProfile.childrenAges].sort((a, b) => a - b);
    return `Ages: ${sortedAges.join(', ')}`;
  };

  const renderChildrenRow = () => {
    const numChildren = parseInt(children) || 0;
    const hasChildren = numChildren > 0;

    return (
      <View>
        {renderNumberInputRow(
          'happy-outline',
          'Children',
          'Number of children in household',
          children,
          updateChildrenSettings
        )}
        {hasChildren && (
          <View style={styles.childAgesRow}>
            <View style={styles.childAgesContent}>
              <Text style={styles.childAgesLabel}>Child Ages</Text>
              <Text style={styles.childAgesSummary}>{getChildAgesSummary()}</Text>
            </View>
            <TouchableOpacity onPress={openChildAgeModal} style={styles.editAgesButton}>
              <Text style={styles.editAgesText}>Edit Ages</Text>
              <Ionicons name="create-outline" size={16} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={COLORS.GRADIENT_MORNING}
        style={styles.header}
      >
        <View style={[styles.headerContent, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Customize your FloodAid</Text>
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            {renderToggleRow(
              'notifications-outline',
              'Notifications',
              'Push alerts and updates',
              notifications,
              updateNotificationsSettings
            )}

            {renderToggleRow(
              'location-outline',
              'Location Services',
              'GPS and location access',
              locationServices,
              setLocationServices
            )}
          </View>
        </View>

        {/* Accessibility & Household Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accessibility & Household</Text>
          <View style={styles.card}>
            {renderToggleRow(
              'body-outline',
              'Mobility Assistance',
              'Enable accessibility features and route planning',
              mobilityAssistance,
              updateMobilityAssistanceSettings
            )}

            {renderNumberInputRow(
              'people-outline',
              'Household Members',
              'Total people in household',
              householdMembers,
              updateHouseholdMembersSettings
            )}

            {renderChildrenRow()}
          </View>
        </View>

        {/* Flood Protection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flood Protection</Text>
          <View style={styles.card}>
            {renderToggleRow(
              'warning-outline',
              'Emergency Alerts',
              'Critical flood warnings',
              true,
              () => {}
            )}
          </View>
        </View>

      </ScrollView>

      {/* Child Age Input Modal */}
      <Modal
        visible={childAgeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeChildAgeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Child Ages</Text>
              <TouchableOpacity onPress={closeChildAgeModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                Enter the age of each child (0-18 years)
              </Text>

              {tempChildAges.map((age, index) => (
                <View key={index} style={styles.childAgeInputRow}>
                  <Text style={styles.childLabel}>Child {index + 1}</Text>
                  <TextInput
                    style={styles.childAgeInput}
                    value={age.toString()}
                    onChangeText={(value) => updateChildAge(index, value)}
                    keyboardType="numeric"
                    maxLength={2}
                    textAlign="center"
                    placeholder="Age"
                  />
                  <Text style={styles.yearLabel}>years</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={closeChildAgeModal} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveChildAges} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save Ages</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT_ON_PRIMARY,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.SUCCESS,
    marginRight: 8,
  },
  onlineText: {
    color: COLORS.TEXT_ON_PRIMARY,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  numberInput: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 50,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  navigationButton: {
    padding: 4,
  },
  // Child ages row styles
  childAgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  childAgesContent: {
    flex: 1,
  },
  childAgesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 2,
  },
  childAgesSummary: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
  },
  editAgesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  editAgesText: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    fontWeight: '600',
    marginRight: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
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
    color: COLORS.TEXT_PRIMARY,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginVertical: 16,
    textAlign: 'center',
  },
  childAgeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  childLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  childAgeInput: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  yearLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    width: 40,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});