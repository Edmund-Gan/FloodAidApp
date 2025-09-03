import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DeveloperMode from './DeveloperMode';
import { COLORS } from '../utils/constants';

/**
 * DEVELOPER MODE INTEGRATION
 * 
 * This component provides a clean integration point for the developer mode.
 * To remove after testing:
 * 1. Remove this component from wherever it's imported
 * 2. Delete this file
 * 3. Delete DeveloperMode.js
 * 4. That's it - no other code needs to be touched!
 */
const DeveloperModeButton = ({ onAlertGenerated }) => {
  const [showDeveloperMode, setShowDeveloperMode] = useState(false);

  // Only show in development builds
  if (!__DEV__) {
    return null;
  }

  const handleOpenDeveloperMode = () => {
    Alert.alert(
      '🛠️ Developer Mode',
      'This is a testing tool for flood probability alerts. Use carefully as it generates real alerts in the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Developer Mode', onPress: () => setShowDeveloperMode(true) }
      ]
    );
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.developerButton}
        onPress={handleOpenDeveloperMode}
      >
        <Ionicons name="construct" size={16} color="white" />
        <Text style={styles.developerButtonText}>Developer Mode</Text>
      </TouchableOpacity>

      <DeveloperMode
        visible={showDeveloperMode}
        onClose={() => setShowDeveloperMode(false)}
        onAlertGenerated={onAlertGenerated}
      />
    </>
  );
};

const styles = StyleSheet.create({
  developerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  developerButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default DeveloperModeButton;