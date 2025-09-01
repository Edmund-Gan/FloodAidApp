import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserContext } from '../context/UserContext';
import { COLORS } from '../utils/constants';

export default function MenuScreen({ navigation }) {
  const { logFeatureUsage } = useContext(UserContext);

  React.useEffect(() => {
    logFeatureUsage('menu');
  }, []);

  const menuItems = [
    {
      id: 'preparedness',
      title: 'Preparedness Guides',
      subtitle: 'Epic 5 - Pre-flood planning',
      icon: 'shield-checkmark-outline',
      screen: 'PreparednessScreen',
      status: 'coming_soon'
    },
    {
      id: 'navigation',
      title: 'Emergency Navigation',
      subtitle: 'Epic 6 - Safe routing',
      icon: 'navigate-outline', 
      screen: 'EmergencyNavigationScreen',
      status: 'coming_soon'
    },
    {
      id: 'response',
      title: 'Emergency Response',
      subtitle: 'Epic 7 - Response guidance',
      icon: 'medical-outline',
      screen: 'EmergencyResponseScreen',
      status: 'coming_soon'
    },
    {
      id: 'communication',
      title: 'Emergency Communication',
      subtitle: 'Epic 8 - Stay connected',
      icon: 'call-outline',
      screen: 'CommunicationScreen',
      status: 'coming_soon'
    },
    {
      id: 'recovery',
      title: 'Post-Flood Recovery',
      subtitle: 'Epic 9 - Recovery assistance',
      icon: 'home-outline',
      screen: 'PostFloodScreen',
      status: 'coming_soon'
    }
  ];

  const handleMenuPress = (item) => {
    if (item.status === 'coming_soon') {
      navigation.navigate(item.screen);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return COLORS.SUCCESS;
      case 'coming_soon': return COLORS.PRIMARY;
      case 'development': return COLORS.WARNING;
      default: return COLORS.TEXT_SECONDARY;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'Available';
      case 'coming_soon': return 'Coming Soon';
      case 'development': return 'In Development';
      default: return 'Unknown';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FloodAid</Text>
        <Text style={styles.subtitle}>More Features</Text>
      </View>

      <View style={styles.currentFeaturesSection}>
        <Text style={styles.sectionTitle}>✅ Available Now</Text>
        
        <View style={styles.featureCard}>
          <Ionicons name="cloud" size={24} color={COLORS.SUCCESS} />
          <View style={styles.featureInfo}>
            <Text style={styles.featureName}>AI-Based Prediction</Text>
            <Text style={styles.featureDescription}>Epic 1 - Real-time flood forecasting</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#E8F5E8' }]}>
            <Text style={[styles.statusText, { color: COLORS.SUCCESS }]}>Live</Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <Ionicons name="map" size={24} color={COLORS.SUCCESS} />
          <View style={styles.featureInfo}>
            <Text style={styles.featureName}>Flood Hotspot Maps</Text>
            <Text style={styles.featureDescription}>Epic 3 - Regional risk visualization</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#E8F5E8' }]}>
            <Text style={[styles.statusText, { color: COLORS.SUCCESS }]}>Live</Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <Ionicons name="location" size={24} color={COLORS.SUCCESS} />
          <View style={styles.featureInfo}>
            <Text style={styles.featureName}>My Locations</Text>
            <Text style={styles.featureDescription}>Epic 4 - Multi-location monitoring</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#E8F5E8' }]}>
            <Text style={[styles.statusText, { color: COLORS.SUCCESS }]}>Live</Text>
          </View>
        </View>
      </View>

      <View style={styles.upcomingSection}>
        <Text style={styles.sectionTitle}>🚧 Coming Soon</Text>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleMenuPress(item)}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={24} color={COLORS.TEXT_SECONDARY} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#E3F2FD' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.PRIMARY} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Development Progress</Text>
            <Text style={styles.infoText}>
              FloodAid is being developed in phases. Epics 1, 3, and 4 are now live. 
              The remaining features will be released in upcoming updates.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    backgroundColor: COLORS.SURFACE,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 5,
  },
  currentFeaturesSection: {
    padding: 20,
  },
  upcomingSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 15,
  },
  featureCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureInfo: {
    flex: 1,
    marginLeft: 15,
  },
  featureName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  featureDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  menuItem: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
    marginLeft: 15,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.TEXT_PRIMARY,
  },
  menuSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoSection: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    flexDirection: 'row',
  },
  infoContent: {
    flex: 1,
    marginLeft: 15,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 100,
  },
});