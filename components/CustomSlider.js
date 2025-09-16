import React, { useState, useRef } from 'react';
import {
  View,
  PanResponder,
  Dimensions,
  StyleSheet,
  Animated
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const CustomSlider = ({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  minimumTrackTintColor = '#3478f6',
  maximumTrackTintColor = '#d3d3d3',
  thumbStyle = {},
  disabled = false,
  style = {},
  ...props
}) => {
  const [sliderWidth, setSliderWidth] = useState(250);
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Calculate thumb position based on value
  const normalizedValue = (value - minimumValue) / (maximumValue - minimumValue);
  const thumbPosition = normalizedValue * (sliderWidth - 20); // 20 is thumb width

  // Create PanResponder for touch handling
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,

    onPanResponderGrant: (event) => {
      // Calculate initial position
      const { locationX } = event.nativeEvent;
      const newValue = calculateValueFromPosition(locationX);
      onValueChange && onValueChange(newValue);
    },

    onPanResponderMove: (event) => {
      const { locationX } = event.nativeEvent;
      const newValue = calculateValueFromPosition(locationX);
      onValueChange && onValueChange(newValue);
    },

    onPanResponderRelease: () => {
      // Optional: add haptic feedback here if needed
    },
  });

  const calculateValueFromPosition = (position) => {
    // Ensure position is within bounds
    const clampedPosition = Math.max(0, Math.min(sliderWidth - 20, position - 10));

    // Calculate normalized value (0 to 1)
    const normalizedPosition = clampedPosition / (sliderWidth - 20);

    // Convert to actual value
    const rawValue = minimumValue + normalizedPosition * (maximumValue - minimumValue);

    // Apply step
    if (step > 0) {
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    }

    return Math.max(minimumValue, Math.min(maximumValue, rawValue));
  };

  const onLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    setSliderWidth(width);
  };

  return (
    <View
      style={[styles.container, style, disabled && styles.disabled]}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      {/* Track */}
      <View style={styles.track}>
        {/* Maximum track (background) */}
        <View
          style={[
            styles.trackBackground,
            { backgroundColor: maximumTrackTintColor }
          ]}
        />

        {/* Minimum track (filled portion) */}
        <View
          style={[
            styles.trackFilled,
            {
              backgroundColor: minimumTrackTintColor,
              width: `${normalizedValue * 100}%`
            }
          ]}
        />

        {/* Thumb */}
        <View
          style={[
            styles.thumb,
            {
              left: thumbPosition,
              backgroundColor: minimumTrackTintColor
            },
            thumbStyle,
            disabled && styles.thumbDisabled
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  disabled: {
    opacity: 0.5,
  },

  track: {
    height: 4,
    position: 'relative',
    borderRadius: 2,
  },

  trackBackground: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    width: '100%',
  },

  trackFilled: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
  },

  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: -8,
    backgroundColor: '#3478f6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  thumbDisabled: {
    backgroundColor: '#BDBDBD',
  },
});

export default CustomSlider;