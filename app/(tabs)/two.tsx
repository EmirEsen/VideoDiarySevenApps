import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/IconSymbol';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, Image } from 'react-native';
import { useVideoStore } from '@/store/videoStore';

type PreviewParams = {
  id: string;
  uri: string;
  filename: string;
  duration: string;
  trimStart: string;
  trimEnd: string;
  thumbnailUri: string;
  name: string;
  description: string;
};

export default function VideoPreviewScreen() {
  const params = useLocalSearchParams<PreviewParams>();
  const router = useRouter();
  const addVideo = useVideoStore(state => state.addVideo);

  const [name, setName] = useState(params.filename || '');
  const [description, setDescription] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Parse numeric values
  const duration = parseFloat(params.duration || '0');
  const trimStart = parseFloat(params.trimStart || '0');
  const trimEnd = parseFloat(params.trimEnd || '0');

  const player = useVideoPlayer(params.uri || '', player => {
    try {
      // Set initial position to trim start
      const playerAny = player as any;
      if (playerAny.position !== undefined) {
        playerAny.position = trimStart;
      } else if (playerAny.positionMillis !== undefined) {
        playerAny.positionMillis = trimStart * 1000;
      }
    } catch (error) {
      console.error('Error initializing player:', error);
    }
  });

  // Monitor playback position to loop within selected portion
  useEffect(() => {
    if (!player) return;

    const updateInterval = setInterval(() => {
      try {
        let currentPosition = 0;
        const playerAny = player as any;

        // Try to get current position
        if (playerAny.position !== undefined) {
          currentPosition = playerAny.position;
        } else if (playerAny.positionMillis !== undefined) {
          // Convert from milliseconds to seconds with precision
          currentPosition = playerAny.positionMillis / 1000;
        }

        // If position exceeds trim end, loop back to trim start
        if (currentPosition >= trimEnd) {
          if (playerAny.position !== undefined) {
            playerAny.position = trimStart;
          } else if (playerAny.positionMillis !== undefined) {
            playerAny.positionMillis = trimStart * 1000;
          }
        }
      } catch (error) {
        console.log('Error updating position:', error);
      }
    }, 50);

    return () => clearInterval(updateInterval);
  }, [player, trimStart, trimEnd]);

  const handlePlayPause = () => {
    if (!player) return;

    try {
      const playerAny = player as any;
      if (isPlaying) {
        if (typeof playerAny.pause === 'function') {
          playerAny.pause();
        }
      } else {
        if (playerAny.position !== undefined) {
          playerAny.position = trimStart;
        } else if (playerAny.positionMillis !== undefined) {
          playerAny.positionMillis = trimStart * 1000;
        }

        if (typeof playerAny.play === 'function') {
          playerAny.play();
        }
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error controlling playback:', error);
      Alert.alert('Error', 'Failed to control video playback');
    }
  };

  const handleSave = () => {
    if (!params.uri) {
      Alert.alert('Error', 'Video not available');
      return;
    }

    if (!params.thumbnailUri) {
      Alert.alert('Error', 'Thumbnail not available');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for your video');
      return;
    }

    // Add to store
    addVideo({
      id: params.id,
      uri: params.uri,
      filename: params.filename,
      name: name.trim(),
      description: description.trim(),
      duration: trimEnd - trimStart,
      trimStart: trimStart,
      trimEnd: trimEnd,
      thumbnailUri: params.thumbnailUri,
      createdAt: Date.now()
    });

    // Show success message
    Alert.alert(
      'Success',
      'Video saved successfully',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to the index page
            router.push('/(tabs)');
          }
        }
      ]
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <LinearGradient colors={['#220643', '#692AA1']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="white" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Save Video</Text>
        </View>

        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
          />
          <Pressable
            style={styles.playButton}
            onPress={handlePlayPause}
          >
            <IconSymbol
              name={isPlaying ? "pause.fill" : "play.fill"}
              size={32}
              color="white"
            />
          </Pressable>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: params.thumbnailUri }}
              style={styles.thumbnail}
            />
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatDuration(trimEnd - trimStart)}
              </Text>
            </View>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter video name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter video description"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.buttonPressed
            ]}
            onPress={handleSave}
          >
            <IconSymbol name="checkmark" size={24} color="white" />
            <Text style={styles.buttonText}>Save Video</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: 'transparent',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    flex: 1,
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  infoContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  thumbnailContainer: {
    width: 120,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: 'white',
    fontSize: 12,
  },
  formContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  label: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  saveButton: {
    backgroundColor: '#f20089',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
