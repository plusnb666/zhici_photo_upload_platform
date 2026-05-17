import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { authAPI } from '../api/auth';
import { imagesAPI } from '../api/images';
import { useAuthStore } from '../store/authStore';
import { formatFileSize, formatDate } from '../utils/format';
import { colors, spacing, radius, fonts } from '../theme';

export function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: myImages } = useQuery({
    queryKey: ['my-images', 1],
    queryFn: () => imagesAPI.list({ page: 1, limit: 100 }),
  });

  const images: any[] = myImages?.data?.data?.items ?? [];
  const totalSize = images.reduce((s: number, i: any) => s + (i.file_size || 0), 0);

  const handleLogout = async () => {
    try {
      const token = useAuthStore.getState().refreshToken;
      if (token) await authAPI.logout(token);
    } catch {}
    clearAuth();
    navigation.navigate('Landing');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.username || '?')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role === 'admin' ? '管理员' : '用户'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{images.length}</Text>
          <Text style={styles.statLabel}>已上传</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{formatFileSize(totalSize)}</Text>
          <Text style={styles.statLabel}>总占用</Text>
        </View>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>最近上传</Text>
        {images.slice(0, 6).map((img: any) => (
          <TouchableOpacity key={img.id} style={styles.recentItem} onPress={() => navigation.navigate('图库', { screen: 'ImageDetail', params: { id: img.id } })}>
            <Text style={styles.recentName} numberOfLines={1}>{img.filename}</Text>
            <Text style={styles.recentDate}>{formatDate(img.created_at)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profileCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { ...fonts.serif, color: colors.white, fontSize: 28, fontWeight: '700' },
  username: { ...fonts.sans, fontSize: 20, fontWeight: '700', color: colors.ink },
  email: { ...fonts.sans, fontSize: 14, color: colors.ink4, marginTop: 4 },
  badge: { backgroundColor: colors.goldLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, marginTop: spacing.sm },
  badgeText: { ...fonts.sans, fontSize: 12, color: colors.gold, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  statNum: { ...fonts.serif, fontSize: 28, fontWeight: '700', color: colors.ink },
  statLabel: { ...fonts.sans, fontSize: 12, color: colors.ink4, marginTop: 4 },
  recentSection: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { ...fonts.sans, fontSize: 16, fontWeight: '600', color: colors.ink, marginBottom: spacing.md },
  recentItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  recentName: { ...fonts.sans, fontSize: 14, color: colors.ink, flex: 1, marginRight: spacing.sm },
  recentDate: { ...fonts.sans, fontSize: 12, color: colors.ink4 },
  logoutBtn: { borderWidth: 1, borderColor: colors.red, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center' },
  logoutText: { ...fonts.sans, color: colors.red, fontSize: 15, fontWeight: '600' },
});
