import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { imagesAPI } from '../api/images';
import { tagsAPI } from '../api/tags';
import { useAuthStore } from '../store/authStore';
import { TagChip } from '../components/TagChip';
import { formatFileSize } from '../utils/format';
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE_BYTES } from '../utils/constants';
import { colors, spacing, radius, fonts } from '../theme';

export function UploadScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const { data: tagData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsAPI.list() });
  const availableTags: any[] = tagData?.data?.data?.items ?? [];

  const uploadMutation = useMutation({
    mutationFn: () => new Promise((resolve, reject) => {
      const token = useAuthStore.getState().accessToken;
      const formData = new FormData();
      for (const f of files) {
        const name = (f.fileName || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
        formData.append('files', {
          uri: f.uri,
          type: f.mimeType || 'image/jpeg',
          name,
        } as any);
      }
      if (tags.length > 0) formData.append('tags', JSON.stringify(tags));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'http://47.116.137.143:8080/api/v1/images/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).message || `HTTP ${xhr.status}`)); }
          catch { reject(new Error(`HTTP ${xhr.status}`)); }
        }
      };
      xhr.onerror = () => reject(new Error('XHR error'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      xhr.timeout = 60000;
      xhr.send(formData);
    }),
    onSuccess: () => {
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ['my-images'] });
      navigation.navigate('图库');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || String(err);
      Alert.alert('上传失败', msg);
    },
  });

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      setFiles((prev) => [...prev, ...result.assets].slice(0, 10));
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('请允许相机权限'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets.length > 0) {
      setFiles((prev) => [...prev, ...result.assets].slice(0, 10));
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>上传图片</Text>

      <View style={styles.dropZone}>
        <Text style={styles.dropIcon}>╋</Text>
        <Text style={styles.dropText}>选择图片上传</Text>
        <Text style={styles.dropHint}>支持 PNG, JPEG, GIF, WebP, BMP</Text>

        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickBtn} onPress={pickImages}>
            <Text style={styles.pickBtnText}>相册</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickBtnOutline} onPress={takePhoto}>
            <Text style={styles.pickBtnOutlineText}>拍照</Text>
          </TouchableOpacity>
        </View>
      </View>

      {files.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.subtitle}>已选 {files.length} 张</Text>
          {files.map((f, i) => {
            const isTooBig = (f.fileSize || 0) > UPLOAD_MAX_SIZE_BYTES;
            return (
              <View key={i} style={styles.fileRow}>
                <Image source={{ uri: f.uri }} style={styles.thumb} />
                <View style={styles.fileMeta}>
                  <Text style={styles.fileName} numberOfLines={1}>{f.fileName || `photo_${i}`}</Text>
                  <Text style={[styles.fileSize, isTooBig && { color: colors.red }]}>
                    {formatFileSize(f.fileSize || 0)}{isTooBig ? ' (超限)' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setFiles(files.filter((_, j) => j !== i))}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.tagSection}>
            <Text style={styles.subtitle}>添加标签（可选）</Text>
            <View style={styles.tagRow}>
              {availableTags.map((t: any) => (
                <TagChip key={t.id} tag={t} active={tags.includes(t.name)}
                  onPress={() => {
                    setTags(tags.includes(t.name) ? tags.filter((x) => x !== t.name) : [...tags, t.name]);
                  }} />
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.uploadBtn, uploadMutation.isPending && { opacity: 0.5 }]}
            disabled={uploadMutation.isPending || files.length === 0}
            onPress={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.uploadBtnText}>上传 {files.length} 张</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...fonts.serif, fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: spacing.lg },
  dropZone: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed', paddingVertical: spacing.xxl, alignItems: 'center', marginBottom: spacing.lg },
  dropIcon: { fontSize: 36, color: colors.ink5 },
  dropText: { ...fonts.sans, fontSize: 16, fontWeight: '600', color: colors.ink, marginTop: spacing.sm },
  dropHint: { ...fonts.sans, fontSize: 12, color: colors.ink4, marginTop: spacing.xs, marginBottom: spacing.lg },
  pickRow: { flexDirection: 'row', gap: spacing.sm },
  pickBtn: { backgroundColor: colors.ink, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.sm },
  pickBtnText: { ...fonts.sans, color: colors.white, fontSize: 15, fontWeight: '600' },
  pickBtnOutline: { borderWidth: 1, borderColor: colors.ink, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.sm },
  pickBtnOutlineText: { ...fonts.sans, color: colors.ink, fontSize: 15, fontWeight: '600' },
  previewSection: { gap: spacing.sm },
  subtitle: { ...fonts.sans, fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: spacing.xs },
  fileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.bgSecondary },
  fileMeta: { flex: 1 },
  fileName: { ...fonts.sans, fontSize: 14, fontWeight: '600', color: colors.ink },
  fileSize: { ...fonts.sans, fontSize: 12, color: colors.ink4, marginTop: 2 },
  removeBtn: { fontSize: 18, color: colors.ink4, padding: spacing.sm },
  tagSection: { marginTop: spacing.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  uploadBtn: { backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 16, alignItems: 'center', marginTop: spacing.md },
  uploadBtnText: { ...fonts.sans, color: colors.white, fontSize: 16, fontWeight: '700' },
});
