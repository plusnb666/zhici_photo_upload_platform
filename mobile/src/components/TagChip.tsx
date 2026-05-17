import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export function TagChip({ tag, active, onPress }: { tag: any; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, active && styles.textActive]}>{tag.name}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  text: { fontSize: 12, color: colors.ink3 },
  textActive: { color: colors.white, fontWeight: '600' },
});
