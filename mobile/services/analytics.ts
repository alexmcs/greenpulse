import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

export const posthog = new PostHog(
  Constants.expoConfig?.extra?.posthogKey ?? '',
  { host: 'https://eu.posthog.com' },
);

// Verification funnel events:
// posthog.capture('verification_started')
// posthog.capture('photo_taken')
// posthog.capture('species_identified', { species, confidence, source })
// posthog.capture('payment_initiated', { amount: 1.00 })
// posthog.capture('certificate_issued', { certificate_id })
// posthog.capture('certificate_shared')
// posthog.capture('low_confidence_manual_select', { species })
