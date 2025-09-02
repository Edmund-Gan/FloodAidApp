import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import environmentalAnalysisService from '../services/EnvironmentalAnalysisService';
import { COLORS } from '../utils/constants';

const { width, height } = Dimensions.get('window');

const FloodAlertDetails = ({ 
  alert, 
  visible, 
  onClose 
}) => {
  const [environmentalData, setEnvironmentalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('weather');

  useEffect(() => {
    if (visible && alert) {
      loadEnvironmentalData();
    }
  }, [visible, alert]);

  const loadEnvironmentalData = async () => {
    try {
      setLoading(true);
      const floodProbability = alert.riskLevel === 'Very High' ? 0.9 :
                              alert.riskLevel === 'High' ? 0.75 :
                              alert.riskLevel === 'Medium' ? 0.6 : 0.3;

      const data = await environmentalAnalysisService.generateComprehensiveAnalysis(
        alert.location.coordinates.lat,
        alert.location.coordinates.lng,
        floodProbability
      );
      
      setEnvironmentalData(data);
    } catch (error) {
      console.error('Error loading environmental data:', error);
      // Show mock data on error
      setEnvironmentalData(environmentalAnalysisService.generateMockAnalysis(
        alert.location.coordinates.lat,
        alert.location.coordinates.lng,
        0.6
      ));
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#FF4444';
      case 'severe': return '#FF6600';
      case 'moderate': return '#FF9800';
      case 'low': return '#FFC107';
      default: return '#2196F3';
    }
  };

  const getRiskLevelColor = (level) => {
    switch (level) {
      case 'Critical': return '#FF4444';
      case 'High': return '#FF6600';
      case 'Moderate': return '#FF9800';
      case 'Low': return '#FFC107';
      default: return '#4CAF50';
    }
  };

  const renderWeatherTab = () => {
    if (!environmentalData?.weatherConditions) return null;

    const { weatherConditions } = environmentalData;

    return (
      <ScrollView style={styles.tabContent}>
        {/* Primary Description */}
        <View style={[styles.section, { borderLeftColor: getSeverityColor(weatherConditions.severityLevel) }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="rainy" size={24} color={getSeverityColor(weatherConditions.severityLevel)} />
            <Text style={styles.sectionTitle}>Current Weather Impact</Text>
          </View>
          <Text style={styles.primaryDescription}>
            {weatherConditions.primaryDescription}
          </Text>
          <View style={styles.severityBadge}>
            <Text style={[styles.severityText, { color: getSeverityColor(weatherConditions.severityLevel) }]}>
              {weatherConditions.severityDescription}
            </Text>
          </View>
        </View>

        {/* Contributing Factors */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={20} color="#666" />
            <Text style={styles.sectionSubtitle}>Contributing Factors</Text>
          </View>
          {weatherConditions.contributingFactors.map((factor, index) => (
            <View key={index} style={styles.factorItem}>
              <Ionicons name="chevron-forward" size={16} color="#FF9800" />
              <Text style={styles.factorText}>{factor}</Text>
            </View>
          ))}
        </View>

        {/* Current Conditions Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Current Conditions</Text>
          <View style={styles.conditionsGrid}>
            <View style={styles.conditionItem}>
              <Ionicons name="thermometer" size={20} color="#2196F3" />
              <Text style={styles.conditionLabel}>Temperature</Text>
              <Text style={styles.conditionValue}>{weatherConditions.currentConditions.temperature}</Text>
            </View>
            <View style={styles.conditionItem}>
              <Ionicons name="water" size={20} color="#2196F3" />
              <Text style={styles.conditionLabel}>Rainfall</Text>
              <Text style={styles.conditionValue}>{weatherConditions.currentConditions.precipitation}</Text>
            </View>
            <View style={styles.conditionItem}>
              <Ionicons name="speedometer" size={20} color="#2196F3" />
              <Text style={styles.conditionLabel}>Humidity</Text>
              <Text style={styles.conditionValue}>{weatherConditions.currentConditions.humidity}</Text>
            </View>
            <View style={styles.conditionItem}>
              <Ionicons name="leaf" size={20} color="#2196F3" />
              <Text style={styles.conditionLabel}>Wind</Text>
              <Text style={styles.conditionValue}>{weatherConditions.currentConditions.windSpeed}</Text>
            </View>
          </View>
        </View>

        {/* Rain Patterns */}
        {weatherConditions.rainPatterns && (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Rainfall Patterns</Text>
            <View style={styles.patternGrid}>
              <View style={styles.patternItem}>
                <Text style={styles.patternLabel}>Duration</Text>
                <Text style={styles.patternValue}>{weatherConditions.rainPatterns.duration}</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternLabel}>Total Expected</Text>
                <Text style={styles.patternValue}>{weatherConditions.rainPatterns.totalExpected}</Text>
              </View>
              <View style={styles.patternItem}>
                <Text style={styles.patternLabel}>Intensity</Text>
                <Text style={[styles.patternValue, { textTransform: 'capitalize' }]}>
                  {weatherConditions.rainPatterns.intensity}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 24h Forecast */}
        {weatherConditions.forecast?.next24Hours && (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Next 24 Hours</Text>
            <View style={styles.forecastGrid}>
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Max Temperature</Text>
                <Text style={styles.forecastValue}>{weatherConditions.forecast.next24Hours.maxTemp}</Text>
              </View>
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Min Temperature</Text>
                <Text style={styles.forecastValue}>{weatherConditions.forecast.next24Hours.minTemp}</Text>
              </View>
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Expected Rain</Text>
                <Text style={styles.forecastValue}>{weatherConditions.forecast.next24Hours.precipitation}</Text>
              </View>
              <View style={styles.forecastItem}>
                <Text style={styles.forecastLabel}>Rain Hours</Text>
                <Text style={styles.forecastValue}>{weatherConditions.forecast.next24Hours.precipitationHours}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderRiverTab = () => {
    if (!environmentalData?.riverStatus) return null;

    const { riverStatus } = environmentalData;

    return (
      <ScrollView style={styles.tabContent}>
        {/* River Status Overview */}
        <View style={[styles.section, { borderLeftColor: getSeverityColor(riverStatus.warningLevel) }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.visualIndicator}>{riverStatus.visualIndicator}</Text>
            <Text style={styles.sectionTitle}>River Discharge Status</Text>
          </View>
          <Text style={styles.primaryDescription}>
            {riverStatus.primaryDescription}
          </Text>
        </View>

        {/* Current Status */}
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Current Water Levels</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Discharge Rate</Text>
              <Text style={styles.statusValue}>{riverStatus.currentStatus.discharge}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Percentile Ranking</Text>
              <Text style={styles.statusValue}>{riverStatus.currentStatus.percentile}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Status Level</Text>
              <Text style={[
                styles.statusValue, 
                { color: getSeverityColor(riverStatus.currentStatus.status) }
              ]}>
                {riverStatus.currentStatus.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Historical Context */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#666" />
            <Text style={styles.sectionSubtitle}>Historical Context</Text>
          </View>
          <View style={styles.historicalGrid}>
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>Yearly Average</Text>
              <Text style={styles.historicalValue}>{riverStatus.historicalContext.average}</Text>
            </View>
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>Median Level</Text>
              <Text style={styles.historicalValue}>{riverStatus.historicalContext.median}</Text>
            </View>
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>Range</Text>
              <Text style={styles.historicalValue}>{riverStatus.historicalContext.yearlyRange}</Text>
            </View>
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>Data Points</Text>
              <Text style={styles.historicalValue}>{riverStatus.historicalContext.dataPoints}</Text>
            </View>
          </View>
        </View>

        {/* Trend Analysis */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons 
              name={
                riverStatus.trend.direction === 'rising' ? 'trending-up' :
                riverStatus.trend.direction === 'falling' ? 'trending-down' : 'remove'
              } 
              size={20} 
              color={
                riverStatus.trend.direction === 'rising' ? '#FF4444' :
                riverStatus.trend.direction === 'falling' ? '#4CAF50' : '#666'
              } 
            />
            <Text style={styles.sectionSubtitle}>Trend Analysis</Text>
          </View>
          <Text style={styles.trendDescription}>{riverStatus.trend.description}</Text>
          <View style={styles.trendBadge}>
            <Text style={[
              styles.trendText,
              { color: riverStatus.trend.direction === 'rising' ? '#FF4444' : 
                       riverStatus.trend.direction === 'falling' ? '#4CAF50' : '#666' }
            ]}>
              {riverStatus.trend.direction.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Risk Factors */}
        {riverStatus.riskFactors && riverStatus.riskFactors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Risk Factors</Text>
            {riverStatus.riskFactors.map((factor, index) => (
              <View key={index} style={styles.factorItem}>
                <Ionicons name="warning" size={16} color="#FF9800" />
                <Text style={styles.factorText}>{factor}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderGeographyTab = () => {
    if (!environmentalData?.geographicalFactors) return null;

    const { geographicalFactors } = environmentalData;

    return (
      <ScrollView style={styles.tabContent}>
        {/* Elevation Assessment */}
        <View style={[styles.section, { borderLeftColor: getSeverityColor(geographicalFactors.elevationRisk) }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mountain" size={24} color={getSeverityColor(geographicalFactors.elevationRisk)} />
            <Text style={styles.sectionTitle}>Elevation Assessment</Text>
          </View>
          <Text style={styles.primaryDescription}>
            {geographicalFactors.primaryDescription}
          </Text>
          <Text style={styles.riskDescription}>
            Risk Level: {geographicalFactors.floodRiskLevel}
          </Text>
        </View>

        {/* Elevation Details */}
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Elevation Details</Text>
          <View style={styles.elevationGrid}>
            <View style={styles.elevationItem}>
              <Text style={styles.elevationLabel}>Meters</Text>
              <Text style={styles.elevationValue}>{geographicalFactors.elevation.meters}m</Text>
            </View>
            <View style={styles.elevationItem}>
              <Text style={styles.elevationLabel}>Feet</Text>
              <Text style={styles.elevationValue}>{geographicalFactors.elevation.feet}ft</Text>
            </View>
            <View style={styles.elevationItem}>
              <Text style={styles.elevationLabel}>Category</Text>
              <Text style={styles.elevationValue}>{geographicalFactors.elevation.category}</Text>
            </View>
          </View>
        </View>

        {/* Location Characteristics */}
        {geographicalFactors.locationCharacteristics && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#666" />
              <Text style={styles.sectionSubtitle}>Location Characteristics</Text>
            </View>
            {geographicalFactors.locationCharacteristics.map((characteristic, index) => (
              <View key={index} style={styles.characteristicItem}>
                <Ionicons name="information-circle" size={16} color="#2196F3" />
                <Text style={styles.characteristicText}>{characteristic}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Risk Factors */}
        {geographicalFactors.riskFactors && (
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Risk Assessment</Text>
            
            {/* Mitigating Factors */}
            {geographicalFactors.riskFactors.mitigating.length > 0 && (
              <View style={styles.riskCategory}>
                <Text style={styles.riskCategoryTitle}>Mitigating Factors</Text>
                {geographicalFactors.riskFactors.mitigating.map((factor, index) => (
                  <View key={index} style={styles.factorItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.factorText}>{factor}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Amplifying Factors */}
            {geographicalFactors.riskFactors.amplifying.length > 0 && (
              <View style={styles.riskCategory}>
                <Text style={styles.riskCategoryTitle}>Amplifying Factors</Text>
                {geographicalFactors.riskFactors.amplifying.map((factor, index) => (
                  <View key={index} style={styles.factorItem}>
                    <Ionicons name="alert-circle" size={16} color="#FF9800" />
                    <Text style={styles.factorText}>{factor}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Drainage Assessment */}
        {geographicalFactors.drainageAssessment && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="water-outline" size={20} color="#666" />
              <Text style={styles.sectionSubtitle}>Drainage Assessment</Text>
            </View>
            <Text style={styles.drainageDescription}>
              {geographicalFactors.drainageAssessment.description}
            </Text>
            <View style={styles.drainageBadge}>
              <Text style={styles.drainageEfficiency}>
                Efficiency: {geographicalFactors.drainageAssessment.efficiency.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Regional Context */}
        {geographicalFactors.regionalContext && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="globe" size={20} color="#666" />
              <Text style={styles.sectionSubtitle}>Regional Context</Text>
            </View>
            <Text style={styles.regionalDescription}>
              {geographicalFactors.regionalContext}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderOverallRisk = () => {
    if (!environmentalData?.overallRisk) return null;

    const { overallRisk } = environmentalData;

    return (
      <View style={styles.overallRiskContainer}>
        <View style={styles.overallRiskHeader}>
          <Text style={styles.overallRiskTitle}>Overall Environmental Risk</Text>
          <Text style={[
            styles.overallRiskLevel,
            { color: getRiskLevelColor(overallRisk.riskLevel) }
          ]}>
            {overallRisk.riskLevel}
          </Text>
        </View>
        <Text style={styles.overallRiskSummary}>
          {overallRisk.summary}
        </Text>
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>
            Confidence: {overallRisk.confidence} ({overallRisk.score}/100)
          </Text>
        </View>
        
        {/* Component Breakdown */}
        <View style={styles.componentsContainer}>
          <Text style={styles.componentsTitle}>Risk Components:</Text>
          <View style={styles.componentItem}>
            <Text style={styles.componentLabel}>Weather</Text>
            <Text style={styles.componentValue}>{overallRisk.components.weather}</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.componentLabel}>River</Text>
            <Text style={styles.componentValue}>{overallRisk.components.river}</Text>
          </View>
          <View style={styles.componentItem}>
            <Text style={styles.componentLabel}>Geography</Text>
            <Text style={styles.componentValue}>{overallRisk.components.geographical}</Text>
          </View>
        </View>
      </View>
    );
  };

  const tabs = [
    { id: 'weather', label: 'Weather', icon: 'rainy' },
    { id: 'river', label: 'River', icon: 'water' },
    { id: 'geography', label: 'Geography', icon: 'mountain' }
  ];

  if (!alert) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alert Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Alert Summary */}
        <View style={styles.alertSummary}>
          <Text style={styles.alertLocation}>{alert.location.name}</Text>
          <Text style={styles.alertTime}>{alert.countdownDisplay}</Text>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading environmental data...</Text>
          </View>
        )}

        {/* Content */}
        {!loading && environmentalData && (
          <>
            {/* Overall Risk Banner */}
            {renderOverallRisk()}

            {/* Tabs */}
            <View style={styles.tabContainer}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Ionicons 
                    name={tab.icon} 
                    size={20} 
                    color={activeTab === tab.id ? '#2196F3' : '#666'} 
                  />
                  <Text style={[
                    styles.tabText,
                    activeTab === tab.id && styles.activeTabText
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab Content */}
            <View style={styles.contentContainer}>
              {activeTab === 'weather' && renderWeatherTab()}
              {activeTab === 'river' && renderRiverTab()}
              {activeTab === 'geography' && renderGeographyTab()}
            </View>
          </>
        )}

        {/* Mock Data Warning */}
        {environmentalData?.isMock && (
          <View style={styles.mockWarning}>
            <Ionicons name="information-circle" size={16} color="#FF9800" />
            <Text style={styles.mockWarningText}>Using simulated environmental data</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  alertSummary: {
    backgroundColor: '#fff',
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  alertLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  overallRiskContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  overallRiskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overallRiskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  overallRiskLevel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  overallRiskSummary: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  confidenceContainer: {
    marginBottom: 12,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#888',
  },
  componentsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  componentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  componentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  componentLabel: {
    fontSize: 12,
    color: '#666',
  },
  componentValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  primaryDescription: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  factorText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    lineHeight: 20,
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  conditionItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  conditionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  patternItem: {
    width: '33%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  patternLabel: {
    fontSize: 12,
    color: '#666',
  },
  patternValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  forecastGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  forecastItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  forecastLabel: {
    fontSize: 12,
    color: '#666',
  },
  forecastValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  visualIndicator: {
    fontSize: 16,
    marginRight: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  statusItem: {
    width: '33%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
    textAlign: 'center',
  },
  historicalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  historicalItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  historicalLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  historicalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
    textAlign: 'center',
  },
  trendDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  trendBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  riskDescription: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  elevationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  elevationItem: {
    width: '33%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  elevationLabel: {
    fontSize: 12,
    color: '#666',
  },
  elevationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  characteristicItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  characteristicText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    lineHeight: 20,
  },
  riskCategory: {
    marginBottom: 16,
  },
  riskCategoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  drainageDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  drainageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  drainageEfficiency: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  regionalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  mockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8E1',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  mockWarningText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 6,
  },
});

export default FloodAlertDetails;