import { router } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from "react";
import { View, StyleSheet, Text, Image, Pressable } from "react-native";
import { TrimmedVideo } from './TrimmedVideo';
import { IconSymbol } from '../IconSymbol';

export default function VideoThumbNail({ video }: { video: TrimmedVideo }) {
    const [image, setImage] = useState<string | null>(null);

    const generateThumbnail = async () => {
        try {
            if (video.thumbnailUri) {
                setImage(video.thumbnailUri);
                return;
            }

            // Otherwise generate a new thumbnail
            const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
                video.localUri || video.uri,
                {
                    time: 2000,
                }
            );
            setImage(thumbnailUri);
        } catch (e) {
            console.warn('Error generating thumbnail:', e);
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
                    uri: video.localUri || video.uri,
                    name: video.name,
                    description: video.description,
                    duration: video.duration.toString(),
                    trimStart: video.trimStart.toString(),
                    trimEnd: video.trimEnd.toString(),
                    filename: video.filename || '',
                    thumbnailUri: video.thumbnailUri || image
                }
            })}
        >
            <View style={styles.imageContainer}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.image} />
                ) : (
                    <View style={styles.placeholderContainer}>
                        <IconSymbol name="play.rectangle.fill" size={48} color="rgba(255,255,255,0.5)" />
                    </View>
                )}
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
        paddingHorizontal: 50
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
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
});