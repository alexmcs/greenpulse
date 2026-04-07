/**
 * admin.tsx — Admin Panel
 * Only visible to users with role=admin or role=moderator in Supabase metadata.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../../services/api';
import { authService } from '../../services/auth';

type Verification = {
  id: string;
  user_id: string;
  species_name: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  lat: number;
  lng: number;
};

type Stats = {
  total_verifications: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_users: number;
  total_certificates: number;
};

export default function AdminScreen() {
  const router = useRouter();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [verifRes, statsRes] = await Promise.all([
        apiClient.get<{ verifications: Verification[] }>('/admin/verifications?status=pending&limit=20'),
        apiClient.get<Stats>('/admin/stats'),
      ]);
      setVerifications(verifRes.data?.verifications ?? []);
      setStats(statsRes.data ?? null);
    } catch (e) {
      // Backend might not have admin endpoints yet — show empty state
      setVerifications([]);
      setStats(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const admin = await authService.isAdmin();
      if (!admin) {
        Alert.alert('Нет доступа', 'Эта страница только для администраторов.');
        router.back();
        return;
      }
      setAuthorized(true);
      await loadData();
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await apiClient.post(`/admin/verifications/${id}/approve`, {});
      setVerifications(v => v.filter(x => x.id !== id));
    } catch {
      Alert.alert('Ошибка', 'Не удалось одобрить верификацию');
    }
  };

  const handleReject = async (id: string) => {
    Alert.alert('Отклонить?', 'Верификация будет отклонена.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Отклонить', style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/admin/verifications/${id}/reject`, {});
            setVerifications(v => v.filter(x => x.id !== id));
          } catch {
            Alert.alert('Ошибка', 'Не удалось отклонить верификацию');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color="#1DB954" size="large" /></View>;
  }

  if (!authorized) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />}
    >
      <Text style={styles.title}>🛡 Панель администратора</Text>

      {/* Stats */}
      {stats && (
        <View style={styles.statsGrid}>
          <StatCard label="Пользователей" value={stats.total_users} />
          <StatCard label="Верификаций" value={stats.total_verifications} />
          <StatCard label="На проверке" value={stats.pending_count} highlight />
          <StatCard label="Одобрено" value={stats.approved_count} />
          <StatCard label="Отклонено" value={stats.rejected_count} />
          <StatCard label="Сертификатов" value={stats.total_certificates} />
        </View>
      )}

      <Text style={styles.sectionTitle}>
        Ожидают проверки ({verifications.length})
      </Text>

      {verifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>✅ Нет верификаций на проверке</Text>
        </View>
      ) : (
        verifications.map((v) => (
          <View key={v.id} style={styles.card}>
            <Text style={styles.species}>{v.species_name}</Text>
            <Text style={styles.meta}>
              Уверенность: {Math.round(v.confidence * 100)}% · {new Date(v.created_at).toLocaleDateString('ru-RU')}
            </Text>
            <Text style={styles.meta}>GPS: {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(v.id)}>
                <Text style={styles.actionText}>✅ Одобрить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(v.id)}>
                <Text style={styles.actionText}>❌ Отклонить</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={[styles.statCard, highlight && styles.statHighlight]}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08' },
  content: { padding: 16 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { color: '#F0FFF4', fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  sectionTitle: { color: '#F0FFF4', fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1, minWidth: '30%', backgroundColor: '#0D1F10', borderRadius: 10,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1A3A1A',
  },
  statHighlight: { borderColor: '#FFD700', backgroundColor: '#1A1A00' },
  statValue: { color: '#1DB954', fontSize: 24, fontWeight: 'bold' },
  statValueHighlight: { color: '#FFD700' },
  statLabel: { color: '#5A7A5A', fontSize: 11, marginTop: 2, textAlign: 'center' },
  card: {
    backgroundColor: '#0D1F10', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#1A3A1A',
  },
  species: { color: '#F0FFF4', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  meta: { color: '#5A7A5A', fontSize: 12, marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: { flex: 1, backgroundColor: '#0A2A0A', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#1DB954', alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#2A0A0A', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#FF4444', alignItems: 'center' },
  actionText: { color: '#F0FFF4', fontWeight: '600', fontSize: 13 },
  emptyBox: { backgroundColor: '#0D1F10', borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: '#5A7A5A', fontSize: 14 },
});
