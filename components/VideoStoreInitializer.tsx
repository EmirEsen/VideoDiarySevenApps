import { useEffect } from 'react';
import { useVideoStore } from '@/store/videoStore';

export function VideoStoreInitializer() {
    const loadVideos = useVideoStore(state => state.loadVideos);

    useEffect(() => {
        loadVideos();
    }, [loadVideos]);

    return null;
} 