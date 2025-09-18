import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../utils/constants';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [mobilityAssistance, setMobilityAssistance] = useState(false);
  const [specialMedicalNeeds, setSpecialMedicalNeeds] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState('1');
  const [children, setChildren] = useState('0');

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
              setNotifications
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
              'accessibility-outline',
              'Mobility Assistance',
              'Enable accessibility features and route planning',
              mobilityAssistance,
              setMobilityAssistance
            )}

            {renderNumberInputRow(
              'people-outline',
              'Household Members',
              'Total people in household',
              householdMembers,
              setHouseholdMembers
            )}

            {renderNumberInputRow(
              'happy-outline',
              'Children',
              'Number of children in household',
              children,
              setChildren
            )}

            {renderToggleRow(
              'medical-outline',
              'Special Medical Needs',
              'Anyone requires special medical attention',
              specialMedicalNeeds,
              setSpecialMedicalNeeds
            )}
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
});