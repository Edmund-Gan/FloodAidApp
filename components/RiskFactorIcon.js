import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const RiskFactorIcon = ({ factorType, size = 80 }) => {
  // Map factor types to icon configurations
  const getIconConfig = (type) => {
    const configs = {
      rain_sum: {
        icon: 'rainy',
        colors: ['#4FC3F7', '#29B6F6'],
        backgroundColor: '#E3F2FD'
      },
      precipitation_sum: {
        icon: 'water',
        colors: ['#4DD0E1', '#26C6DA'],
        backgroundColor: '#E0F7FA'
      },
      wind_speed_max: {
        icon: 'leaf',
        colors: ['#4DB6AC', '#26A69A'],
        backgroundColor: '#E0F2F1'
      },
      wind_gusts_max: {
        icon: 'thunderstorm',
        colors: ['#7986CB', '#5C6BC0'],
        backgroundColor: '#E8EAF6'
      },
      river_discharge: {
        icon: 'waves',
        colors: ['#4FC3F7', '#039BE5'],
        backgroundColor: '#E1F5FE'
      },
      temp_max: {
        icon: 'sunny',
        colors: ['#FFB74D', '#FF9800'],
        backgroundColor: '#FFF3E0'
      },
      elevation: {
        icon: 'trending-up',
        colors: ['#81C784', '#66BB6A'],
        backgroundColor: '#E8F5E9'
      },
      monsoon_intensity: {
        icon: 'cloud',
        colors: ['#9575CD', '#7E57C2'],
        backgroundColor: '#EDE7F6'
      },
      precipitation_hours: {
        icon: 'time',
        colors: ['#64B5F6', '#42A5F5'],
        backgroundColor: '#E3F2FD'
      }
    };

    return configs[type] || {
      icon: 'alert-circle',
      colors: ['#90A4AE', '#78909C'],
      backgroundColor: '#ECEFF1'
    };
  };

  const config = getIconConfig(factorType);
  const iconSize = size * 0.5;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: config.backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size * 0.75,
          height: size * 0.75,
          borderRadius: (size * 0.75) / 2,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons
          name={config.icon}
          size={iconSize}
          color="#FFFFFF"
        />
      </LinearGradient>
    </View>
  );
};

export default RiskFactorIcon;
