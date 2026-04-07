import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { authService } from '../../services/auth';
import { useRouter } from 'expo-router';
import type { User } from '@supabase/supabase-js';
import { useI18n } from '../../i18n';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t, lang, setLang, languages } = useI18n();

  useEffect(() => {
    (async () => {
      const [currentUser, adminStatus] = await Promise.all([
        authService.getCurrentUser(),
        authService.isAdmin(),
      ]);
      setUser(currentUser);
      setIsAdmin(adminStatus);
      setLoading(false);
    })();
  }, []);

  const handleDeleteAccount = () => {
    Alert.alert(
      t.profile.deleteTitle,
      t.profile.deleteMsg,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.profile.delete,
          style: 'destructive',
          onPress: async () => {
            await authService.deleteAccount();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  const handleSignOut = async () => {
    await authService.signOut();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#1DB954" />
      </View>
    );
  }

  const displayName = user?.user_metadata?.display_name ?? 'Пользователь';
  const email = user?.email ?? '';
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ru-RU')
    : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{displayName}</Text>
      <Text style={styles.email}>{email}</Text>
      {createdAt ? <Text style={styles.meta}>{t.profile.memberSince} {createdAt}</Text> : null}
      {isAdmin && (
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>{t.profile.administrator}</Text>
        </View>
      )}
      <View style={styles.divider} />

      {/* Language selector */}
      <Text style={styles.sectionLabel}>{t.profile.language}</Text>
      <View style={styles.langRow}>
        {languages.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[styles.langButton, lang === l.code && styles.langButtonActive]}
            onPress={() => setLang(l.code)}
          >
            <Text style={styles.langFlag}>{l.flag}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.divider} />
      {isAdmin && (
        <TouchableOpacity style={[styles.button, styles.adminButton]} onPress={() => router.push('/(tabs)/admin' as never)}>
          <Text style={styles.buttonText}>{t.profile.adminPanel}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>{t.profile.signOut}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.danger]} onPress={handleDeleteAccount}>
        <Text style={styles.buttonText}>{t.profile.deleteAccount}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08' },
  content: { padding: 24, alignItems: 'center' },
  center: { justifyContent: 'center', alignItems: 'center' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#060E08', fontSize: 32, fontWeight: 'bold' },
  name: { color: '#F0FFF4', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  email: { color: '#5A7A5A', fontSize: 14, marginBottom: 4 },
  meta: { color: '#5A7A5A', fontSize: 12, marginBottom: 16 },
  adminBadge: {
    backgroundColor: '#0D2A1A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    marginBottom: 8, borderWidth: 1, borderColor: '#1DB954',
  },
  adminBadgeText: { color: '#1DB954', fontWeight: '600', fontSize: 13 },
  divider: { width: '100%', height: 1, backgroundColor: '#0D1F10', marginVertical: 16 },
  button: {
    width: '100%', backgroundColor: '#0D1F10', borderRadius: 10,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1DB954',
  },
  adminButton: { borderColor: '#FFD700', backgroundColor: '#1A1A00' },
  danger: { borderColor: '#FF4444' },
  buttonText: { color: '#F0FFF4', textAlign: 'center', fontWeight: '600' },
  sectionLabel: { color: '#5A7A5A', fontSize: 11, letterSpacing: 1, alignSelf: 'flex-start', marginBottom: 8, marginTop: 4 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 4 },
  langButton: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#1A3020',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1F10',
  },
  langButtonActive: { borderColor: '#1DB954', backgroundColor: '#0A2A0A' },
  langFlag: { fontSize: 22 },
});
