# FloodAid Logging System Guide

## Overview

FloodAid uses a **native logging filter** that prevents console logs from appearing in iOS device logs and Xcode console, while keeping them fully visible in the Metro bundler terminal for development.

## How It Works

### The Problem

In React Native, `console.log()` sends output to two places:
1. **Metro Terminal** - Where developers actually look during development
2. **Native Device Logs** - iOS device logs / Xcode console / Android logcat

iOS device logs can become extremely noisy with hundreds of debug messages, making it hard to find actual issues.

### The Solution

The `nativeLoggingFilter.js` intercepts logs at the **native bridge level**:

```
JavaScript console.log()
    ↓
Metro Terminal captures (✓ ALWAYS VISIBLE)
    ↓
nativeLoggingFilter checks platform
    ↓
iOS: Block transmission ❌ (no device logs)
Android: Allow transmission ✅ (logcat works)
```

### Results

- **Metro Terminal (All Platforms)**: Shows all console logs ✅
- **iOS Device / Xcode Console**: Silent, no logs ✅
- **Android Logcat**: Shows all console logs ✅
- **Production Builds**: Normal logging for error tracking ✅

## For Developers

### Normal Console Usage

You can continue using standard console methods anywhere in the codebase:

```javascript
console.log('Debug message');       // Shows in Metro, not iOS device
console.warn('Warning message');    // Shows in Metro, not iOS device
console.error('Error message');     // Shows in Metro, not iOS device
console.info('Info message');       // Shows in Metro, not iOS device
```

**Where you'll see these:**
- ✅ Metro terminal (always)
- ❌ iOS device logs / Xcode console (filtered out)
- ✅ Android logcat (normal behavior)

### Using the Logger Utility (Optional)

For cleaner code, you can use the `Logger` utility:

```javascript
import Logger from './utils/Logger';

Logger.log('Debug message');       // Platform-aware logging
Logger.warn('Warning message');    // Platform-aware logging
Logger.error('Error message');     // Platform-aware logging
Logger.always('Critical message'); // Always shows everywhere
```

## Temporarily Enabling iOS Device Logs

If you need to debug native iOS issues and want to see logs in Xcode console:

### Method 1: Runtime Toggle

```javascript
import { enableIOSNativeLogging, disableIOSNativeLogging } from './utils/nativeLoggingFilter';

// Temporarily enable iOS device logging
enableIOSNativeLogging();

// Your debugging code here
console.log('This will now show in Xcode console');

// Re-disable when done
disableIOSNativeLogging();
```

### Method 2: Comment Out Filter

In `App.js`, temporarily comment out the import:

```javascript
// import './utils/nativeLoggingFilter';  // Disabled for debugging
```

Restart the app - all logs will now appear in iOS device logs.

### Method 3: Check Status

```javascript
import { isIOSNativeLoggingDisabled } from './utils/nativeLoggingFilter';

console.log('iOS logging disabled:', isIOSNativeLoggingDisabled());
```

## File Structure

```
FloodAidApp/
├── utils/
│   ├── nativeLoggingFilter.js  # Native bridge interceptor
│   └── Logger.js               # Optional smart logging utility
└── App.js                      # Applies filter on line 2
```

## Technical Details

### How React Native Logging Works

1. **JavaScript calls `console.log()`**
2. **Metro intercepts and displays** (terminal output)
3. **React Native calls `global.nativeLoggingHook`**
4. **Our filter intercepts here** ⬅️ This is where we block iOS
5. **Native platform receives log** (or doesn't, if blocked)
6. **Platform logging system displays** (Xcode / logcat)

### Filter Implementation

```javascript
// nativeLoggingFilter.js
global.nativeLoggingHook = (level, ...args) => {
  if (Platform.OS === 'ios') {
    return; // Block - don't send to iOS native
  }

  // Allow for Android
  if (originalNativeLoggingHook) {
    originalNativeLoggingHook(level, ...args);
  }
};
```

### Why Metro Terminal Still Shows Logs

Metro captures console output **before** it reaches the native bridge. Our filter operates **at** the native bridge, so Metro always sees the logs.

```
console.log()
    ↓
[Metro captures HERE] ← Always visible
    ↓
[Filter blocks HERE] ← iOS only
    ↓
Native device logs
```

## Verification

### Check It's Working

1. **Run on iOS device/simulator**
2. **Check Metro terminal**: Should see:
   ```
   📱 [Native Logging Filter] iOS device logging disabled - logs visible in Metro terminal only
   ```
3. **Open Xcode Console** (Debug > Console): Should be silent
4. **Metro terminal**: Should show all your console.log statements

### Run on Android

1. **Run on Android device/emulator**
2. **Check Metro terminal**: Should see:
   ```
   📱 [Native Logging Filter] Native logging enabled for android
   ```
3. **Run `adb logcat`**: Should see console logs
4. **Metro terminal**: Should show all your console.log statements

## Best Practices

### 1. Use Metro Terminal for Development

The Metro terminal is your primary debugging tool:

```bash
# Metro terminal shows everything
expo start
# or
npm start
```

### 2. Don't Rely on Xcode Console

During normal development, don't open Xcode console. Use Metro terminal instead.

### 3. Android Logcat Still Works

For Android-specific debugging:

```bash
adb logcat | grep -i "ReactNativeJS"
```

### 4. Production Logging Unaffected

In production builds (`__DEV__ === false`), the filter doesn't apply and native error tracking works normally.

### 5. Critical Logs

For logs that must appear everywhere (including iOS device):

```javascript
import Logger from './utils/Logger';
Logger.always('CRITICAL: Database connection failed');
```

## Troubleshooting

### Logs Not Appearing in Metro Terminal

**Problem**: No logs in Metro terminal
**Solution**:
1. Check Metro is running (`expo start` or `npm start`)
2. Ensure you're looking at the correct terminal window
3. Try clearing Metro cache: `expo start -c`

### Logs Still Appearing in Xcode Console

**Problem**: iOS device logs still showing
**Solution**:
1. Verify `nativeLoggingFilter.js` is imported first in `App.js`
2. Check you see the filter activation message in Metro
3. Restart the app completely
4. Clear build: `expo run:ios --clear`

### Need iOS Device Logs Temporarily

**Problem**: Debugging native iOS issue, need Xcode console
**Solution**: Use `enableIOSNativeLogging()` as shown above

### Android Logcat Not Working

**Problem**: No logs in Android logcat
**Solution**: This is likely an Android setup issue, not the filter. The filter allows Android logs through normally.

## Statistics

- **Total Console Statements**: 998 across 63 files
- **Impact**: All automatically work with filter
- **Refactoring Required**: None
- **Performance**: Negligible (single if-check per log)

## Comparison: Before vs After

### Before (Without Filter)

**iOS:**
- Metro Terminal: ✅ Shows all logs
- Xcode Console: ✅ Shows all logs (noisy, cluttered)

**Android:**
- Metro Terminal: ✅ Shows all logs
- Android Logcat: ✅ Shows all logs

### After (With Filter)

**iOS:**
- Metro Terminal: ✅ Shows all logs (no change)
- Xcode Console: ❌ Silent (clean)

**Android:**
- Metro Terminal: ✅ Shows all logs (no change)
- Android Logcat: ✅ Shows all logs (no change)

## Migration Guide

If you have existing code that expects iOS device logs:

```javascript
// Old approach - relied on Xcode console
console.log('Check Xcode console for this');

// New approach - check Metro terminal instead
console.log('Check Metro terminal for this');
```

No code changes needed - just change where you look!

## Performance Impact

The native logging filter has minimal performance impact:
- **Single platform check per log**: `if (Platform.OS === 'ios')`
- **No string processing**: Logs are blocked, not filtered
- **Metro terminal unaffected**: Logs never processed twice

## Known Limitations

### 1. Xcode Native Logs Still Work

Native iOS logs (from Objective-C/Swift code) are unaffected:
```objective-c
NSLog(@"This still appears in Xcode console");
```

Only JavaScript console logs are filtered.

### 2. Production Builds Unaffected

In production, the filter doesn't apply. This is intentional for error tracking.

### 3. Expo Go May Differ

If using Expo Go (not recommended for this project), behavior may vary. The filter is designed for development builds.

## Support

### Common Questions

**Q: Can I see iOS device logs when needed?**
A: Yes, use `enableIOSNativeLogging()` temporarily.

**Q: Does this affect production builds?**
A: No, production builds log normally for error tracking.

**Q: Why not just remove console.log statements?**
A: Console logs are essential for development. This solution keeps them useful without the noise.

**Q: Does Metro terminal show real-time logs?**
A: Yes, Metro shows logs in real-time as your app runs.

**Q: Can I disable the filter?**
A: Yes, comment out `import './utils/nativeLoggingFilter';` in App.js.

### Getting Help

1. Check Metro terminal is running
2. Verify filter activation message appears
3. Review this guide
4. Check `utils/nativeLoggingFilter.js` implementation
5. Contact development team

## Future Improvements

Potential enhancements:

1. **Selective filtering**: Filter only debug logs, allow errors
2. **Remote logging**: Send iOS logs to remote service instead
3. **Log levels**: Implement debug/info/warn/error levels
4. **Performance monitoring**: Keep performance logs on iOS

---

**Last Updated**: October 2025
**Version**: 2.0 (Corrected)
**Author**: Development Team
