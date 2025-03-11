import { SafeAreaView, StyleSheet, Pressable } from 'react-native';

import { Text, View } from '@/components/Themed';
import { IconSymbol } from '@/components/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { useVideoStore } from '@/store/videoStore';
import { TrimmedVideo } from '@/components/video/TrimmedVideo';
import VideoThumbNail from '@/components/video/VideoThumbNail';

export default function TabOneScreen() {
  const videos = useVideoStore(state => state.videos);


  const renderItem = ({ item }: { item: TrimmedVideo }) => {
    return (
      <VideoThumbNail video={item} />
    );
  }

  return (
    <LinearGradient colors={['#220643', '#692AA1']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>

        <View style={styles.header}>
          <IconSymbol name="play.square.stack.fill" size={42} color="white" />
          <Text style={styles.title}>Video Library</Text>
        </View>

        <View style={styles.content}>
          <FlatList
            data={videos}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed
          ]}
          onPress={() => router.push('/modal')}
        >
          <IconSymbol name="photo.badge.plus" size={32} color="white" />
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    backgroundColor: 'transparent',
    flex: 1
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 45,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f20089',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }]
  }
});
