
export type HapticType = 'selection' | 'success' | 'warning' | 'error' | 'heavy';

/**
 * Triggers a haptic feedback vibration if supported by the device.
 * @param type The type of feedback pattern to trigger.
 */
export const triggerHaptic = (type: HapticType = 'selection') => {
  // Check if Vibration API is supported
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  try {
    switch (type) {
      case 'selection':
        // Very short, sharp tap for UI interactions like toggles or buttons
        navigator.vibrate(10);
        break;
      case 'success':
        // A satisfying, slightly longer vibration for completed actions (e.g., sent message)
        navigator.vibrate(50);
        break;
      case 'warning':
        // Two short pulses
        navigator.vibrate([30, 50, 30]);
        break;
      case 'error':
        // distinct error pattern
        navigator.vibrate([50, 100, 50]);
        break;
      case 'heavy':
        // Stronger vibration for significant state changes (e.g., Recording Start)
        navigator.vibrate(75);
        break;
    }
  } catch (e) {
    // Ignore errors if vibration fails (e.g. user permission/settings)
    console.debug("Haptic feedback failed", e);
  }
};
