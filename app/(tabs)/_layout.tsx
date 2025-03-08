import React from 'react';
import { router, Stack } from 'expo-router';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { Pressable, Text } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';

export default function Layout() {

  return (
    <Stack
      screenOptions={{
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: '#10002b',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Video Library',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="crop/[id]"
        options={{
          title: 'Edit',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconSymbol name="chevron.left" size={18} color="white" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>Video Library</Text>
            </Pressable>
          )
        }}
      />
    </Stack>
  );
}
