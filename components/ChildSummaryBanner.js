import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ChildSummaryBanner = ({ userProfile, showTimeAdjustment = false, estimatedTime = null }) => {
  const { hasChildren, hasInfants, hasToddlers, hasSchoolChildren, hasTeens, childrenAges = [] } = userProfile;

  if (!hasChildren || childrenAges.length === 0) {
    return null;
  }

  const getAgeGroupSummary = () => {
    const groups = [];

    if (hasInfants) {
      const infantCount = childrenAges.filter(age => age < 2).length;
      groups.push(`${infantCount} infant${infantCount > 1 ? 's' : ''}`);
    }

    if (hasToddlers) {
      const toddlerCount = childrenAges.filter(age => age >= 2 && age <= 5).length;
      groups.push(`${toddlerCount} toddler${toddlerCount > 1 ? 's' : ''}`);
    }

    if (hasSchoolChildren) {
      const schoolCount = childrenAges.filter(age => age >= 6 && age <= 12).length;
      groups.push(`${schoolCount} school-age`);
    }

    if (hasTeens) {
      const teenCount = childrenAges.filter(age => age >= 13 && age <= 17).length;
      groups.push(`${teenCount} teen${teenCount > 1 ? 's' : ''}`);
    }

    if (groups.length === 0) {
      return `${childrenAges.length} child${childrenAges.length > 1 ? 'ren' : ''}`;
    }

    if (groups.length === 1) {
      return groups[0];
    }

    if (groups.length === 2) {
      return groups.join(' and ');
    }

    return groups.slice(0, -1).join(', ') + ', and ' + groups[groups.length - 1];
  };

  const getChildSpecificFeatures = () => {
    const features = [];

    if (hasInfants) {
      features.push('infant care items');
    }

    if (hasToddlers) {
      features.push('comfort items');
    }

    if (hasSchoolChildren) {
      features.push('school coordination');
    }

    if (hasTeens) {
      features.push('teen responsibilities');
    }

    return features;
  };

  const renderAgeDistribution = () => {
    const ageGroups = [
      { name: 'Infants', count: childrenAges.filter(age => age < 2).length, color: '#FFB347', icon: 'baby-outline' },
      { name: 'Toddlers', count: childrenAges.filter(age => age >= 2 && age <= 5).length, color: '#4ECDC4', icon: 'happy-outline' },
      { name: 'School', count: childrenAges.filter(age => age >= 6 && age <= 12).length, color: '#A78BFA', icon: 'school-outline' },
      { name: 'Teens', count: childrenAges.filter(age => age >= 13 && age <= 17).length, color: '#FF6B6B', icon: 'people-outline' }
    ].filter(group => group.count > 0);

    if (ageGroups.length <= 1) {
      return null;
    }

    return (
      <View style={styles.ageDistribution}>
        {ageGroups.map((group, index) => (
          <View key={group.name} style={styles.ageGroup}>
            <View style={[styles.ageIcon, { backgroundColor: group.color + '20' }]}>
              <Ionicons name={group.icon} size={12} color={group.color} />
            </View>
            <Text style={styles.ageCount}>{group.count}</Text>
            <Text style={styles.ageLabel}>{group.name}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={16} color="#FF6B6B" />
        <Text style={styles.title}>Child-Specific Planning</Text>
      </View>

      <Text style={styles.summary}>
        Planning includes {getAgeGroupSummary()} with {getChildSpecificFeatures().join(', ')}
      </Text>

      {renderAgeDistribution()}

      {showTimeAdjustment && estimatedTime && (
        <View style={styles.timeAdjustment}>
          <Ionicons name="time-outline" size={14} color="#FF9800" />
          <Text style={styles.timeText}>
            Time estimates adjusted for children (+{Math.round(((estimatedTime / childrenAges.length) - 1) * 100)}% avg)
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF8F8',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C53030',
    marginLeft: 6,
  },
  summary: {
    fontSize: 12,
    color: '#744C4C',
    lineHeight: 16,
    marginBottom: 8,
  },
  ageDistribution: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFE5E5',
  },
  ageGroup: {
    alignItems: 'center',
    flex: 1,
  },
  ageIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  ageCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  ageLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  timeAdjustment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFE5E5',
  },
  timeText: {
    fontSize: 11,
    color: '#E65100',
    marginLeft: 4,
    fontStyle: 'italic',
  },
});

export default ChildSummaryBanner;