import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RiskFactorIndicator = ({ factor, onPress }) => {
  const getIndicatorStyle = (impactLevel) => {
    switch (impactLevel) {
      case 'High':
        return {
          backgroundColor: '#ffebee',
          borderColor: '#f44336',
          borderWidth: 2,
          shadowColor: '#f44336',
        };
      case 'Medium':
        return {
          backgroundColor: '#fff8e1',
          borderColor: '#ff9800',
          borderWidth: 2,
          shadowColor: '#ff9800',
        };
      case 'Low':
        return {
          backgroundColor: '#e8f5e8',
          borderColor: '#4caf50',
          borderWidth: 2,
          shadowColor: '#4caf50',
        };
      default:
        return {
          backgroundColor: '#f5f5f5',
          borderColor: '#ddd',
          borderWidth: 1,
          shadowColor: '#999',
        };
    }
  };

  const getTextColor = (impactLevel) => {
    switch (impactLevel) {
      case 'High':
        return '#d32f2f';
      case 'Medium':
        return '#f57c00';
      case 'Low':
        return '#388e3c';
      default:
        return '#666';
    }
  };

  const getIcon = (impactLevel, riskDirection) => {
    if (impactLevel === 'High') {
      return riskDirection === 'Increases' ? 'arrow-up-circle' : 'arrow-down-circle';
    } else if (impactLevel === 'Medium') {
      return riskDirection === 'Increases' ? 'trending-up' : 'trending-down';
    } else {
      return riskDirection === 'Increases' ? 'chevron-up' : 'chevron-down';
    }
  };

  const containerStyle = getIndicatorStyle(factor.impact_level);
  const textColor = getTextColor(factor.impact_level);
  const iconName = getIcon(factor.impact_level, factor.risk_direction);

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={() => onPress(factor)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons 
            name={iconName} 
            size={20} 
            color={textColor} 
            style={styles.icon}
          />
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              {factor.feature?.title || factor.technical_name}
            </Text>
            <Text style={[styles.impact, { color: textColor }]}>
              {factor.impact_level} Impact
            </Text>
          </View>
        </View>
        
        <Text style={[styles.description, { color: textColor }]} numberOfLines={2}>
          {factor.feature?.description || 'Contributing to flood risk assessment'}
        </Text>
        
        <View style={styles.footer}>
          <Text style={[styles.contribution, { color: textColor }]}>
            Contribution: {(factor.contribution_score * 100).toFixed(1)}%
          </Text>
          <Ionicons 
            name="information-circle-outline" 
            size={16} 
            color={textColor} 
            style={styles.infoIcon}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = {
  container: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  icon: {
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  impact: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
    opacity: 0.9,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contribution: {
    fontSize: 11,
    fontWeight: '500',
  },
  infoIcon: {
    opacity: 0.7,
  },
};

export default RiskFactorIndicator;