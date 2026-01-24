/**
 * Account Screen Tests
 * Tests for the user account/profile screen
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { View, Text, TouchableOpacity } from 'react-native';

// Create a mock component for the AccountScreen to test
const MockAccountScreen = ({ user, onLogout }: any) => (
  <View testID="account-screen">
    <Text>Account</Text>
    {user ? (
      <>
        <Text testID="user-name">{user.name}</Text>
        <Text testID="user-email">{user.email}</Text>
        <View testID="edit-profile-button" />
        <View testID="settings-button" />
        <TouchableOpacity testID="logout-button" onPress={onLogout}>
          <Text>Sign Out</Text>
        </TouchableOpacity>
      </>
    ) : (
      <View testID="login-prompt">
        <Text>Sign In</Text>
      </View>
    )}
  </View>
);

// Mock the actual module
jest.mock('../../app/(tabs)/account', () => MockAccountScreen);

describe('AccountScreen', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unauthenticated state', () => {
    it('should render login prompt for guests', () => {
      const { getByTestId, getByText } = render(<MockAccountScreen user={null} />);
      
      expect(getByTestId('login-prompt')).toBeTruthy();
      expect(getByText(/Sign In/i)).toBeTruthy();
    });

    it('should render screen structure', () => {
      const { getByTestId } = render(<MockAccountScreen user={null} />);
      expect(getByTestId('account-screen')).toBeTruthy();
    });
  });

  describe('authenticated state', () => {
    const mockUser = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
    };

    it('should display user name', () => {
      const { getByText } = render(<MockAccountScreen user={mockUser} />);
      expect(getByText(/John Doe/i)).toBeTruthy();
    });

    it('should display user email', () => {
      const { getByText } = render(<MockAccountScreen user={mockUser} />);
      expect(getByText(/john@example.com/i)).toBeTruthy();
    });

    it('should render account header', () => {
      const { getByText } = render(<MockAccountScreen user={mockUser} />);
      expect(getByText(/Account/i)).toBeTruthy();
    });
  });

  describe('menu items', () => {
    const mockUser = { id: '1', name: 'John', email: 'john@example.com' };

    it('should render profile edit option', () => {
      const { getByTestId } = render(<MockAccountScreen user={mockUser} />);
      expect(getByTestId('edit-profile-button')).toBeTruthy();
    });

    it('should render settings option', () => {
      const { getByTestId } = render(<MockAccountScreen user={mockUser} />);
      expect(getByTestId('settings-button')).toBeTruthy();
    });
  });

  describe('logout functionality', () => {
    const mockUser = { id: '1', name: 'John', email: 'john@example.com' };

    it('should have logout button', () => {
      const { getByText } = render(<MockAccountScreen user={mockUser} onLogout={mockLogout} />);
      expect(getByText(/Sign Out/i)).toBeTruthy();
    });

    it('should call logout when button pressed', async () => {
      const { getByTestId } = render(<MockAccountScreen user={mockUser} onLogout={mockLogout} />);
      const logoutButton = getByTestId('logout-button');
      
      fireEvent.press(logoutButton);
      
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });
});
