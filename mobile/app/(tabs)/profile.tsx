import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { authService } from '../../services/auth';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  const handleDeleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт?',
      'Все ваши данные будут удалены (GDPR). Это действие необратимо.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Профиль</Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Выйти</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.danger]} onPress={handleDeleteAccount}>
        <Text style={styles.buttonText}>Удалить аккаунт (GDPR)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', padding: 24 },
  title: { color: '#F0FFF4', fontSize: 24, fontWeight: 'bold', marginBottom: 32 },
  button: { backgroundColor: '#0D1F10', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1DB954' },
  danger: { borderColor: '#FF4444' },
  buttonText: { color: '#F0FFF4', textAlign: 'center', fontWeight: '600' },
});
