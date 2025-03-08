import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useState } from 'react';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';

export default function ModalScreen() {
  const [status, requestPermission] = MediaLibrary.usePermissions();

  const pickVideo = async () => {
    // Request media library permissions
    if (status?.status !== 'granted') {
      const newStatus = await requestPermission();
      if (newStatus.status !== 'granted') {
        alert('Sorry, we need media library permissions to make this work!');
        return;
      }
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const video = result.assets[0];

      // Get asset info from MediaLibrary
      const asset = await MediaLibrary.createAssetAsync(video.uri);

      // Close modal and navigate to crop screen in stack
      router.dismiss();

      // Navigate to crop screen in stack
      router.push({
        pathname: '/(tabs)/crop/[id]',
        params: {
          id: asset.id,
          uri: asset.uri,
          filename: asset.filename || 'video',
          duration: asset.duration?.toString() || '0',
          width: asset.width?.toString() || '0',
          height: asset.height?.toString() || '0'
        }
      });
    }
  };

  return (
    <LinearGradient colors={['#220643', '#692AA1']} style={styles.container}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}>
          <IconSymbol name="xmark" size={24} color="white" />
        </Pressable>
        <Text style={styles.title}>Add Video</Text>
      </View>

      <View style={styles.optionsContainer}>
        <Pressable style={styles.option} onPress={pickVideo}>
          <View style={styles.iconContainer}>
            <IconSymbol name="photo.on.rectangle" size={32} color="white" />
          </View>
          <Text style={styles.optionText}>Choose from Library</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 32,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 16,
  },
  optionsContainer: {
    flex: 1,
    gap: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f20089',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
});
