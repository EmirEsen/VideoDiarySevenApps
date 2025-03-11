import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';

export interface VideoProcessingParams {
    videoUri: string;
    startTime: number;
    duration: number;
    outputFileName?: string;
}

export interface ThumbnailParams {
    videoUri: string;
    timeMs: number;
    quality?: number;
}

export interface ProcessingResult {
    success: boolean;
    outputUri: string;
    thumbnailUri: string;
    error?: string;
}

export const processVideo = async ({
    videoUri,
    startTime,
    duration,
    outputFileName = `trimmed_${Date.now()}.mp4`
}: VideoProcessingParams): Promise<ProcessingResult> => {
    try {
        const outputUri = `${FileSystem.cacheDirectory}${outputFileName}`;

        const inputFileInfo = await FileSystem.getInfoAsync(videoUri);
        if (!inputFileInfo.exists) {
            throw new Error(`Input file does not exist: ${videoUri}`);
        }

        try {
            const { FFmpegKit, ReturnCode } = require('ffmpeg-kit-react-native');

            const command = `-ss ${startTime} -i "${videoUri}" -t ${duration} -c copy "${outputUri}"`;

            const session = await FFmpegKit.execute(command);
            const returnCode = await session.getReturnCode();
            const logs = await session.getAllLogs();

            if (ReturnCode.isSuccess(returnCode)) {

                try {
                    // Generate a thumbnail from the middle of the trimmed section
                    const middleTimeMs = Math.round(startTime * 1000 + (duration * 1000) / 2);

                    const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(outputUri, {
                        time: middleTimeMs - Math.round(startTime * 1000), // Adjust for trimmed video and ensure it's an integer
                        quality: 0.7,
                    });

                    return {
                        success: true,
                        outputUri,
                        thumbnailUri,
                    };
                } catch (thumbnailError: any) {
                    return {
                        success: true,
                        outputUri,
                        thumbnailUri: '',
                        error: `Video processed successfully but thumbnail generation failed: ${thumbnailError.message}`,
                    };
                }
            } else {

                return {
                    success: false,
                    outputUri: '',
                    thumbnailUri: '',
                    error: `Failed to trim the video. FFmpeg error code: ${returnCode}`,
                };
            }
        } catch (error: any) {

            if (error.code === 'MODULE_NOT_FOUND') {
                return await processFallback(videoUri);
            }

            return await processFallback(videoUri);
        }

    } catch (error: any) {
        return {
            success: false,
            outputUri: '',
            thumbnailUri: '',
            error: `An error occurred while processing the video: ${error.message}`,
        };
    }
};

const processFallback = async (videoUri: string): Promise<ProcessingResult> => {
    try {
        // Generate a thumbnail from the video
        const middleTimeMs = 1000; // Just use 1 second as a default
        console.log('Generating fallback thumbnail at time:', middleTimeMs, 'ms');

        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: middleTimeMs,
            quality: 0.7,
        });

        console.log('Fallback thumbnail generated successfully:', thumbnailUri);

        return {
            success: true,
            outputUri: videoUri,
            thumbnailUri,
            error: 'Video was not trimmed due to FFmpeg unavailability. Using original video.',
        };
    } catch (error: any) {
        console.error('Error in fallback processing:', error);
        return {
            success: false,
            outputUri: '',
            thumbnailUri: '',
            error: `Fallback processing failed: ${error.message}`,
        };
    }
};

export const generateThumbnail = async ({
    videoUri,
    timeMs,
    quality = 0.7
}: ThumbnailParams): Promise<string> => {
    try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: Math.round(timeMs),
            quality,
        });
        return uri;
    } catch (error) {
        console.error('Error generating thumbnail:', error);
        throw error;
    }
}; 