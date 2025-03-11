import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
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

export const VideoIdContext = createContext<string | null>(null);

export default function VideoDetailsScreen() {
  const params = useLocalSearchParams<PreviewParams>();
  const router = useRouter();

  // Get store actions and data
  const addVideo = useVideoStore(state => state.addVideo);
  const updateVideo = useVideoStore(state => state.updateVideo);
  const videos = useVideoStore(state => state.videos);

  const videoId = params.id || null;

  // Store the original values to compare against
  const originalName = params.name || '';
  const originalDescription = params.description || '';

  // Ensure we have valid trim values
  const trimStart = parseFloat(params.trimStart || '0');
  const trimEnd = parseFloat(params.trimEnd || params.duration || '0');

  const [name, setName] = useState(originalName);
  const [description, setDescription] = useState(originalDescription);
  const [isPlaying, setIsPlaying] = useState(false);

  // Track if changes have been made
  const hasChanges = name !== originalName || description !== originalDescription;

  // Check if this is an existing video
  const existingVideo = useMemo(() => {
    return videos.find(v => v.id === params.id);
  }, [videos, params.id]);

  const duration = parseFloat(params.duration || '0');

  const player = useVideoPlayer(params.uri || '', player => {
    player.loop = true;
  });

  const onChangeName = useCallback((text: string) => {
    setName(text);
  }, []);

  const onChangeDescription = useCallback((text: string) => {
    setDescription(text);
  }, []);

  // Set up video playback loop
  useEffect(() => {
    if (!player) return;

    const updateInterval = setInterval(() => {
      try {
        let currentPosition = 0;
        const playerAny = player as any;

        if (playerAny.position !== undefined) {
          currentPosition = playerAny.position;
        } else if (playerAny.positionMillis !== undefined) {
          currentPosition = playerAny.positionMillis / 1000;
        }

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

  const handlePlayPause = useCallback(() => {
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
      setIsPlaying(prev => !prev);
    } catch (error) {
      console.error('Error controlling playback:', error);
      Alert.alert('Error', 'Failed to control video playback');
    }
  }, [player, isPlaying, trimStart]);

  // Create the video object outside of handleSave to avoid recreating it on each render
  const updatedVideo = useMemo(() => ({
    id: params.id,
    localUri: params.uri,
    uri: params.uri,
    filename: params.filename,
    name: name.trim(),
    description: description.trim(),
    duration: trimEnd - trimStart,
    trimStart: trimStart,
    trimEnd: trimEnd,
    thumbnailUri: params.thumbnailUri,
    createdAt: existingVideo ? existingVideo.createdAt : Date.now()
  }), [
    params.id,
    params.uri,
    params.filename,
    name,
    description,
    trimStart,
    trimEnd,
    params.thumbnailUri,
    existingVideo
  ]);

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      return;
    }

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

    try {
      if (existingVideo) {
        await updateVideo(updatedVideo);
        Alert.alert('Success', 'Video updated successfully');
      } else {
        await addVideo(updatedVideo);
        Alert.alert('Success', 'Video saved successfully');
      }
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video. Please try again.');
    }
  }, [
    hasChanges,
    params.uri,
    params.thumbnailUri,
    name,
    existingVideo,
    updatedVideo,
    updateVideo,
    router,
    addVideo
  ]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <VideoIdContext.Provider value={videoId}>
      <LinearGradient colors={['#220643', '#692AA1']} style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.videoContainer}>
            <VideoView
              player={player}
              style={styles.video}
              nativeControls={true}
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
              <Text style={styles.label}>
                Name {name !== originalName && <Text style={styles.changedIndicator}>• Changed</Text>}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  name !== originalName && styles.changedInput
                ]}
                value={name}
                onChangeText={onChangeName}
                placeholder="Enter video name"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
              />

              <Text style={styles.label}>
                Description (optional) {description !== originalDescription && <Text style={styles.changedIndicator}>• Changed</Text>}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  description !== originalDescription && styles.changedInput
                ]}
                value={description}
                onChangeText={onChangeDescription}
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
                pressed && styles.buttonPressed,
                !hasChanges && styles.disabledButton
              ]}
              onPress={handleSave}
              disabled={!hasChanges}
            >
              <IconSymbol name="checkmark" size={24} color={hasChanges ? "white" : "rgba(255, 255, 255, 0.5)"} />
              <Text style={[styles.buttonText, !hasChanges && styles.disabledButtonText]}>
                {hasChanges ? "Save Changes" : "No Changes"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </VideoIdContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoContainer: {
    width: '100%',
    height: '45%',
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
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  disabledButtonText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  changedIndicator: {
    color: '#f20089',
    fontSize: 12,
    fontWeight: 'bold',
  },
  changedInput: {
    borderWidth: 1,
    borderColor: '#f20089',
  },
});
