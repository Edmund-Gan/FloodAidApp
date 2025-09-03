/**
 * EmbeddedMLTest.js - Test suite for Embedded ML Integration
 * Tests the embedded ML service functionality and accuracy
 */

import embeddedMLService from '../services/EmbeddedMLService';

describe('EmbeddedMLService Tests', () => {
  const testLocations = [
    { lat: 3.1390, lon: 101.6869, name: "Kuala Lumpur", expectedState: "WILAYAH PERSEKUTUAN" },
    { lat: 1.4927, lon: 103.7414, name: "Johor Bahru", expectedState: "JOHOR" },
    { lat: 1.5535, lon: 110.3592, name: "Kuching", expectedState: "SARAWAK" },
    { lat: 5.9804, lon: 116.0735, name: "Kota Kinabalu", expectedState: "SABAH" },
    { lat: 3.0738, lon: 101.5183, name: "Puchong, Selangor", expectedState: "SELANGOR" }
  ];

  beforeAll(async () => {
    // Initialize the embedded ML service
    await embeddedMLService.initialize();
  });

  test('Service initialization', () => {
    expect(embeddedMLService.isInitialized).toBe(true);
    expect(embeddedMLService.modelConfig).toBeDefined();
    expect(embeddedMLService.modelConfig.features_count).toBe(31);
    expect(embeddedMLService.modelConfig.f1_score).toBe(0.8095);
  });

  test('State detection from coordinates', () => {
    testLocations.forEach(location => {
      const detectedState = embeddedMLService.getStateFromCoordinates(location.lat, location.lon);
      expect(detectedState).toBe(location.expectedState);
      console.log(`✅ ${location.name}: ${detectedState}`);
    });
  });

  test('Monsoon feature calculation', () => {
    const testDates = [
      { date: '2024-01-15', expectedSeason: 'Northeast', expectedCode: 0 },
      { date: '2024-07-15', expectedSeason: 'Southwest', expectedCode: 1 },
      { date: '2024-04-15', expectedSeason: 'Inter-monsoon', expectedCode: 2 },
      { date: '2024-10-15', expectedSeason: 'Inter-monsoon', expectedCode: 2 }
    ];

    testDates.forEach(testCase => {
      const monsoonFeatures = embeddedMLService.calculateMonsoonFeatures(testCase.date);
      expect(monsoonFeatures.monsoon_season_encoded).toBe(testCase.expectedCode);
      expect(monsoonFeatures.monsoon_name).toBe(testCase.expectedSeason);
      expect(monsoonFeatures.days_since_monsoon_start).toBeGreaterThanOrEqual(0);
      expect(monsoonFeatures.monsoon_intensity).toBeGreaterThan(0);
      console.log(`✅ ${testCase.date}: ${monsoonFeatures.monsoon_name} (${monsoonFeatures.monsoon_intensity})`);
    });
  });

  test('Monthly feature creation', () => {
    const testDate = '2024-07-15';
    const monthlyFeatures = embeddedMLService.createMonthlyFeatures(testDate);
    
    // Should have 12 monthly features
    const monthlyKeys = Object.keys(monthlyFeatures).filter(key => key.startsWith('is_'));
    expect(monthlyKeys).toHaveLength(12);
    
    // July should be 1, others should be 0
    expect(monthlyFeatures.is_july).toBe(1.0);
    expect(monthlyFeatures.is_january).toBe(0.0);
    expect(monthlyFeatures.is_december).toBe(0.0);
    
    console.log('✅ Monthly features created correctly for July');
  });

  test('Feature vector creation', () => {
    const testDate = '2024-07-15';
    const mockWeatherData = {
      features: {
        temp_max: 32.5,
        temp_min: 24.2,
        temp_mean: 28.1,
        precipitation_sum: 15.0,
        rain_sum: 12.0,
        precipitation_hours: 4.0,
        wind_speed_max: 18.0,
        wind_gusts_max: 25.0,
        wind_direction: 180.0,
        river_discharge: 55.0,
        river_discharge_mean: 50.0,
        river_discharge_median: 48.0,
        elevation: 50.0
      }
    };
    
    const featureVector = embeddedMLService.createFeatureVector(
      mockWeatherData,
      3.1390,
      101.6869,
      testDate
    );
    
    expect(featureVector).toHaveLength(31);
    expect(featureVector[0]).toBe(3.1390); // latitude
    expect(featureVector[1]).toBe(101.6869); // longitude
    expect(featureVector[2]).toBe(32.5); // temp_max
    expect(featureVector.every(val => typeof val === 'number')).toBe(true);
    
    console.log('✅ 31-feature vector created successfully');
  });

  test('Flood risk prediction', async () => {
    for (const location of testLocations) {
      const prediction = await embeddedMLService.predictFloodRisk(
        location.lat,
        location.lon,
        '2024-07-15'
      );
      
      expect(prediction.success).toBe(true);
      expect(prediction.risk_level).toMatch(/^(Low|Medium|High)$/);
      expect(prediction.flood_probability).toBeGreaterThanOrEqual(0);
      expect(prediction.flood_probability).toBeLessThanOrEqual(1);
      expect(prediction.location_info.state).toBe(location.expectedState);
      expect(prediction.prediction_details.features_count).toBe(31);
      
      console.log(`✅ ${location.name}: ${prediction.risk_level} risk (${(prediction.flood_probability * 100).toFixed(1)}%)`);
    }
  });

  test('Multiple location predictions', async () => {
    const locations = testLocations.map(loc => ({
      latitude: loc.lat,
      longitude: loc.lon,
      label: loc.name
    }));
    
    const multiPrediction = await embeddedMLService.predictMultipleLocations(locations, '2024-07-15');
    
    expect(multiPrediction.success).toBe(true);
    expect(multiPrediction.total_locations).toBe(testLocations.length);
    expect(multiPrediction.results).toHaveLength(testLocations.length);
    
    multiPrediction.results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.location_label).toBe(testLocations[index].name);
      expect(result.request_index).toBe(index);
    });
    
    console.log(`✅ Multiple location predictions completed for ${multiPrediction.total_locations} locations`);
  });

  test('Service status and cache', () => {
    const status = embeddedMLService.getServiceStatus();
    
    expect(status.initialized).toBe(true);
    expect(status.model_version).toBe('3.0-embedded');
    expect(status.features_count).toBe(31);
    expect(status.f1_score).toBe(0.8095);
    expect(status.cache_size).toBeGreaterThanOrEqual(0);
    
    console.log('✅ Service status:', status);
    
    // Test cache clearing
    embeddedMLService.clearCache();
    const clearedStatus = embeddedMLService.getServiceStatus();
    expect(clearedStatus.cache_size).toBe(0);
    
    console.log('✅ Cache cleared successfully');
  });

  test('Error handling', async () => {
    // Test invalid coordinates
    const invalidPrediction = await embeddedMLService.predictFloodRisk(999, 999);
    expect(invalidPrediction.success).toBe(false);
    expect(invalidPrediction.error).toContain('coordinates');
    
    console.log('✅ Error handling works for invalid coordinates');
  });

  test('Performance benchmark', async () => {
    const startTime = Date.now();
    const testLocation = testLocations[0];
    
    // Run 10 predictions to measure average performance
    const predictions = [];
    for (let i = 0; i < 10; i++) {
      const prediction = await embeddedMLService.predictFloodRisk(
        testLocation.lat,
        testLocation.lon,
        '2024-07-15'
      );
      predictions.push(prediction);
    }
    
    const endTime = Date.now();
    const averageTime = (endTime - startTime) / 10;
    
    expect(averageTime).toBeLessThan(2000); // Should be less than 2 seconds per prediction
    predictions.forEach(prediction => {
      expect(prediction.success).toBe(true);
    });
    
    console.log(`✅ Performance: Average ${averageTime.toFixed(0)}ms per prediction (Target: <2000ms)`);
  });
});

// Manual test function for development
export const runManualTest = async () => {
  console.log('🚀 Running Manual Embedded ML Test...');
  
  try {
    // Initialize service
    await embeddedMLService.initialize();
    console.log('✅ Service initialized');
    
    // Test prediction
    const testLocation = { lat: 3.1390, lon: 101.6869, name: "Kuala Lumpur" };
    const prediction = await embeddedMLService.predictFloodRisk(
      testLocation.lat,
      testLocation.lon
    );
    
    if (prediction.success) {
      console.log('✅ Test Prediction Results:');
      console.log(`  Location: ${prediction.location_info.state}`);
      console.log(`  Risk Level: ${prediction.risk_level}`);
      console.log(`  Probability: ${(prediction.flood_probability * 100).toFixed(1)}%`);
      console.log(`  Confidence: ${prediction.confidence}`);
      console.log(`  Model: ${prediction.prediction_details.model_used}`);
      console.log(`  Features: ${prediction.prediction_details.features_count}`);
      console.log(`  F1-Score: ${prediction.prediction_details.f1_score}`);
    } else {
      console.error('❌ Test Prediction Failed:', prediction.error);
    }
    
    // Test service status
    const status = embeddedMLService.getServiceStatus();
    console.log('📊 Service Status:', status);
    
  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
};