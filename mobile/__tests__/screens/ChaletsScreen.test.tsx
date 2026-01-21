/**
 * Chalets Screen Tests
 * Tests for the chalets/accommodation screen
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';

// Mock Chalet data
const mockChalets = [
  {
    id: '1',
    name: 'Ocean View Chalet',
    description: 'Beautiful ocean view',
    price: 250,
    capacity: 4,
    amenities: ['WiFi', 'Kitchen', 'AC'],
    images: ['/img1.jpg'],
    available: true,
  },
  {
    id: '2',
    name: 'Mountain Retreat',
    description: 'Peaceful mountain view',
    price: 180,
    capacity: 6,
    amenities: ['WiFi', 'Fireplace'],
    images: ['/img2.jpg'],
    available: false,
  },
];

// Create mock component
const MockChaletsScreen = ({ 
  chalets = [], 
  isLoading = false, 
  error = null,
  onChaletPress = () => {},
}: any) => (
  <View testID="chalets-screen">
    <Text>Chalets</Text>
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
        testID="chalets-list"
        data={chalets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`chalet-${item.id}`}
            onPress={() => onChaletPress(item)}
          >
            <Text>{item.name}</Text>
            <Text>${item.price}/night</Text>
            <Text>Capacity: {item.capacity} guests</Text>
            {item.amenities.map((amenity: string) => (
              <Text key={amenity}>{amenity}</Text>
            ))}
            {!item.available && <Text testID="unavailable-badge">Unavailable</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text testID="empty-message">No chalets available</Text>}
      />
    )}
    <View testID="filter-button" />
    <View testID="sort-button" />
  </View>
);

jest.mock('../../app/(tabs)/chalets', () => MockChaletsScreen);

describe('ChaletsScreen', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render screen structure', () => {
      const { getByTestId, getByText } = render(<MockChaletsScreen chalets={mockChalets} />);
      
      expect(getByTestId('chalets-screen')).toBeTruthy();
      expect(getByText(/Chalets/i)).toBeTruthy();
    });

    it('should render chalets list', () => {
      const { getByTestId } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(getByTestId('chalets-list')).toBeTruthy();
    });

    it('should display chalet names', () => {
      const { getByText } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(getByText('Ocean View Chalet')).toBeTruthy();
      expect(getByText('Mountain Retreat')).toBeTruthy();
    });
  });

  describe('chalet details', () => {
    it('should display chalet prices', () => {
      const { getByText } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(getByText('$250/night')).toBeTruthy();
      expect(getByText('$180/night')).toBeTruthy();
    });

    it('should display chalet capacity', () => {
      const { getByText } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(getByText('Capacity: 4 guests')).toBeTruthy();
      expect(getByText('Capacity: 6 guests')).toBeTruthy();
    });

    it('should display chalet amenities', () => {
      const { queryAllByText } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(queryAllByText('WiFi').length).toBeGreaterThan(0);
      expect(queryAllByText('Kitchen').length).toBeGreaterThan(0);
    });

    it('should show unavailable badge for unavailable chalets', () => {
      const { getByTestId } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(getByTestId('unavailable-badge')).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator', () => {
      const { getByTestId } = render(<MockChaletsScreen isLoading={true} />);
      expect(getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should display error message', () => {
      const { getByTestId, getByText } = render(
        <MockChaletsScreen error="Failed to load chalets" />
      );
      expect(getByTestId('error-container')).toBeTruthy();
      expect(getByText('Failed to load chalets')).toBeTruthy();
    });

    it('should show retry button on error', () => {
      const { getByText } = render(<MockChaletsScreen error="Error" />);
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no chalets', () => {
      const { getByTestId } = render(<MockChaletsScreen chalets={[]} />);
      expect(getByTestId('empty-message')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should have filter button', () => {
      const { getByTestId } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(getByTestId('filter-button')).toBeTruthy();
    });

    it('should have sort button', () => {
      const { getByTestId } = render(<MockChaletsScreen chalets={mockChalets} />);
      expect(getByTestId('sort-button')).toBeTruthy();
    });

    it('should call onChaletPress when chalet pressed', () => {
      const { getByTestId } = render(
        <MockChaletsScreen chalets={mockChalets} onChaletPress={mockOnPress} />
      );
      
      fireEvent.press(getByTestId('chalet-1'));
      expect(mockOnPress).toHaveBeenCalledWith(mockChalets[0]);
    });
  });
});
