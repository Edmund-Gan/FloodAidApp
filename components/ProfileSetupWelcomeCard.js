import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ProfileSetupWelcomeCard = ({
  componentName = 'Emergency Kit',
  impactExamples = [],
  onSetupNow,
  onDismiss
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="information-circle" size={32} color="#2196F3" />
        <Text style={styles.title}>Personalize Your Recommendations</Text>
      </View>

      <Text style={styles.description}>
        These recommendations adjust based on:
      </Text>

      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <Ionicons name="people-outline" size={16} color="#2196F3" />
          <Text style={styles.featureText}>Number of people in your household</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="happy-outline" size={16} color="#2196F3" />
          <Text style={styles.featureText}>Children's ages (adds specific items)</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="accessibility-outline" size={16} color="#2196F3" />
          <Text style={styles.featureText}>Mobility needs (extended timelines)</Text>
        </View>
      </View>

      {impactExamples.length > 0 && (
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Example Impact:</Text>
          {impactExamples.map((example, index) => (
            <Text key={index} style={styles.exampleText}>
              {example}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onSetupNow}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Set Up Profile Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onDismiss}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Continue Without</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 8,
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 8,
  },
  featuresList: {
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#616161',
    marginLeft: 8,
    flex: 1,
  },
  examplesContainer: {
    backgroundColor: '#BBDEFB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  examplesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 6,
  },
  exampleText: {
    fontSize: 12,
    color: '#424242',
    marginBottom: 2,
    paddingLeft: 4,
  },
  actions: {
    gap: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1976D2',
  },
});

export default ProfileSetupWelcomeCard;
