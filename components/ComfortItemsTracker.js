import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ComfortItemsTracker = ({ userProfile }) => {
  const [comfortItems, setComfortItems] = useState({});
  const [expanded, setExpanded] = useState(false);

  const { hasChildren, childrenDetails = [] } = userProfile;

  // Define age-appropriate comfort items
  const getAgeAppropriateComfortItems = (age) => {
    if (age < 2) {
      return [
        { id: 'pacifier', name: 'Pacifier', icon: 'ellipse-outline' },
        { id: 'baby_blanket', name: 'Baby blanket', icon: 'bed-outline' },
        { id: 'soft_toy', name: 'Soft toy', icon: 'heart-outline' },
        { id: 'bottle', name: 'Favorite bottle', icon: 'water-outline' }
      ];
    } else if (age <= 5) {
      return [
        { id: 'stuffed_animal', name: 'Stuffed animal', icon: 'heart-outline' },
        { id: 'blanket', name: 'Special blanket', icon: 'bed-outline' },
        { id: 'toy', name: 'Favorite toy', icon: 'cube-outline' },
        { id: 'book', name: 'Picture book', icon: 'book-outline' }
      ];
    } else if (age <= 12) {
      return [
        { id: 'comfort_item', name: 'Comfort item', icon: 'heart-outline' },
        { id: 'book', name: 'Favorite book', icon: 'book-outline' },
        { id: 'game', name: 'Small game/toy', icon: 'game-controller-outline' },
        { id: 'journal', name: 'Journal/notebook', icon: 'create-outline' }
      ];
    } else {
      return [
        { id: 'personal_item', name: 'Personal comfort item', icon: 'heart-outline' },
        { id: 'book', name: 'Book/magazine', icon: 'book-outline' },
        { id: 'music', name: 'Music/headphones', icon: 'musical-note-outline' },
        { id: 'photos', name: 'Family photos', icon: 'images-outline' }
      ];
    }
  };

  // Generate all comfort items for all children
  const getAllComfortItems = () => {
    const allItems = [];
    let itemId = 0;

    childrenDetails.forEach((child, childIndex) => {
      if (child.needsComfortItems) {
        const ageItems = getAgeAppropriateComfortItems(child.age);
        ageItems.forEach(item => {
          allItems.push({
            ...item,
            id: `child_${childIndex}_${item.id}`,
            childIndex,
            childAge: child.age,
            uniqueId: itemId++
          });
        });
      }
    });

    return allItems;
  };

  const allComfortItems = getAllComfortItems();

  useEffect(() => {
    loadComfortItemsProgress();
  }, []);

  const loadComfortItemsProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem('comfortItemsProgress');
      if (stored) {
        setComfortItems(JSON.parse(stored));
      }
    } catch (error) {
      console.log('Error loading comfort items progress:', error);
    }
  };

  const saveComfortItemsProgress = async (newProgress) => {
    try {
      await AsyncStorage.setItem('comfortItemsProgress', JSON.stringify(newProgress));
      setComfortItems(newProgress);
    } catch (error) {
      console.log('Error saving comfort items progress:', error);
    }
  };

  const toggleComfortItem = (itemId) => {
    const newProgress = {
      ...comfortItems,
      [itemId]: !comfortItems[itemId]
    };
    saveComfortItemsProgress(newProgress);
  };

  const completedCount = Object.values(comfortItems).filter(Boolean).length;
  const totalCount = allComfortItems.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Don't show if no children need comfort items
  const childrenNeedingComfort = childrenDetails.filter(child => child.needsComfortItems);
  if (!hasChildren || childrenNeedingComfort.length === 0) {
    return null;
  }

  const renderComfortItem = (item) => {
    const isCompleted = comfortItems[item.id];

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemRow, isCompleted && styles.itemCompleted]}
        onPress={() => toggleComfortItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.itemCheckbox}>
          <Ionicons
            name={isCompleted ? 'checkbox' : 'square-outline'}
            size={20}
            color={isCompleted ? '#FF6B6B' : '#666'}
          />
        </View>
        <View style={styles.itemIcon}>
          <Ionicons name={item.icon} size={18} color="#FF6B6B" />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, isCompleted && styles.itemTitleCompleted]}>
            {item.name}
          </Text>
          <Text style={styles.itemSubtitle}>
            Child {item.childIndex + 1} (age {item.childAge})
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="heart" size={20} color="#FF6B6B" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Comfort Items Checklist</Text>
            <Text style={styles.headerSubtitle}>
              Reduces anxiety for {childrenNeedingComfort.length} {childrenNeedingComfort.length === 1 ? 'child' : 'children'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>{completedCount}/{totalCount}</Text>
            <Text style={styles.progressLabel}>{progressPercentage}%</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#FF6B6B"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#FF9800" />
            <Text style={styles.infoText}>
              Comfort items help children feel secure during stressful emergency situations
            </Text>
          </View>

          <ScrollView
            style={styles.itemsList}
            showsVerticalScrollIndicator={false}
          >
            {allComfortItems.map(renderComfortItem)}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FFE5E5',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF8F8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C53030',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#744C4C',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  progressLabel: {
    fontSize: 10,
    color: '#744C4C',
  },
  content: {
    backgroundColor: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 11,
    color: '#E65100',
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  itemsList: {
    maxHeight: 200,
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  itemCompleted: {
    backgroundColor: '#F8F9FA',
  },
  itemCheckbox: {
    marginRight: 12,
  },
  itemIcon: {
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
  },
  itemTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#666',
  },
});

export default ComfortItemsTracker;