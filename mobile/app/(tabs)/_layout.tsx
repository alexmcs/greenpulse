import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
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
          title: 'Главная',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: 'Верифицировать',
          tabBarIcon: ({ color }) => <Ionicons name="camera" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="certificates"
        options={{
          title: 'Сертификаты',
          tabBarIcon: ({ color }) => <Ionicons name="document-text" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Админка',
          href: null, // Скрыт из tab bar — доступен только из профиля
        }}
      />
    </Tabs>
  );
}
