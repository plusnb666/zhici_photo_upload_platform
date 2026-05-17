import { useEffect, useRef } from 'react';
import { NavigationContainer, type NavigationContainerRef, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors, fonts } from '../theme';

import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { GalleryScreen } from '../screens/GalleryScreen';
import { ImageDetailScreen } from '../screens/ImageDetailScreen';
import { UploadScreen } from '../screens/UploadScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AdminScreen } from '../screens/AdminScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const GalleryStack = createNativeStackNavigator();

function GalleryStackScreen() {
  return (
    <GalleryStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.white },
      headerTintColor: colors.ink,
      headerTitleStyle: { ...fonts.sans, fontWeight: '600', fontSize: 16 },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.bg },
    }}>
      <GalleryStack.Screen name="Gallery" component={GalleryScreen} options={{ title: '全部图片' }} />
      <GalleryStack.Screen name="MyUploads" component={GalleryScreen} options={{ title: '我的上传' }} />
      <GalleryStack.Screen name="ImageDetail" component={ImageDetailScreen} options={{ title: '详情' }} />
    </GalleryStack.Navigator>
  );
}

function MainTabs() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.navigate('Landing');
    }
  }, [isAuthenticated]);

  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line, paddingBottom: 4, height: 56 },
      tabBarActiveTintColor: colors.gold,
      tabBarInactiveTintColor: colors.ink4,
      tabBarLabelStyle: { ...fonts.sans, fontSize: 11 },
      tabBarIcon: ({ color }) => {
        const icon = { 图库: '▦', 上传: '+', 我的: '○', 管理: '◎' }[route.name] || '●';
        return <Text style={{ color, fontSize: 20 }}>{icon}</Text>;
      },
    })}>
      <Tab.Screen name="图库" component={GalleryStackScreen} />
      <Tab.Screen name="上传" component={UploadScreen} options={{ headerShown: true, title: '上传',
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { ...fonts.sans, fontWeight: '600', fontSize: 16 },
      }} />
      <Tab.Screen name="我的" component={ProfileScreen} options={{ headerShown: true, title: '个人中心',
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { ...fonts.sans, fontWeight: '600', fontSize: 16 },
      }} />
      {isAdmin && (
        <Tab.Screen name="管理" component={AdminScreen} options={{ headerShown: true, title: '管理后台',
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { ...fonts.sans, fontWeight: '600', fontSize: 16 },
        }} />
      )}
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navRef = useRef<NavigationContainerRef<any>>(null);
  const prevAuth = useRef(isAuthenticated);

  useEffect(() => {
    if (prevAuth.current === false && isAuthenticated === true) {
      setTimeout(() => {
        navRef.current?.navigate('MainTabs');
      }, 50);
    }
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated]);

  return (
    <NavigationContainer ref={navRef}>
      <RootStack.Navigator screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.ink,
        headerTitleStyle: { ...fonts.sans, fontWeight: '600', fontSize: 16 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
        <RootStack.Screen name="Landing" component={LandingScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
        <RootStack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
        <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
