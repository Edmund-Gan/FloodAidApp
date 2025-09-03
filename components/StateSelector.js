/**
 * StateSelector.js - Modern multi-select dropdown for Malaysian states
 * Features search, quick region selection, and clean Material Design interface
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REGIONS } from '../utils/FilterHelpers';

const { width, height } = Dimensions.get('window');

const StateSelector = ({ 
  selectedStates = [], 
  onSelectionChange, 
  availableStates = [],
  style,
  placeholder = "Search state names..."
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const allStates = availableStates;

  // Filter states based on search query
  const filteredStates = useMemo(() => {
    if (!searchQuery.trim()) return allStates;
    
    return allStates.filter(state =>
      state.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allStates]);

  const handleStateToggle = (stateName) => {
    const newSelection = selectedStates.includes(stateName)
      ? selectedStates.filter(s => s !== stateName)
      : [...selectedStates, stateName];
    
    onSelectionChange(newSelection);
  };

  const handleRegionSelect = (regionStates) => {
    // Toggle region: if all states in region are selected, deselect them; otherwise select all
    const allSelected = regionStates.every(state => selectedStates.includes(state));
    
    let newSelection;
    if (allSelected) {
      // Deselect all states in this region
      newSelection = selectedStates.filter(state => !regionStates.includes(state));
    } else {
      // Select all states in this region (and keep existing selections from other regions)
      const otherStates = selectedStates.filter(state => !regionStates.includes(state));
      newSelection = [...otherStates, ...regionStates];
    }
    
    onSelectionChange(newSelection);
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const selectAll = () => {
    onSelectionChange([...allStates]);
  };

  const getDisplayText = () => {
    if (selectedStates.length === 0) {
      return placeholder;
    } else if (selectedStates.length === 1) {
      return selectedStates[0];
    } else if (selectedStates.length <= 3) {
      return selectedStates.join(', ');
    } else {
      return `${selectedStates.length} states selected`;
    }
  };

  const renderQuickRegionButtons = () => (
    <View style={styles.quickRegionsContainer}>
      <Text style={styles.quickRegionsTitle}>Quick Selection:</Text>
      <View style={styles.quickRegionsButtons}>
        {Object.values(REGIONS).map(region => {
          const isRegionSelected = region.states.every(state => selectedStates.includes(state));
          
          return (
            <TouchableOpacity
              key={region.key}
              style={[
                styles.quickRegionButton,
                isRegionSelected && styles.activeQuickRegionButton
              ]}
              onPress={() => handleRegionSelect(region.states)}
            >
              <Text style={[
                styles.quickRegionText,
                isRegionSelected && styles.activeQuickRegionText
              ]}>
                {region.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderStateItem = (stateName) => {
    const isSelected = selectedStates.includes(stateName);
    
    return (
      <TouchableOpacity
        key={stateName}
        style={styles.stateItem}
        onPress={() => handleStateToggle(stateName)}
      >
        <View style={styles.stateItemContent}>
          <Text style={styles.stateName}>{stateName}</Text>
          <View style={[
            styles.checkbox,
            isSelected && styles.checkedCheckbox
          ]}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Selector Button */}
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.selectorContent}>
          <Ionicons 
            name="search" 
            size={16} 
            color="#666" 
            style={styles.selectorIcon} 
          />
          <Text style={[
            styles.selectorText,
            selectedStates.length === 0 && styles.placeholderText
          ]}>
            {getDisplayText()}
          </Text>
          {selectedStates.length > 0 ? (
            <TouchableOpacity onPress={() => onSelectionChange([])} style={styles.clearButton}>
              <Ionicons 
                name="close-circle" 
                size={16} 
                color="#999" 
              />
            </TouchableOpacity>
          ) : (
            <Ionicons 
              name="chevron-down" 
              size={16} 
              color="#666" 
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Select States</Text>
                <Text style={styles.modalSubtitle}>Selected states will appear on the map</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search states..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={selectAll}
              >
                <Text style={styles.actionButtonText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={clearSelection}
              >
                <Text style={styles.actionButtonText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Region Selection */}
            {!searchQuery && renderQuickRegionButtons()}

            {/* States List */}
            <ScrollView style={styles.statesList} showsVerticalScrollIndicator={false}>
              {filteredStates.map(renderStateItem)}
            </ScrollView>

            {/* Selection Summary */}
            <View style={styles.selectionSummary}>
              <Text style={styles.summaryText}>
                {selectedStates.length} of {allStates.length} states selected
              </Text>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectorButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorIcon: {
    marginRight: 8,
  },
  selectorText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  clearButton: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  quickRegionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  quickRegionsTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  quickRegionsButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickRegionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  activeQuickRegionButton: {
    backgroundColor: '#2196F3',
  },
  quickRegionText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  activeQuickRegionText: {
    color: '#fff',
  },
  statesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stateItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  stateItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stateName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  selectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
  },
  doneButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 6,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default StateSelector;