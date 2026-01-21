/**
 * Debug test to verify SecureStore mock behavior
 */
import * as SecureStore from 'expo-secure-store';

describe('SecureStore Mock Debug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.clearAllMockStorage();
  });

  it('should have working getItemAsync mock', async () => {
    // Check the type of function
    console.log('setItemAsync type:', typeof SecureStore.setItemAsync);
    console.log('getItemAsync type:', typeof SecureStore.getItemAsync);
    
    // Store a value
    await SecureStore.setItemAsync('test-key', 'test-value');
    
    // Check mock was called
    console.log('setItemAsync called?', (SecureStore.setItemAsync as jest.Mock).mock.calls);
    
    // Get the value
    const result = await SecureStore.getItemAsync('test-key');
    
    console.log('getItemAsync called?', (SecureStore.getItemAsync as jest.Mock).mock.calls);
    console.log('Got result:', result);
    
    expect(result).toBe('test-value');
  });

  it('should check _getStorage helper', async () => {
    const store = (SecureStore as any)._getStorage?.();
    console.log('Storage object:', store);
    
    await SecureStore.setItemAsync('key1', 'value1');
    
    const storeAfter = (SecureStore as any)._getStorage?.();
    console.log('Storage after set:', storeAfter);
    
    expect(storeAfter).toEqual({ key1: 'value1' });
  });
});
