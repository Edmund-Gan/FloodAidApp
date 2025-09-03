import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocationContext } from '../context/LocationContext';
import { COLORS } from '../utils/constants';

export default function AlertDashboard({ visible, onClose }) {
  const {
    getAllActiveAlerts,
    monitoredLocations,
    getLocationById,
    dismissLocationAlert,
    getLocationsByFamily,
    refreshLocationRisk
  } = useContext(LocationContext);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, high, moderate, family
  const [groupByFamily, setGroupByFamily] = useState(false);

  const activeAlerts = getAllActiveAlerts();
  const familyGroups = getLocationsByFamily();

  useEffect(() => {
    if (visible) {
      onRefresh();
    }
  }, [visible]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      for (const location of monitoredLocations) {
        if (location.alertsEnabled) {
          await refreshLocationRisk(location.id);
        }
      }
    } catch (error) {
      console.error('Error refreshing alerts:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getFilteredAlerts = () => {
    let filteredAlerts = activeAlerts;

    switch (selectedFilter) {
      case 'high':
        filteredAlerts = activeAlerts.filter(alert => 
          alert.severity === 'immediate' || alert.severity === 'urgent'
        );
        break;
      case 'moderate':
        filteredAlerts = activeAlerts.filter(alert => 
          alert.severity === 'warning' || alert.severity === 'advisory'
        );
        break;
      default:
        break;
    }

    if (groupByFamily) {
      return groupAlertsByFamily(filteredAlerts);
    }

    return filteredAlerts.sort((a, b) => {
      const severityOrder = { immediate: 4, urgent: 3, warning: 2, advisory: 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });
  };

  const groupAlertsByFamily = (alerts) => {
    const grouped = {};
    
    alerts.forEach(alert => {
      const location = getLocationFromAlert(alert);
      const family = location?.familyMember || 'Other';
      
      if (!grouped[family]) {
        grouped[family] = [];
      }
      grouped[family].push(alert);
    });

    return grouped;
  };

  const getLocationFromAlert = (alert) => {
    return monitoredLocations.find(location => 
      location.coordinates &&
      Math.abs(location.coordinates.latitude - alert.location.coordinates.lat) < 0.0001 &&
      Math.abs(location.coordinates.longitude - alert.location.coordinates.lng) < 0.0001
    );
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'immediate': return COLORS.ERROR;
      case 'urgent': return '#FF6B00';
      case 'warning': return COLORS.WARNING;
      case 'advisory': return '#4A90E2';
      default: return COLORS.TEXT_SECONDARY;
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'immediate': return 'warning';
      case 'urgent': return 'alert';
      case 'warning': return 'alert-circle';
      case 'advisory': return 'information-circle';
      default: return 'help-circle';
    }
  };

  const formatTimeUntil = (timeString) => {
    try {
      const alertTime = new Date(timeString);
      const now = new Date();
      const diffMs = alertTime.getTime() - now.getTime();
      
      if (diffMs <= 0) return 'Now';
      
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffHours > 24) {
        const days = Math.floor(diffHours / 24);
        const hours = diffHours % 24;
        return `${days}d ${hours}h`;
      } else if (diffHours > 0) {
        return `${diffHours}h ${diffMins}m`;
      } else {
        return `${diffMins}m`;
      }
    } catch (error) {
      return 'Unknown';
    }
  };

  const handleDismissAlert = (alert) => {
    const location = getLocationFromAlert(alert);
    if (location) {
      dismissLocationAlert(location.id);
    }
  };

  const renderAlertCard = (alert, index) => {
    const location = getLocationFromAlert(alert);
    const severityColor = getSeverityColor(alert.severity);
    const severityIcon = getSeverityIcon(alert.severity);

    return (
      <View key={`${alert.id}-${index}`} style={[
        styles.alertCard,
        { borderLeftColor: severityColor }
      ]}>
        <View style={styles.alertHeader}>
          <View style={styles.alertTitleRow}>
            <Ionicons name={severityIcon} size={20} color={severityColor} />
            <Text style={[styles.alertTitle, { color: severityColor }]}>
              {alert.severity.toUpperCase()} ALERT
            </Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => handleDismissAlert(alert)}
          >
            <Ionicons name="close" size={16} color={COLORS.TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        <Text style={styles.alertLocation}>
          {location?.customLabel || alert.location.name}
        </Text>

        <Text style={styles.alertDescription}>
          {alert.floodTimeframe?.description || 'Flood risk detected'}
        </Text>

        <View style={styles.alertDetails}>
          <View style={styles.alertDetailItem}>
            <Ionicons name="time-outline" size={16} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.alertDetailText}>
              {alert.countdownDisplay || formatTimeUntil(alert.timestamp)}
            </Text>
          </View>

          <View style={styles.alertDetailItem}>
            <Ionicons name="rainy-outline" size={16} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.alertDetailText}>
              {alert.expectedRainfall ? `${Math.round(alert.expectedRainfall)}mm` : 'Unknown'}
            </Text>
          </View>

          {alert.riskLevel && (
            <View style={styles.alertDetailItem}>
              <Ionicons name="shield-outline" size={16} color={COLORS.TEXT_SECONDARY} />
              <Text style={styles.alertDetailText}>
                {alert.riskLevel} Risk
              </Text>
            </View>
          )}
        </View>

        {alert.preparationGuidance && (
          <View style={styles.guidanceContainer}>
            <Text style={styles.guidanceTitle}>Recommended Actions:</Text>
            {alert.preparationGuidance.actions.slice(0, 2).map((action, idx) => (
              <Text key={idx} style={styles.guidanceAction}>• {action}</Text>
            ))}
            {alert.preparationGuidance.timeEstimate && (
              <Text style={styles.guidanceTime}>
                Estimated prep time: {alert.preparationGuidance.timeEstimate}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.alertTimestamp}>
          Alert issued: {new Date(alert.timestamp).toLocaleString('en-MY')}
        </Text>
      </View>
    );
  };

  const renderFamilyGroupedAlerts = (groupedAlerts) => {
    return Object.entries(groupedAlerts).map(([family, alerts]) => (
      <View key={family} style={styles.familyGroup}>
        <View style={styles.familyHeader}>
          <Ionicons name="people-outline" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.familyTitle}>{family}</Text>
          <View style={styles.familyCount}>
            <Text style={styles.familyCountText}>{alerts.length}</Text>
          </View>
        </View>
        {alerts.map((alert, index) => renderAlertCard(alert, index))}
      </View>
    ));
  };

  const filteredAlerts = getFilteredAlerts();
  const hasAlerts = Array.isArray(filteredAlerts) ? filteredAlerts.length > 0 : Object.keys(filteredAlerts).length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alert Dashboard</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color={COLORS.PRIMARY} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {['all', 'high', 'moderate'].map(filter => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterButton,
                  selectedFilter === filter && styles.activeFilter
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[
                  styles.filterText,
                  selectedFilter === filter && styles.activeFilterText
                ]}>
                  {filter === 'all' ? 'All Alerts' : 
                   filter === 'high' ? 'High Priority' : 'Moderate Priority'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <TouchableOpacity
            style={styles.groupToggle}
            onPress={() => setGroupByFamily(!groupByFamily)}
          >
            <Ionicons 
              name={groupByFamily ? "people" : "people-outline"} 
              size={20} 
              color={groupByFamily ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.alertsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {!hasAlerts ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={64} color={COLORS.SUCCESS} />
              <Text style={styles.emptyTitle}>No Active Alerts</Text>
              <Text style={styles.emptySubtitle}>
                All your monitored locations are currently safe from flood risks.
              </Text>
              <TouchableOpacity style={styles.refreshEmptyButton} onPress={onRefresh}>
                <Text style={styles.refreshEmptyText}>Refresh Status</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.alertsContainer}>
              {groupByFamily ? 
                renderFamilyGroupedAlerts(filteredAlerts) :
                filteredAlerts.map((alert, index) => renderAlertCard(alert, index))
              }
            </View>
          )}
        </ScrollView>

        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{activeAlerts.length}</Text>
            <Text style={styles.summaryLabel}>Active Alerts</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{monitoredLocations.filter(l => l.alertsEnabled).length}</Text>
            <Text style={styles.summaryLabel}>Monitored</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[
              styles.summaryNumber,
              { color: activeAlerts.filter(a => a.severity === 'immediate' || a.severity === 'urgent').length > 0 ? COLORS.ERROR : COLORS.SUCCESS }
            ]}>
              {activeAlerts.filter(a => a.severity === 'immediate' || a.severity === 'urgent').length}
            </Text>
            <Text style={styles.summaryLabel}>High Priority</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  refreshButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterScroll: {
    flex: 1,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilter: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  filterText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  activeFilterText: {
    color: COLORS.TEXT_ON_PRIMARY,
  },
  groupToggle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.BACKGROUND,
  },
  alertsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  alertsContainer: {
    paddingVertical: 16,
  },
  alertCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  dismissButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: COLORS.BACKGROUND,
  },
  alertLocation: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 12,
    lineHeight: 20,
  },
  alertDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  alertDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  alertDetailText: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: 4,
  },
  guidanceContainer: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 6,
  },
  guidanceAction: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 2,
    lineHeight: 16,
  },
  guidanceTime: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
    marginTop: 4,
    fontStyle: 'italic',
  },
  alertTimestamp: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'right',
  },
  familyGroup: {
    marginBottom: 20,
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.PRIMARY + '10',
    borderRadius: 8,
    marginBottom: 8,
  },
  familyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginLeft: 8,
    flex: 1,
  },
  familyCount: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  familyCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_ON_PRIMARY,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshEmptyButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_ON_PRIMARY,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
});