import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, Pressable, Image, ScrollView, NativeScrollEvent, NativeSyntheticEvent, Alert, PanResponder, GestureResponderEvent, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { IconSymbol } from '@/components/IconSymbol';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { processVideo } from '@/services/videoProcessingService';

const { width } = Dimensions.get('window');

const FRAME_WIDTH = 60;

type VideoParams = Record<string, string>;

export default function VideoEditScreen() {
    const params = useLocalSearchParams<VideoParams>();
    const [duration, setDuration] = useState(() => {
        const parsedDuration = parseFloat(params.duration || '0');
        return parsedDuration > 0 && parsedDuration < 3600 ? parsedDuration : 7;
    });
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(Math.min(5, duration)); // Default to 5 seconds or video duration    
    const [maxAllowableEnd, setMaxAllowableEnd] = useState(Math.min(5, duration)); // Maximum allowable end time
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
    const [selectionState, setSelectionState] = useState('initial'); // 'initial', 'selectingStart', 'selectingEnd'
    const [isScrolling, setIsScrolling] = useState(false);
    const [thumbnailError, setThumbnailError] = useState<string | null>(null);
    const previousScrollXRef = useRef(0);
    const isUserScrollingRef = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const playerRef = useRef<any>(null);
    const playerValidRef = useRef<boolean>(false);

    const getLocalUri = async () => {
        try {
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

                    if (assetInfo.duration && assetInfo.duration > 0) {
                        console.log('Updating duration from MediaLibrary:', assetInfo.duration);
                        setDuration(assetInfo.duration);
                        const newTrimEnd = Math.min(5, assetInfo.duration);
                        setTrimEnd(newTrimEnd);
                        setMaxAllowableEnd(newTrimEnd);
                        setTrimEndPosition(newTrimEnd * FRAME_WIDTH);
                    }
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

            const thumbnails: string[] = [];
            const validDuration = duration > 0 && duration < 3600 ? duration : 7;

            const frameCount = Math.ceil(validDuration);

            for (let i = 0; i < frameCount; i++) {
                try {
                    const timePosition = i;

                    const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
                        time: timePosition * 1000,
                        quality: 0.5,
                    });

                    thumbnails.push(uri);
                } catch (frameError) {
                    thumbnails.push('');
                }
            }

            setFrameThumbnails(thumbnails);
        } catch (error) {
            console.error('Error generating frame thumbnails:', error);
            setFrameThumbnails(['']);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (localUri) {
            generateFrameThumbnails();

            const timeoutId = setTimeout(() => {
                if (isGenerating) {
                    setIsGenerating(false);
                    setThumbnailError('Thumbnail generation timed out. You can still trim the video.');

                    const validDuration = duration > 0 && duration < 3600 ? duration : 7;
                    const emptyThumbnails = Array(Math.ceil(validDuration)).fill('');
                    setFrameThumbnails(emptyThumbnails);
                }
            }, 15000);

            return () => clearTimeout(timeoutId);
        }
    }, [localUri, duration]);

    useEffect(() => {
        setTrimStartPosition(trimStart * FRAME_WIDTH);
        setTrimEndPosition(trimEnd * FRAME_WIDTH);
    }, [trimStart, trimEnd]);

    useEffect(() => {
        const newMaxEnd = Math.min(trimStart + 5, duration);
        setMaxAllowableEnd(newMaxEnd);

        if (trimEnd > newMaxEnd) {
            setTrimEnd(newMaxEnd);
        }
    }, [trimStart, duration]);

    const leftPadding = width / 2;

    useEffect(() => {
        if (frameThumbnails.length > 0 && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ x: 0, animated: false });
        }
    }, [frameThumbnails]);

    const player = useVideoPlayer(localUri || '', player => {
        if (!player) return;
        try {
            playerRef.current = player;
            playerValidRef.current = true;

            player.loop = true;

            if ('duration' in player && player.duration && player.duration > 0) {
                const videoDuration = player.duration as number;

                if (Math.abs(videoDuration - duration) > 1) {
                    setDuration(videoDuration);

                    const newTrimEnd = Math.min(5, videoDuration);
                    setTrimEnd(newTrimEnd);
                    setMaxAllowableEnd(newTrimEnd);
                    setTrimEndPosition(newTrimEnd * FRAME_WIDTH);
                }
            }
        } catch (error) {
            console.error('Error configuring player:', error);
        }
    });

    useEffect(() => {
        if (!player || !localUri || !playerValidRef.current) return;

        let isMounted = true;
        const timer = setInterval(() => {
            if (!isMounted || !playerValidRef.current) return;

            try {
                const currentPlayer = playerRef.current;
                if (currentPlayer && typeof currentPlayer === 'object' && 'position' in currentPlayer && !isUserScrollingRef.current) {
                    const currentTimeInSeconds = currentPlayer.position as number || 0;
                    const timeMs = currentTimeInSeconds * 1000;

                    setCurrentTimeMs(timeMs);
                    setCurrentTime(Math.floor(currentTimeInSeconds));
                }
            } catch (error) {
                clearInterval(timer);
            }
        }, 100);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [player, localUri]);

    useEffect(() => {
        return () => {
            playerValidRef.current = false;

            try {
                const currentPlayer = playerRef.current;
                if (currentPlayer && typeof currentPlayer === 'object') {
                    console.log('Cleaning up player resources');

                    try {
                        if (typeof currentPlayer.pause === 'function') {
                            currentPlayer.pause();
                        }
                    } catch (pauseError) {
                    }

                    try {
                        if (typeof currentPlayer.release === 'function') {
                            currentPlayer.release();
                        }
                    } catch (releaseError) {
                    }

                    playerRef.current = null;
                }
            } catch (error) {
                console.log('Player cleanup failed silently');
            }
        };
    }, []);

    useEffect(() => {
        if (!player || !localUri || !playerValidRef.current) return;

        const durationCheckInterval = setInterval(() => {
            try {
                const currentPlayer = playerRef.current;
                if (currentPlayer && typeof currentPlayer === 'object' && 'duration' in currentPlayer && currentPlayer.duration && currentPlayer.duration > 0) {
                    const videoDuration = currentPlayer.duration as number;

                    if (Math.abs(videoDuration - duration) > 1) {
                        setDuration(videoDuration);

                        const newTrimEnd = Math.min(5, videoDuration);
                        setTrimEnd(newTrimEnd);
                        setMaxAllowableEnd(newTrimEnd);
                        setTrimEndPosition(newTrimEnd * FRAME_WIDTH);
                    }
                }
            } catch (error) {
            }
        }, 1000);

        return () => clearInterval(durationCheckInterval);
    }, [player, localUri, duration]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffset = event.nativeEvent.contentOffset;
        const isScrollingForward = contentOffset.x >= previousScrollXRef.current;
        const isScrollingBackward = contentOffset.x < previousScrollXRef.current;

        previousScrollXRef.current = contentOffset.x;

        const exactPosition = contentOffset.x / FRAME_WIDTH;
        const index = Math.floor(exactPosition);
        const fraction = exactPosition - index;

        const timeMs = (index + fraction) * 1000;
        const timeSeconds = timeMs / 1000;

        if (selectionState === 'selectingEnd' && timeSeconds < trimStart && isUserScrollingRef.current && isScrollingBackward) {
            const startPosition = trimStart * FRAME_WIDTH;
            scrollViewRef.current?.scrollTo({ x: startPosition, animated: true });

            setSelectedFrameIndex(Math.floor(trimStart));
            setCurrentTime(Math.floor(trimStart));
            setCurrentTimeMs(trimStart * 1000);

            if (player && 'position' in player) {
                try {
                    player.position = trimStart;
                } catch (error) {
                    console.log('Error updating video position:', error);
                }
            }

            return;
        }

        if (selectionState === 'selectingEnd' && timeSeconds > maxAllowableEnd && isUserScrollingRef.current && isScrollingForward) {
            const maxAllowablePosition = maxAllowableEnd * FRAME_WIDTH;
            scrollViewRef.current?.scrollTo({ x: maxAllowablePosition, animated: true });

            setSelectedFrameIndex(Math.floor(maxAllowableEnd));
            setCurrentTime(Math.floor(maxAllowableEnd));
            setCurrentTimeMs(maxAllowableEnd * 1000);

            if (player && 'position' in player) {
                try {
                    player.position = maxAllowableEnd;
                } catch (error) {
                    console.log('Error updating video position:', error);
                }
            }

            return;
        }

        if (index >= 0 && index < frameThumbnails.length) {
            setSelectedFrameIndex(index);
            setCurrentTime(index);
            setCurrentTimeMs(timeMs);

            if (player) {
                try {
                    if (typeof player.play === 'function') {
                        if (isScrolling && !player.playing) {
                            player.play();
                        } else if (!isScrolling && player.playing) {
                            player.pause();
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

        if (selectionState === 'selectingEnd' && currentTimeMs / 1000 >= maxAllowableEnd) {
            const maxAllowablePosition = maxAllowableEnd * FRAME_WIDTH;
            scrollViewRef.current?.scrollTo({ x: maxAllowablePosition, animated: true });
        }

        try {
            if (player && player.playing) {
                player.pause();
            }
        } catch (error) {
            console.error('Error pausing player on drag start:', error);
        }
    };

    const handleScrollEndDrag = () => {
        setIsDragging(false);

        try {
            if (player && player.playing) {
                player.pause();
            }
        } catch (error) {
            console.error('Error pausing player on drag end:', error);
        }

        setTimeout(() => {
            setIsScrolling(false);
            isUserScrollingRef.current = false;
        }, 200);
    };

    const handleMomentumScrollEnd = () => {
        setIsScrolling(false);
        isUserScrollingRef.current = false;

        try {
            if (player && player.playing) {
                player.pause();
            }
        } catch (error) {
            console.error('Error pausing player on momentum end:', error);
        }
    };

    const formatTimeMs = (milliseconds: number) => {
        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor(milliseconds % 1000);

        return `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(1, '0')}`;
    };

    const handleContinue = async () => {
        if (!localUri) {
            Alert.alert('Error', 'Video or thumbnail not available');
            return;
        }

        try {
            setIsLoading(true);
            setLoadingMessage('Processing video...');

            const trimDuration = trimEnd - trimStart;

            const result = await processVideo({
                videoUri: localUri,
                startTime: trimStart,
                duration: trimDuration,
                outputFileName: `${params.filename || 'video'}_trimmed_${Date.now()}.mp4`
            });

            setIsLoading(false);

            if (!result.success) {
                Alert.alert('Processing Error', result.error || 'Failed to process video');
                return;
            }

            console.log('Video processing result:', result);

            router.push({
                pathname: '/(tabs)/[id]/videoDetails',
                params: {
                    id: params.id,
                    uri: result.outputUri,
                    filename: params.filename || 'video',
                    duration: trimDuration.toString(),
                    trimStart: '0',
                    trimEnd: trimDuration.toString(),
                    thumbnailUri: result.thumbnailUri || frameThumbnails[selectedFrameIndex],
                    name: params.name || '',
                    description: params.description || ''
                }
            });
        } catch (error: any) {
            setIsLoading(false);
            Alert.alert('Error', `Failed to process video: ${error.message}`);
            console.error('Video processing error:', error);
        }
    };

    const handleCancel = () => {
        router.back();
    };

    const setStartAtCurrentPosition = () => {
        const currentTimeSeconds = currentTimeMs / 1000;

        setTrimStart(currentTimeSeconds);
        setTrimStartPosition(currentTimeMs * FRAME_WIDTH / 1000);

        const newMaxEnd = Math.min(currentTimeSeconds + 5, duration);
        setMaxAllowableEnd(newMaxEnd);

        setTrimEnd(newMaxEnd);
        setTrimEndPosition(newMaxEnd * 1000 * FRAME_WIDTH / 1000);

        setSelectionState('selectingEnd');
    };

    const setEndAtCurrentPosition = () => {
        const currentTimeSeconds = currentTimeMs / 1000;

        if (currentTimeSeconds > trimStart && currentTimeSeconds <= maxAllowableEnd) {
            setTrimEnd(currentTimeSeconds);
            setTrimEndPosition(currentTimeMs * FRAME_WIDTH / 1000);

            setSelectionState('complete');

        } else if (currentTimeSeconds <= trimStart) {
            const newEnd = trimStart + 0.5;
            setTrimEnd(newEnd);
            setTrimEndPosition(newEnd * 1000 * FRAME_WIDTH / 1000);
            setSelectionState('complete');

            Alert.alert('Minimum Duration', 'The clip must be at least 0.5 seconds long. Your end point has been adjusted.');
        } else if (currentTimeSeconds > maxAllowableEnd) {
            setTrimEnd(maxAllowableEnd);
            setTrimEndPosition(maxAllowableEnd * 1000 * FRAME_WIDTH / 1000);
            setSelectionState('complete');
        }
    };

    const getIndicatorColor = () => {
        switch (selectionState) {
            case 'initial':
                return '#70e000';
            case 'selectingStart':
                return '#38b000';
            case 'selectingEnd':
                return '#FF0000';
            case 'complete':
                return '#0000FF';
            default:
                return '#00f5d4';
        }
    };

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
                                selectionState === 'selectingEnd' ? 'Select end point' :
                                    `Trim: ${formatTimeMs(trimStart * 1000)} - ${formatTimeMs(trimEnd * 1000)}`}
                </Text>
                <View style={styles.framePreviewWrapper} ref={frameContainerRef}>
                    {isGenerating && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#f20089" />
                            <Text style={styles.loadingText}>
                                Generating thumbnails...
                            </Text>
                        </View>
                    )}

                    <View style={styles.centerIndicator}>
                        <View style={[
                            styles.indicatorLine,
                            { backgroundColor: selectionState === 'selectingEnd' ? '#FF0000' : getIndicatorColor() }
                        ]} />
                        <View style={[
                            styles.indicatorArrow,
                            { borderBottomColor: selectionState === 'selectingEnd' ? '#FF0000' : getIndicatorColor() }
                        ]} />
                    </View>

                    <View style={styles.timeRulerLine} />

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
                            const showTimeText = true;

                            const isBeforeStart = (selectionState === 'selectingEnd' || selectionState === 'complete') && index < trimStart;
                            const isAfterEnd = selectionState === 'complete' && index > trimEnd;
                            const isAfterMaxEnd = selectionState === 'selectingEnd' && index > maxAllowableEnd;

                            const isOutsideAllowableRange = isBeforeStart || isAfterEnd || isAfterMaxEnd;

                            return (
                                <View key={index} style={styles.frameWithTimeContainer}>
                                    {/* Frame container */}
                                    <View
                                        style={[
                                            styles.frameContainer,
                                            index >= trimStart && index <= trimEnd && styles.selectedFrameRange,
                                            isOutsideAllowableRange && styles.disabledFrameRange
                                        ]}
                                    >
                                        {uri ? (
                                            <Image
                                                source={{ uri }}
                                                style={styles.frameThumbnail}
                                            />
                                        ) : (
                                            <View style={[styles.frameThumbnail, styles.placeholderThumbnail]} />
                                        )}

                                        {isOutsideAllowableRange && (
                                            <View style={[
                                                styles.frameOverlay,
                                                isBeforeStart && styles.beforeStartOverlay,
                                                (isAfterEnd || isAfterMaxEnd) && styles.afterEndOverlay
                                            ]} />
                                        )}
                                    </View>

                                    <View style={styles.frameTimeMarker}>
                                        <View style={styles.timeMarkerTick} />
                                        {showTimeText && (
                                            <Text style={[
                                                styles.timeMarkerText,
                                                selectionState !== 'initial' && (
                                                    Math.abs(index - trimStart) < 0.1 && styles.startTimeMarker
                                                ),
                                                selectionState === 'complete' && (
                                                    Math.abs(index - trimEnd) < 0.1 && styles.endTimeMarker
                                                ),
                                                selectionState === 'selectingEnd' && (
                                                    Math.abs(index - maxAllowableEnd) < 0.1 && styles.maxEndTimeMarker
                                                )
                                            ]}>
                                                {index === 0 ? '0:00' :
                                                    selectionState !== 'initial' && Math.abs(index - trimStart) < 0.1 ? 'START' :
                                                        selectionState === 'complete' && Math.abs(index - trimEnd) < 0.1 ? 'END' :
                                                            selectionState === 'selectingEnd' && Math.abs(index - maxAllowableEnd) < 0.1 ? 'MAX' :
                                                                `${Math.floor(index / 60)}:${(index % 60).toString().padStart(2, '0')}`}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.trimButtonsContainer}>
                    {selectionState === 'initial' || selectionState === 'selectingStart' ? (
                        <Pressable
                            style={[
                                styles.actionButton,
                                { backgroundColor: '#38b000' }
                            ]}
                            onPress={setStartAtCurrentPosition}
                        >
                            <Text style={styles.trimButtonText}>
                                Set Start ({formatTimeMs(currentTimeMs)})
                            </Text>
                        </Pressable>
                    ) : selectionState === 'selectingEnd' ? (
                        <Pressable
                            style={[
                                styles.actionButton,
                                { backgroundColor: '#FF0000' }
                            ]}
                            onPress={setEndAtCurrentPosition}
                        >
                            <Text style={styles.trimButtonText}>
                                Set End ({formatTimeMs(currentTimeMs)})
                            </Text>
                        </Pressable>
                    ) : selectionState === 'complete' ? (
                        <Pressable
                            style={[
                                styles.actionButton,
                                { backgroundColor: '#9d4edd' }
                            ]}
                            onPress={() => setSelectionState('selectingStart')}
                        >
                            <Text style={styles.trimButtonText}>Adjust Trim Points</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={[
                                styles.actionButton,
                                { backgroundColor: getIndicatorColor() }
                            ]}
                            onPress={handleActionButtonPress}
                        >
                            <Text style={styles.trimButtonText}>{getActionButtonText()}</Text>
                        </Pressable>
                    )}

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

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color="#f20089" />
                        <Text style={styles.loadingCardText}>{loadingMessage}</Text>
                    </View>
                </View>
            )}
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
        height: 120
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
        backgroundColor: '#00f5d4', // Default color
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
        bottom: 10, // Position above the time markers
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        zIndex: 1,
    },

    timeMarkerContainer: {
        position: 'absolute',
        width: FRAME_WIDTH,
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
    },

    timeMarkerTick: {
        width: 1,
        height: 8,
        backgroundColor: 'white',
        marginBottom: 4,
        position: 'absolute',
        left: 0, // Position at the start (left edge) of the frame
    },

    timeMarkerText: {
        color: 'white',
        fontSize: 8,
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 2,
        borderRadius: 2,
        position: 'absolute',
        left: -15, // Center the text below the tick (assuming ~30px width)
        top: 10, // Position below the tick
        width: 40, // Fixed width for better centering
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
        justifyContent: 'center',
        marginTop: 2,
        width: FRAME_WIDTH,
        position: 'relative',
        left: 0, // Align with left edge of frame
        height: 20, // Fixed height for time markers
        textAlign: 'center',
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

    startTimeMarker: {
        fontWeight: 'bold',
        backgroundColor: 'rgba(56, 176, 0, 0.7)', // Green for start marker
        color: 'white',
        paddingHorizontal: 6,
    },

    endTimeMarker: {
        fontWeight: 'bold',
        backgroundColor: 'rgba(255, 0, 0, 0.7)', // Red for end marker
        color: 'white',
        paddingHorizontal: 6,
    },

    maxEndTimeMarker: {
        fontWeight: 'bold',
        backgroundColor: 'rgba(255, 0, 0, 0.7)', // Red for max end marker
        color: 'white',
        paddingHorizontal: 6,
    },

    hiddenTimeMarkerText: {
        opacity: 0, // Hide text but keep the element in the layout
    },
    disabledFrameRange: {
        opacity: 0.5,
    },
    frameOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 5,
    },
    beforeStartOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderLeftWidth: 0,
        borderRightWidth: 2,
        borderRightColor: '#38b000',
    },
    afterEndOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderLeftWidth: 2,
        borderLeftColor: '#ff0055',
    },
    loadingCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    loadingCardText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
    },
});