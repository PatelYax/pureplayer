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

let languageNames: Intl.DisplayNames | null = null;
try {
  languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
} catch {
  // Fallback if Intl.DisplayNames is not supported
}

function normalizeLanguageName(codeOrName: string | undefined): string | null {
  if (!codeOrName) return null;
  const trimmed = String(codeOrName).trim();
  const lower = trimmed.toLowerCase();

  // If it's an undetermined code or technical index (e.g. audio_0, 0), ignore it
  if (
    lower === 'und' ||
    lower === 'root' ||
    lower === 'unknown' ||
    lower === 'undefined' ||
    lower === 'none' ||
    /^(audio|sub|track|stream)?_?\d+$/i.test(trimmed)
  ) {
    return null;
  }

  // If it's a 2 or 3 letter ISO code (e.g. 'en', 'es', 'ta', 'hin', 'fra') or 'en-US'
  if (/^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(trimmed) && languageNames) {
    try {
      const resolved = languageNames.of(trimmed);
      if (
        resolved &&
        resolved.toLowerCase() !== 'root' &&
        resolved.toLowerCase() !== 'und' &&
        resolved.toLowerCase() !== 'unknown'
      ) {
        return resolved;
      }
    } catch {
      // Ignore resolution error
    }
  }

  return trimmed;
}

export function getTrackBaseLanguage(track: AudioTrack | SubtitleTrack | null | undefined): string {
  if (!track) return '';
  const candidateName = normalizeLanguageName((track as any).name);
  const candidateLabel = normalizeLanguageName((track as any).label);
  const candidateLang = normalizeLanguageName(track.language);
  const candidateId = normalizeLanguageName((track as any).id);

  return (
    candidateName ||
    candidateLabel ||
    candidateLang ||
    candidateId ||
    track.language ||
    (track as any).name ||
    track.label ||
    ''
  );
}

export function getTrackDuplicateInfo(
  track: AudioTrack | SubtitleTrack,
  allTracks: (AudioTrack | SubtitleTrack)[],
): { baseLanguage: string; duplicateIndex: number; totalDuplicates: number } {
  const baseLanguage = getTrackBaseLanguage(track);
  const duplicates = allTracks.filter((t) => getTrackBaseLanguage(t) === baseLanguage);
  const duplicateIndex = duplicates.indexOf(track) + 1;
  return {
    baseLanguage,
    duplicateIndex: Math.max(1, duplicateIndex),
    totalDuplicates: duplicates.length,
  };
}

export function getTrackLabel(
  track: AudioTrack | SubtitleTrack,
  index: number,
  allTracks: (AudioTrack | SubtitleTrack)[],
  fallbackPrefix: string,
): string {
  const { baseLanguage, duplicateIndex, totalDuplicates } = getTrackDuplicateInfo(track, allTracks);

  if (!baseLanguage) {
    if (fallbackPrefix === 'Audio' && allTracks.length === 1) {
      return 'Default Audio';
    }
    return `${fallbackPrefix} ${index + 1}`;
  }

  if (totalDuplicates > 1) {
    return `${baseLanguage} (${duplicateIndex})`;
  }

  return baseLanguage;
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

  const selectedAudioIndex = (() => {
    if (!audioTrack) return 0;
    const refIdx = audioTracks.indexOf(audioTrack);
    if (refIdx !== -1) return refIdx;

    if (audioTrack.id) {
      const idMatches = audioTracks
        .map((t, idx) => (t.id === audioTrack.id ? idx : -1))
        .filter((idx) => idx !== -1);
      if (idMatches.length === 1) return idMatches[0];
    }

    const targetInfo = getTrackDuplicateInfo(audioTrack, audioTracks);
    const matchIdx = audioTracks.findIndex((t) => {
      const tInfo = getTrackDuplicateInfo(t, audioTracks);
      return (
        tInfo.baseLanguage === targetInfo.baseLanguage &&
        tInfo.duplicateIndex === targetInfo.duplicateIndex
      );
    });
    if (matchIdx !== -1) return matchIdx;

    const baseIdx = audioTracks.findIndex(
      (t) => getTrackBaseLanguage(t) === targetInfo.baseLanguage,
    );
    return baseIdx !== -1 ? baseIdx : 0;
  })();

  const selectedSubIndex = (() => {
    if (!subtitleTrack) return -1;
    const refIdx = subtitleTracks.indexOf(subtitleTrack);
    if (refIdx !== -1) return refIdx;

    if (subtitleTrack.id) {
      const idMatches = subtitleTracks
        .map((t, idx) => (t.id === subtitleTrack.id ? idx : -1))
        .filter((idx) => idx !== -1);
      if (idMatches.length === 1) return idMatches[0];
    }

    const targetInfo = getTrackDuplicateInfo(subtitleTrack, subtitleTracks);
    const matchIdx = subtitleTracks.findIndex((t) => {
      const tInfo = getTrackDuplicateInfo(t, subtitleTracks);
      return (
        tInfo.baseLanguage === targetInfo.baseLanguage &&
        tInfo.duplicateIndex === targetInfo.duplicateIndex
      );
    });
    if (matchIdx !== -1) return matchIdx;

    return subtitleTracks.findIndex(
      (t) => getTrackBaseLanguage(t) === targetInfo.baseLanguage,
    );
  })();

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
              const isSelected = i === selectedAudioIndex;
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
                  selected={subtitleTrack === null || selectedSubIndex === -1}
                  preferred={subtitleTrack === null || selectedSubIndex === -1}
                  onPress={() => { selectSubtitle(null); onClose(); }}
                />
                {subtitleTracks.map((track, i) => {
                  const label = getTrackLabel(track, i, subtitleTracks, 'Subtitle');
                  const isSelected = i === selectedSubIndex;
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
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.75)' },
  panel: { width: '100%', maxWidth: 360, maxHeight: '85%', padding: 16, gap: 8, borderRadius: 16,
    backgroundColor: '#0A0A0AF8', borderWidth: 1, borderColor: '#1F1F1F' },
  heading: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 10,
    borderWidth: 1.5, borderColor: 'transparent', borderRadius: 8 },
  selected: { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: colors.accent },
  pressed: { backgroundColor: colors.pressed },
  focus: { borderColor: colors.focus, backgroundColor: colors.selected },
  label: { color: colors.text, fontFamily: fonts.regular, fontSize: 15, flex: 1 },
  check: { color: colors.accent, fontSize: 18, fontFamily: fonts.bold },
  error: { color: colors.error, fontFamily: fonts.regular },
});
