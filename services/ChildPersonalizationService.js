/**
 * ChildPersonalizationService
 *
 * Provides smart personalization features for child-specific emergency preparedness
 * Automatically categorizes children by age groups and provides relevant recommendations
 */

class ChildPersonalizationService {

  /**
   * Categorize children by age groups based on their ages
   * @param {Array} childrenAges - Array of children's ages
   * @returns {Object} Age group flags
   */
  static categorizeChildrenByAge(childrenAges) {
    if (!Array.isArray(childrenAges) || childrenAges.length === 0) {
      return {
        hasInfants: false,
        hasToddlers: false,
        hasSchoolChildren: false,
        hasTeens: false
      };
    }

    return {
      hasInfants: childrenAges.some(age => age < 2),
      hasToddlers: childrenAges.some(age => age >= 2 && age <= 5),
      hasSchoolChildren: childrenAges.some(age => age >= 6 && age <= 12),
      hasTeens: childrenAges.some(age => age >= 13 && age <= 17)
    };
  }

  /**
   * Generate child details with default settings based on ages
   * @param {Array} childrenAges - Array of children's ages
   * @returns {Array} Array of child detail objects
   */
  static generateChildDetails(childrenAges) {
    if (!Array.isArray(childrenAges)) {
      return [];
    }

    return childrenAges.map(age => ({
      age,
      name: '',
      needsComfortItems: age <= 8, // Children 8 and under typically need comfort items
      hasSpecialNeeds: false
    }));
  }

  /**
   * Update user profile with smart child categorization
   * @param {Object} userProfile - Current user profile
   * @param {Function} updateUserProfile - Function to update the profile
   */
  static updateChildCategorization(userProfile, updateUserProfile) {
    const { childrenAges = [], hasChildren } = userProfile;

    if (!hasChildren || childrenAges.length === 0) {
      // Clear child flags if no children
      updateUserProfile({
        hasInfants: false,
        hasToddlers: false,
        hasSchoolChildren: false,
        hasTeens: false,
        childrenDetails: []
      });
      return;
    }

    const ageCategories = this.categorizeChildrenByAge(childrenAges);
    const childrenDetails = this.generateChildDetails(childrenAges);

    updateUserProfile({
      ...ageCategories,
      childrenDetails
    });
  }

  /**
   * Get child-specific emergency kit recommendations
   * @param {Object} userProfile - User profile with child information
   * @returns {Array} Array of recommendation objects
   */
  static getChildKitRecommendations(userProfile) {
    const { hasInfants, hasToddlers, hasSchoolChildren, hasTeens, childrenDetails = [] } = userProfile;
    const recommendations = [];

    if (hasInfants) {
      recommendations.push({
        category: 'Infant Care',
        priority: 'HIGH',
        items: [
          'Formula and bottles (3-day supply)',
          'Diapers and wipes (72 hours worth)',
          'Baby food and snacks',
          'Pacifiers and comfort items',
          'Portable crib or travel bed'
        ],
        estimatedTime: '45 minutes',
        notes: 'Infants require specialized supplies that cannot be substituted'
      });
    }

    if (hasToddlers) {
      recommendations.push({
        category: 'Toddler Safety',
        priority: 'HIGH',
        items: [
          'Child-safe snacks and drinks',
          'Extra clothes and shoes',
          'Favorite comfort items',
          'Simple entertainment (books, small toys)',
          'Child-proof safety items'
        ],
        estimatedTime: '30 minutes',
        notes: 'Toddlers need familiar items to reduce anxiety during emergencies'
      });
    }

    if (hasSchoolChildren) {
      recommendations.push({
        category: 'School-Age Children',
        priority: 'MEDIUM',
        items: [
          'School emergency contact information',
          'Activities and books',
          'Comfort items if needed',
          'Child identification cards',
          'Emergency instruction cards'
        ],
        estimatedTime: '25 minutes',
        notes: 'School children can help with simple emergency tasks'
      });
    }

    if (hasTeens) {
      recommendations.push({
        category: 'Teen Preparedness',
        priority: 'MEDIUM',
        items: [
          'Personal care items',
          'Mobile device chargers',
          'Emergency contact cards',
          'Age-appropriate responsibilities',
          'Entertainment items'
        ],
        estimatedTime: '20 minutes',
        notes: 'Teens can take on emergency responsibilities and help with younger children'
      });
    }

    // Add comfort items recommendation if any child needs them
    const needsComfortItems = childrenDetails.some(child => child.needsComfortItems);
    if (needsComfortItems) {
      recommendations.push({
        category: 'Comfort & Stress Relief',
        priority: 'MEDIUM',
        items: [
          'Favorite toys or stuffed animals',
          'Comfort blankets',
          'Family photos',
          'Familiar snacks',
          'Calming activities (coloring books, puzzles)'
        ],
        estimatedTime: '15 minutes',
        notes: 'Comfort items are crucial for reducing child anxiety during emergencies'
      });
    }

    return recommendations;
  }

  /**
   * Get child-specific preparation guidelines
   * @param {Object} userProfile - User profile with child information
   * @returns {Array} Array of preparation guideline objects
   */
  static getChildPreparationGuidelines(userProfile) {
    const { hasInfants, hasToddlers, hasSchoolChildren, hasTeens, familySize } = userProfile;
    const guidelines = [];

    // Always include general child safety if has children
    if (userProfile.hasChildren) {
      guidelines.push({
        title: 'Child Safety Planning',
        priority: 'HIGH',
        estimatedTime: '20 minutes',
        tasks: [
          'Create identification cards for each child',
          'Practice evacuation routes with children',
          'Teach emergency contact numbers',
          'Plan comfort measures for stress relief',
          'Establish child-specific meeting points'
        ]
      });
    }

    if (hasSchoolChildren || hasTeens) {
      guidelines.push({
        title: 'School & Childcare Coordination',
        priority: 'HIGH',
        estimatedTime: '15 minutes',
        tasks: [
          'Update emergency contacts at schools',
          'Review pickup authorization lists',
          'Share family emergency plan with schools',
          'Confirm school emergency procedures',
          'Establish communication protocols'
        ]
      });
    }

    if (hasInfants || hasToddlers) {
      guidelines.push({
        title: 'Infant & Toddler Preparation',
        priority: 'HIGH',
        estimatedTime: '25 minutes',
        tasks: [
          'Organize 72-hour infant supply kit',
          'Prepare portable sleeping arrangements',
          'Pack comfort and calming items',
          'Plan for feeding schedules',
          'Prepare for temperature regulation'
        ]
      });
    }

    return guidelines;
  }

  /**
   * Calculate child-adjusted preparation time
   * @param {number} baseTime - Base preparation time in minutes
   * @param {Object} userProfile - User profile with child information
   * @returns {number} Adjusted time in minutes
   */
  static calculateChildAdjustedTime(baseTime, userProfile) {
    const { hasChildren, childrenAges = [] } = userProfile;

    if (!hasChildren || childrenAges.length === 0) {
      return baseTime;
    }

    let timeMultiplier = 1;

    // Add time for each child age group
    if (childrenAges.some(age => age < 2)) {
      timeMultiplier += 0.5; // Infants add 50% more time
    }

    if (childrenAges.some(age => age >= 2 && age <= 5)) {
      timeMultiplier += 0.3; // Toddlers add 30% more time
    }

    if (childrenAges.some(age => age >= 6 && age <= 12)) {
      timeMultiplier += 0.2; // School children add 20% more time
    }

    // Cap the multiplier at 2.0 (100% increase maximum)
    timeMultiplier = Math.min(timeMultiplier, 2.0);

    return Math.round(baseTime * timeMultiplier);
  }

  /**
   * Get age-appropriate emergency instructions for children
   * @param {number} childAge - Age of the child
   * @returns {Array} Array of age-appropriate instructions
   */
  static getAgeAppropriateInstructions(childAge) {
    if (childAge < 2) {
      return [
        'Keep infant with adult at all times',
        'Ensure feeding supplies are accessible',
        'Monitor for signs of distress'
      ];
    } else if (childAge <= 5) {
      return [
        'Stay with mom/dad at all times',
        'Hold grown-up\'s hand when moving',
        'Carry your special toy',
        'Tell grown-up if you\'re scared'
      ];
    } else if (childAge <= 12) {
      return [
        'Stay calm and listen to adults',
        'Know your family meeting place',
        'Remember emergency phone numbers',
        'Help carry light emergency supplies',
        'Stay with family group'
      ];
    } else {
      return [
        'Help younger family members stay calm',
        'Assist with emergency preparations',
        'Know multiple emergency contact methods',
        'Be prepared to take responsibility if needed',
        'Help communicate with emergency services'
      ];
    }
  }

  /**
   * Validate child profile data
   * @param {Object} childrenDetails - Array of child detail objects
   * @returns {Object} Validation result with errors if any
   */
  static validateChildProfile(childrenDetails) {
    const errors = [];

    if (!Array.isArray(childrenDetails)) {
      errors.push('Children details must be an array');
      return { isValid: false, errors };
    }

    childrenDetails.forEach((child, index) => {
      if (typeof child.age !== 'number' || child.age < 0 || child.age > 18) {
        errors.push(`Child ${index + 1}: Age must be between 0 and 18`);
      }

      if (typeof child.needsComfortItems !== 'boolean') {
        errors.push(`Child ${index + 1}: needsComfortItems must be true or false`);
      }

      if (typeof child.hasSpecialNeeds !== 'boolean') {
        errors.push(`Child ${index + 1}: hasSpecialNeeds must be true or false`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default ChildPersonalizationService;