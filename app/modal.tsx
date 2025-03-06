import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Pressable, FlatList, Image, Dimensions } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Text, View } from '@/components/Themed';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 64) / 4; // 4 columns with 16px padding on each side

interface VideoItem extends MediaLibrary.Asset {
  filename: string;
  uri: string;
  duration: number;
  width: number;
  height: number;
  thumbnailUri?: string;
}

const generateThumbnail = async (videoUri: string, duration: number) => {

  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 1000,
      quality: 0.5,
    });
    return uri;
  } catch (error) {
    console.log(`Failed to generate thumbnail:`, error);
    return null;
  }
};

export default function ModalScreen() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status === 'granted') {
        const media = await MediaLibrary.getAssetsAsync({
          mediaType: ['video'],
          first: 50, // Limit to 50 videos for performance
          sortBy: ['creationTime'],
        });

        console.log('Found videos:', media.assets.length);

        // Generate thumbnails for each video
        const videosWithThumbnails = await Promise.all(
          media.assets.map(async (video) => {
            try {
              const assetInfo = await MediaLibrary.getAssetInfoAsync(video);
              const videoUri = assetInfo.localUri || assetInfo.uri;

              // Try to generate thumbnail
              const thumbnailUri = await generateThumbnail(videoUri, video.duration);

              if (thumbnailUri) {
                console.log('Successfully generated thumbnail for:', video.filename);
              } else {
                console.log('Failed to generate thumbnail for:', video.filename);
              }

              return { ...video, thumbnailUri: thumbnailUri || undefined };
            } catch (error) {
              console.error('Error processing video:', error);
              return video;
            }
          })
        );

        setVideos(videosWithThumbnails);
      }
      setLoading(false);
    })();
  }, []);

  const handleVideoSelect = (video: VideoItem) => {
    console.log('video --->', video);
    router.push({
      pathname: '/crop/[id]',
      params: {
        id: video.id,
        uri: video.uri,
        duration: video.duration,
        filename: video.filename,
        width: video.width,
        height: video.height,
      }
    });
  };

  const renderVideoItem = ({ item }: { item: VideoItem }) => (
    <Pressable
      style={({ pressed }) => [
        styles.videoItem,
        pressed && styles.videoItemPressed
      ]}
      onPress={() => handleVideoSelect(item)}
    >
      <Image
        source={{ uri: item.thumbnailUri || item.uri }}
        style={styles.videoThumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoInfo}>
        <Text style={styles.videoDuration}>
          {Math.floor(item.duration)}s
        </Text>
      </View>
      {!item.thumbnailUri && (
        <View style={styles.failedThumbnail}>
          <IconSymbol name="video" size={24} color="white" />
        </View>
      )}
    </Pressable>
  );

  return (
    <LinearGradient colors={['#220643', '#692AA1']} style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <IconSymbol name="photo.badge.plus" size={42} color="white" />
          <Text style={styles.title}>Select Video</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading videos...</Text>
          </View>
        ) : (
          <FlatList
            data={videos}
            renderItem={renderVideoItem}
            keyExtractor={(item) => item.id}
            numColumns={4}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
          />
        )}

        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
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
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  listContent: {
    paddingBottom: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  videoItem: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.5,
    borderRadius: 8,
    overflow: 'hidden',
    // borderWidth: 2,
    // borderColor: 'white',
  },
  videoItemPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }]
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 4,
  },
  videoDuration: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  failedThumbnail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  }
});
