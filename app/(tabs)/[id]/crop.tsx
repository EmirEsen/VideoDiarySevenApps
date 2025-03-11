import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, Pressable, Image, ScrollView, NativeScrollEvent, NativeSyntheticEvent, Alert, PanResponder, GestureResponderEvent, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { IconSymbol } from '@/components/IconSymbol';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
const { width } = Dimensions.get('window');

const FRAME_WIDTH = 60;

type VideoParams = Record<string, string>;

export default function VideoEditScreen() {
    const params = useLocalSearchParams<VideoParams>();
    const [duration] = useState(() => {
        const parsedDuration = parseFloat(params.duration || '0');
        // If duration is unreasonably long or invalid, cap it at a reasonable value
        return parsedDuration > 0 && parsedDuration < 3600 ? parsedDuration : 7;
    });
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
    const [isScrolling, setIsScrolling] = useState(false);
    const [thumbnailError, setThumbnailError] = useState<string | null>(null);
    const previousScrollXRef = useRef(0);
    const isUserScrollingRef = useRef(false);
    const lastTimeUpdateRef = useRef(0);

    const getLocalUri = async () => {
        try {
            // First try to get the asset info from MediaLibrary
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

            try {
                const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
                console.log('Asset info:', assetInfo);
                if (assetInfo && assetInfo.localUri) {
                    console.log('Local URI from MediaLibrary:', assetInfo.localUri);
                    setLocalUri(assetInfo.localUri);
                    return;
                }
            } catch (mediaLibraryError) {
                console.log('MediaLibrary error, using direct URI instead:', mediaLibraryError);
            }

            setLocalUri(params.uri);
        } catch (error) {
            console.error('Error getting local URI:', error);
        }
    };

    useEffect(() => {
        getLocalUri();
    }, []);

    const generateFrameThumbnails = async () => {
        if (!localUri) {
            console.error('No localUri available for thumbnail generation');
            return;
        }

        try {
            setIsGenerating(true);
            console.log('Starting thumbnail generation for video:', localUri);
            console.log('Video duration:', duration);

            const thumbnails: string[] = [];

            // Validate duration again to ensure it's reasonable
            const validDuration = duration > 0 && duration < 3600 ? duration : 7;
            console.log(`Using validated duration: ${validDuration} seconds`);

            // Limit the number of frames to prevent performance issues
            // Generate at most 60 frames or one per second, whichever is less
            const MAX_FRAMES = 60;
            const frameCount = Math.min(Math.ceil(validDuration), MAX_FRAMES);
            console.log(`Generating ${frameCount} thumbnails...`);

            // Calculate interval to distribute frames evenly
            const interval = validDuration / frameCount;

            for (let i = 0; i < frameCount; i++) {
                try {
                    const timePosition = i * interval;
                    console.log(`Generating thumbnail at ${timePosition} seconds`);

                    const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
                        time: Math.floor(timePosition * 1000),
                        quality: 0.5,
                    });

                    thumbnails.push(uri);
                    console.log(`Generated thumbnail ${i + 1}/${frameCount}`);
                } catch (frameError) {
                    console.error(`Error generating thumbnail at position ${i}:`, frameError);
                    // Add a placeholder thumbnail to maintain sequence
                    thumbnails.push('');
                }
            }

            console.log(`Successfully generated ${thumbnails.filter(Boolean).length} thumbnails`);
            setFrameThumbnails(thumbnails);
        } catch (error) {
            console.error('Error generating frame thumbnails:', error);
            // Set at least one empty thumbnail to prevent UI issues
            setFrameThumbnails(['']);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (localUri) {
            generateFrameThumbnails();

            // Set a timeout for thumbnail generation
            const timeoutId = setTimeout(() => {
                if (isGenerating) {
                    setIsGenerating(false);
                    setThumbnailError('Thumbnail generation timed out. You can still trim the video.');
                    console.log('Thumbnail generation timed out');

                    const validDuration = duration > 0 && duration < 3600 ? duration : 7;
                    const emptyThumbnails = Array(Math.min(Math.ceil(validDuration), 60)).fill('');
                    setFrameThumbnails(emptyThumbnails);
                }
            }, 15000);

            return () => clearTimeout(timeoutId);
        }
    }, [localUri]);

    useEffect(() => {
        setTrimStartPosition(trimStart * FRAME_WIDTH);
        setTrimEndPosition(trimEnd * FRAME_WIDTH);
    }, [trimStart, trimEnd]);

    const startMarkerPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const newPosition = Math.max(0, trimStartPosition + gestureState.dx);
                if (newPosition < trimEndPosition - 10) {
                    setTrimStartPosition(newPosition);
                    const newTrimStart = newPosition / FRAME_WIDTH;
                    setTrimStart(newTrimStart);
                    scrollViewRef.current?.scrollTo({ x: newPosition, animated: false });
                }
            },
            onPanResponderRelease: () => {
            }
        })
    ).current;

    const endMarkerPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const newPosition = Math.min(
                    duration * FRAME_WIDTH,
                    trimEndPosition + gestureState.dx
                );
                if (newPosition > trimStartPosition + 10) {
                    setTrimEndPosition(newPosition);
                    const newTrimEnd = newPosition / FRAME_WIDTH;
                    setTrimEnd(newTrimEnd);
                }
            },
            onPanResponderRelease: () => {
            }
        })
    ).current;

    const leftPadding = width / 2;

    useEffect(() => {
        if (frameThumbnails.length > 0 && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ x: 0, animated: false });
        }
    }, [frameThumbnails]);

    const player = useVideoPlayer(localUri || '', player => {
        player.loop = true;
    });

    // Use a timer to update the current time display
    useEffect(() => {
        if (!player || !localUri) return;

        const timer = setInterval(() => {
            if (player && 'position' in player && !isUserScrollingRef.current) {
                const currentTimeInSeconds = player.position as number || 0;
                const timeMs = currentTimeInSeconds * 1000;

                setCurrentTimeMs(timeMs);
                setCurrentTime(Math.floor(currentTimeInSeconds));
            }
        }, 100); // Update every 100ms

        return () => clearInterval(timer);
    }, [player, localUri]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffset = event.nativeEvent.contentOffset;
        const isScrollingForward = contentOffset.x >= previousScrollXRef.current;

        // Update reference for next scroll event
        previousScrollXRef.current = contentOffset.x;

        const exactPosition = contentOffset.x / FRAME_WIDTH;
        const index = Math.floor(exactPosition);
        const fraction = exactPosition - index;

        const timeMs = (index + fraction) * 1000;

        if (index >= 0 && index < frameThumbnails.length) {
            setSelectedFrameIndex(index);
            setCurrentTime(index);
            setCurrentTimeMs(timeMs);

            if (player) {
                try {
                    if (typeof player.play === 'function') {
                        // If we're not already playing and we're scrolling, play
                        if (isScrolling && !player.playing) {
                            player.play();
                        }

                        if ('position' in player) {
                            player.position = timeMs / 1000;
                        }
                    }
                } catch (error) {
                    console.log('Error updating video position:', error);
                }
            }
        }
    };

    const handleScrollBeginDrag = () => {
        setIsDragging(true);
        setIsScrolling(true);
        isUserScrollingRef.current = true;

        if (player && player.playing) {
            player.pause();
        }
    };

    const handleScrollEndDrag = () => {
        setIsDragging(false);

        setTimeout(() => {
            setIsScrolling(false);
            isUserScrollingRef.current = false;
        }, 200);
    };

    const handleMomentumScrollEnd = () => {
        setIsScrolling(false);
        isUserScrollingRef.current = false;
    };

    const formatTimeMs = (milliseconds: number) => {
        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor(milliseconds % 1000);

        return `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(1, '0')}`;
    };

    const handleContinue = () => {
        console.log('localUri', localUri);
        if (!localUri) {
            Alert.alert('Error', 'Video or thumbnail not available');
            return;
        }

        // Navigate to the preview screen with all necessary data
        router.push({
            pathname: '/(tabs)/[id]/videoDetails',
            params: {
                id: params.id,
                uri: localUri,
                filename: params.filename || 'video',
                duration: duration.toString(),
                trimStart: trimStart.toString(),
                trimEnd: trimEnd.toString(),
                thumbnailUri: frameThumbnails[selectedFrameIndex],
                name: params.name || '',
                description: params.description || ''
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

    return (
        <LinearGradient colors={['#220643', '#692AA1']} style={styles.container}>
            <View style={styles.videoContainer}>
                {localUri ? (
                    <VideoView
                        player={player}
                        style={styles.video}
                        nativeControls={false}
                    />
                ) : (
                    <View style={[styles.video, styles.placeholder]}>
                        <Text style={styles.placeholderText}>Loading video...</Text>
                    </View>
                )}

                <View style={styles.currentTimeDisplay}>
                    <Text style={styles.currentTimeText}>
                        {formatTimeMs(currentTimeMs)}
                    </Text>
                </View>
            </View>

            <View style={styles.framePreviewContainer}>
                <Text style={styles.timeText}>
                    {isGenerating ? 'Generating thumbnails...' :
                        thumbnailError ? thumbnailError :
                            selectionState === 'initial' ? 'Select start point' :
                                selectionState === 'selectingEnd' ? 'Now select end point' :
                                    `Trim: ${formatTimeMs(trimStart * 1000)} - ${formatTimeMs(trimEnd * 1000)}`}
                </Text>
                <View style={styles.framePreviewWrapper} ref={frameContainerRef}>
                    {/* Loading overlay for thumbnail generation */}
                    {isGenerating && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#f20089" />
                            <Text style={styles.loadingText}>
                                Generating thumbnails...
                            </Text>
                        </View>
                    )}

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

                    {/* Time ruler line */}
                    <View style={styles.timeRulerLine} />

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
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                        decelerationRate="normal"
                        snapToInterval={0}
                        scrollEventThrottle={16}
                    >

                        {frameThumbnails.map((uri, index) => {
                            // Determine if we should show the time text (first, last, and every 2nd frame)
                            const showTimeText = index === 0 ||
                                index === frameThumbnails.length - 1 ||
                                index % 2 === 0;

                            return (
                                <View key={index} style={styles.frameWithTimeContainer}>
                                    {/* Frame container */}
                                    <View
                                        style={[
                                            styles.frameContainer,
                                            index >= trimStart && index <= trimEnd && styles.selectedFrameRange
                                        ]}
                                    >
                                        {/* Frame thumbnail */}
                                        {uri ? (
                                            <Image
                                                source={{ uri }}
                                                style={styles.frameThumbnail}
                                            />
                                        ) : (
                                            <View style={[styles.frameThumbnail, styles.placeholderThumbnail]} />
                                        )}
                                    </View>

                                    {/* Time marker below frame */}
                                    <View style={styles.frameTimeMarker}>
                                        <View style={styles.timeMarkerTick} />
                                        {showTimeText && (
                                            <Text style={[
                                                styles.timeMarkerText,
                                                index === 0 && styles.firstTimeMarker
                                            ]}>
                                                {index === 0 ? '0:00.0' : formatTimeMs(index * 1000)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
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
        position: 'relative',
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
        height: 180,
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
        bottom: 20, // Position above the time markers
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        zIndex: 1,
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
        position: 'absolute',
        left: 0,
    },

    timeMarkerText: {
        color: 'white',
        fontSize: 10,
        textAlign: 'left',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 4,
        borderRadius: 2,
        position: 'absolute',
        left: 0,
        top: 10, // Position below the tick
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
        alignItems: 'flex-start',
        marginTop: 2,
        width: FRAME_WIDTH,
        position: 'relative',
        left: 0, // Align with left edge of frame
        height: 20, // Fixed height for time markers
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

    currentTimeDisplay: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },

    currentTimeText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },

    placeholderThumbnail: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingText: {
        color: 'white',
        marginTop: 10,
        fontSize: 14,
    },

    firstTimeMarker: {
        fontWeight: 'bold',
        backgroundColor: 'rgba(112, 224, 0, 0.5)', // Highlight the first marker
    },

    hiddenTimeMarkerText: {
        opacity: 0, // Hide text but keep the element in the layout
    },
});