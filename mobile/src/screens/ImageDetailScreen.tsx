import { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { imagesAPI } from '../api/images';
import { tagsAPI } from '../api/tags';
import { useAuthStore } from '../store/authStore';
import { TagChip } from '../components/TagChip';
import { EmptyState } from '../components/EmptyState';
import { formatFileSize, formatDateTime } from '../utils/format';
import { colors, spacing, radius, fonts } from '../theme';

export function ImageDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data } = useQuery({
    queryKey: ['image', id],
    queryFn: () => imagesAPI.get(Number(id)),
    enabled: !!id,
  });
  const { data: tagData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsAPI.list() });
  const { data: commentData } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => imagesAPI.listComments(Number(id)),
  });

  const toggleMutation = useMutation({
    mutationFn: (tagId: number) => imagesAPI.toggleTag(Number(id), tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['image', id] }),
  });
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => imagesAPI.createComment(Number(id), content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', id] }),
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => imagesAPI.deleteComment(Number(id), commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', id] }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => imagesAPI.delete(Number(id)),
    onSuccess: () => { navigation.goBack(); },
  });

  const img = data?.data?.data;
  const tags: any[] = tagData?.data?.data?.items ?? [];
  const comments: any[] = commentData?.data?.data ?? [];
  const [commentText, setCommentText] = useState('');

  if (!img) {
    return <View style={styles.root}><ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 80 }} /></View>;
  }

  const activeTagIds = new Set((img.tags || []).filter((t: any) => t.active).map((t: any) => t.id));

  const handleComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed || trimmed.length > 500) return;
    createCommentMutation.mutate(trimmed);
    setCommentText('');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Image source={{ uri: img.url }} style={styles.image} resizeMode="contain" />

      <Text style={styles.filename}>{img.filename}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{formatFileSize(img.file_size)}</Text>
        <Text style={styles.metaSep}>·</Text>
        <Text style={styles.meta}>{img.mime_type}</Text>
        <Text style={styles.metaSep}>·</Text>
        <Text style={styles.meta}>{formatDateTime(img.created_at)}</Text>
      </View>
      {img.username && (
        <Text style={styles.uploader}>上传者: {img.username}</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>标签</Text>
        <View style={styles.tagRow}>
          {tags.map((t: any) => (
            <TagChip key={t.id} tag={t} active={activeTagIds.has(t.id)} onPress={() => toggleMutation.mutate(t.id)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btn} onPress={() => {
            Alert.alert('确认删除', '', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ]);
          }}>
            <Text style={styles.btnTextDanger}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>评论 ({comments.length})</Text>
        {comments.length === 0 ? (
          <EmptyState message="暂无评论" />
        ) : (
          comments.map((c: any) => (
            <View key={c.id} style={styles.commentItem}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>{(c.username || '?')[0]}</Text>
              </View>
              <View style={styles.commentBody}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentUser}>{c.username}</Text>
                  <Text style={styles.commentTime}>{formatDateTime(c.created_at)}</Text>
                </View>
                <Text style={styles.commentContent}>{c.content}</Text>
              </View>
              {(user?.id === c.user_id || user?.role === 'admin') && (
                <TouchableOpacity style={styles.commentDelete} onPress={() => deleteCommentMutation.mutate(c.id)}>
                  <Text style={styles.commentDeleteIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="写下评论..."
            placeholderTextColor={colors.ink5}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={500}
            multiline
          />
          <TouchableOpacity
            style={[styles.commentSubmit, !commentText.trim() && { opacity: 0.4 }]}
            disabled={!commentText.trim()}
            onPress={handleComment}
          >
            <Text style={styles.commentSubmitText}>发送</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  image: { width: '100%', height: 320, backgroundColor: colors.bgSecondary },
  filename: { ...fonts.sans, fontSize: 20, fontWeight: '700', color: colors.ink, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  meta: { ...fonts.sans, fontSize: 13, color: colors.ink4 },
  metaSep: { marginHorizontal: 6, color: colors.ink5 },
  uploader: { ...fonts.sans, fontSize: 13, color: colors.ink3, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { ...fonts.sans, fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: spacing.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.red },
  btnTextDanger: { ...fonts.sans, color: colors.red, fontSize: 14, fontWeight: '600' },
  commentItem: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-start' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  commentAvatarText: { ...fonts.sans, color: colors.white, fontSize: 14, fontWeight: '600' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  commentUser: { ...fonts.sans, fontSize: 13, fontWeight: '600', color: colors.ink },
  commentTime: { ...fonts.sans, fontSize: 11, color: colors.ink5 },
  commentContent: { ...fonts.sans, fontSize: 14, color: colors.ink2, lineHeight: 20 },
  commentDelete: { padding: 4 },
  commentDeleteIcon: { fontSize: 14, color: colors.ink5 },
  commentInputRow: { flexDirection: 'row', marginTop: spacing.md, alignItems: 'flex-end', gap: spacing.sm },
  commentInput: { ...fonts.sans, flex: 1, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: colors.line, color: colors.ink, maxHeight: 80 },
  commentSubmit: { backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 12 },
  commentSubmitText: { ...fonts.sans, color: colors.white, fontSize: 14, fontWeight: '600' },
});
