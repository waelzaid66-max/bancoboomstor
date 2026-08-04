/**
 * Setup for the render layer.
 *
 * AsyncStorage is a native module: importing it outside a real app throws
 * "NativeModule: AsyncStorage is null". The library ships an official in-memory
 * mock for exactly this, and it is what its Jest docs prescribe.
 *
 * This is needed even to render a component that never stores anything. The
 * first run of this suite failed on the chain
 *
 *     PresenceDot → AppText → LanguageContext → AsyncStorage
 *
 * which is a fair illustration of why the static guards were not enough: the
 * presence indicator reaches persistent storage two hops away through a text
 * component, and no amount of reading the source as text shows you that. The
 * module graph does.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
