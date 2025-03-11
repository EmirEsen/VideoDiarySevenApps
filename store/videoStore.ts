import { create } from 'zustand';
import { TrimmedVideo } from '@/components/video/TrimmedVideo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'video_diary_videos';

interface VideoState {
    videos: TrimmedVideo[];
    isLoading: boolean;
    addVideo: (video: TrimmedVideo) => Promise<void>;
    updateVideo: (video: TrimmedVideo) => Promise<void>;
    removeVideo: (id: string) => Promise<void>;
    getVideos: () => TrimmedVideo[];
    loadVideos: () => Promise<void>;
}

const saveVideosToStorage = async (videos: TrimmedVideo[]): Promise<void> => {
    try {
        const jsonValue = JSON.stringify(videos);
        await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (error) {
        console.error('Error saving videos to storage:', error);
    }
};

export const useVideoStore = create<VideoState>((set, get) => ({
    videos: [],
    isLoading: true,

    // Load videos from AsyncStorage
    loadVideos: async () => {
        try {
            set({ isLoading: true });
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
            const savedVideos = jsonValue != null ? JSON.parse(jsonValue) as TrimmedVideo[] : [];
            set({ videos: savedVideos, isLoading: false });
        } catch (error) {
            console.error('Error loading videos from storage:', error);
            set({ isLoading: false });
        }
    },

    // Add a video and save to AsyncStorage
    addVideo: async (video: TrimmedVideo) => {
        const updatedVideos = [video, ...get().videos];
        set({ videos: updatedVideos });
        await saveVideosToStorage(updatedVideos);
    },

    // Update a video and save to AsyncStorage
    updateVideo: async (video: TrimmedVideo) => {
        const updatedVideos = get().videos.map(v =>
            v.id === video.id ? video : v
        );
        set({ videos: updatedVideos });
        await saveVideosToStorage(updatedVideos);
    },

    // Remove a video and save to AsyncStorage
    removeVideo: async (id: string) => {
        const updatedVideos = get().videos.filter(video => video.id !== id);
        set({ videos: updatedVideos });
        await saveVideosToStorage(updatedVideos);
    },

    // Get videos (synchronous, for convenience)
    getVideos: () => {
        return get().videos;
    }
})); 