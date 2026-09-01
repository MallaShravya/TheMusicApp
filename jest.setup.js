/**
 * Test environment setup.
 *
 * AsyncStorage is a native module, so importing it in Node throws. The library ships an
 * in-memory mock for exactly this; without it any test that touches the storage layer — which
 * includes anything importing `src/visualiser`, via the analysis cache — fails on import.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * The brightness module reaches the device. Under test there is no screen to brighten, and a
 * rejected promise inside a component effect would surface as an unhandled rejection rather
 * than a useful failure.
 */
jest.mock('expo-brightness', () => ({
  isAvailableAsync: jest.fn(async () => false),
  setBrightnessAsync: jest.fn(async () => {}),
  restoreSystemBrightnessAsync: jest.fn(async () => {}),
  getBrightnessAsync: jest.fn(async () => 0.5),
}));
