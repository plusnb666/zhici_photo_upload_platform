import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.icon}>◷</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  icon: { fontSize: 40, color: colors.ink5, marginBottom: 12 },
  text: { ...fonts.sans, fontSize: 14, color: colors.ink4 },
});
