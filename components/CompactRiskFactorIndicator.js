import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CompactRiskFactorIndicator = ({ factor, onPress, style }) => {
  const getIndicatorStyle = (impactLevel, riskDirection) => {
    // Determine if this is a protective factor
    const isProtective = riskDirection && (
      riskDirection.toLowerCase().includes('decrease') || 
      riskDirection.toLowerCase().includes('protect') ||
      riskDirection.toLowerCase().includes('reduc')
    );

    if (isProtective) {
      return {
        backgroundColor: '#e8f5e8',
        borderColor: '#4caf50',
        color: '#2e7d32',
      };
    }

    switch (impactLevel) {
      case 'High':
        return {
          backgroundColor: '#ffebee',
          borderColor: '#f44336',
          color: '#c62828',
        };
      case 'Medium':
        return {
          backgroundColor: '#fff8e1',
          borderColor: '#ff9800',
          color: '#ef6c00',
        };
      case 'Low':
        return {
          backgroundColor: '#f3e5f5',
          borderColor: '#9c27b0',
          color: '#7b1fa2',
        };
      default:
        return {
          backgroundColor: '#f5f5f5',
          borderColor: '#bdbdbd',
          color: '#616161',
        };
    }
  };

  const getIcon = (impactLevel, riskDirection) => {
    const isProtective = riskDirection && (
      riskDirection.toLowerCase().includes('decrease') || 
      riskDirection.toLowerCase().includes('protect') ||
      riskDirection.toLowerCase().includes('reduc')
    );

    if (isProtective) return 'shield-checkmark-outline';
    
    switch (impactLevel) {
      case 'High':
        return 'warning';
      case 'Medium':
        return 'alert-circle-outline';
      case 'Low':
        return 'information-circle-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const indicatorStyle = getIndicatorStyle(factor.impact_level, factor.risk_direction);
  const iconName = getIcon(factor.impact_level, factor.risk_direction);

  // Get the full title without truncation
  const getFullTitle = (factor) => {
    if (factor.feature?.title) {
      return factor.feature.title;
    }
    return factor.technical_name || 'Unknown';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: indicatorStyle.backgroundColor,
          borderColor: indicatorStyle.borderColor,
        },
        style
      ]}
      onPress={() => onPress(factor)}
      activeOpacity={0.7}
    >
      <Ionicons 
        name={iconName} 
        size={12} 
        color={indicatorStyle.color} 
        style={styles.icon}
      />
      <Text 
        style={[styles.title, { color: indicatorStyle.color }]} 
        numberOfLines={2}
      >
        {getFullTitle(factor)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    marginRight: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 140, // Allow wider titles for full text
    lineHeight: 14,
  },
};

export default CompactRiskFactorIndicator;