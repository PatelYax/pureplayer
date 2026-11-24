import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AudioTrack, SubtitleTrack } from 'expo-video';
import { colors } from '../theme';
import type { PlayerControls, VideoQuality } from './usePurePlayer';

type Props = {
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  audioTrack: AudioTrack | null;
  subtitleTrack: SubtitleTrack | null;
  selectAudio: (track: AudioTrack) => void;
  selectSubtitle: (track: SubtitleTrack | null) => void;
  videoQualities: number[];
  videoQuality: VideoQuality;
  videoSize: { height: number } | null;
  selectVideoQuality: PlayerControls['selectVideoQuality'];
  onClose: () => void;
  onBack: () => void;
};

function Option({ label, onPress, selected, preferred = false }: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  preferred?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      hasTVPreferredFocus={Platform.isTV && preferred}
      onPress={onPress}
      style={({ focused, pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed, focused && styles.focus]}
    >
      <Text style={styles.label}>{selected ? `${label} (selected)` : label}</Text>
    </Pressable>
  );
}

export function TrackSettings({
  audioTracks, subtitleTracks, audioTrack, subtitleTrack, selectAudio, selectSubtitle,
  videoQualities, videoQuality, videoSize, selectVideoQuality, onClose, onBack,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [changingQuality, setChangingQuality] = useState(false);

  async function changeQuality(quality: VideoQuality) {
    if (changingQuality || quality === videoQuality) return;
    setChangingQuality(true);
    setError(null);
    try {
      await selectVideoQuality(quality);
    } catch (cause) {
      console.warn('PurePlayer could not change video quality.', cause);
      setError(cause instanceof Error ? cause.message : 'Could not change video quality.');
    } finally {
      setChangingQuality(false);
    }
  }

  async function openCaptionStyle() {
    setError(null);
    try {
      await Linking.sendIntent('android.settings.CAPTIONING_SETTINGS');
    } catch (cause) {
      console.warn('PurePlayer could not open Android caption settings.', cause);
      setError('Open Settings > Accessibility > Captions to change subtitle style on this device.');
    }
  }

  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onBack}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.panel}>
          <Text accessibilityRole="header" style={styles.heading}>Playback settings</Text>
          <ScrollView>
            {(videoQualities.length > 1 || videoQuality !== 'auto') && (
              <>
                <Text accessibilityRole="header" style={styles.section}>Video quality</Text>
                <Option label={videoQuality === 'auto' && videoSize ? `Auto (${videoSize.height}p)` : 'Auto'}
                  selected={videoQuality === 'auto'} onPress={() => changeQuality('auto')} />
                {videoQualities.map((height) => (
                  <Option key={height} label={`${height}p`} selected={videoQuality === height}
                    onPress={() => changeQuality(height)} />
                ))}
              </>
            )}
            {audioTracks.length > 1 && (
              <>
                <Text accessibilityRole="header" style={styles.section}>Audio</Text>
                {audioTracks.map((track, i) => (
                  <Option key={track.id} label={track.name || track.label || track.language || `Audio ${i + 1}`}
                    selected={audioTrack?.id === track.id} onPress={() => selectAudio(track)} />
                ))}
              </>
            )}
            {subtitleTracks.length > 0 && (
              <>
                <Text accessibilityRole="header" style={styles.section}>Subtitles</Text>
                <Option label="Off" selected={subtitleTrack === null} onPress={() => selectSubtitle(null)} />
                {subtitleTracks.map((track, i) => (
                  <Option key={track.id} label={track.name || track.label || track.language || `Subtitle ${i + 1}`}
                    selected={subtitleTrack?.id === track.id} onPress={() => selectSubtitle(track)} />
                ))}
                {Platform.OS === 'android' && (
                  <Option label="Subtitle style: text and background colors" onPress={openCaptionStyle} />
                )}
              </>
            )}
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          </ScrollView>
          <Option label="Done" preferred onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: '#0009' },
  panel: { width: '100%', maxWidth: 480, maxHeight: '90%', padding: 16, gap: 8, borderRadius: 16, backgroundColor: colors.surface },
  heading: { color: colors.text, fontSize: 20, fontWeight: '700' },
  section: { color: colors.muted, fontSize: 15, marginTop: 10, marginBottom: 4 },
  option: { justifyContent: 'center', minHeight: 46, paddingHorizontal: 10, borderWidth: 2, borderColor: 'transparent', borderRadius: 8 },
  selected: { backgroundColor: colors.selected },
  pressed: { backgroundColor: colors.pressed },
  focus: { borderColor: colors.focus, backgroundColor: colors.selected },
  label: { color: colors.text, fontSize: 16 },
  error: { color: colors.error },
});
