import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth';
import { colors, spacing, radius, fonts } from '../theme';

export function RegisterScreen({ navigation }: any) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const regMutation = useMutation({
    mutationFn: () => authAPI.register(username, email, password),
    onSuccess: () => { navigation.navigate('Login'); },
    onError: (err: any) => { setError(err.response?.data?.message || '注册失败'); },
  });

  const valid = username.length >= 2 && email.includes('@') && password.length >= 6;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>赤子の相册</Text>
        <Text style={styles.subtitle}>创建新账号</Text>

        <TextInput style={styles.input} placeholder="用户名（至少2字）" placeholderTextColor={colors.ink5}
          value={username} onChangeText={(v) => { setUsername(v); setError(''); }} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="邮箱" placeholderTextColor={colors.ink5}
          value={email} onChangeText={(v) => { setEmail(v); setError(''); }}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <TextInput style={styles.input} placeholder="密码（至少6位）" placeholderTextColor={colors.ink5}
          value={password} onChangeText={(v) => { setPassword(v); setError(''); }} secureTextEntry />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!valid || regMutation.isPending) && styles.btnDisabled]}
          disabled={!valid || regMutation.isPending}
          onPress={() => regMutation.mutate()}
          activeOpacity={0.8}
        >
          {regMutation.isPending
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.btnText}>注册</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>已有账号？登录</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl },
  title: { ...fonts.serif, fontSize: 24, fontWeight: '700', color: colors.gold, marginBottom: 4 },
  subtitle: { ...fonts.sans, fontSize: 14, color: colors.ink4, marginBottom: spacing.lg },
  input: { ...fonts.sans, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15, color: colors.ink, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line },
  error: { ...fonts.sans, color: colors.red, fontSize: 13, marginBottom: spacing.md },
  btn: { backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md },
  btnDisabled: { opacity: 0.4 },
  btnText: { ...fonts.sans, color: colors.white, fontSize: 16, fontWeight: '600' },
  link: { ...fonts.sans, color: colors.gold, fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
});
