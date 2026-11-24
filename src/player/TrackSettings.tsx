import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AudioTrack, SubtitleTrack } from 'expo-video';
import { colors, fonts } from '../theme';
import type { PlayerControls, VideoQuality } from './usePurePlayer';

export type TrackSettingsMode = 'audio' | 'subtitles' | 'quality';

const headings = { audio: 'Audio tracks', subtitles: 'Subtitles', quality: 'Video quality' };

type Props = {
  mode: TrackSettingsMode;
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
};

function Option({ label, onPress, selected, preferred = false, disabled = false }: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  preferred?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      hasTVPreferredFocus={Platform.isTV && preferred}
      disabled={disabled}
      onPress={onPress}
      style={({ focused, pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed, focused && styles.focus]}
    >
      <Text style={styles.label}>{label}</Text>
      {selected && <Text accessible={false} style={styles.check}>✓</Text>}
    </Pressable>
  );
}

function getTrackLabel(
  track: AudioTrack | SubtitleTrack,
  index: number,
  allTracks: (AudioTrack | SubtitleTrack)[],
  fallbackPrefix: string,
): string {
  const baseLabel = (track as any).label || (track as any).name || track.language;
  if (!baseLabel) {
    return `${fallbackPrefix} ${index + 1}`;
  }
  const duplicates = allTracks.filter(
    (t) => ((t as any).label || (t as any).name || t.language) === baseLabel,
  );
  if (duplicates.length > 1) {
    const duplicateIndex = duplicates.indexOf(track);
    return `${baseLabel} (${duplicateIndex + 1})`;
  }
  return baseLabel;
}

export function TrackSettings({
  mode, audioTracks, subtitleTracks, audioTrack, subtitleTrack, selectAudio, selectSubtitle,
  videoQualities, videoQuality, videoSize, selectVideoQuality, onClose,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [changingQuality, setChangingQuality] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function changeQuality(quality: VideoQuality) {
    if (changingQuality) return;
    if (quality === videoQuality) {
      onClose();
      return;
    }
    setChangingQuality(true);
    setError(null);
    try {
      await selectVideoQuality(quality);
      if (mounted.current) onClose();
    } catch (cause) {
      console.warn('PurePlayer could not change video quality.', cause);
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not change video quality.');
    } finally {
      if (mounted.current) setChangingQuality(false);
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
    <Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessible={false} focusable={false} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.panel}>
          <Text accessibilityRole="header" style={styles.heading}>{headings[mode]}</Text>
          <ScrollView>
            {mode === 'quality' && (
              <>
                <Option label={videoQuality === 'auto' && videoSize ? `Auto (${videoSize.height}p)` : 'Auto'}
                  selected={videoQuality === 'auto'} preferred={videoQuality === 'auto' || !videoQualities.includes(videoQuality)}
                  disabled={changingQuality} onPress={() => changeQuality('auto')} />
                {videoQualities.map((height) => (
                  <Option key={height} label={`${height}p`} selected={videoQuality === height}
                    preferred={videoQuality === height} disabled={changingQuality} onPress={() => changeQuality(height)} />
                ))}
              </>
            )}
            {mode === 'audio' && audioTracks.map((track, i) => {
              const label = getTrackLabel(track, i, audioTracks, 'Audio');
              const isSelected = audioTrack
                ? (audioTrack.id && track.id ? audioTrack.id === track.id : audioTrack === track)
                : i === 0;
              return (
                <Option
                  key={`${track.id ?? 'audio'}-${i}`}
                  label={label}
                  selected={isSelected}
                  preferred={isSelected}
                  onPress={() => { selectAudio(track); onClose(); }}
                />
              );
            })}
            {mode === 'subtitles' && (
              <>
                <Option
                  label="Off"
                  selected={subtitleTrack === null}
                  preferred={subtitleTrack === null}
                  onPress={() => { selectSubtitle(null); onClose(); }}
                />
                {subtitleTracks.map((track, i) => {
                  const label = getTrackLabel(track, i, subtitleTracks, 'Subtitle');
                  const isSelected = subtitleTrack
                    ? (subtitleTrack.id && track.id ? subtitleTrack.id === track.id : subtitleTrack === track)
                    : false;
                  return (
                    <Option
                      key={`${track.id ?? 'sub'}-${i}`}
                      label={label}
                      selected={isSelected}
                      preferred={isSelected}
                      onPress={() => { selectSubtitle(track); onClose(); }}
                    />
                  );
                })}
                {Platform.OS === 'android' && (
                  <Option label="Subtitle style: text and background colors" onPress={openCaptionStyle} />
                )}
              </>
            )}
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: '#0004' },
  panel: { width: '100%', maxWidth: 360, maxHeight: '85%', padding: 16, gap: 8, borderRadius: 20,
    backgroundColor: '#091322F0', borderWidth: 1, borderColor: '#A8C6F044' },
  heading: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 10,
    borderWidth: 2, borderColor: 'transparent', borderRadius: 10 },
  selected: { backgroundColor: colors.selected },
  pressed: { backgroundColor: colors.pressed },
  focus: { borderColor: colors.focus, backgroundColor: colors.selected },
  label: { color: colors.text, fontFamily: fonts.regular, fontSize: 16, flex: 1, textShadowColor: '#000', textShadowRadius: 4 },
  check: { color: colors.focus, fontSize: 18, fontFamily: fonts.bold },
  error: { color: colors.error, fontFamily: fonts.regular },
});
