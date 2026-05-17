import { Image, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { colors, radius, fonts } from '../theme';
import { formatFileSize } from '../utils/format';

const CARD_W = (Dimensions.get('window').width - 56) / 2;

interface Props {
  img: any;
  showUploader?: boolean;
  showActions?: boolean;
  onPress: () => void;
  onDelete?: () => void;
  onRename?: () => void;
}

export function ImageCard({ img, showUploader, showActions, onPress, onDelete, onRename }: Props) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <Image source={{ uri: img.thumbnail_url || img.url }} style={styles.image} resizeMode="cover" />
      {showUploader && img.username && (
        <View style={styles.uploaderBadge}>
          <Text style={styles.uploaderText}>{img.username}</Text>
        </View>
      )}
      <View style={styles.meta}>
        <Text style={styles.filename} numberOfLines={1}>{img.filename}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.size}>{formatFileSize(img.file_size)}</Text>
          {img.tags?.slice(0, 2).map((t: any) => (
            <Text key={t.id} style={styles.tag}>{t.name}</Text>
          ))}
        </View>
      </View>
      {showActions && (
        <View style={styles.actions}>
          {onRename && (
            <TouchableOpacity style={styles.actionBtn} onPress={onRename}>
              <Text style={styles.actionIcon}>✎</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
              <Text style={[styles.actionIcon, styles.deleteIcon]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_W, backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden' },
  image: { width: '100%', height: CARD_W * 0.75, backgroundColor: colors.bgSecondary },
  uploaderBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.overlay, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  uploaderText: { ...fonts.sans, color: colors.white, fontSize: 11, fontWeight: '600' },
  meta: { padding: 10, gap: 4 },
  filename: { ...fonts.sans, fontSize: 13, fontWeight: '600', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  size: { ...fonts.sans, fontSize: 11, color: colors.ink4 },
  tag: { ...fonts.sans, fontSize: 10, color: colors.gold, backgroundColor: colors.goldLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  actions: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 4 },
  actionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { color: colors.white, fontSize: 14 },
  deleteIcon: { color: colors.red },
});
