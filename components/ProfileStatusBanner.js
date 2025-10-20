import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ProfileStatusBanner = ({
  userProfile,
  isDefault = false,
  onPress
}) => {
  const getProfileSummary = () => {
    if (isDefault) {
      return 'Using generic recommendations';
    }

    const parts = [];

    // Family size
    parts.push(`${userProfile.familySize} ${userProfile.familySize === 1 ? 'person' : 'people'}`);

    // Children
    if (userProfile.hasChildren && userProfile.childrenAges?.length > 0) {
      const childCount = userProfile.childrenAges.length;
      const ages = [...userProfile.childrenAges].sort((a, b) => a - b).join(', ');
      parts.push(`${childCount} ${childCount === 1 ? 'child' : 'children'} (ages ${ages})`);
    }

    // Mobility assistance
    if (userProfile.mobilityAssistance) {
      parts.push('mobility assistance');
    }

    return parts.join(', ');
  };

  const bannerStyle = isDefault
    ? [styles.container, styles.containerWarning]
    : [styles.container, styles.containerSuccess];

  const iconName = isDefault ? 'warning' : 'checkmark-circle';
  const iconColor = isDefault ? '#F57C00' : '#388E3C';

  return (
    <TouchableOpacity
      style={bannerStyle}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Ionicons name={iconName} size={20} color={iconColor} style={styles.icon} />
        <View style={styles.textContainer}>
          {isDefault ? (
            <>
              <Text style={[styles.primaryText, styles.warningText]}>
                {getProfileSummary()}
              </Text>
              <Text style={[styles.secondaryText, styles.warningText]}>
                Tap to personalize for your household
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.primaryText, styles.successText]}>
                Personalized for: {getProfileSummary()}
              </Text>
              <Text style={[styles.secondaryText, styles.successText]}>
                Tap to review settings
              </Text>
            </>
          )}
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isDefault ? '#F57C00' : '#388E3C'}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  containerWarning: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFB74D',
  },
  containerSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#81C784',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  primaryText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  secondaryText: {
    fontSize: 11,
    fontWeight: '400',
  },
  warningText: {
    color: '#E65100',
  },
  successText: {
    color: '#2E7D32',
  },
});

export default ProfileStatusBanner;
