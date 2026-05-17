import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, TextInput, StyleSheet, TouchableOpacity, Text, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { imagesAPI } from '../api/images';
import { tagsAPI } from '../api/tags';
import { ImageCard } from '../components/ImageCard';
import { TagChip } from '../components/TagChip';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, radius, fonts } from '../theme';
import { PAGE_SIZE } from '../utils/constants';

export function GalleryScreen({ navigation, route }: any) {
  const mine = route.name === 'MyUploads';
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: imgData, isLoading } = useQuery({
    queryKey: [mine ? 'my-images' : 'all-images', page, search, tagFilter, refreshKey],
    queryFn: () => mine
      ? imagesAPI.list({ page, limit: PAGE_SIZE, search, tag: tagFilter })
      : imagesAPI.listPublic({ page, limit: PAGE_SIZE, search, tag: tagFilter }),
  });
  const { data: tagData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsAPI.list() });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => imagesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [mine ? 'my-images' : 'all-images'] });
    },
  });

  const newItems: any[] = imgData?.data?.data?.items ?? [];
  const total = imgData?.data?.data?.total ?? 0;
  const tags: any[] = tagData?.data?.data?.items ?? [];

  const [allImages, setAllImages] = useState<any[]>([]);
  const prevPage = useRef(0);

  useEffect(() => {
    if (page === 1) {
      setAllImages(newItems);
    } else if (page > prevPage.current) {
      setAllImages((prev) => [...prev, ...newItems]);
    }
    if (newItems.length > 0) prevPage.current = page;
  }, [newItems, page]);

  const resetList = () => { setAllImages([]); setPage(1); setRefreshKey(k => k + 1); };
  const handleRefresh = () => { setPage(1); setRefreshKey(k => k + 1); };

  const isRefreshing = isLoading && allImages.length === 0;

  const handleDelete = (id: number) => {
    Alert.alert('确认删除', '删除后不可恢复', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const renderItem = useCallback(({ item }: any) => (
    <ImageCard
      img={item}
      showUploader={!mine}
      showActions={mine}
      onPress={() => navigation.navigate('ImageDetail', { id: item.id })}
      onDelete={() => handleDelete(item.id)}
      onRename={() => {
        Alert.prompt?.('重命名', '输入新文件名', [
          { text: '取消', style: 'cancel' },
          { text: '确认', onPress: (name?: string) => {
            if (name?.trim()) {
              imagesAPI.update(item.id, { filename: name.trim() }).then(() => {
                queryClient.invalidateQueries({ queryKey: [mine ? 'my-images' : 'all-images'] });
              });
            }
          }},
        ], 'plain-text', item.filename);
      }}
    />
  ), [mine]);

  return (
    <View style={styles.root}>
      <View style={styles.filterRow}>
        <TextInput style={styles.search} placeholder="搜索..." placeholderTextColor={colors.ink5}
          value={search} onChangeText={(v) => { setSearch(v); resetList(); }} />
      </View>
      <View style={styles.tagRow}>
        {tags.map((t: any) => (
          <TagChip key={t.id} tag={t} active={tagFilter === t.name}
            onPress={() => { setTagFilter(tagFilter === t.name ? undefined : t.name); resetList(); }} />
        ))}
      </View>

      <FlatList
        data={allImages}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={isRefreshing ? null : <EmptyState message={mine ? '你还没有上传图片' : '暂无图片'} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        onEndReached={() => { if (!isRefreshing && allImages.length < total) setPage((p) => p + 1); }}
        onEndReachedThreshold={0.3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  filterRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: { ...fonts.sans, backgroundColor: colors.white, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: colors.line, color: colors.ink },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
});
