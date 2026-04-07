import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { authService } from '../services/auth';

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn,
  enableInExpoDevelopment: false,
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Check session on mount — redirect to login if not authenticated
    authService.getSession().then((session) => {
      if (!session) {
        router.replace('/(auth)/login');
      }
    });

    // Listen for auth state changes (logout, token expiry)
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      if (!session) {
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0D1F10' },
        headerTintColor: '#F0FFF4',
        contentStyle: { backgroundColor: '#060E08' },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

