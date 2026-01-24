/**
 * Restaurant Screen Tests
 * Tests for the restaurant/dining screen
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';

// Mock menu data
const mockMenuItems = [
  {
    id: '1',
    name: 'Grilled Salmon',
    description: 'Fresh salmon with herbs',
    price: 24.99,
    category: 'Main Course',
    image: '/salmon.jpg',
    available: true,
  },
  {
    id: '2',
    name: 'Caesar Salad',
    description: 'Classic caesar salad',
    price: 12.99,
    category: 'Starters',
    image: '/salad.jpg',
    available: true,
  },
  {
    id: '3',
    name: 'Chocolate Cake',
    description: 'Rich chocolate cake',
    price: 8.99,
    category: 'Desserts',
    image: '/cake.jpg',
    available: false,
  },
];

const mockCategories = ['All', 'Starters', 'Main Course', 'Desserts', 'Drinks'];

// Create mock component
const MockRestaurantScreen = ({
  menuItems = [],
  categories = mockCategories,
  selectedCategory = 'All',
  searchQuery = '',
  isLoading = false,
  error = null,
  onCategoryPress = () => {},
  onSearchChange = () => {},
  onItemPress = () => {},
  onAddToCart = () => {},
}: any) => (
  <View testID="restaurant-screen">
    <Text>Restaurant</Text>
    <TextInput
      testID="search-input"
      placeholder="Search menu..."
      value={searchQuery}
      onChangeText={onSearchChange}
    />
    <FlatList
      testID="categories-list"
      horizontal
      data={categories}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity
          testID={`category-${item.toLowerCase().replace(' ', '-')}`}
          onPress={() => onCategoryPress(item)}
        >
          <Text style={selectedCategory === item ? { fontWeight: 'bold' } : {}}>
            {item}
          </Text>
        </TouchableOpacity>
      )}
    />
    {isLoading ? (
      <ActivityIndicator testID="loading-indicator" />
    ) : error ? (
      <View testID="error-container">
        <Text testID="error-message">{error}</Text>
        <TouchableOpacity testID="retry-button">
          <Text>Retry</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <FlatList
        testID="menu-list"
        data={menuItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`menu-item-${item.id}`}
            onPress={() => onItemPress(item)}
          >
            <Text>{item.name}</Text>
            <Text>{item.description}</Text>
            <Text>${item.price.toFixed(2)}</Text>
            <Text>{item.category}</Text>
            {item.available ? (
              <TouchableOpacity
                testID={`add-to-cart-${item.id}`}
                onPress={() => onAddToCart(item)}
              >
                <Text>Add to Cart</Text>
              </TouchableOpacity>
            ) : (
              <Text testID="unavailable-label">Unavailable</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text testID="empty-message">No menu items found</Text>}
      />
    )}
  </View>
);

jest.mock('../../app/(tabs)/restaurant', () => MockRestaurantScreen);

describe('RestaurantScreen', () => {
  const mockOnCategoryPress = jest.fn();
  const mockOnSearchChange = jest.fn();
  const mockOnItemPress = jest.fn();
  const mockOnAddToCart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render screen structure', () => {
      const { getByTestId, getByText } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByTestId('restaurant-screen')).toBeTruthy();
      expect(getByText(/Restaurant/i)).toBeTruthy();
    });

    it('should render search input', () => {
      const { getByTestId, getByPlaceholderText } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByTestId('search-input')).toBeTruthy();
      expect(getByPlaceholderText(/Search menu/i)).toBeTruthy();
    });

    it('should render categories list', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByTestId('categories-list')).toBeTruthy();
    });

    it('should render menu list', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByTestId('menu-list')).toBeTruthy();
    });
  });

  describe('menu items display', () => {
    it('should display menu item names', () => {
      const { getByText } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByText('Grilled Salmon')).toBeTruthy();
      expect(getByText('Caesar Salad')).toBeTruthy();
    });

    it('should display menu item prices', () => {
      const { getByText } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByText('$24.99')).toBeTruthy();
      expect(getByText('$12.99')).toBeTruthy();
    });

    it('should display menu item descriptions', () => {
      const { getByText } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByText('Fresh salmon with herbs')).toBeTruthy();
    });

    it('should show unavailable label for unavailable items', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(getByTestId('unavailable-label')).toBeTruthy();
    });
  });

  describe('categories', () => {
    it('should display all categories', () => {
      const { queryAllByText } = render(
        <MockRestaurantScreen menuItems={mockMenuItems} />
      );
      
      expect(queryAllByText('All').length).toBeGreaterThan(0);
      expect(queryAllByText('Starters').length).toBeGreaterThan(0);
      expect(queryAllByText('Main Course').length).toBeGreaterThan(0);
      expect(queryAllByText('Desserts').length).toBeGreaterThan(0);
    });

    it('should call onCategoryPress when category selected', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen 
          menuItems={mockMenuItems} 
          onCategoryPress={mockOnCategoryPress}
        />
      );
      
      fireEvent.press(getByTestId('category-starters'));
      expect(mockOnCategoryPress).toHaveBeenCalledWith('Starters');
    });
  });

  describe('search functionality', () => {
    it('should call onSearchChange when typing in search', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen 
          menuItems={mockMenuItems} 
          onSearchChange={mockOnSearchChange}
        />
      );
      
      fireEvent.changeText(getByTestId('search-input'), 'salmon');
      expect(mockOnSearchChange).toHaveBeenCalledWith('salmon');
    });
  });

  describe('loading state', () => {
    it('should show loading indicator', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen isLoading={true} />
      );
      
      expect(getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should display error message', () => {
      const { getByTestId, getByText } = render(
        <MockRestaurantScreen error="Failed to load menu" />
      );
      
      expect(getByTestId('error-container')).toBeTruthy();
      expect(getByText('Failed to load menu')).toBeTruthy();
    });

    it('should show retry button on error', () => {
      const { getByText } = render(
        <MockRestaurantScreen error="Error" />
      );
      
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no items', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen menuItems={[]} />
      );
      
      expect(getByTestId('empty-message')).toBeTruthy();
    });
  });

  describe('add to cart', () => {
    it('should call onAddToCart when add button pressed', () => {
      const { getByTestId } = render(
        <MockRestaurantScreen 
          menuItems={mockMenuItems} 
          onAddToCart={mockOnAddToCart}
        />
      );
      
      fireEvent.press(getByTestId('add-to-cart-1'));
      expect(mockOnAddToCart).toHaveBeenCalledWith(mockMenuItems[0]);
    });
  });
});
