import React, { createContext, useState, useEffect } from 'react';

export const FloodContext = createContext();

export const FloodProvider = ({ children }) => {
  const [currentRisk, setCurrentRisk] = useState({
    probability: 0.75,
    riskLevel: 'High',
    confidence: 0.80,
    timeToFlood: { hours: 12, minutes: 30, seconds: 0 },
    location: 'Puchong, Selangor',
    coordinates: { latitude: 3.1390, longitude: 101.6869 },
    lastUpdated: new Date().toISOString(),
  });

  const [weatherSummary, setWeatherSummary] = useState({
    currentTempMax: 32.5,
    currentTempMin: 24.8,
    currentPrecipitation: 15.2,
    currentWindSpeed: 12.3,
    recent7dayRainfall: 127.5,
    recentAvgTemp: 28.1,
    riverDischarge: 245.6,
    riverLevel: 5.2,
    normalRiverRange: '4-6'
  });

  const [riskFactors, setRiskFactors] = useState([
    'Heavy rainfall expected',
    'Rising river levels',
    'Monsoon season',
    'Low-lying area'
  ]);

  const [hotspots, setHotspots] = useState([
    {
      id: 1,
      latitude: 3.1390,
      longitude: 101.6869,
      district: 'Puchong',
      state: 'Selangor',
      riskLevel: 'high',
      riskProbability: 0.78,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 2,
      latitude: 1.4927,
      longitude: 103.7414,
      district: 'Johor Bahru',
      state: 'Johor',
      riskLevel: 'medium',
      riskProbability: 0.45,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 3,
      latitude: 5.4141,
      longitude: 100.3288,
      district: 'George Town',
      state: 'Penang',
      riskLevel: 'low',
      riskProbability: 0.22,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 4,
      latitude: 4.5975,
      longitude: 101.0901,
      district: 'Ipoh',
      state: 'Perak',
      riskLevel: 'high',
      riskProbability: 0.68,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 5,
      latitude: 5.9804,
      longitude: 116.0735,
      district: 'Kota Kinabalu',
      state: 'Sabah',
      riskLevel: 'medium',
      riskProbability: 0.41,
      lastUpdated: new Date().toISOString()
    }
  ]);

  const [precipitationForecast, setPrecipitationForecast] = useState([
    { time: '12AM', value: 0.1 },
    { time: '3AM', value: 0.3 },
    { time: '6AM', value: 0.5 },
    { time: '9AM', value: 0.7 },
    { time: '12PM', value: 0.4 },
    { time: '3PM', value: 0.2 },
    { time: '6PM', value: 0.6 },
  ]);

  const [alerts, setAlerts] = useState([
    {
      id: 1,
      type: 'flood',
      severity: 'high',
      title: 'High Flood Risk Alert',
      description: 'Flood risk elevated for Puchong area. Take precautionary measures.',
      probability: 75,
      timeframe: '12-24 hours',
      timestamp: new Date().toISOString()
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentRisk(prevRisk => {
        let { hours, minutes, seconds } = prevRisk.timeToFlood;
        
        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        }
        
        return {
          ...prevRisk,
          timeToFlood: { hours, minutes, seconds }
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const refreshFloodData = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update data with slight variations to simulate real API response
    setCurrentRisk(prev => ({
      ...prev,
      probability: Math.max(0.1, Math.min(0.9, prev.probability + (Math.random() - 0.5) * 0.1)),
      lastUpdated: new Date().toISOString()
    }));
    
    setWeatherSummary(prev => ({
      ...prev,
      currentPrecipitation: Math.max(0, prev.currentPrecipitation + (Math.random() - 0.5) * 5),
      riverLevel: Math.max(0, prev.riverLevel + (Math.random() - 0.5) * 0.5)
    }));
    
    setIsLoading(false);
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return '#FF4444';
      case 'medium':
        return '#FFBB00';
      case 'low':
        return '#44AA44';
      default:
        return '#666666';
    }
  };

  const getRiskLevelFromProbability = (probability) => {
    if (probability >= 0.8) return 'Very High';
    if (probability >= 0.6) return 'High';
    if (probability >= 0.3) return 'Medium';
    return 'Low';
  };

  const value = {
    currentRisk,
    weatherSummary,
    riskFactors,
    hotspots,
    precipitationForecast,
    alerts,
    isLoading,
    refreshFloodData,
    getRiskColor,
    getRiskLevelFromProbability,
    setCurrentRisk,
    setWeatherSummary,
    setRiskFactors,
    setHotspots,
    setAlerts
  };

  return (
    <FloodContext.Provider value={value}>
      {children}
    </FloodContext.Provider>
  );
};