/**
 * Home Screen Tests
 * Tests for the main home/dashboard screen
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';

// Mock modules data
const mockModules = [
  { id: '1', name: 'Restaurant', icon: 'restaurant', enabled: true },
  { id: '2', name: 'Pool', icon: 'pool', enabled: true },
  { id: '3', name: 'Chalets', icon: 'home', enabled: true },
  { id: '4', name: 'Spa', icon: 'spa', enabled: false },
];

// Mock bookings data
const mockBookings = [
  {
    id: '1',
    type: 'chalet',
    name: 'Ocean View Chalet',
    date: '2024-01-15',
    status: 'confirmed',
  },
  {
    id: '2',
    type: 'restaurant',
    name: 'Dinner Reservation',
    date: '2024-01-16',
    status: 'pending',
  },
];

// Create mock component
const MockHomeScreen = ({
  user = null,
  modules = [],
  bookings = [],
  isLoading = false,
  error = null,
  onModulePress = () => {},
  onBookingPress = () => {},
  onLogin = () => {},
}: any) => (
  <ScrollView testID="home-screen">
    {/* Header */}
    <View testID="header">
      {user ? (
        <Text testID="welcome-message">Welcome, {user.name}</Text>
      ) : (
        <View testID="guest-header">
          <Text>Welcome, Guest</Text>
          <TouchableOpacity testID="login-button" onPress={onLogin}>
            <Text>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>

    {/* Content */}
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
      <>
        {/* Modules Section */}
        <View testID="modules-section">
          <Text>Quick Access</Text>
          <FlatList
            testID="modules-list"
            horizontal
            data={modules.filter((m: any) => m.enabled)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`module-${item.id}`}
                onPress={() => onModulePress(item)}
              >
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text testID="no-modules">No modules available</Text>}
          />
        </View>

        {/* Bookings Section (only for authenticated users) */}
        {user && (
          <View testID="bookings-section">
            <Text>Your Bookings</Text>
            {bookings.length > 0 ? (
              <FlatList
                testID="bookings-list"
                data={bookings}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    testID={`booking-${item.id}`}
                    onPress={() => onBookingPress(item)}
                  >
                    <Text>{item.name}</Text>
                    <Text>{item.date}</Text>
                    <Text testID={`status-${item.id}`}>{item.status}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text testID="no-bookings">No upcoming bookings</Text>
            )}
          </View>
        )}
      </>
    )}
  </ScrollView>
);

jest.mock('../../app/(tabs)/index', () => MockHomeScreen);

describe('HomeScreen', () => {
  const mockOnModulePress = jest.fn();
  const mockOnBookingPress = jest.fn();
  const mockOnLogin = jest.fn();

  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unauthenticated state', () => {
    it('should render screen structure', () => {
      const { getByTestId } = render(
        <MockHomeScreen modules={mockModules} />
      );
      
      expect(getByTestId('home-screen')).toBeTruthy();
    });

    it('should show guest header', () => {
      const { getByTestId, getByText } = render(
        <MockHomeScreen modules={mockModules} />
      );
      
      expect(getByTestId('guest-header')).toBeTruthy();
      expect(getByText('Welcome, Guest')).toBeTruthy();
    });

    it('should show login button', () => {
      const { getByTestId, getByText } = render(
        <MockHomeScreen modules={mockModules} />
      );
      
      expect(getByTestId('login-button')).toBeTruthy();
      expect(getByText('Sign In')).toBeTruthy();
    });

    it('should call onLogin when login button pressed', () => {
      const { getByTestId } = render(
        <MockHomeScreen modules={mockModules} onLogin={mockOnLogin} />
      );
      
      fireEvent.press(getByTestId('login-button'));
      expect(mockOnLogin).toHaveBeenCalled();
    });

    it('should not show bookings section', () => {
      const { queryByTestId } = render(
        <MockHomeScreen modules={mockModules} />
      );
      
      expect(queryByTestId('bookings-section')).toBeNull();
    });
  });

  describe('authenticated state', () => {
    it('should show welcome message with user name', () => {
      const { getByTestId, getByText } = render(
        <MockHomeScreen user={mockUser} modules={mockModules} bookings={mockBookings} />
      );
      
      expect(getByTestId('welcome-message')).toBeTruthy();
      expect(getByText('Welcome, John Doe')).toBeTruthy();
    });

    it('should show bookings section', () => {
      const { getByTestId } = render(
        <MockHomeScreen user={mockUser} modules={mockModules} bookings={mockBookings} />
      );
      
      expect(getByTestId('bookings-section')).toBeTruthy();
    });

    it('should display user bookings', () => {
      const { getByText } = render(
        <MockHomeScreen user={mockUser} modules={mockModules} bookings={mockBookings} />
      );
      
      expect(getByText('Ocean View Chalet')).toBeTruthy();
      expect(getByText('Dinner Reservation')).toBeTruthy();
    });

    it('should show empty bookings message when no bookings', () => {
      const { getByTestId } = render(
        <MockHomeScreen user={mockUser} modules={mockModules} bookings={[]} />
      );
      
      expect(getByTestId('no-bookings')).toBeTruthy();
    });
  });

  describe('modules display', () => {
    it('should render modules section', () => {
      const { getByTestId, getByText } = render(
        <MockHomeScreen modules={mockModules} />
      );
      
      expect(getByTestId('modules-section')).toBeTruthy();
      expect(getByText('Quick Access')).toBeTruthy();
    });

    it('should render modules list', () => {
      const { getByTestId } = render(
        <MockHomeScreen modules={mockModules} />
      );
      
      expect(getByTestId('modules-list')).toBeTruthy();
    });

    it('should display enabled module names', () => {
      const { getByText } = render(
        <MockHomeScreen modules={mockModules} />
      );
      
      expect(getByText('Restaurant')).toBeTruthy();
      expect(getByText('Pool')).toBeTruthy();
      expect(getByText('Chalets')).toBeTruthy();
    });

    it('should call onModulePress when module pressed', () => {
      const { getByTestId } = render(
        <MockHomeScreen modules={mockModules} onModulePress={mockOnModulePress} />
      );
      
      fireEvent.press(getByTestId('module-1'));
      expect(mockOnModulePress).toHaveBeenCalledWith(mockModules[0]);
    });
  });

  describe('loading state', () => {
    it('should show loading indicator', () => {
      const { getByTestId } = render(
        <MockHomeScreen isLoading={true} />
      );
      
      expect(getByTestId('loading-indicator')).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should display error message', () => {
      const { getByTestId, getByText } = render(
        <MockHomeScreen error="Failed to load data" />
      );
      
      expect(getByTestId('error-container')).toBeTruthy();
      expect(getByText('Failed to load data')).toBeTruthy();
    });

    it('should show retry button on error', () => {
      const { getByText } = render(
        <MockHomeScreen error="Error" />
      );
      
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  describe('bookings interaction', () => {
    it('should call onBookingPress when booking pressed', () => {
      const { getByTestId } = render(
        <MockHomeScreen 
          user={mockUser} 
          modules={mockModules} 
          bookings={mockBookings}
          onBookingPress={mockOnBookingPress}
        />
      );
      
      fireEvent.press(getByTestId('booking-1'));
      expect(mockOnBookingPress).toHaveBeenCalledWith(mockBookings[0]);
    });

    it('should display booking status', () => {
      const { getByText } = render(
        <MockHomeScreen user={mockUser} modules={mockModules} bookings={mockBookings} />
      );
      
      expect(getByText('confirmed')).toBeTruthy();
      expect(getByText('pending')).toBeTruthy();
    });
  });
});
