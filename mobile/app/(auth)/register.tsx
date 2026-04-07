import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useState } from 'react';
import { authService } from '../../services/auth';
import { useRouter } from 'expo-router';
import { useI18n } from '../../i18n';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const router = useRouter();
  const { t } = useI18n();

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      setError(t.register.fillAll);
      return;
    }
    setError('');
    setLoading(true);
    const result = await authService.signUp(email, password, displayName);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
    } else if (result.data.session) {
      // Подтверждение email отключено — сразу в приложение
      router.replace('/(tabs)');
    } else {
      // Письмо отправлено
      setStep('confirm');
    }
  };

  if (step === 'confirm') {
    return (
      <View style={styles.container}>
        <Text style={styles.confirmIcon}>📧</Text>
        <Text style={styles.confirmTitle}>{t.register.confirmTitle}</Text>
        <Text style={styles.confirmBody}>{t.register.confirmBody.replace('{email}', email)}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.buttonText}>{t.register.goToLogin}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStep('form')}>
          <Text style={styles.link}>{t.register.wrongEmail}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
      <TextInput
        style={styles.input}
        placeholder={t.register.name}
        placeholderTextColor="#5A7A5A"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder={t.register.email}
        placeholderTextColor="#5A7A5A"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder={t.register.password}
        placeholderTextColor="#5A7A5A"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '...' : t.register.signUp}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.link}>{t.register.hasAccount}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', padding: 24, justifyContent: 'center' },
  logo: { width: 200, height: 120, alignSelf: 'center', marginBottom: 36 },
  input: { backgroundColor: '#0D1F10', borderRadius: 10, padding: 14, color: '#F0FFF4', marginBottom: 12, borderWidth: 1, borderColor: '#1a3320' },
  button: { backgroundColor: '#1DB954', borderRadius: 10, padding: 16, marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#060E08', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
  link: { color: '#A8C5A0', textAlign: 'center', marginTop: 16 },
  error: { color: '#FF4444', marginBottom: 8 },
  confirmIcon: { fontSize: 56, textAlign: 'center', marginBottom: 20 },
  confirmTitle: { color: '#F0FFF4', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  confirmBody: { color: '#A8C5A0', fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
});

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
      <TextInput
        style={styles.input}
        placeholder={t.register.name}
        placeholderTextColor="#5A7A5A"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder={t.register.email}
        placeholderTextColor="#5A7A5A"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder={t.register.password}
        placeholderTextColor="#5A7A5A"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>{t.register.signUp}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.link}>{t.register.hasAccount}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', padding: 24, justifyContent: 'center' },
  logo: { width: 200, height: 120, alignSelf: 'center', marginBottom: 36 },
  input: { backgroundColor: '#0D1F10', borderRadius: 10, padding: 14, color: '#F0FFF4', marginBottom: 12, borderWidth: 1, borderColor: '#1a3320' },
  button: { backgroundColor: '#1DB954', borderRadius: 10, padding: 16, marginTop: 8 },
  buttonText: { color: '#060E08', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
  link: { color: '#A8C5A0', textAlign: 'center', marginTop: 16 },
  error: { color: '#FF4444', marginBottom: 8 },
});
