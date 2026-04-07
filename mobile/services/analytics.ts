import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

const posthogKey = Constants.expoConfig?.extra?.posthogKey ?? '';

// Guard: PostHog crashes with empty API key
export const posthog = posthogKey
  ? new PostHog(posthogKey, { host: Constants.expoConfig?.extra?.posthogHost ?? 'https://eu.posthog.com' })
  : null;

export const track = (event: string, properties?: Record<string, unknown>) => {
  posthog?.capture(event, properties);
};
