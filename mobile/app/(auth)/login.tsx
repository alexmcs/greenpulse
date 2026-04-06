import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { authService } from '../../services/auth';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    const result = await authService.signIn(email, password);
    if (result.error) {
      setError(result.error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🌱 GreenPulse</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#5A7A5A"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        placeholderTextColor="#5A7A5A"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Войти</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
        <Text style={styles.link}>Нет аккаунта? Зарегистрироваться</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', padding: 24, justifyContent: 'center' },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#1DB954', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#0D1F10', borderRadius: 10, padding: 14, color: '#F0FFF4', marginBottom: 12, borderWidth: 1, borderColor: '#1a3320' },
  button: { backgroundColor: '#1DB954', borderRadius: 10, padding: 16, marginTop: 8 },
  buttonText: { color: '#060E08', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
  link: { color: '#A8C5A0', textAlign: 'center', marginTop: 16 },
  error: { color: '#FF4444', marginBottom: 8 },
});
