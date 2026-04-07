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
import { useI18n } from '../../i18n';

type StatusFilter = 'pending' | 'approved' | 'rejected';

type Verification = {
  id: string;
  user_id: string;
  species_name: string;
  confidence: number;
  status: StatusFilter;
  created_at: string;
  lat: number;
  lng: number;
  photo_url?: string;
  co2_kg_year?: number;
};

type Stats = {
  total_verifications: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_users: number;
  total_certificates: number;
};

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#1DB954' : pct >= 50 ? '#FFD700' : '#FF4444';
  return (
    <View style={[badgeStyles.wrap, { borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{pct}%</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  wrap: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontWeight: 'bold', fontSize: 13 },
});

function StatusBadge({ status }: { status: StatusFilter }) {
  const map: Record<StatusFilter, { label: string; color: string; bg: string }> = {
    pending:  { label: '⏳ На проверке', color: '#FFD700', bg: '#1A1A00' },
    approved: { label: '✅ Одобрено',    color: '#1DB954', bg: '#001A00' },
    rejected: { label: '❌ Отклонено',   color: '#FF4444', bg: '#1A0000' },
  };
  const s = map[status];
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: s.color, fontSize: 12, fontWeight: '600' }}>{s.label}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const { t } = useI18n();

  const loadData = useCallback(async (status: StatusFilter = filter) => {
    try {
      const [verifRes, statsRes] = await Promise.all([
        apiClient.get<{ verifications: Verification[] }>(`/admin/verifications?status=${status}&limit=30`),
        apiClient.get<Stats>('/admin/stats'),
      ]);
      setVerifications(verifRes.data?.verifications ?? []);
      setStats(statsRes.data ?? null);
    } catch {
      setVerifications([]);
      setStats(null);
    }
  }, [filter]);

  useEffect(() => {
    (async () => {
      const admin = await authService.isAdmin();
      if (!admin) {
        Alert.alert(t.admin.noAccess, t.admin.noAccessMsg);
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

  const onFilterChange = async (s: StatusFilter) => {
    setFilter(s);
    setLoading(true);
    await loadData(s);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await apiClient.post(`/admin/verifications/${id}/approve`, {});
      setVerifications(v => v.filter(x => x.id !== id));
    } catch {
      Alert.alert(t.common.error, t.admin.errApprove);
    }
  };

  const handleReject = async (id: string) => {
    Alert.alert(t.admin.rejectTitle, t.admin.rejectMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: '❌ Отклонить', style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/admin/verifications/${id}/reject`, {});
            setVerifications(v => v.filter(x => x.id !== id));
          } catch {
            Alert.alert(t.common.error, t.admin.errReject);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color="#1DB954" size="large" /></View>;
  }
  if (!authorized) return null;

  const filterTabs: { key: StatusFilter; label: string; count?: number }[] = [
    { key: 'pending',  label: '⏳ Ожидают', count: stats?.pending_count },
    { key: 'approved', label: '✅ Одобрены', count: stats?.approved_count },
    { key: 'rejected', label: '❌ Отклонены', count: stats?.rejected_count },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />}
    >
      <Text style={styles.title}>{t.admin.title}</Text>

      {/* Stats row */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.bigStat}>
            <Text style={styles.bigStatValue}>{stats.total_users}</Text>
            <Text style={styles.bigStatLabel}>{t.admin.users}</Text>
          </View>
          <View style={styles.bigStatDivider} />
          <View style={styles.bigStat}>
            <Text style={styles.bigStatValue}>{stats.total_verifications}</Text>
            <Text style={styles.bigStatLabel}>{t.admin.verifications}</Text>
          </View>
          <View style={styles.bigStatDivider} />
          <View style={styles.bigStat}>
            <Text style={styles.bigStatValue}>{stats.total_certificates}</Text>
            <Text style={styles.bigStatLabel}>{t.admin.certificates}</Text>
          </View>
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {filterTabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => onFilterChange(tab.key)}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
            {tab.count !== undefined && (
              <View style={[styles.filterBadge, filter === tab.key && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === tab.key && styles.filterBadgeTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Verification cards */}
      {verifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🌿</Text>
          <Text style={styles.emptyText}>{t.admin.noPending}</Text>
        </View>
      ) : (
        verifications.map((v) => (
          <View key={v.id} style={styles.card}>
            {/* Header row */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.species}>{v.species_name}</Text>
                <Text style={styles.date}>
                  {new Date(v.created_at).toLocaleDateString()} · {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <ConfidenceBadge value={v.confidence} />
            </View>

            {/* Status */}
            <StatusBadge status={v.status} />

            {/* Info row */}
            <View style={styles.infoRow}>
              <Text style={styles.infoItem}>📍 {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</Text>
              {v.co2_kg_year !== undefined && (
                <Text style={styles.infoItem}>🌱 {v.co2_kg_year.toFixed(1)} kg CO₂/yr</Text>
              )}
            </View>

            {/* Actions — only for pending */}
            {v.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(v.id)}>
                  <Text style={styles.approveBtnText}>✅ Одобрить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(v.id)}>
                  <Text style={styles.rejectBtnText}>❌ Отклонить</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060E08' },
  content: { padding: 16, paddingBottom: 40 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { color: '#F0FFF4', fontSize: 22, fontWeight: 'bold', marginBottom: 16 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: '#0D1F10', borderRadius: 14,
    padding: 16, marginBottom: 16, alignItems: 'center',
  },
  bigStat: { flex: 1, alignItems: 'center' },
  bigStatValue: { color: '#1DB954', fontSize: 28, fontWeight: 'bold' },
  bigStatLabel: { color: '#5A7A5A', fontSize: 11, marginTop: 2, textAlign: 'center' },
  bigStatDivider: { width: 1, height: 40, backgroundColor: '#1A3A1A', marginHorizontal: 8 },

  // Filter tabs
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0D1F10', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6,
    borderWidth: 1, borderColor: 'transparent', gap: 4,
  },
  filterTabActive: { borderColor: '#1DB954', backgroundColor: '#0A2A0A' },
  filterTabText: { color: '#5A7A5A', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  filterTabTextActive: { color: '#1DB954' },
  filterBadge: {
    backgroundColor: '#1A3A1A', borderRadius: 10, minWidth: 20,
    height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  filterBadgeActive: { backgroundColor: '#1DB954' },
  filterBadgeText: { color: '#5A7A5A', fontSize: 11, fontWeight: 'bold' },
  filterBadgeTextActive: { color: '#060E08' },

  // Cards
  card: {
    backgroundColor: '#0D1F10', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#1A3A1A',
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  species: { color: '#F0FFF4', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  date: { color: '#5A7A5A', fontSize: 12 },
  infoRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  infoItem: { color: '#5A7A5A', fontSize: 12 },

  // Actions
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  approveBtn: {
    flex: 1, backgroundColor: '#0A2A0A', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#1DB954',
  },
  approveBtnText: { color: '#1DB954', fontWeight: '700', fontSize: 14 },
  rejectBtn: {
    flex: 1, backgroundColor: '#2A0A0A', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#FF4444',
  },
  rejectBtnText: { color: '#FF4444', fontWeight: '700', fontSize: 14 },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#5A7A5A', fontSize: 15, textAlign: 'center' },
});

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '../../services/api';
import { authService } from '../../services/auth';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();

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
        Alert.alert(t.admin.noAccess, t.admin.noAccessMsg);
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
      Alert.alert(t.common.error, t.admin.errApprove);
    }
  };

  const handleReject = async (id: string) => {
    Alert.alert(t.admin.rejectTitle, t.admin.rejectMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.admin.reject.replace(/^[^ ]+ /, ''), style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.post(`/admin/verifications/${id}/reject`, {});
            setVerifications(v => v.filter(x => x.id !== id));
          } catch {
            Alert.alert(t.common.error, t.admin.errReject);
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
      <Text style={styles.title}>{t.admin.title}</Text>

      {/* Stats */}
      {stats && (
        <View style={styles.statsGrid}>
          <StatCard label={t.admin.users} value={stats.total_users} />
          <StatCard label={t.admin.verifications} value={stats.total_verifications} />
          <StatCard label={t.admin.pending} value={stats.pending_count} highlight />
          <StatCard label={t.admin.approved} value={stats.approved_count} />
          <StatCard label={t.admin.rejected} value={stats.rejected_count} />
          <StatCard label={t.admin.certificates} value={stats.total_certificates} />
        </View>
      )}

      <Text style={styles.sectionTitle}>
        {t.admin.pendingSection} ({verifications.length})
      </Text>

      {verifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t.admin.noPending}</Text>
        </View>
      ) : (
        verifications.map((v) => (
          <View key={v.id} style={styles.card}>
            <Text style={styles.species}>{v.species_name}</Text>
            <Text style={styles.meta}>
              {t.admin.confidence} {Math.round(v.confidence * 100)}% · {new Date(v.created_at).toLocaleDateString()}
            </Text>
            <Text style={styles.meta}>{t.admin.gps} {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(v.id)}>
                <Text style={styles.actionText}>{t.admin.approve}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(v.id)}>
                <Text style={styles.actionText}>{t.admin.reject}</Text>
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
