# Google Maps Setup Checklist for Expo SDK 49

## ✅ Required Steps in Google Cloud Console

### 1. **Enable Required APIs**
Go to [Google Cloud Console API Library](https://console.cloud.google.com/apis/library):

- [ ] **Maps SDK for Android** - CRITICAL for react-native-maps on Android
- [ ] **Maps SDK for iOS** - CRITICAL for react-native-maps on iOS  
- [ ] Maps JavaScript API - Optional (used by Expo Go)
- [ ] Static Maps API - Optional (for static map images)

### 2. **Enable Billing** 
⚠️ **MOST COMMON ISSUE**: Maps won't work without billing enabled

- [ ] Go to [Billing](https://console.cloud.google.com/billing)
- [ ] Enable billing for your project
- [ ] Add a payment method (required even for free tier)
- [ ] Verify billing is active

### 3. **API Key Configuration**
Go to [Credentials](https://console.cloud.google.com/apis/credentials):

- [ ] API Key exists: `AIzaSyC-0v96Q4G43rh8tuLfzTaACTfVA-oSwGM`
- [ ] **API Restrictions**: Select "Restrict key" and choose:
  - Maps SDK for Android ✅
  - Maps SDK for iOS ✅
- [ ] **Application Restrictions**: 
  - For development: "None" or "HTTP referrers"
  - For production: "Android apps" with package name

### 4. **Development vs Production**
**Development (Expo Go)**:
- Works with Maps JavaScript API
- Less restrictions needed

**Production (Built APK/IPA)**:
- Requires Maps SDK for Android/iOS
- May need SHA-1 certificate fingerprint
- Package name restrictions

## 🔧 Testing Your Setup

### Test 1: Static Maps API (Quick verification)
Run: `node test-google-maps.js`
- ✅ Should return HTTP 200 with PNG image
- ❌ If HTTP 403: Check billing or API restrictions

### Test 2: Simple Map Test
Navigate to Hotspots tab in app:
- ✅ Should see map of Selangor with 2 markers (Puchong & KL)
- ❌ If blank/gray: Maps SDK not enabled or billing issue

## 🚨 Common Issues

### **Blank/Gray Map**
- Maps SDK for Android/iOS not enabled
- Billing not enabled
- API key restrictions too strict

### **"API_KEY_INVALID" Error**
- Wrong API key in app.json
- API key doesn't have required permissions

### **"REQUEST_DENIED" Error**  
- API restrictions blocking your app
- Package name doesn't match restrictions

### **Works in Expo Go but not built app**
- Maps SDK for Android/iOS not enabled
- Missing SHA-1 certificate in production

## 📱 Quick Verification Steps

1. **Check Console Errors**: Look for API-related error messages
2. **Network Tab**: Check if maps API calls are being made
3. **Test URL**: Try loading static map URL in browser
4. **Billing Check**: Verify charges appear in Google Cloud billing

## 💰 Billing Information

**Free Tier** (with billing enabled):
- $200 monthly credit
- Maps SDK: $7 per 1000 map loads (after free tier)
- Static Maps: $2 per 1000 requests

**No Billing = No Maps**: Maps will not work at all without billing enabled

## 🔗 Useful Links

- [Google Maps Platform](https://console.cloud.google.com/google/maps-apis)
- [Expo Maps Documentation](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [react-native-maps Troubleshooting](https://github.com/react-native-maps/react-native-maps/blob/master/docs/troubleshooting.md)