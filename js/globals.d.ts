// Test hooks that the pages set on the window object (in a background tab animations do not
// advance, so the state can be set directly).
interface Window {
  SignPage?: Record<string, unknown>;
  MapPage?: Record<string, unknown>;
  HomeFox?: Record<string, unknown>;
}
