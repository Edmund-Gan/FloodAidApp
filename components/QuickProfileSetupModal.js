import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileImpactPreview from './ProfileImpactPreview';

const { width } = Dimensions.get('window');

const QuickProfileSetupModal = ({
  visible,
  onClose,
  onSave,
  onFullSettings,
  userProfile,
  componentType = 'emergency_kit'
}) => {
  // Local state for quick setup
  const [familySize, setFamilySize] = useState(userProfile?.familySize || 1);
  const [childrenCount, setChildrenCount] = useState(userProfile?.childrenAges?.length || 0);
  const [childrenAges, setChildrenAges] = useState(userProfile?.childrenAges || []);
  const [mobilityAssistance, setMobilityAssistance] = useState(userProfile?.mobilityAssistance || false);

  // Reset local state when modal opens with current profile values
  useEffect(() => {
    if (visible && userProfile) {
      setFamilySize(userProfile.familySize || 1);
      setChildrenCount(userProfile.childrenAges?.length || 0);
      setChildrenAges(userProfile.childrenAges || []);
      setMobilityAssistance(userProfile.mobilityAssistance || false);
    }
  }, [visible, userProfile]);

  // Update children ages array when count changes
  useEffect(() => {
    if (childrenCount === 0) {
      setChildrenAges([]);
    } else if (childrenCount > childrenAges.length) {
      // Add default ages
      const newAges = [...childrenAges];
      while (newAges.length < childrenCount) {
        newAges.push(5); // Default age
      }
      setChildrenAges(newAges);
    } else if (childrenCount < childrenAges.length) {
      // Remove excess ages
      setChildrenAges(childrenAges.slice(0, childrenCount));
    }
  }, [childrenCount]);

  const updateChildAge = (index, age) => {
    const newAges = [...childrenAges];
    const ageNum = parseInt(age) || 0;
    newAges[index] = Math.max(0, Math.min(18, ageNum)); // Clamp between 0-18
    setChildrenAges(newAges);
  };

  const handleSave = () => {
    const updatedProfile = {
      familySize,
      hasChildren: childrenCount > 0,
      childrenAges,
      mobilityAssistance
    };
    onSave(updatedProfile);
  };

  // Build new profile for impact preview
  const newProfile = {
    familySize,
    hasChildren: childrenCount > 0,
    childrenAges,
    mobilityAssistance
  };

  const hasChanges = () => {
    return familySize !== userProfile?.familySize ||
           childrenCount !== (userProfile?.childrenAges?.length || 0) ||
           mobilityAssistance !== userProfile?.mobilityAssistance ||
           JSON.stringify(childrenAges) !== JSON.stringify(userProfile?.childrenAges || []);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Quick Profile Setup</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Household Members Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Household Members</Text>
              <View style={styles.pickerRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.pickerButton,
                      familySize === num && styles.pickerButtonSelected
                    ]}
                    onPress={() => setFamilySize(num)}
                  >
                    <Text style={[
                      styles.pickerButtonText,
                      familySize === num && styles.pickerButtonTextSelected
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionHint}>
                Total people living in your household
              </Text>
            </View>

            {/* Children Count Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Children in Household</Text>
              <View style={styles.pickerRow}>
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.pickerButton,
                      childrenCount === num && styles.pickerButtonSelected
                    ]}
                    onPress={() => setChildrenCount(num)}
                  >
                    <Text style={[
                      styles.pickerButtonText,
                      childrenCount === num && styles.pickerButtonTextSelected
                    ]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionHint}>
                Number of children (ages 0-18)
              </Text>
            </View>

            {/* Children Ages Input */}
            {childrenCount > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Child Ages</Text>
                <View style={styles.agesContainer}>
                  {childrenAges.map((age, index) => (
                    <View key={index} style={styles.ageInputRow}>
                      <Text style={styles.ageLabel}>Child {index + 1}</Text>
                      <TextInput
                        style={styles.ageInput}
                        value={age.toString()}
                        onChangeText={(value) => updateChildAge(index, value)}
                        keyboardType="numeric"
                        maxLength={2}
                        placeholder="Age"
                        placeholderTextColor="#999"
                      />
                      <Text style={styles.ageUnit}>years</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Mobility Assistance Toggle */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setMobilityAssistance(!mobilityAssistance)}
                activeOpacity={0.7}
              >
                <View style={styles.toggleLeft}>
                  <View style={[
                    styles.toggleIconContainer,
                    mobilityAssistance && styles.toggleIconContainerActive
                  ]}>
                    <Ionicons
                      name="accessibility"
                      size={20}
                      color={mobilityAssistance ? '#2196F3' : '#999'}
                    />
                  </View>
                  <View style={styles.toggleTextContainer}>
                    <Text style={styles.toggleLabel}>Mobility Assistance</Text>
                    <Text style={styles.toggleHint}>
                      Enables accessibility features and route planning
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.toggleSwitch,
                  mobilityAssistance && styles.toggleSwitchActive
                ]}>
                  <View style={[
                    styles.toggleThumb,
                    mobilityAssistance && styles.toggleThumbActive
                  ]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Impact Preview */}
            {hasChanges() && (
              <ProfileImpactPreview
                componentType={componentType}
                currentProfile={userProfile}
                newProfile={newProfile}
              />
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !hasChanges() && styles.saveButtonDisabled
                ]}
                onPress={handleSave}
                disabled={!hasChanges()}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save & Personalize</Text>
              </TouchableOpacity>
            </View>

            {onFullSettings && (
              <TouchableOpacity
                style={styles.fullSettingsButton}
                onPress={onFullSettings}
              >
                <Text style={styles.fullSettingsText}>
                  Need more options? Full Settings
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#2196F3" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    maxHeight: 480,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerButton: {
    width: 45,
    height: 45,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
  },
  pickerButtonSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  pickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  pickerButtonTextSelected: {
    color: '#2196F3',
  },
  agesContainer: {
    gap: 10,
  },
  ageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
  },
  ageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  ageInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 60,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  ageUnit: {
    fontSize: 13,
    color: '#666',
    width: 40,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  toggleIconContainerActive: {
    backgroundColor: '#E3F2FD',
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  toggleHint: {
    fontSize: 12,
    color: '#666',
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E0E0E0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#2196F3',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 18 }],
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    gap: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  fullSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 6,
  },
  fullSettingsText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '500',
  },
});

export default QuickProfileSetupModal;
