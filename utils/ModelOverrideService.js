/**
 * ModelOverrideService.js - Developer Mode Model Override System
 * Allows developers to replace ML predictions and adjust flood risk calculations
 * Used only in developer mode for testing different scenarios and models
 */

class ModelOverrideService {
  constructor() {
    this.isActive = false;
    this.overrides = {
      // Manual probability override
      manualProbability: null,
      manualProbabilityEnabled: false,

      // Model selection
      selectedModel: 'embedded', // 'embedded', 'statistical', 'custom'

      // Risk factor multipliers
      rainfallMultiplier: 1.0,
      stateRiskMultiplier: null,
      monsoonIntensityMultiplier: 1.0,
      riverDischargeThreshold: 1.0,

      // Custom model config
      customModelConfig: null,

      // Feature weights override
      featureWeights: null,

      // Threshold overrides
      thresholdOverrides: {}
    };

    this.isDevelopmentMode = __DEV__ || process.env.NODE_ENV === 'development';
    console.log('ModelOverrideService initialized - Development mode:', this.isDevelopmentMode);
  }

  /**
   * Check if any overrides are currently active
   */
  isOverrideActive() {
    return this.isDevelopmentMode && this.isActive;
  }

  /**
   * Enable the override system
   */
  enableOverrides() {
    if (!this.isDevelopmentMode) {
      console.warn('ModelOverrideService: Cannot enable overrides in production');
      return false;
    }

    this.isActive = true;
    console.log('🔧 ModelOverrideService: Override system enabled');
    return true;
  }

  /**
   * Disable all overrides and reset to defaults
   */
  disableOverrides() {
    this.isActive = false;
    this.resetAllOverrides();
    console.log('🔧 ModelOverrideService: Override system disabled');
  }

  /**
   * Reset all overrides to default values
   */
  resetAllOverrides() {
    this.overrides = {
      manualProbability: null,
      manualProbabilityEnabled: false,
      selectedModel: 'embedded',
      rainfallMultiplier: 1.0,
      stateRiskMultiplier: null,
      monsoonIntensityMultiplier: 1.0,
      riverDischargeThreshold: 1.0,
      customModelConfig: null,
      featureWeights: null,
      thresholdOverrides: {}
    };
    console.log('🔧 ModelOverrideService: All overrides reset to defaults');
  }

  /**
   * Set manual flood probability (0-1)
   */
  setManualProbability(probability, enabled = true) {
    if (!this.isDevelopmentMode) return false;

    if (probability < 0 || probability > 1) {
      console.warn('ModelOverrideService: Probability must be between 0 and 1');
      return false;
    }

    this.overrides.manualProbability = probability;
    this.overrides.manualProbabilityEnabled = enabled;

    console.log(`🎯 Manual probability set: ${(probability * 100).toFixed(1)}% (enabled: ${enabled})`);
    return true;
  }

  /**
   * Get manual probability override
   */
  getManualProbability() {
    if (!this.isOverrideActive() || !this.overrides.manualProbabilityEnabled) {
      return null;
    }
    return this.overrides.manualProbability;
  }

  /**
   * Set rainfall intensity multiplier
   */
  setRainfallMultiplier(multiplier) {
    if (!this.isDevelopmentMode) return false;

    if (multiplier < 0.1 || multiplier > 10) {
      console.warn('ModelOverrideService: Rainfall multiplier must be between 0.1 and 10');
      return false;
    }

    this.overrides.rainfallMultiplier = multiplier;
    console.log(`🌧️ Rainfall multiplier set: ${multiplier}x`);
    return true;
  }

  /**
   * Set state risk multiplier override
   */
  setStateRiskMultiplier(multiplier) {
    if (!this.isDevelopmentMode) return false;

    if (multiplier !== null && (multiplier < 0.1 || multiplier > 5)) {
      console.warn('ModelOverrideService: State risk multiplier must be between 0.1 and 5');
      return false;
    }

    this.overrides.stateRiskMultiplier = multiplier;
    console.log(`🗺️ State risk multiplier set: ${multiplier ? multiplier + 'x' : 'default'}`);
    return true;
  }

  /**
   * Set monsoon intensity multiplier
   */
  setMonsoonIntensityMultiplier(multiplier) {
    if (!this.isDevelopmentMode) return false;

    if (multiplier < 0.1 || multiplier > 5) {
      console.warn('ModelOverrideService: Monsoon intensity multiplier must be between 0.1 and 5');
      return false;
    }

    this.overrides.monsoonIntensityMultiplier = multiplier;
    console.log(`🌀 Monsoon intensity multiplier set: ${multiplier}x`);
    return true;
  }

  /**
   * Set river discharge threshold multiplier
   */
  setRiverDischargeThreshold(multiplier) {
    if (!this.isDevelopmentMode) return false;

    if (multiplier < 0.1 || multiplier > 5) {
      console.warn('ModelOverrideService: River discharge threshold must be between 0.1 and 5');
      return false;
    }

    this.overrides.riverDischargeThreshold = multiplier;
    console.log(`🏞️ River discharge threshold set: ${multiplier}x`);
    return true;
  }

  /**
   * Set selected model type
   */
  setModelType(modelType) {
    if (!this.isDevelopmentMode) return false;

    const validTypes = ['embedded', 'statistical', 'custom'];
    if (!validTypes.includes(modelType)) {
      console.warn('ModelOverrideService: Invalid model type. Must be embedded, statistical, or custom');
      return false;
    }

    this.overrides.selectedModel = modelType;
    console.log(`🤖 Model type set: ${modelType}`);
    return true;
  }

  /**
   * Set custom model configuration
   */
  setCustomModelConfig(config) {
    if (!this.isDevelopmentMode) return false;

    try {
      // Validate config structure
      if (!config || typeof config !== 'object') {
        throw new Error('Config must be an object');
      }

      if (!config.model_version || !config.features_count) {
        throw new Error('Config must have model_version and features_count');
      }

      this.overrides.customModelConfig = config;
      console.log(`📦 Custom model config loaded: v${config.model_version}, ${config.features_count} features`);
      return true;

    } catch (error) {
      console.error('ModelOverrideService: Invalid custom model config:', error.message);
      return false;
    }
  }

  /**
   * Apply overrides to weather data before ML processing
   */
  applyWeatherDataOverrides(weatherData) {
    if (!this.isOverrideActive() || !weatherData) {
      return weatherData;
    }

    const modifiedData = { ...weatherData };
    let modificationsApplied = [];

    // Apply rainfall multiplier
    if (this.overrides.rainfallMultiplier !== 1.0) {
      if (modifiedData.features) {
        if (modifiedData.features.precipitation_sum) {
          modifiedData.features.precipitation_sum *= this.overrides.rainfallMultiplier;
        }
        if (modifiedData.features.rain_sum) {
          modifiedData.features.rain_sum *= this.overrides.rainfallMultiplier;
        }
        if (modifiedData.features.rainfall_intensity) {
          modifiedData.features.rainfall_intensity *= this.overrides.rainfallMultiplier;
        }
      }
      modificationsApplied.push(`rainfall×${this.overrides.rainfallMultiplier}`);
    }

    // Apply monsoon intensity multiplier
    if (this.overrides.monsoonIntensityMultiplier !== 1.0) {
      if (modifiedData.monsoon_info && modifiedData.monsoon_info.intensity) {
        modifiedData.monsoon_info.intensity *= this.overrides.monsoonIntensityMultiplier;
      }
      modificationsApplied.push(`monsoon×${this.overrides.monsoonIntensityMultiplier}`);
    }

    // Apply river discharge threshold
    if (this.overrides.riverDischargeThreshold !== 1.0) {
      if (modifiedData.features && modifiedData.features.river_discharge) {
        modifiedData.features.river_discharge *= this.overrides.riverDischargeThreshold;
      }
      modificationsApplied.push(`river×${this.overrides.riverDischargeThreshold}`);
    }

    if (modificationsApplied.length > 0) {
      console.log(`🔧 Weather data overrides applied: ${modificationsApplied.join(', ')}`);
    }

    return modifiedData;
  }

  /**
   * Apply state risk multiplier override
   */
  applyStateRiskOverride(originalMultiplier, state) {
    if (!this.isOverrideActive() || this.overrides.stateRiskMultiplier === null) {
      return originalMultiplier;
    }

    console.log(`🗺️ State risk override: ${originalMultiplier} → ${this.overrides.stateRiskMultiplier} for ${state}`);
    return this.overrides.stateRiskMultiplier;
  }

  /**
   * Get current override status for display
   */
  getOverrideStatus() {
    if (!this.isOverrideActive()) {
      return { active: false, overrides: [] };
    }

    const activeOverrides = [];

    if (this.overrides.manualProbabilityEnabled) {
      activeOverrides.push({
        type: 'Manual Probability',
        value: `${(this.overrides.manualProbability * 100).toFixed(1)}%`
      });
    }

    if (this.overrides.selectedModel !== 'embedded') {
      activeOverrides.push({
        type: 'Model Type',
        value: this.overrides.selectedModel
      });
    }

    if (this.overrides.rainfallMultiplier !== 1.0) {
      activeOverrides.push({
        type: 'Rainfall Multiplier',
        value: `${this.overrides.rainfallMultiplier}x`
      });
    }

    if (this.overrides.stateRiskMultiplier !== null) {
      activeOverrides.push({
        type: 'State Risk Multiplier',
        value: `${this.overrides.stateRiskMultiplier}x`
      });
    }

    if (this.overrides.monsoonIntensityMultiplier !== 1.0) {
      activeOverrides.push({
        type: 'Monsoon Intensity',
        value: `${this.overrides.monsoonIntensityMultiplier}x`
      });
    }

    if (this.overrides.riverDischargeThreshold !== 1.0) {
      activeOverrides.push({
        type: 'River Discharge',
        value: `${this.overrides.riverDischargeThreshold}x`
      });
    }

    return {
      active: true,
      overrides: activeOverrides,
      totalCount: activeOverrides.length
    };
  }

  /**
   * Get all current override values for UI
   */
  getAllOverrides() {
    return { ...this.overrides };
  }
}

// Export singleton instance
const modelOverrideService = new ModelOverrideService();
export default modelOverrideService;