/**
 * callback.tsx — обработчик deep link после верификации email Supabase
 * URL: greenpulse://auth/callback?code=...  (PKCE)
 *      greenpulse://auth/callback#access_token=...  (implicit)
 */
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../services/auth';

function parseUrl(url: string): { fragment: Record<string, string>; query: Record<string, string> } {
  const toMap = (str: string) => {
    const m: Record<string, string> = {};
    for (const part of (str || '').split('&')) {
      const idx = part.indexOf('=');
      if (idx > 0) m[part.slice(0, idx)] = decodeURIComponent(part.slice(idx + 1));
    }
    return m;
  };
  const [withoutHash, hash = ''] = url.split('#');
  const query = withoutHash.split('?')[1] || '';
  return { fragment: toMap(hash), query: toMap(query) };
}

async function processUrl(url: string): Promise<void> {
  const { fragment, query } = parseUrl(url);

  if (query.code) {
    // PKCE flow (Supabase по умолчанию)
    const { error } = await supabase.auth.exchangeCodeForSession(query.code);
    if (error) throw error;
    return;
  }

  if (fragment.access_token && fragment.refresh_token) {
    // Implicit flow (старый)
    const { error } = await supabase.auth.setSession({
      access_token: fragment.access_token,
      refresh_token: fragment.refresh_token,
    });
    if (error) throw error;
    return;
  }

  const errDesc = fragment.error_description || query.error_description;
  if (errDesc) throw new Error(errDesc.replace(/\+/g, ' '));

  // Нет токена и нет ошибки — возможно просто redirect без параметров
  const session = await supabase.auth.getSession();
  if (!session.data.session) throw new Error('Не удалось подтвердить аккаунт');
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handle = async (url: string) => {
      try {
        await processUrl(url);
        router.replace('/(tabs)');
      } catch (e: any) {
        setErrorMsg(e.message || 'Ошибка верификации');
      }
    };

    Linking.getInitialURL().then(url => { if (url) handle(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>❌</Text>
        <Text style={styles.title}>Ошибка верификации</Text>
        <Text style={styles.message}>{errorMsg}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.buttonText}>Вернуться к входу</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#1DB954" size="large" style={{ marginBottom: 20 }} />
      <Text style={styles.title}>Подтверждаем аккаунт...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#F0FFF4', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  message: { color: '#FF6B6B', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#1DB954', borderRadius: 10, padding: 14, width: '100%', alignItems: 'center' },
  buttonText: { color: '#060E08', fontWeight: 'bold', fontSize: 16 },
});
