/**
 * Setup global do Jest: mocks de módulos nativos para rodar os testes do
 * motor crítico em ambiente Node (sem device).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '0.1.0',
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.AntiSpamScreening = undefined;
  return RN;
});
