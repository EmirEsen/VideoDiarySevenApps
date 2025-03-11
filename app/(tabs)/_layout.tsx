import React from 'react';
import { router, Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { Pressable, Text } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';

// Access the global delete handler
declare global {
  var currentDeleteHandler: (() => void) | null;
}

export default function Layout() {
  const router = useRouter();

  // Function to handle delete button press
  const handleDeletePress = () => {
    // Call the global delete handler if it exists
    if (global.currentDeleteHandler) {
      global.currentDeleteHandler();
    }
  };

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
        name="[id]/crop"
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
      <Stack.Screen
        name="[id]/videoDetails"
        options={{
          title: 'Video Details',
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconSymbol name="chevron.left" size={18} color="white" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>Video Library</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleDeletePress}
              style={{
                padding: 10,
                marginRight: 5
              }}
            >
              <IconSymbol name="trash" size={20} color="red" />
            </Pressable>
          )
        }}
      />
    </Stack>
  );
}
