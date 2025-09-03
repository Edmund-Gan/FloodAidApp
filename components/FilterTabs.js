/**
 * FilterTabs.js - Modern Material Design 3 tab navigation for primary filters
 * Provides clean horizontal tab interface with animations and icons
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FILTER_TYPES } from '../utils/FilterHelpers';

const { width } = Dimensions.get('window');

const FilterTabs = ({ 
  activeFilter, 
  onFilterChange, 
  filterCounts = {},
  style 
}) => {
  const tabs = [
    {
      key: FILTER_TYPES.RECENT,
      label: 'Recent',
      icon: 'time',
      count: filterCounts.recent || 0,
      color: '#1976D2'
    },
    {
      key: FILTER_TYPES.HISTORICAL,
      label: 'All Time',
      icon: 'library',
      count: filterCounts.all || 0,
      color: '#388E3C'
    },
    {
      key: FILTER_TYPES.HIGH_RISK,
      label: 'High Risk',
      icon: 'warning',
      count: filterCounts.high_risk || 0,
      color: '#D32F2F'
    },
    {
      key: FILTER_TYPES.REGIONAL,
      label: 'Regional',
      icon: 'map',
      count: filterCounts.peninsular + filterCounts.east_malaysia || 0,
      color: '#7B1FA2'
    }
  ];

  const getTabWidth = () => {
    return (width - 40) / tabs.length; // Account for container padding
  };

  const renderTab = (tab, index) => {
    const isActive = activeFilter === tab.key;
    const tabWidth = getTabWidth();

    return (
      <TouchableOpacity
        key={tab.key}
        style={[
          styles.tab,
          { width: tabWidth },
          isActive && [styles.activeTab, { backgroundColor: tab.color }]
        ]}
        onPress={() => onFilterChange(tab.key)}
        activeOpacity={0.7}
      >
        <View style={styles.tabContent}>
          <Ionicons
            name={tab.icon}
            size={18}
            color={isActive ? '#fff' : tab.color}
            style={styles.tabIcon}
          />
          <Text style={[
            styles.tabLabel,
            isActive ? styles.activeTabLabel : { color: tab.color }
          ]}>
            {tab.label}
          </Text>
          {tab.count > 0 && (
            <View style={[
              styles.countBadge,
              isActive ? styles.activeCountBadge : { backgroundColor: tab.color }
            ]}>
              <Text style={[
                styles.countText,
                isActive ? styles.activeCountText : styles.inactiveCountText
              ]}>
                {tab.count}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tabContainer}>
        {tabs.map((tab, index) => renderTab(tab, index))}
      </View>
      
      {/* Active tab indicator */}
      <View 
        style={[
          styles.activeIndicator,
          {
            left: 20 + (tabs.findIndex(t => t.key === activeFilter) * getTabWidth()),
            width: getTabWidth()
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTab: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeTabLabel: {
    color: '#fff',
  },
  countBadge: {
    position: 'absolute',
    top: -8,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  countText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  activeCountText: {
    color: '#333',
  },
  inactiveCountText: {
    color: '#fff',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: 'transparent', // Hidden since we use elevated active tab instead
  }
});

export default FilterTabs;