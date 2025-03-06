import React from 'react';
import { Stack } from 'expo-router';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

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
          headerShown: false,
        }}
      />
    </Stack>
  );
}
