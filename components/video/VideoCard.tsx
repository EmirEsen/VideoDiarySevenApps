import { router } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from "react";
import { View, StyleSheet, Text, Image, Pressable } from "react-native";
import { TrimmedVideo } from './TrimmedVideo';

export default function VideoCard({ video }: { video: TrimmedVideo }) {

    const [image, setImage] = useState<string | null>(null);

    const generateThumbnail = async () => {
        try {
            const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
                video.localUri,
                {
                    time: 2000,
                }
            );
            setImage(thumbnailUri);
        } catch (e) {
            console.warn(e);
        }
    };

    useEffect(() => {
        generateThumbnail();
    }, []);

    return (
        <Pressable
            style={({ pressed }) => [
                styles.container,
                pressed && styles.pressed
            ]}
            onPress={() => router.push({
                pathname: '/(tabs)/[id]/videoDetails',
                params: {
                    id: video.id,
                    uri: video.localUri,
                    filename: video.filename,
                    duration: video.duration.toString(),
                    trimStart: video.trimStart.toString(),
                    trimEnd: video.trimEnd.toString(),
                    thumbnailUri: video.thumbnailUri,
                    name: video.name,
                    description: video.description
                }
            })}
        >
            <View style={styles.imageContainer}>
                {image && <Image source={{ uri: image }} style={styles.image} />}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>{video.name}</Text>
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 50,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.98 }]
    },
    imageContainer: {
        position: 'relative',
        width: 200,
        height: 120,
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 8
    },
    titleContainer: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 4,
        borderRadius: 4,
    },
    title: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    }
});