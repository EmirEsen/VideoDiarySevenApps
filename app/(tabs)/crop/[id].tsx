import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, Pressable, Image, ScrollView, NativeScrollEvent, NativeSyntheticEvent, Alert, PanResponder, GestureResponderEvent } from 'react-native';
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

type VideoParams = Record<string, string>;

export default function VideoEditScreen() {
    const params = useLocalSearchParams<VideoParams>();
    const [duration] = useState(parseFloat(params.duration || '0'));
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(Math.min(5, duration)); // Default to 5 seconds or video duration    
    const [isGenerating, setIsGenerating] = useState(false);
    const [localUri, setLocalUri] = useState<string | null>(null);
    const [frameThumbnails, setFrameThumbnails] = useState<string[]>([]);
    const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);
    const [isDragging, setIsDragging] = useState(false);
    const router = useRouter();
    const [trimStartPosition, setTrimStartPosition] = useState(0);
    const [trimEndPosition, setTrimEndPosition] = useState(FRAME_WIDTH * 5); // Default to 5 seconds
    const frameContainerRef = useRef<View>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [currentTimeMs, setCurrentTimeMs] = useState(0);
    const [isSettingStart, setIsSettingStart] = useState(true); // Default to setting start position
    const [isSettingEnd, setIsSettingEnd] = useState(false);
    const [selectionState, setSelectionState] = useState('initial'); // 'initial', 'selectingStart', 'selectingEnd'

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
    }, []);

    const generateFrameThumbnails = async () => {
        if (!localUri) return;

        try {
            setIsGenerating(true);
            const thumbnails: string[] = [];

            // Generate thumbnails at 1-second intervals
            const frameCount = Math.ceil(duration);
            for (let i = 0; i < frameCount; i++) {
                const time = i; // 1-second intervals
                const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
                    time: time * 1000, // Convert to milliseconds
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

    useEffect(() => {
        // Update marker positions when trim values change
        setTrimStartPosition(trimStart * FRAME_WIDTH);
        setTrimEndPosition(trimEnd * FRAME_WIDTH);
    }, [trimStart, trimEnd]);

    // Create pan responder for start marker
    const startMarkerPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const newPosition = Math.max(0, trimStartPosition + gestureState.dx);
                // Don't allow start marker to go past end marker
                if (newPosition < trimEndPosition - 10) { // Smaller minimum gap for precision
                    setTrimStartPosition(newPosition);
                    // Convert position to time with ms precision
                    const newTrimStart = newPosition / FRAME_WIDTH;
                    setTrimStart(newTrimStart);
                    // Scroll to the new position
                    scrollViewRef.current?.scrollTo({ x: newPosition, animated: false });
                }
            },
            onPanResponderRelease: () => {
                // No snapping to frames, keep the exact position
            }
        })
    ).current;

    // Create pan responder for end marker
    const endMarkerPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const newPosition = Math.min(
                    duration * FRAME_WIDTH,
                    trimEndPosition + gestureState.dx
                );
                // Don't allow end marker to go before start marker
                if (newPosition > trimStartPosition + 10) { // Smaller minimum gap for precision
                    setTrimEndPosition(newPosition);
                    // Convert position to time with ms precision
                    const newTrimEnd = newPosition / FRAME_WIDTH;
                    setTrimEnd(newTrimEnd);
                }
            },
            onPanResponderRelease: () => {
                // No snapping to frames, keep the exact position
            }
        })
    ).current;

    // Calculate the padding needed to align the left edge of the first frame with the center line
    const leftPadding = width / 2;

    // Scroll to the beginning when frames are loaded
    useEffect(() => {
        if (frameThumbnails.length > 0 && scrollViewRef.current) {
            // Ensure we start at the beginning (first frame aligned with center line)
            scrollViewRef.current.scrollTo({ x: 0, animated: false });
        }
    }, [frameThumbnails]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffset = event.nativeEvent.contentOffset;

        // Calculate precise position with millisecond precision
        const exactPosition = contentOffset.x / FRAME_WIDTH;
        const index = Math.floor(exactPosition);
        const fraction = exactPosition - index;

        // Calculate time in milliseconds (1000ms per second)
        const timeMs = (index + fraction) * 1000;

        if (index >= 0 && index < frameThumbnails.length) {
            setSelectedFrameIndex(index);
            setCurrentTime(index);
            setCurrentTimeMs(timeMs);

            // Only update trim points if explicitly setting them
            // This prevents accidental changes when just scrolling
        }
    };

    const handleScrollBeginDrag = () => {
        setIsDragging(true);
    };

    const handleScrollEndDrag = () => {
        setIsDragging(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimeMs = (milliseconds: number) => {
        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor(milliseconds % 1000);

        return `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(1, '0')}`;
    };

    const player = useVideoPlayer(localUri || '', player => {
        player.loop = false;
        player.play();
    });

    const handleContinue = () => {
        console.log('localUri', localUri);
        if (!localUri) {
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
            }
        });
    };

    const handleCancel = () => {
        router.back();
    };

    // Function to set the start trim point at the current position with ms precision
    const setStartAtCurrentPosition = () => {
        const currentTimeSeconds = currentTimeMs / 1000;
        if (currentTimeSeconds < trimEnd) {
            setTrimStart(currentTimeSeconds);
            setTrimStartPosition(currentTimeMs * FRAME_WIDTH / 1000);
            setSelectionState('selectingEnd'); // After setting start, move to selecting end
        }
    };

    // Function to set the end trim point at the current position with ms precision
    const setEndAtCurrentPosition = () => {
        const currentTimeSeconds = currentTimeMs / 1000;
        if (currentTimeSeconds > trimStart) {
            setTrimEnd(currentTimeSeconds);
            setTrimEndPosition(currentTimeMs * FRAME_WIDTH / 1000);
            setSelectionState('complete'); // After setting end, selection is complete
        }
    };

    // Get the indicator color based on the selection state
    const getIndicatorColor = () => {
        switch (selectionState) {
            case 'initial':
                return '#70e000'; // Initial green color
            case 'selectingStart':
                return '#38b000'; // Keep green while selecting start
            case 'selectingEnd':
                return '#FF0000'; // Red when selecting end
            case 'complete':
                return '#0000FF'; // Blue when both points are set
            default:
                return '#00f5d4';
        }
    };

    // Get the appropriate button text based on selection state
    const getActionButtonText = () => {
        switch (selectionState) {
            case 'initial':
            case 'selectingStart':
                return `Set Start (${formatTimeMs(currentTimeMs)})`;
            case 'selectingEnd':
                return `Set End (${formatTimeMs(currentTimeMs)})`;
            case 'complete':
                return 'Adjust Trim Points';
            default:
                return 'Set Position';
        }
    };

    // Handle the primary action button press based on current state
    const handleActionButtonPress = () => {
        switch (selectionState) {
            case 'initial':
            case 'selectingStart':
                setStartAtCurrentPosition();
                break;
            case 'selectingEnd':
                setEndAtCurrentPosition();
                break;
            case 'complete':
                // Reset to selecting start if they want to adjust
                setSelectionState('selectingStart');
                break;
        }
    };

    // Generate time markers for the ruler
    const generateTimeMarkers = () => {
        const markers = [];
        // Create a marker every second
        for (let i = 0; i <= Math.ceil(duration); i++) {
            markers.push(i);
        }
        return markers;
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
                    {selectionState === 'initial' ? 'Select start point' :
                        selectionState === 'selectingEnd' ? 'Now select end point' :
                            `Trim: ${formatTimeMs(trimStart * 1000)} - ${formatTimeMs(trimEnd * 1000)}`}
                </Text>
                <View style={styles.framePreviewWrapper} ref={frameContainerRef}>
                    {/* Center indicator line with dynamic color */}
                    <View style={styles.centerIndicator}>
                        <View style={[
                            styles.indicatorLine,
                            { backgroundColor: getIndicatorColor() }
                        ]} />
                        <View style={[
                            styles.indicatorArrow,
                            { borderBottomColor: getIndicatorColor() }
                        ]} />
                    </View>

                    {/* Frames ScrollView with integrated time markers */}
                    <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.frameScrollContent,
                            { paddingLeft: leftPadding, paddingRight: leftPadding }
                        ]}
                        onScroll={handleScroll}
                        onScrollBeginDrag={handleScrollBeginDrag}
                        onScrollEndDrag={handleScrollEndDrag}
                        decelerationRate="normal"
                        snapToInterval={0}
                        scrollEventThrottle={16}
                    >

                        {frameThumbnails.map((uri, index) => (
                            <View key={index} style={styles.frameWithTimeContainer}>
                                {/* Frame container */}
                                <View
                                    style={[
                                        styles.frameContainer,
                                        index >= trimStart && index <= trimEnd && styles.selectedFrameRange
                                    ]}
                                >
                                    {/* Frame thumbnail */}
                                    <Image
                                        source={{ uri }}
                                        style={styles.frameThumbnail}
                                    />
                                </View>

                                {/* Time marker below frame */}
                                <View style={styles.frameTimeMarker}>
                                    <View style={styles.timeMarkerTick} />
                                    <Text style={styles.timeMarkerText}>
                                        {formatTimeMs(index * 1000)}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.trimButtonsContainer}>
                    <Pressable
                        style={[
                            styles.actionButton,
                            { backgroundColor: getIndicatorColor() }
                        ]}
                        onPress={handleActionButtonPress}
                    >
                        <Text style={styles.trimButtonText}>{getActionButtonText()}</Text>
                    </Pressable>

                    {selectionState === 'complete' && (
                        <Pressable
                            style={styles.resetButton}
                            onPress={() => setSelectionState('initial')}
                        >
                            <Text style={styles.trimButtonText}>Reset</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            <View style={styles.controls}>
                <View style={styles.buttonContainer}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.cancelButton,
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handleCancel}
                        disabled={isGenerating}
                    >
                        <IconSymbol name="xmark.circle" size={24} color="white" />
                        <Text style={styles.buttonText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.saveButton,
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handleContinue}
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
        height: width * 1.23,
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
    cancelButton: {
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
        height: 180, // Increased height to accommodate time markers
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingVertical: 8,
        marginBottom: 35,
    },
    frameScrollContent: {
        paddingHorizontal: 16,
    },
    frameContainer: {
        width: FRAME_WIDTH,
        height: 80,
        overflow: 'hidden',
        position: 'relative', // For absolute positioning of children
    },
    selectedFrameRange: {
        opacity: 1,
    },
    frameThumbnail: {
        width: '100%',
        height: '100%',
    },
    framePreviewWrapper: {
        position: 'relative',
        height: 120, // Adjusted height
        marginBottom: 10,
    },
    trimMarker: {
        position: 'absolute',
        top: 0,
        width: 4,
        height: '100%',
        zIndex: 10,
    },
    markerHandle: {
        position: 'absolute',
        top: '50%',
        left: -8,
        width: 20,
        height: 20,
        backgroundColor: '#f20089',
        borderRadius: 10,
        transform: [{ translateY: -10 }],
        borderWidth: 2,
        borderColor: 'white',
    },
    centerIndicator: {
        position: 'absolute',
        top: 0,
        left: '50%',
        height: '100%',
        width: 2,
        alignItems: 'center',
        zIndex: 20,
        pointerEvents: 'none',
    },

    indicatorLine: {
        width: 2,
        height: '100%',
        backgroundColor: '#00f5d4', // Bright teal color for visibility
    },

    indicatorArrow: {
        position: 'absolute',
        top: -8,
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#00f5d4',
    },

    trimButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginHorizontal: 35,
        marginTop: 2,
    },

    actionButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },

    resetButton: {
        backgroundColor: '#f20089',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginLeft: 8,
    },

    trimButtonText: {
        color: 'white',
        fontWeight: '600',
        textAlign: 'center',
    },

    activeButton: {
        backgroundColor: '#d100d1', // Darker shade to indicate active state
    },

    timeIndicatorContainer: {
        position: 'absolute',
        bottom: -35, // Position below the frame
        left: 0,
        width: FRAME_WIDTH,
        alignItems: 'flex-start',
        paddingLeft: 2,
    },

    timeVerticalLine: {
        position: 'absolute',
        top: -15, // Connect to the bottom of the frame
        left: 4,
        width: 1,
        height: 15,
        backgroundColor: '#70e000',
    },

    timeMarkerCircle: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#70e000', // Green circle
        borderWidth: 1,
        borderColor: 'white',
    },

    timeIndicatorText: {
        color: 'white',
        fontSize: 10,
        marginLeft: 12,
        marginTop: 2,
    },

    timeRulerContainer: {
        position: 'absolute',
        bottom: 0,
        height: 30,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },

    timeRulerLine: {
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        width: '100%',
    },

    timeMarkerContainer: {
        position: 'absolute',
        width: FRAME_WIDTH,
        alignItems: 'center',
    },

    timeMarkerTick: {
        width: 1,
        height: 8,
        backgroundColor: 'white',
        marginBottom: 2,
    },

    timeMarkerText: {
        color: 'white',
        fontSize: 10,
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 4,
        borderRadius: 2,
    },

    scrollableRulerLine: {
        position: 'absolute',
        bottom: 10, // Position at the tick marks
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        width: '100%',
        zIndex: 1,
    },

    frameTimeMarker: {
        alignItems: 'center',
        marginTop: 2,
        width: FRAME_WIDTH,
        position: 'relative',
        left: 0, // Align with left edge of frame
    },

    frameWithTimeContainer: {
        width: FRAME_WIDTH,
        alignItems: 'flex-start',
    },

    // Renamed to avoid duplicates
    timeRulerWrapperHidden: {
        display: 'none',
    },

    timeRulerLineHidden: {
        display: 'none',
    },

    timeMarkerContainerHidden: {
        display: 'none',
    },
});