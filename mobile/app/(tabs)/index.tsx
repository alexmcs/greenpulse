import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.tagline}>Посади дерево. Получи сертификат.</Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push('/(tabs)/verify')}
      >
        <Text style={styles.primaryButtonText}>Верифицировать посадку</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 220, height: 130, marginBottom: 24 },
  tagline: { fontSize: 18, color: '#A8C5A0', textAlign: 'center', marginBottom: 40 },
  primaryButton: { backgroundColor: '#1DB954', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32 },
  primaryButtonText: { fontSize: 18, fontWeight: 'bold', color: '#060E08' },
});
