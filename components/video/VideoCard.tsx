import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video"
import { View, StyleSheet, Text } from "react-native";

export default function VideoCard({ uri }: { uri: string }) {

    const player = useVideoPlayer(uri, player => {
        player.loop = true;
        player.play();
    });

    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

    return (
        <View style={styles.contentContainer}>
            <VideoView style={styles.video}
                player={player}
                allowsFullscreen
                allowsPictureInPicture />
            <Text style={styles.title}>Video 1</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 50
    },
    video: {
        width: 250,
        height: 150,
        borderRadius: 22
    },
    title: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10
    }
});