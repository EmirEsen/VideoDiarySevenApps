import { useMutation, useQueryClient } from '@tanstack/react-query';
import { processVideo, VideoProcessingParams, ProcessingResult } from '../services/videoProcessingService';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

export const useVideoProcessing = (onSuccess?: (data: ProcessingResult) => void) => {
    const router = useRouter();
    const queryClient = useQueryClient();

    return useMutation<ProcessingResult, Error, VideoProcessingParams>({
        mutationFn: async (params: VideoProcessingParams) => {
            return await processVideo(params);
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });

            if (data.success) {
                if (onSuccess) {
                    onSuccess(data);
                } else {
                    router.push({
                        pathname: '/(tabs)/[id]/videoDetails',
                        params: {
                            id: Date.now().toString(),
                            uri: data.outputUri,
                            filename: 'trimmed_video',
                            duration: variables.duration.toString(),
                            trimStart: variables.startTime.toString(),
                            trimEnd: (variables.startTime + variables.duration).toString(),
                            thumbnailUri: data.thumbnailUri,
                            name: '',
                            description: ''
                        }
                    });
                }
            } else {
                Alert.alert('Error', data.error || 'Failed to process video');
            }
        },
        onError: (error) => {
            console.error('Video processing error:', error);
            Alert.alert('Error', `Failed to process video: ${error.message}`);
        }
    });
}; 