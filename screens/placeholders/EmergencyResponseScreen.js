import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

export default function EmergencyResponseScreen({ navigation }) {
  const comingSoonFeatures = [
    'Step-by-step emergency protocols',
    'Utility safety management',
    'Emergency supply checklists',
    'First aid guidance',
    'Evacuation decision support',
    'Emergency contact integration'
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>Emergency Response</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="medical-outline" size={80} color="#ccc" />
        </View>

        <Text style={styles.mainTitle}>Emergency Response</Text>
        <Text style={styles.subtitle}>Epic 7: Emergency Response Guidance</Text>
        
        <Text style={styles.description}>
          Get immediate, scenario-specific guidance during flood emergencies. Access step-by-step 
          instructions for safety procedures, utility management, and emergency response protocols.
        </Text>

        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Planned Features:</Text>
          {comingSoonFeatures.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: COLORS.SURFACE,
    elevation: 2,
  },
  backButton: {
    padding: 5,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  iconContainer: {
    marginBottom: 30,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  comingSoonBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 40,
  },
  comingSoonText: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 10,
    flex: 1,
  },
});