/**
 * QuickStats.js - Compact statistics display component
 * Modern card-based design showing key flood statistics without blocking the map
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const QuickStats = ({ 
  statistics,
  filteredCount,
  totalCount,
  style,
  onStatsPress,
  isCollapsible = true
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  
  if (!statistics) return null;

  const stats = [
    {
      key: 'filtered',
      label: 'states shown',
      value: filteredCount || 0,
      icon: 'eye',
      color: '#2196F3'
    },
    {
      key: 'total_events',
      label: 'total events',
      value: statistics.totalEvents || 0,
      icon: 'water',
      color: '#FF9800',
      format: 'number'
    },
    {
      key: 'recent',
      label: 'recent activity',
      value: statistics.recentEvents || 0,
      icon: 'time',
      color: '#F44336'
    }
  ];

  const formatValue = (stat) => {
    if (stat.format === 'number') {
      return stat.value.toLocaleString();
    }
    if (stat.format === 'text') {
      return stat.value;
    }
    return stat.value.toString();
  };

  const renderStat = (stat, index) => (
    <View key={stat.key} style={styles.statRow}>
      <Ionicons 
        name={stat.icon} 
        size={16} 
        color={stat.color}
        style={styles.statIcon}
      />
      <Text style={[styles.statNumber, { color: stat.color }]}>
        {formatValue(stat)}
      </Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
    </View>
  );

  if (isCollapsible && isCollapsed) {
    return (
      <TouchableOpacity 
        style={[styles.containerCollapsed, style]}
        onPress={() => setIsCollapsed(false)}
        activeOpacity={0.7}
      >
        <Ionicons name="stats-chart" size={16} color="#666" />
        <Text style={styles.collapsedText}>Stats</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Header with collapse button */}
      {isCollapsible && (
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Statistics</Text>
          <TouchableOpacity 
            onPress={() => setIsCollapsed(true)}
            style={styles.collapseButton}
          >
            <Ionicons name="chevron-up" size={14} color="#999" />
          </TouchableOpacity>
        </View>
      )}
      
      <TouchableOpacity 
        onPress={onStatsPress}
        activeOpacity={onStatsPress ? 0.7 : 1}
        disabled={!onStatsPress}
      >
        <View style={styles.statsContainer}>
          {stats.map(renderStat)}
        </View>
        
        {/* Show more indicator */}
        {onStatsPress && (
          <View style={styles.showMoreContainer}>
            <Ionicons name="chevron-down" size={12} color="#999" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 0,
    marginVertical: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    minWidth: 160,
  },
  containerCollapsed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  collapsedText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  collapseButton: {
    padding: 2,
  },
  statsContainer: {
    flexDirection: 'column',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    marginRight: 8,
    width: 16,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  showMoreContainer: {
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  }
});

export default QuickStats;