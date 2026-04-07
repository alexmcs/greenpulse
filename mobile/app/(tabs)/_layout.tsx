import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n';

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0D1F10', borderTopColor: '#1DB954' },
        tabBarActiveTintColor: '#1DB954',
        tabBarInactiveTintColor: '#5A7A5A',
        headerStyle: { backgroundColor: '#0D1F10' },
        headerTintColor: '#F0FFF4',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: t.tabs.verify,
          tabBarIcon: ({ color }) => <Ionicons name="camera" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="certificates"
        options={{
          title: t.tabs.certificates,
          tabBarIcon: ({ color }) => <Ionicons name="document-text" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: null, // скрыт из tab bar — открывается из профиля
        }}
      />
    </Tabs>
  );
}
