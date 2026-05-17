import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/admin';
import { formatFileSize, formatDate } from '../utils/format';
import { colors, spacing, radius, fonts } from '../theme';

export function AdminScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'users' | 'images'>('users');

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => adminAPI.stats() });
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminAPI.listUsers({ limit: 100 }),
    enabled: tab === 'users',
  });
  const { data: imagesData } = useQuery({
    queryKey: ['admin-images'],
    queryFn: () => adminAPI.listImages({ limit: 100 }),
    enabled: tab === 'images',
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => adminAPI.updateUser(id, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
  const resetPwdMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => adminAPI.resetUserPassword(id, password),
    onSuccess: () => Alert.alert('密码已重置'),
  });
  const deleteImageMutation = useMutation({
    mutationFn: (id: number) => adminAPI.deleteImage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-images'] }),
  });

  const s = stats?.data?.data ?? {};
  const users: any[] = usersData?.data?.data?.items ?? [];
  const images: any[] = imagesData?.data?.data?.items ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{s.total_users || 0}</Text><Text style={styles.statLabel}>用户</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{s.total_images || 0}</Text><Text style={styles.statLabel}>图片</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{formatFileSize(s.total_storage || 0)}</Text><Text style={styles.statLabel}>存储</Text></View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'users' && styles.tabActive]} onPress={() => setTab('users')}>
          <Text style={[styles.tabText, tab === 'users' && styles.tabTextActive]}>用户</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'images' && styles.tabActive]} onPress={() => setTab('images')}>
          <Text style={[styles.tabText, tab === 'images' && styles.tabTextActive]}>图片</Text>
        </TouchableOpacity>
      </View>

      {tab === 'users' && (
        <FlatList
          data={users}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }: any) => (
            <View style={styles.userRow}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.username}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userStorage}>{formatFileSize(item.storage_used || 0)} · {formatDate(item.created_at)}</Text>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.roleBtn, item.role === 'admin' && styles.roleBtnAdmin]}
                  onPress={() => updateRoleMutation.mutate({ id: item.id, role: item.role === 'admin' ? 'user' : 'admin' })}
                >
                  <Text style={styles.roleBtnText}>{item.role === 'admin' ? 'Admin' : 'User'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetBtn} onPress={() => {
                  Alert.prompt?.('重置密码', '输入新密码（至少6位）', [
                    { text: '取消', style: 'cancel' },
                    { text: '确认', onPress: (pwd?: string) => {
                      if (pwd && pwd.length >= 6) resetPwdMutation.mutate({ id: item.id, password: pwd });
                    }},
                  ], 'secure-text');
                }}>
                  <Text style={styles.resetBtnText}>密码</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {tab === 'images' && (
        <FlatList
          data={images}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={({ item }: any) => (
            <View style={styles.imgRow}>
              <View style={styles.imgInfo}>
                <Text style={styles.imgName} numberOfLines={1}>{item.filename}</Text>
                <Text style={styles.imgMeta}>{item.username} · {formatFileSize(item.file_size)} · {formatDate(item.created_at)}</Text>
              </View>
              <TouchableOpacity style={styles.imgDelete} onPress={() => {
                Alert.alert('确认删除', item.filename, [
                  { text: '取消', style: 'cancel' },
                  { text: '删除', style: 'destructive', onPress: () => deleteImageMutation.mutate(item.id) },
                ]);
              }}>
                <Text style={styles.imgDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  statNum: { ...fonts.serif, fontSize: 22, fontWeight: '700', color: colors.ink },
  statLabel: { ...fonts.sans, fontSize: 11, color: colors.ink4, marginTop: 2 },
  tabRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.white },
  tabActive: { backgroundColor: colors.ink },
  tabText: { ...fonts.sans, fontSize: 14, color: colors.ink3 },
  tabTextActive: { color: colors.white, fontWeight: '600' },
  userRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { ...fonts.sans, fontSize: 14, fontWeight: '600', color: colors.ink },
  userEmail: { ...fonts.sans, fontSize: 12, color: colors.ink4, marginTop: 2 },
  userStorage: { ...fonts.sans, fontSize: 11, color: colors.ink5, marginTop: 2 },
  userActions: { flexDirection: 'row', gap: spacing.xs },
  roleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.bgSecondary },
  roleBtnAdmin: { backgroundColor: colors.goldLight },
  roleBtnText: { ...fonts.sans, fontSize: 12, color: colors.ink },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.bgSecondary },
  resetBtnText: { ...fonts.sans, fontSize: 12, color: colors.gold },
  imgRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  imgInfo: { flex: 1 },
  imgName: { ...fonts.sans, fontSize: 14, fontWeight: '600', color: colors.ink },
  imgMeta: { ...fonts.sans, fontSize: 12, color: colors.ink4, marginTop: 2 },
  imgDelete: { padding: spacing.sm },
  imgDeleteText: { fontSize: 16, color: colors.red },
});
