import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { isFinal } from '@/lib/order-status';
import { useApp } from '@/store/app-store';

export default function TabsLayout() {
  const { orders } = useApp();
  const activeOrders = orders.filter((o) => !isFinal(o.status)).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarLabelStyle: { fontFamily: Fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: Colors.bg, borderTopColor: Colors.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Étlap',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={23} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Keresés',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={23} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Rendelések',
          tabBarBadge: activeOrders > 0 ? activeOrders : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.brand, fontFamily: Fonts.bold },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={23} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
