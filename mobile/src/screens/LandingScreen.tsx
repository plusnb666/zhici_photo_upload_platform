import { useState, useEffect, useCallback, useRef } from 'react';
import { View, FlatList, Text, TextInput, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { imagesAPI } from '../api/images';
import { tagsAPI } from '../api/tags';
import { useAuthStore } from '../store/authStore';
import { ImageCard } from '../components/ImageCard';
import { TagChip } from '../components/TagChip';
import { EmptyState } from '../components/EmptyState';
import { colors, spacing, radius, fonts } from '../theme';
import { PAGE_SIZE } from '../utils/constants';

export function LandingScreen({ navigation }: any) {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: imgData, isLoading } = useQuery({
    queryKey: ['public-images', page, search, tagFilter, refreshKey],
    queryFn: () => imagesAPI.listPublic({ page, limit: PAGE_SIZE, search, tag: tagFilter }),
  });
  const { data: tagData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
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

  const handleSearch = (v: string) => { setSearch(v); setPage(1); setRefreshKey(k => k + 1); };
  const handleTag = (name?: string) => { setTagFilter(name); setPage(1); setRefreshKey(k => k + 1); };
  const handleRefresh = () => { setPage(1); setRefreshKey(k => k + 1); };

  const isRefreshing = isLoading && allImages.length === 0;

  const renderItem = useCallback(({ item }: any) => (
    <ImageCard
      img={item}
      showUploader
      onPress={() => isAuth
        ? navigation.navigate('MainTabs', { screen: '图库', params: { screen: 'ImageDetail', params: { id: item.id } } })
        : navigation.navigate('Login', { id: item.id })}
    />
  ), [isAuth]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.logo}>赤子の相册</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnOutlineText}>登录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.btnPrimaryText}>注册</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TextInput
          style={styles.search}
          placeholder="搜索图片..."
          placeholderTextColor={colors.ink5}
          value={search}
          onChangeText={handleSearch}
        />
      </View>
      <View style={styles.tagRow}>
        {tags.map((t: any) => (
          <TagChip key={t.id} tag={t} active={tagFilter === t.name} onPress={() => handleTag(tagFilter === t.name ? undefined : t.name)} />
        ))}
      </View>

      <FlatList
        data={allImages}
        keyExtractor={(item: any) => String(item.id)}
        renderItem={renderItem}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={isRefreshing ? null : <EmptyState message="暂无公开图片" />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        onEndReached={() => {
          if (!isRefreshing && allImages.length < total) setPage((p) => p + 1);
        }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  logo: { ...fonts.serif, fontSize: 22, fontWeight: '700', color: colors.gold },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  btnPrimary: { backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm },
  btnPrimaryText: { ...fonts.sans, color: colors.white, fontSize: 14, fontWeight: '600' },
  btnOutline: { borderWidth: 1, borderColor: colors.ink, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.sm },
  btnOutlineText: { ...fonts.sans, color: colors.ink, fontSize: 14, fontWeight: '600' },
  filterRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: { ...fonts.sans, backgroundColor: colors.white, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: colors.line, color: colors.ink },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
});
