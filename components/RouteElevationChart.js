// components/RouteElevationChart.js
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 80; // Account for margins
const CHART_HEIGHT = 150;
const CHART_PADDING = { top: 10, right: 10, bottom: 25, left: 40 };

/**
 * RouteElevationChart Component
 *
 * Displays an elevation profile chart for a route with:
 * - Line graph showing elevation changes
 * - Color-coded sections (low-lying areas in red)
 * - Elevation markers
 * - Distance markers
 */
const RouteElevationChart = ({ route, elevationThreshold = 10 }) => {
  if (!route || !route.geometry || !route.geometry.coordinates) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No elevation data available</Text>
      </View>
    );
  }

  const coordinates = route.geometry.coordinates;

  // Extract elevation data (3rd element in each coordinate array)
  const elevations = coordinates
    .map(coord => coord[2])
    .filter(elev => elev !== undefined && elev !== null);

  if (elevations.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No elevation data available</Text>
      </View>
    );
  }

  // Calculate chart dimensions
  const chartInnerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const chartInnerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  // Calculate elevation range
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = maxElevation - minElevation;

  // Add padding to elevation range for better visualization
  const paddedMin = Math.max(0, minElevation - elevationRange * 0.1);
  const paddedMax = maxElevation + elevationRange * 0.1;
  const paddedRange = paddedMax - paddedMin;

  // Scale functions
  const scaleX = (index) => {
    return CHART_PADDING.left + (index / (elevations.length - 1)) * chartInnerWidth;
  };

  const scaleY = (elevation) => {
    const normalized = (elevation - paddedMin) / paddedRange;
    return CHART_PADDING.top + chartInnerHeight - (normalized * chartInnerHeight);
  };

  // Generate path data for elevation line
  const pathData = elevations.map((elev, index) => {
    const x = scaleX(index);
    const y = scaleY(elev);
    return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  // Generate path data for fill area under the line
  const fillPathData = [
    pathData,
    `L ${scaleX(elevations.length - 1)} ${CHART_PADDING.top + chartInnerHeight}`,
    `L ${scaleX(0)} ${CHART_PADDING.top + chartInnerHeight}`,
    'Z'
  ].join(' ');

  // Generate elevation markers (y-axis)
  const elevationMarkers = [];
  const markerCount = 4;
  for (let i = 0; i <= markerCount; i++) {
    const elevation = paddedMin + (paddedRange * i / markerCount);
    const y = scaleY(elevation);
    elevationMarkers.push({
      y,
      label: `${Math.round(elevation)}m`
    });
  }

  // Generate distance markers (x-axis) - show 5 markers
  const distanceMarkers = [];
  const totalDistance = route.distance || 0; // in km
  const distanceMarkerCount = Math.min(5, elevations.length);

  for (let i = 0; i < distanceMarkerCount; i++) {
    const index = Math.floor((elevations.length - 1) * i / (distanceMarkerCount - 1));
    const x = scaleX(index);
    const distance = (totalDistance * i / (distanceMarkerCount - 1)).toFixed(1);
    distanceMarkers.push({
      x,
      label: `${distance}`
    });
  }

  // Identify low-lying segments for color coding
  const lowLyingSegments = route.lowLyingSegments || [];

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <SvgGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4CAF50" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#4CAF50" stopOpacity="0.1" />
          </SvgGradient>
          <SvgGradient id="lowLyingGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F44336" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#F44336" stopOpacity="0.1" />
          </SvgGradient>
        </Defs>

        {/* Y-axis grid lines and labels */}
        {elevationMarkers.map((marker, index) => (
          <React.Fragment key={`elev-marker-${index}`}>
            <Line
              x1={CHART_PADDING.left}
              y1={marker.y}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y2={marker.y}
              stroke="#E0E0E0"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <SvgText
              x={CHART_PADDING.left - 5}
              y={marker.y + 4}
              fontSize="10"
              fill="#666"
              textAnchor="end"
            >
              {marker.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X-axis distance labels */}
        {distanceMarkers.map((marker, index) => (
          <SvgText
            key={`dist-marker-${index}`}
            x={marker.x}
            y={CHART_HEIGHT - 5}
            fontSize="10"
            fill="#666"
            textAnchor="middle"
          >
            {marker.label}
          </SvgText>
        ))}

        {/* Threshold line (low-lying elevation threshold) */}
        {elevationThreshold >= paddedMin && elevationThreshold <= paddedMax && (
          <React.Fragment>
            <Line
              x1={CHART_PADDING.left}
              y1={scaleY(elevationThreshold)}
              x2={CHART_WIDTH - CHART_PADDING.right}
              y2={scaleY(elevationThreshold)}
              stroke="#FF5722"
              strokeWidth="2"
              strokeDasharray="6,3"
            />
            <SvgText
              x={CHART_WIDTH - CHART_PADDING.right - 5}
              y={scaleY(elevationThreshold) - 5}
              fontSize="9"
              fill="#FF5722"
              textAnchor="end"
              fontWeight="bold"
            >
              Flood threshold
            </SvgText>
          </React.Fragment>
        )}

        {/* Fill area under elevation line */}
        <Path
          d={fillPathData}
          fill="url(#elevationGradient)"
        />

        {/* Highlight low-lying segments */}
        {lowLyingSegments.map((segment, index) => {
          const startX = scaleX(segment.start);
          const endX = scaleX(segment.end);
          const rectWidth = endX - startX;

          return (
            <Rect
              key={`low-segment-${index}`}
              x={startX}
              y={CHART_PADDING.top}
              width={rectWidth}
              height={chartInnerHeight}
              fill="url(#lowLyingGradient)"
            />
          );
        })}

        {/* Elevation line */}
        <Path
          d={pathData}
          stroke="#4CAF50"
          strokeWidth="2.5"
          fill="none"
        />

        {/* Start and end markers */}
        <Circle
          cx={scaleX(0)}
          cy={scaleY(elevations[0])}
          r="4"
          fill="#4CAF50"
          stroke="#fff"
          strokeWidth="2"
        />
        <Circle
          cx={scaleX(elevations.length - 1)}
          cy={scaleY(elevations[elevations.length - 1])}
          r="4"
          fill="#F44336"
          stroke="#fff"
          strokeWidth="2"
        />

        {/* Minimum elevation marker (if below threshold) */}
        {minElevation < elevationThreshold && (
          <Circle
            cx={scaleX(elevations.indexOf(minElevation))}
            cy={scaleY(minElevation)}
            r="5"
            fill="#FF5722"
            stroke="#fff"
            strokeWidth="2"
          />
        )}
      </Svg>

      {/* Chart legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>Safe elevation</Text>
        </View>
        {route.elevationMetrics?.lowLyingPercentage > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>Low-lying area</Text>
          </View>
        )}
      </View>

      {/* Distance label */}
      <Text style={styles.distanceLabel}>Distance (km)</Text>

      {/* Elevation statistics */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>{minElevation.toFixed(1)}m</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg</Text>
          <Text style={styles.statValue}>
            {route.elevationMetrics?.average || 0}m
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>{maxElevation.toFixed(1)}m</Text>
        </View>
        {route.elevationMetrics?.lowLyingPercentage > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: '#F44336' }]}>Low</Text>
            <Text style={[styles.statValue, { color: '#F44336' }]}>
              {route.elevationMetrics.lowLyingPercentage.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginVertical: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 2,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
  distanceLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
});

export default RouteElevationChart;
