import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ProfileImpactPreview = ({
  componentType = 'emergency_kit', // 'emergency_kit', 'recovery_plan', 'preparation'
  currentProfile,
  newProfile
}) => {
  const calculateImpact = () => {
    const current = currentProfile || { familySize: 1, hasChildren: false, childrenAges: [], mobilityAssistance: false };
    const updated = newProfile;

    const impacts = [];

    if (componentType === 'emergency_kit') {
      // Calculate emergency kit changes
      const baseItems = 45; // approximate base item count
      const childItemsPerChild = 8;
      const mobilityItems = 3;

      const currentTotal = baseItems;
      const newChildItems = updated.hasChildren ? updated.childrenAges.length * childItemsPerChild : 0;
      const newMobilityItems = updated.mobilityAssistance ? mobilityItems : 0;
      const newTotal = baseItems + newChildItems + newMobilityItems;

      if (newTotal > currentTotal) {
        impacts.push({
          icon: 'briefcase-outline',
          text: `Emergency kit: ${newTotal - currentTotal} items added`,
          positive: true
        });
      }

      // Water quantity impact
      const currentWater = current.familySize * 12; // 12L per person for 3 days
      const newWater = updated.familySize * 12;
      if (newWater > currentWater) {
        impacts.push({
          icon: 'water-outline',
          text: `Water needed: ${currentWater}L → ${newWater}L`,
          positive: false
        });
      }
    } else if (componentType === 'recovery_plan') {
      // Calculate recovery timeline changes
      const baseDays = 7;

      // Current timeline
      const currentMultiplier = 1.0 +
        (current.familySize > 1 ? (current.familySize - 1) * 0.1 : 0) +
        (current.childrenAges.length * 0.2) +
        (current.mobilityAssistance ? 0.5 : 0);
      const currentDays = Math.ceil(baseDays * currentMultiplier);

      // New timeline
      const newMultiplier = 1.0 +
        (updated.familySize > 1 ? (updated.familySize - 1) * 0.1 : 0) +
        (updated.childrenAges.length * 0.2) +
        (updated.mobilityAssistance ? 0.5 : 0);
      const newDays = Math.ceil(baseDays * newMultiplier);

      if (newDays !== currentDays) {
        impacts.push({
          icon: 'calendar-outline',
          text: `Recovery timeline: ${currentDays} days → ${newDays} days`,
          positive: false
        });
      }

      // Professional help indicators
      if (updated.mobilityAssistance && !current.mobilityAssistance) {
        impacts.push({
          icon: 'accessibility-outline',
          text: 'Additional accessibility considerations added',
          positive: true
        });
      }
    } else if (componentType === 'preparation') {
      // Calculate preparation sections changes
      const baseSections = 8;
      const childSections = updated.hasChildren ? 4 : 0;
      const currentSections = 8 + (current.hasChildren ? 4 : 0);
      const newSections = baseSections + childSections;

      if (newSections > currentSections) {
        impacts.push({
          icon: 'list-outline',
          text: `Preparation sections: ${currentSections} → ${newSections}`,
          positive: true
        });
      }

      // Time estimate
      const baseTime = 75; // minutes
      const childTime = updated.hasChildren ? 45 : 0;
      const mobilityMultiplier = updated.mobilityAssistance ? 1.3 : 1.0;

      const currentTime = Math.round((baseTime + (current.hasChildren ? 45 : 0)) * (current.mobilityAssistance ? 1.3 : 1.0));
      const newTime = Math.round((baseTime + childTime) * mobilityMultiplier);

      if (newTime > currentTime) {
        impacts.push({
          icon: 'time-outline',
          text: `Est. time: ${currentTime} min → ${newTime} min`,
          positive: false
        });
      }
    }

    // Add child-specific items notice
    if (updated.hasChildren && !current.hasChildren) {
      impacts.push({
        icon: 'happy-outline',
        text: 'Child-specific items and guidance added',
        positive: true
      });
    }

    return impacts;
  };

  const impacts = calculateImpact();

  if (impacts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Impact Preview</Text>
      {impacts.map((impact, index) => (
        <View key={index} style={styles.impactRow}>
          <View style={[
            styles.iconContainer,
            impact.positive ? styles.iconContainerPositive : styles.iconContainerNeutral
          ]}>
            <Ionicons
              name={impact.icon}
              size={16}
              color={impact.positive ? '#388E3C' : '#1976D2'}
            />
          </View>
          <Text style={styles.impactText}>{impact.text}</Text>
        </View>
      ))}
      <View style={styles.note}>
        <Ionicons name="bulb-outline" size={14} color="#666" />
        <Text style={styles.noteText}>
          Recommendations will update instantly after saving
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  iconContainerPositive: {
    backgroundColor: '#E8F5E9',
  },
  iconContainerNeutral: {
    backgroundColor: '#E3F2FD',
  },
  impactText: {
    fontSize: 12,
    color: '#424242',
    flex: 1,
    lineHeight: 18,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  noteText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
    flex: 1,
  },
});

export default ProfileImpactPreview;
