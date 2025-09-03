# Developer Mode - Testing Tool

This is a comprehensive testing tool for flood probability alerts.

## 🛠️ Features

### Probability Testing Tab
- **Flood Probability Slider**: Test alerts with 10%-95% flood probability
- **Timeframe Selection**: Test different flood timing (immediate to 72 hours)
- **Location Selection**: Test with 8 Malaysian cities
- **Real-time Generation**: Generate alerts with custom parameters

### Scenarios Tab  
- **5 Predefined Scenarios**: 
  - Immediate Heavy Rain
  - Urgent 6-Hour Warning  
  - Warning 12-Hour Forecast
  - Advisory 24-Hour Watch
  - Multiple Rain Periods

### Settings Tab
- **ML Alert Configuration**: Enable/disable ML-based alerts
- **Threshold Control**: Set ML alert threshold (50%-95%)
- **Alert History**: View last 10 test alerts generated
- **Clear Function**: Remove all test alerts

## 📱 How to Access

1. **Development Mode Only**: Button only appears in `__DEV__` builds
2. **HomeScreen Location**: Orange "Developer Mode" button appears after "View Details"
3. **Safety Confirmation**: Shows warning dialog before opening

## 🧪 How to Use

### Generate Probability-Based Alert
1. Open Developer Mode
2. Go to "Probability" tab
3. Select location, set probability (10%-95%), choose timeframe
4. Tap "Generate Flood Alert"
5. Alert will appear in main app interface

### Test Predefined Scenarios
1. Go to "Scenarios" tab
2. Tap any scenario card
3. Scenario will execute immediately

### Configure ML Alerts
1. Go to "Settings" tab
2. Toggle ML alerts on/off
3. Adjust threshold slider
4. Changes apply immediately to alert system

## 🗑️ How to Remove (Clean Cleanup)

When testing is complete, remove these files:

### Files to Delete:
```
/components/DeveloperMode.js
/components/DeveloperModeButton.js
DEVELOPER_MODE_README.md (this file)
```

### Code Changes:
```javascript
// In App.js, remove this line:
import DeveloperModeButton from './components/DeveloperModeButton';

// In App.js, remove these lines:
{/* Developer Mode Button - Only visible in development */}
<DeveloperModeButton onAlertGenerated={handleFloodAlert} />
```

That's it! No other code needs to be touched. The existing functional code remains completely untouched.

## 🔧 Technical Details

- **Dependencies**: Uses existing `@react-native-community/slider` and `@react-native-picker/picker`
- **Integration**: Minimal integration with existing `handleFloodAlert` callback
- **Isolation**: Completely self-contained, no modifications to core functionality
- **Safety**: Only visible in development builds (`__DEV__` check)

## 📝 Usage Tips

1. **Test Systematically**: Start with low probabilities, work up to high
2. **Check Alert History**: Verify all generated alerts in Settings tab
3. **Clear Between Tests**: Use "Clear All" to reset alert state
4. **Monitor Console**: Check console for detailed generation logs
5. **Test ML Thresholds**: Try different thresholds to see alert triggering behavior

The tool provides comprehensive testing for all aspects of the flood alert system while maintaining clean separation from production code.