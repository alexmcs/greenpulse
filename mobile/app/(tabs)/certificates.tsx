import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { apiClient } from '../../services/api';
import { useI18n } from '../../i18n';

export default function CertificatesScreen() {
  const [certs, setCerts] = useState<any[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    apiClient.get('/certificates/').then(r => setCerts(r.data)).catch(console.error);
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={certs}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={styles.empty}>{t.certificates.empty}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <Text style={styles.species}>{item.verification?.species_name}</Text>
            <Text style={styles.date}>{new Date(item.issued_at).toLocaleDateString()}</Text>
            <Text style={styles.co2}>{item.verification?.co2_kg_year} {t.certificates.co2Unit}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08', padding: 16 },
  empty: { color: '#5A7A5A', textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: { backgroundColor: '#0D1F10', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1DB954' },
  species: { color: '#F0FFF4', fontSize: 18, fontWeight: 'bold' },
  date: { color: '#A8C5A0', marginTop: 4 },
  co2: { color: '#1DB954', marginTop: 8, fontWeight: '600' },
});
