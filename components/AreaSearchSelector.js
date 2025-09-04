/**
 * AreaSearchSelector.js - Enhanced search for districts and states
 * Features: Real-time search, district/state filtering, intuitive UI
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EnhancedFloodDataService from '../services/EnhancedFloodDataService';

const { width, height } = Dimensions.get('window');

const AreaSearchSelector = ({ 
  selectedArea = null, 
  onAreaSelected, 
  style,
  placeholder = "Search districts or states..."
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchIndex, setSearchIndex] = useState({ districts: [], states: [] });

  // Load search index when component mounts
  useEffect(() => {
    loadSearchIndex();
  }, []);

  // Perform search when query changes
  useEffect(() => {
    performSearch();
  }, [searchQuery]);


  const loadSearchIndex = async () => {
    try {
      const data = await EnhancedFloodDataService.loadAllFloodData();
      setSearchIndex(data.searchIndex);
    } catch (error) {
      console.error('Error loading search index:', error);
    }
  };

  const performSearch = async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await EnhancedFloodDataService.searchAreas(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error performing search:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAreaSelect = (area) => {
    onAreaSelected(area);
    setModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const clearSelection = () => {
    onAreaSelected(null);
  };

  const getDisplayText = () => {
    if (selectedArea) {
      return selectedArea.fullName;
    }
    return placeholder;
  };

  const renderSearchResult = (item) => {
    // Ensure we have a unique key and required properties
    const uniqueKey = `${item.type}-${item.fullName || item.name || Math.random()}`;
    
    return (
    <TouchableOpacity
      key={uniqueKey}
      style={styles.resultItem}
      onPress={() => handleAreaSelect(item)}
    >
      <View style={styles.resultContent}>
        <View style={styles.resultMainInfo}>
          <Text style={styles.resultName}>{item.name}</Text>
          {item.type === 'district' && (
            <Text style={styles.resultState}>{item.state}</Text>
          )}
        </View>
        <View style={[
          styles.resultTypeTag,
          item.type === 'state' ? styles.stateTag : styles.districtTag
        ]}>
          <Text style={[
            styles.resultTypeText,
            item.type === 'state' ? styles.stateTagText : styles.districtTagText
          ]}>
            {item.type === 'state' ? 'STATE' : 'DISTRICT'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  const renderPopularAreas = () => {
    // Show some popular/recent search areas when no query
    const popularStates = ['Selangor', 'Kelantan', 'Terengganu', 'Pahang', 'Johor'];
    const popularItems = popularStates
      .filter(state => searchIndex.states.includes(state))
      .map(state => ({
        type: 'state',
        name: state,
        fullName: state,
        state: state,
        searchText: state.toLowerCase()
      }));

    return (
      <View style={styles.popularSection}>
        <Text style={styles.sectionTitle}>Popular States</Text>
        {popularItems.map(renderSearchResult)}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Search Button */}
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.searchContent}>
          <Ionicons 
            name="search" 
            size={16} 
            color="#666" 
            style={styles.searchIcon} 
          />
          <Text style={[
            styles.searchText,
            !selectedArea && styles.placeholderText
          ]}>
            {getDisplayText()}
          </Text>
          {selectedArea ? (
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
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

      {/* Search Modal */}
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
                <Text style={styles.modalTitle}>Search Location</Text>
                <Text style={styles.modalSubtitle}>Find flood events by district or state</Text>
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
              <Ionicons name="search" size={20} color="#666" style={styles.searchInputIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Type district or state name..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#2196F3" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : searchQuery.length >= 2 ? (
                <View style={styles.resultsSection}>
                  <Text style={styles.sectionTitle}>
                    Search Results ({searchResults.length})
                  </Text>
                  {searchResults.length === 0 ? (
                    <View style={styles.noResultsContainer}>
                      <Ionicons name="search" size={32} color="#ccc" />
                      <Text style={styles.noResultsText}>No areas found</Text>
                      <Text style={styles.noResultsSubtext}>
                        Try searching for a different district or state name
                      </Text>
                    </View>
                  ) : (
                    searchResults.map(renderSearchResult)
                  )}
                </View>
              ) : (
                renderPopularAreas()
              )}
            </ScrollView>

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                💡 Search by district (e.g., "Petaling") or state (e.g., "Selangor")
              </Text>
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
  searchButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
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
    height: height * 0.75,
    paddingTop: 20,
    flex: 1,
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
  searchInputIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  resultsSection: {
    marginBottom: 16,
  },
  popularSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  resultContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultMainInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  resultState: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  resultTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  stateTag: {
    backgroundColor: '#E3F2FD',
  },
  districtTag: {
    backgroundColor: '#F3E5F5',
  },
  resultTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  stateTagText: {
    color: '#1976D2',
  },
  districtTagText: {
    color: '#7B1FA2',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
  },
  noResultsSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  instructionsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default AreaSearchSelector;