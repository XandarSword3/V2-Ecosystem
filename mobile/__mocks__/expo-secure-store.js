// Jest mock for expo-secure-store

// Using module-level state for storage that persists across mock calls
let storage = {};

const SecureStoreMock = {
  getItemAsync: jest.fn(async (key) => storage[key] || null),
  setItemAsync: jest.fn(async (key, value) => {
    storage[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key) => {
    delete storage[key];
  }),
  isAvailableAsync: jest.fn(async () => true),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  
  // Helper for tests to clear storage
  _clearStorage: () => {
    storage = {};
  },
  
  // Helper to access storage directly
  _getStorage: () => storage,
};

module.exports = SecureStoreMock;
