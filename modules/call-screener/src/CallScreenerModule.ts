import { requireNativeModule } from 'expo-modules-core';

// This loads the native module object from the JSI
const CallScreenerModule = requireNativeModule('CallScreener');

export default CallScreenerModule;
