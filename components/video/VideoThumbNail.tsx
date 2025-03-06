import * as VideoThumbnails from 'expo-video-thumbnails';
import { useEffect, useState } from "react";
import { View, StyleSheet, Text, Image, Pressable } from "react-native";

export default function VideoThumbNail({ uri }: { uri: string }) {
    const [image, setImage] = useState<string | null>(null);

    const generateThumbnail = async () => {
        try {
            const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
                uri,
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
            onPress={() => console.log('Pressed video:', uri)}
        >
            <View style={styles.imageContainer}>
                {image && <Image source={{ uri: image }} style={styles.image} />}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Video 1</Text>
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
    }
});