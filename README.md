# FloodAid - Comprehensive Flood Preparedness System

FloodAid is a comprehensive flood preparedness and response system designed specifically for Malaysian families, built using React Native and Expo. The app provides AI-based flood predictions, real-time monitoring, and emergency response guidance.

## Features

### ✅ Available Features (Epics 1, 3, 4)

**Epic 1: AI-Based Prediction**
- 24-48 hour advance flood warnings with 75% probability accuracy
- Real-time countdown timer to predicted flood event
- Confidence indicators and risk level assessments
- Location-specific predictions for Malaysian regions

**Epic 3: Live Data Visualization**
- Real-time rainfall and river level monitoring
- Interactive flood hotspot maps with risk visualization
- 24-hour precipitation forecast charts
- Regional flood risk mapping for Malaysia

**Epic 4: Multi-Location Monitoring**
- Track multiple locations (home, work, school, family)
- Custom location labels and management
- Individual risk assessments for each location
- Add/remove locations with persistent storage

### 🚧 Coming Soon (Epics 5-9)

- **Epic 5**: Pre-flood preparedness guides and checklists
- **Epic 6**: Emergency navigation and safe routing
- **Epic 7**: Emergency response guidance and protocols  
- **Epic 8**: Emergency communication and family alerts
- **Epic 9**: Post-flood recovery assistance

## Technology Stack

- **Framework**: React Native 0.72.10 with Expo SDK 49.0.0
- **Navigation**: React Navigation v6 (Bottom Tabs + Stack Navigator)
- **State Management**: React Context API
- **Maps**: React Native Maps with flood hotspot visualization
- **Storage**: AsyncStorage for location persistence
- **UI**: Apple Weather-inspired design with gradients and blur effects
- **Icons**: Expo Vector Icons (Ionicons)

## Project Structure

```
FloodAidApp/
├── App.js                          # Main app with navigation setup
├── package.json                    # Dependencies and scripts
├── context/                        # React Context providers
│   ├── FloodContext.js             # Flood data and predictions
│   ├── LocationContext.js          # Location management
│   └── UserContext.js              # User analytics and preferences
├── screens/                        # Main application screens
│   ├── ForecastScreen.js           # Epic 1: AI predictions
│   ├── LiveDataScreen.js           # Epic 3: Real-time data
│   ├── MyLocationsScreen.js        # Epic 4: Location monitoring
│   ├── MenuScreen.js               # More features navigation
│   └── placeholders/               # Coming soon screens
│       ├── PreparednessScreen.js   # Epic 5 placeholder
│       ├── EmergencyNavigationScreen.js # Epic 6 placeholder
│       ├── EmergencyResponseScreen.js   # Epic 7 placeholder
│       ├── CommunicationScreen.js       # Epic 8 placeholder
│       └── PostFloodScreen.js           # Epic 9 placeholder
├── services/                       # API and external services
│   └── FloodAPI.js                 # Flood prediction API integration
├── utils/                          # Utilities and constants
│   └── constants.js                # App constants and color scheme
└── README.md                       # This file
```

## Installation & Setup

### Prerequisites
- Node.js 16+ installed
- Expo CLI installed globally: `npm install -g @expo/cli`
- iOS Simulator or Android emulator (or physical device with Expo Go)

### Installation Steps

1. **Navigate to the FloodAid app directory**
   ```bash
   cd "D:\Monash\FIT5120\Actual Project\FloodAidApp"
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```
   
   Note: The `--legacy-peer-deps` flag is used to ensure compatibility with the exact dependency versions.

3. **Start the development server**
   ```bash
   npx expo start
   ```

4. **Run on your preferred platform**
   - Press `i` for iOS Simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your physical device

## API Integration

### Current Implementation
- **Mock Data**: App currently uses realistic mock data for demonstration
- **Flood API Service**: Ready for backend integration via `services/FloodAPI.js`
- **Real-time Updates**: Context providers support live data refresh

### Backend Integration Ready
The app is designed to integrate with the existing ML prediction system:
- `D:\Monash\FIT5120\Actual Project\Datasets\simple_flood_api.py`
- `D:\Monash\FIT5120\Actual Project\Datasets\coordinate_flood_predictor.py`

## Key Components

### Context Providers

**FloodContext**: Manages flood predictions, countdown timers, and weather data
```javascript
// Key state
currentRisk: { probability: 0.75, riskLevel: 'High', timeToFlood: {...} }
hotspots: [...] // Map markers for flood risk areas
precipitationForecast: [...] // 24-hour forecast data
```

**LocationContext**: Handles multi-location monitoring with AsyncStorage persistence
```javascript
// Sample locations
monitoredLocations: [
  { name: "Home", subtitle: "Puchong", riskLevel: "High Risk", ... },
  { name: "Workplace", subtitle: "KL Sentral", riskLevel: "Moderate Risk", ... }
]
```

**UserContext**: Tracks feature usage and user analytics
```javascript
// Usage tracking for all major features
logFeatureUsage('forecast'), logFeatureUsage('live_data'), etc.
```

### Core Screens

**ForecastScreen**: Apple Weather-styled interface with:
- Real-time flood countdown timer
- 75% flood probability indicator  
- Weather summary cards with blur effects
- Pull-to-refresh functionality

**LiveDataScreen**: Live data visualization featuring:
- Interactive map with flood hotspots
- Real-time rainfall/river level monitoring
- 24-hour precipitation forecast charts
- Regional flood risk legend

**MyLocationsScreen**: Location management with:
- Add/remove locations modal interface
- Individual risk assessments per location
- AsyncStorage persistence
- Empty state handling

## Design Philosophy

### Apple Weather Inspired
- **Visual Design**: Gradient backgrounds, blur effects, rounded corners
- **Typography**: Clear hierarchy with bold titles and secondary text
- **Color Scheme**: Blue primary colors with contextual risk colors
- **Interactions**: Smooth animations and intuitive gesture controls

### Malaysian Context
- **Location Focus**: Optimized for Malaysian addresses and regions
- **Risk Communication**: Clear, non-technical language for flood risks  
- **Family-Centered**: Multi-location monitoring for family safety
- **Cultural Sensitivity**: Appropriate messaging and emergency guidance

## Target User: Alice Chen Persona

**Background**: 34-year-old administrative coordinator and mother of two (ages 8, 12) living in Puchong, Selangor.

**How FloodAid Helps Alice**:
- **Location-Specific Alerts**: Puchong-specific flood predictions vs generic alerts
- **Family Coordination**: Monitor home, children's schools, workplace simultaneously
- **Preparation Guidance**: Step-by-step checklists with time estimates
- **Peace of Mind**: Reliable, advance warning system for family safety

## Dependencies

### Core Dependencies
```json
{
  "expo": "~49.0.21",
  "react": "18.2.0",
  "react-native": "0.72.10",
  "@react-navigation/native": "^6.1.9",
  "@react-navigation/bottom-tabs": "^6.5.11",
  "@react-navigation/stack": "^6.3.20",
  "expo-linear-gradient": "~12.3.0",
  "expo-blur": "~12.4.1",
  "react-native-maps": "1.7.1",
  "@expo/vector-icons": "^13.0.0",
  "@react-native-async-storage/async-storage": "1.18.2"
}
```

### Development Dependencies
```json
{
  "@babel/core": "^7.20.0"
}
```

## Testing

### Manual Testing Checklist
- [ ] App launches successfully on iOS/Android
- [ ] Bottom tab navigation works across all screens
- [ ] Countdown timer updates in real-time on ForecastScreen
- [ ] Map displays flood hotspots on LiveDataScreen  
- [ ] Add/remove locations functionality in MyLocationsScreen
- [ ] Placeholder screens accessible from MenuScreen
- [ ] Pull-to-refresh updates data appropriately
- [ ] AsyncStorage persists location data across app restarts

## Future Development

### Phase 1 Enhancements
- Backend API integration with ML prediction system
- Real-time push notifications for flood alerts
- GPS-based location detection and auto-addition
- Enhanced map functionality with satellite imagery

### Phase 2 Features (Epics 5-9)
- Complete implementation of preparedness guides
- Emergency navigation with real-time routing
- Emergency response protocols and first aid guidance
- Family communication system with automated alerts
- Post-flood recovery assistance and health monitoring

### Phase 3 Advanced Features
- Offline functionality for emergency situations
- Community features for neighborhood alerts
- Integration with Malaysian emergency services
- Advanced personalization based on user behavior

## Contributing

This project follows the existing codebase patterns from the ClimateWatchMalaysia app. When contributing:

1. **Follow Existing Patterns**: Use the same component structure and styling approach
2. **Context-Based State**: Extend existing context providers rather than creating new ones
3. **Apple Weather Style**: Maintain the gradient-heavy, blur-effect visual design
4. **Malaysian Focus**: Ensure all features are relevant to Malaysian flood scenarios

## Support

For technical issues or feature requests:
1. Check existing documentation in `CLAUDE.md` files
2. Review the Design Report V2 for comprehensive specifications
3. Test against the Alice Chen persona scenarios
4. Ensure compatibility with existing ML backend system

---

**FloodAid** - Empowering Malaysian families with intelligent flood preparedness technology.