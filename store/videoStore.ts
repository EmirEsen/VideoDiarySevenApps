import { create } from 'zustand';
import { TrimmedVideo } from '@/components/video/TrimmedVideo';

interface VideoState {
    videos: TrimmedVideo[];
    addVideo: (video: TrimmedVideo) => void;
    removeVideo: (id: string) => void;
    getVideos: () => TrimmedVideo[];
}

export const useVideoStore = create<VideoState>((set, get) => ({
    videos: [],

    addVideo: (video: TrimmedVideo) => {
        set((state) => ({
            videos: [video, ...state.videos]
        }));
    },

    removeVideo: (id: string) => {
        set((state) => ({
            videos: state.videos.filter(video => video.id !== id)
        }));
    },

    getVideos: () => {
        return get().videos;
    }
})); 