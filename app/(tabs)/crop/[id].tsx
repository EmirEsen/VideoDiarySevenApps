import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, Pressable, Image, ScrollView, NativeScrollEvent, NativeSyntheticEvent, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { IconSymbol } from '@/components/IconSymbol';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import { useVideoStore } from '@/store/videoStore';
import { useRouter } from 'expo-router';
const { width } = Dimensions.get('window');
const FRAME_WIDTH = 60; // Width of each frame preview
const FRAME_COUNT = 10; // Number of frames to generate

type VideoParams = Record<string, string>;

export default function VideoEditScreen() {
    const params = useLocalSearchParams<VideoParams>();
    const [duration] = useState(parseFloat(params.duration || '0'));
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(Math.min(5, duration)); // Default to 5 seconds or video duration
    const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [localUri, setLocalUri] = useState<string | null>(null);
    const [frameThumbnails, setFrameThumbnails] = useState<string[]>([]);
    const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);
    const [isDragging, setIsDragging] = useState(false);
    const router = useRouter();

    const addVideo = useVideoStore(state => state.addVideo);

    const getLocalUri = async () => {
        try {
            // Get the asset info using the URI from params
            const asset: MediaLibrary.Asset = {
                id: params.id,
                uri: params.uri,
                mediaType: 'video',
                width: parseInt(params.width || '0'),
                height: parseInt(params.height || '0'),
                filename: params.filename || '',
                creationTime: 0,
                modificationTime: 0,
                duration: parseFloat(params.duration || '0'),
                albumId: ''
            };

            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
            console.log('Asset info:', assetInfo);
            if (assetInfo.localUri) {
                console.log('Local URI:', assetInfo.localUri);
                setLocalUri(assetInfo.localUri);
            } else {
                console.error('No local URI found for the asset');
            }
        } catch (error) {
            console.error('Error getting local URI:', error);
        }
    };

    useEffect(() => {
        getLocalUri();
        generateThumbnail(0);
    }, []);

    const generateThumbnail = async (time: number) => {
        try {
            setIsGenerating(true);
            console.log('Generating thumbnail for URI:', localUri, 'at time:', time);

            const { uri } = await VideoThumbnails.getThumbnailAsync(localUri || '', {
                time: time * 1000, // Convert to milliseconds
                quality: 0.5,
            });
            setThumbnailUri(uri);
        } catch (error) {
            console.error('Error generating thumbnail:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const generateFrameThumbnails = async () => {
        if (!localUri) return;

        try {
            setIsGenerating(true);
            const thumbnails: string[] = [];

            // Generate thumbnails at equal intervals
            for (let i = 0; i < FRAME_COUNT; i++) {
                const time = Math.round((duration * i) / (FRAME_COUNT - 1));
                const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
                    time: time * 1000, // Convert to milliseconds and ensure it's an integer
                    quality: 0.5,
                });
                thumbnails.push(uri);
            }

            setFrameThumbnails(thumbnails);
        } catch (error) {
            console.error('Error generating frame thumbnails:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (localUri) {
            generateFrameThumbnails();
        }
    }, [localUri]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!isDragging) return;

        const contentOffset = event.nativeEvent.contentOffset;
        const frameWidth = FRAME_WIDTH; // No gap
        const index = Math.round(contentOffset.x / frameWidth);

        if (index >= 0 && index < FRAME_COUNT) {
            const time = Math.round((duration * index) / (FRAME_COUNT - 1));
            setTrimStart(time);
            setTrimEnd(Math.min(time + 5, duration));
            setSelectedFrameIndex(index);
        }
    };

    const handleScrollBeginDrag = () => {
        setIsDragging(true);
    };

    const handleScrollEndDrag = () => {
        setIsDragging(false);
    };

    const handlePreview = () => {
        generateThumbnail(trimStart);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const player = useVideoPlayer(localUri || '', player => {
        player.loop = false;
        player.play();
    });

    const handleSave = () => {
        console.log('localUri', localUri);
        console.log('thumbnailUri', thumbnailUri);
        if (!localUri || !thumbnailUri) {
            Alert.alert('Error', 'Video or thumbnail not available');
            return;
        }

        // Navigate to the preview screen with all necessary data
        router.push({
            pathname: '/(tabs)/two',
            params: {
                id: params.id,
                uri: localUri,
                filename: params.filename || 'video',
                duration: duration.toString(),
                trimStart: trimStart.toString(),
                trimEnd: trimEnd.toString(),
                thumbnailUri: thumbnailUri
            }
        });
    };

    return (
        <LinearGradient colors={['#220643', '#692AA1']} style={styles.container}>
            <View style={styles.videoContainer}>
                <VideoView
                    player={player}
                    style={styles.video}
                    nativeControls={false}
                />
            </View>

            <View style={styles.framePreviewContainer}>
                <Text style={styles.timeText}>
                    {formatTime(trimStart)} - {formatTime(trimEnd)}
                </Text>
                <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.frameScrollContent}
                    onScroll={handleScroll}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScrollEndDrag={handleScrollEndDrag}
                    decelerationRate="fast"
                    snapToInterval={FRAME_WIDTH} // No gap
                >
                    {frameThumbnails.map((uri, index) => (
                        <View
                            key={index}
                            style={[
                                styles.frameContainer,
                                index === selectedFrameIndex && styles.selectedFrame
                            ]}
                        >
                            <Image
                                source={{ uri }}
                                style={styles.frameThumbnail}
                            />
                            <View style={styles.frameTime}>
                                <Text style={styles.frameTimeText}>
                                    {formatTime((duration * index) / (FRAME_COUNT - 1))}
                                </Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.controls}>
                <View style={styles.buttonContainer}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.previewButton,
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handlePreview}
                        disabled={isGenerating}
                    >
                        <IconSymbol name="play.fill" size={24} color="white" />
                        <Text style={styles.buttonText}>Preview</Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.saveButton,
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handleSave}
                        disabled={isGenerating}
                    >
                        <Text style={styles.buttonText}>Continue</Text>
                        <IconSymbol name="chevron.right" size={24} color="white" />
                    </Pressable>
                </View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    videoContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: width,
        height: width * 1.4,
    },
    placeholder: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: 'white',
        fontSize: 16,
    },
    controls: {
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    trimControls: {
        marginBottom: 16,
    },
    timeText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 8,
    },
    trimSliderContainer: {
        gap: 8,
    },
    trimSlider: {
        width: '100%',
        height: 40,
    },
    trimLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    trimLabel: {
        color: 'white',
        fontSize: 14,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16
    },
    previewButton: {
        flex: 1,
        backgroundColor: '#f20089',
        padding: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#f20089',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    buttonPressed: {
        opacity: 0.8,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    framePreviewContainer: {
        height: 120, // Increased height to accommodate time text
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingVertical: 8,
    },
    frameScrollContent: {
        paddingHorizontal: 16,
    },
    frameContainer: {
        width: FRAME_WIDTH,
        height: 80,
        overflow: 'hidden',
        borderWidth: 1, // Thinner border
        borderColor: 'rgba(255, 255, 255, 0.2)', // Subtle border
    },
    selectedFrame: {
        borderColor: '#f20089',
        borderWidth: 2, // Make selected border more visible
    },
    frameThumbnail: {
        width: '100%',
        height: '100%',
    },
    frameTime: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 2,
    },
    frameTimeText: {
        color: 'white',
        fontSize: 10,
        textAlign: 'center',
    },
});