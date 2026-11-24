import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { VideoView } from 'expo-video';
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, useTVEventHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { usePurePlayer, type PlayerEvent, type PlayerSource } from './usePurePlayer';
import { usePlaybackOrientation, type PlaybackOrientation } from './usePlaybackOrientation';
import { usePlaybackBrightness } from './usePlaybackBrightness';
import { useSeekGestures } from './useSeekGestures';
import { TrackSettings } from './TrackSettings';
import { colors } from '../theme';

export function PlayerButton({
  label, onPress, disabled = false, preferredFocus = false, secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  preferredFocus?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hasTVPreferredFocus={Platform.isTV && preferredFocus}
      onPress={onPress}
      style={({ focused, pressed }) => [
        styles.button,
        secondary && styles.secondary,
        pressed && styles.active,
        focused && styles.focused,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

const icons = {
  backArrow: 'M19 12H5m7-7-7 7 7 7',
  play: 'M8 5l12 7-12 7z',
  pause: 'M8 5h2v14H8zM14 5h2v14h-2z',
  backwardChevrons: 'm11 5-7 7 7 7m9-14-7 7 7 7',
  forwardChevrons: 'm4 5 7 7-7 7m9-14 7 7-7 7',
  brightness: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  previous: 'M5 5v14M19 5 8 12l11 7z',
  next: 'M19 5v14M5 5l11 7-11 7z',
  fill: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  fit: 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5',
  tracks: 'M3 5h18v12h-8l-4 3v-3H3zM6 9h5m2 0h5M6 13h8m2 0h2',
};

const scrubLabelWidth = 72;
const exitWindowMs = 2000;
const tvControlsIdleMs = 4000;

function IconButton({ icon, label, onPress, disabled, primary, compact, step }: {
  icon: keyof typeof icons;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  compact?: boolean;
  step?: '-10' | '+10';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hasTVPreferredFocus={Platform.isTV && primary && !disabled}
      onPress={onPress}
      style={({ focused, pressed }) => [
        styles.iconButton,
        compact && styles.compactIcon,
        primary && styles.primaryIcon,
        pressed && styles.active,
        focused && styles.focused,
        disabled && styles.disabled,
      ]}
    >
      <Svg accessible={false} width={primary ? 36 : compact || step ? 22 : 28} height={primary ? 36 : compact || step ? 22 : 28} viewBox="0 0 24 24">
        <Path d={icons[icon]} fill="none" stroke="#000B" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path
          d={icons[icon]}
          fill={primary ? colors.text : 'none'}
          stroke={colors.text}
          strokeWidth={primary ? 1 : 1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {step && <Text accessible={false} style={styles.stepLabel}>{step}</Text>}
    </Pressable>
  );
}

function BrightnessSlider({ value, onChange, left }: {
  value: number;
  onChange: (level: number) => void;
  left: number;
}) {
  const height = useRef(0);
  const start = useRef({ pageY: 0, locationY: 0 });
  const percent = Math.round(value * 100);
  return (
    <View pointerEvents="box-none" style={[styles.side, { left }]}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Screen brightness"
        accessibilityValue={{ min: 5, max: 100, now: percent }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') onChange(value + 0.1);
          if (nativeEvent.actionName === 'decrement') onChange(value - 0.1);
        }}
        onLayout={({ nativeEvent }) => { height.current = nativeEvent.layout.height; }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={({ nativeEvent: { pageY, locationY } }) => {
          start.current = { pageY, locationY };
          if (height.current > 0) onChange(1 - locationY / height.current);
        }}
        onResponderMove={({ nativeEvent: { pageY } }) => {
          if (height.current > 0) {
            const y = start.current.locationY + pageY - start.current.pageY;
            onChange(1 - y / height.current);
          }
        }}
        style={styles.brightnessTarget}
      >
        <View pointerEvents="none" style={styles.brightnessTrack}>
          <View style={[styles.brightnessFill, { height: `${percent}%` }]} />
        </View>
      </View>
      <Svg accessible={false} width={19} height={19} viewBox="0 0 24 24">
        <Path d={icons.brightness} fill="none" stroke={colors.text} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

type BackNavigation =
  | { backRoute?: undefined; navigate?: undefined }
  | { backRoute: string; navigate: (route: string) => void };

export type PurePlayerProps = BackNavigation & {
  source: PlayerSource;
  onEvent?: (event: PlayerEvent) => void;
  controls?: boolean;
  autoRotate?: boolean;
  initialOrientation?: PlaybackOrientation;
  lockedOrientation?: PlaybackOrientation;
  onExit?: () => void;
  onBack?: () => void;
  /** @deprecated Use onBack. */
  onClose?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  skipIntro?: { start: number; end: number };
};

export function PurePlayer({
  source, ...props
}: PurePlayerProps) {
  return <PlayerSession key={source.id} source={source} {...props} />;
}

function PlayerSession({
  source, onEvent, controls = true, autoRotate = false, initialOrientation, lockedOrientation,
  onExit, onBack, onClose, backRoute, navigate, onNext, onPrev, skipIntro,
}: PurePlayerProps) {
  const player = usePurePlayer(source, onEvent);
  const insets = useSafeAreaInsets();
  const edge = Platform.isTV ? 24 : 14;
  const [controlsVisible, setControlsVisible] = useState(true);
  const [tvActivity, setTvActivity] = useState(0);
  const [exitHintVisible, setExitHintVisible] = useState(false);
  const exitDeadline = useRef(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trackSettingsOpen, setTrackSettingsOpen] = useState(false);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const scrubStart = useRef<{ pageX: number; localX: number } | null>(null);
  const surfaceWidth = useRef(0);
  const [fillScreen, setFillScreen] = useState(false);
  const brightness = usePlaybackBrightness(controls && !Platform.isTV);
  const { duration, videoSize } = player;
  usePlaybackOrientation(autoRotate, videoSize, initialOrientation, lockedOrientation);
  const seekDisabled = duration === null || player.state === 'error';
  const showControls = controls && controlsVisible;
  const gestures = useSeekGestures(player.position, duration, player.seekTo, controls && !seekDisabled && !trackSettingsOpen, showControls);
  const tvSeekPreview = Platform.isTV ? gestures.preview : null;
  const timelinePreview = scrubPosition ?? tvSeekPreview;
  const displayedPosition = timelinePreview ?? gestures.preview ?? player.position;
  const progress = duration ? Math.min(100, Math.max(0, displayedPosition / duration * 100)) : 0;
  const hasTrackSettings = player.audioTracks.length > 1 || player.subtitleTracks.length > 0;

  const loading = player.state === 'loading' || (player.state === 'idle' && !player.ended);
  const canAutoHide = Platform.isTV && showControls && player.isPlaying && !player.ended &&
    !loading && !player.error && !trackSettingsOpen && gestures.preview === null;

  useTVEventHandler(({ eventType }) => {
    if (canAutoHide && eventType !== 'focus' && eventType !== 'blur') {
      setTvActivity((activity) => activity + 1);
    }
  });

  useEffect(() => {
    if (!canAutoHide) return;
    const timer = setTimeout(() => setControlsVisible(false), tvControlsIdleMs);
    return () => clearTimeout(timer);
  }, [canAutoHide, tvActivity]);

  function clearExitHint() {
    exitDeadline.current = 0;
    if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    exitTimer.current = null;
    setExitHintVisible(false);
  }

  function toggleControls() {
    clearExitHint();
    setControlsVisible((visible) => !visible);
  }

  function hideControls() {
    clearExitHint();
    gestures.cancelSeek();
    scrubStart.current = null;
    setScrubPosition(null);
    setTrackSettingsOpen(false);
    setControlsVisible(false);
  }

  const handleHardwareBack = useEffectEvent(() => {
    if (showControls || trackSettingsOpen) {
      hideControls();
      return true;
    }

    gestures.cancelSeek();
    if (Date.now() >= exitDeadline.current) {
      clearExitHint();
      exitDeadline.current = Date.now() + exitWindowMs;
      setExitHintVisible(true);
      exitTimer.current = setTimeout(clearExitHint, exitWindowMs);
      return true;
    }

    clearExitHint();
    const exit = onExit ?? (backRoute !== undefined ? () => navigate(backRoute) : onBack ?? onClose);
    if (!exit) return false;
    exit();
    return true;
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleHardwareBack());
    return () => {
      subscription.remove();
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    };
  }, []);

  function scrubTime(x: number) {
    if (seekDisabled || duration === null || timelineWidth <= 0) return null;
    return Math.max(0, Math.min(1, x / timelineWidth)) * duration;
  }

  function updateScrub(pageX: number, commit = false) {
    const start = scrubStart.current;
    if (!start) return;
    const target = scrubTime(start.localX + pageX - start.pageX);
    if (commit) {
      scrubStart.current = null;
      setScrubPosition(null);
      if (target !== null) player.seekTo(target);
    } else {
      setScrubPosition(target);
    }
  }

  const introEnd = skipIntro && duration !== null && !seekDisabled && !loading &&
    Number.isFinite(skipIntro.start) && skipIntro.start >= 0 &&
    skipIntro.end > skipIntro.start && skipIntro.end <= duration &&
    player.position >= skipIntro.start && player.position < skipIntro.end
    ? skipIntro.end : null;

  return (
    <View style={styles.player} onLayout={({ nativeEvent }) => { surfaceWidth.current = nativeEvent.layout.width; }}>
      <VideoView
        style={styles.video}
        player={player.engine}
        surfaceType="surfaceView"
        contentFit={fillScreen ? 'cover' : 'contain'}
        nativeControls={false}
        onFirstFrameRender={player.firstFrameRendered}
      />
      {controls && (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {!Platform.isTV && (
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={showControls ? 'Hide playback controls' : 'Show playback controls'}
              onPress={({ nativeEvent }) => {
                const fraction = surfaceWidth.current > 0 ? nativeEvent.locationX / surfaceWidth.current : 0.5;
                gestures.tapVideo(fraction < 0.4 ? -1 : fraction > 0.6 ? 1 : null, toggleControls);
              }}
            />
          )}
          {Platform.isTV && !showControls && (
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Show playback controls"
              hasTVPreferredFocus
              onPress={toggleControls}
            />
          )}
          {showControls && (
            <View pointerEvents="box-none" style={styles.overlay}>
              {!loading && (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <Svg width="100%" height="100%">
                    <Defs>
                      <LinearGradient id="playerShade" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#030710" stopOpacity={0.7} />
                        <Stop offset="28%" stopColor="#030710" stopOpacity={0} />
                        <Stop offset="68%" stopColor="#030710" stopOpacity={0} />
                        <Stop offset="100%" stopColor="#030710" stopOpacity={0.88} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#playerShade)" />
                  </Svg>
                </View>
              )}
              <View pointerEvents="box-none" style={[styles.top, {
                top: insets.top + edge, left: insets.left + edge, right: insets.right + edge,
              }]}>
                <IconButton icon="backArrow" label="Hide playback controls" compact onPress={hideControls} />
                <View pointerEvents="box-none" style={styles.tools}>
                  {onPrev && <IconButton icon="previous" label="Previous video" compact onPress={onPrev} />}
                  {onNext && <IconButton icon="next" label="Next video" compact onPress={onNext} />}
                  {hasTrackSettings && (
                    <IconButton icon="tracks" label="Audio and subtitles" compact onPress={() => setTrackSettingsOpen(true)} />
                  )}
                  {!Platform.isTV && <IconButton
                    icon={fillScreen ? 'fit' : 'fill'}
                    label={fillScreen ? 'Fit video to screen' : 'Zoom to fill screen'}
                    compact
                    onPress={() => setFillScreen((fill) => !fill)}
                  />}
                </View>
              </View>
              <View pointerEvents="box-none" style={styles.center}>
                {loading ? (
                  <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Loading video" />
                ) : player.error ? (
                  <Text accessibilityRole="alert" style={styles.error}>{player.error}</Text>
                ) : (
                  <View pointerEvents={!Platform.isTV && gestures.feedback ? 'none' : 'box-none'} style={[styles.row, gestures.feedback && styles.hideRow]}>
                    <IconButton icon="backwardChevrons" step="-10" label="Back 10 seconds" disabled={seekDisabled} onPress={() => player.seekTo(player.position - 10)} />
                    <IconButton
                      icon={player.isPlaying ? 'pause' : 'play'}
                      label={player.isPlaying ? 'Pause' : player.ended ? 'Replay' : 'Play'}
                      primary
                      onPress={player.isPlaying ? player.pause : player.play}
                    />
                    <IconButton icon="forwardChevrons" step="+10" label="Forward 10 seconds" disabled={seekDisabled} onPress={() => player.seekTo(player.position + 10)} />
                  </View>
                )}
              </View>
              {!Platform.isTV && brightness.value !== null && !loading && !player.error && (
                <BrightnessSlider value={brightness.value} onChange={brightness.setLevel} left={insets.left + edge} />
              )}
            </View>
          )}
          {(showControls || tvSeekPreview !== null) && (
              <View pointerEvents={Platform.isTV && !showControls ? 'none' : 'auto'} style={[styles.timeline, { bottom: insets.bottom + edge, left: insets.left + edge, right: insets.right + edge }]}>
                {brightness.error && <Text accessibilityRole="alert" style={styles.error}>{brightness.error}</Text>}
                {duration !== null && (
                  <View
                    accessible={!Platform.isTV}
                    accessibilityRole={Platform.isTV ? undefined : 'adjustable'}
                    accessibilityState={{ disabled: seekDisabled }}
                    accessibilityLabel="Playback position"
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(progress), text: formatTime(displayedPosition) }}
                    accessibilityActions={Platform.isTV ? undefined : [{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={({ nativeEvent }) => {
                      if (nativeEvent.actionName === 'increment') player.seekTo(player.position + 10);
                      if (nativeEvent.actionName === 'decrement') player.seekTo(player.position - 10);
                    }}
                    onLayout={({ nativeEvent }) => setTimelineWidth(nativeEvent.layout.width)}
                    onStartShouldSetResponder={() => !Platform.isTV && !seekDisabled && timelineWidth > 0}
                    onResponderGrant={({ nativeEvent: { pageX, locationX } }) => {
                      gestures.cancelSeek();
                      scrubStart.current = { pageX, localX: locationX };
                      setScrubPosition(scrubTime(locationX));
                    }}
                    onResponderMove={({ nativeEvent }) => updateScrub(nativeEvent.pageX)}
                    onResponderRelease={({ nativeEvent }) => updateScrub(nativeEvent.pageX, true)}
                    onResponderTerminate={() => {
                      scrubStart.current = null;
                      setScrubPosition(null);
                    }}
                    style={styles.seekTarget}
                  >
                    <View pointerEvents="none" style={styles.track}>
                      <View style={[styles.fill, { width: `${progress}%` }]} />
                    </View>
                    {timelinePreview !== null && timelineWidth > 0 && (
                      <View pointerEvents="none" style={[styles.scrubLabel, {
                        left: Math.max(0, Math.min(timelineWidth - scrubLabelWidth, timelineWidth * progress / 100 - scrubLabelWidth / 2)),
                      }]}>
                        <Text style={styles.scrubTime}>{formatTime(timelinePreview)}</Text>
                      </View>
                    )}
                  </View>
                )}
                {showControls && introEnd !== null && (
                  <View style={[styles.intro, {
                    right: insets.right + edge, bottom: insets.bottom + edge + 62,
                  }]}>
                    <PlayerButton label="Skip Intro" onPress={() => player.seekTo(introEnd)} />
                  </View>
                )}
                <View style={styles.times}>
                  <Text style={styles.time}>{formatTime(displayedPosition)}</Text>
                  <Text style={styles.time}>{duration === null ? '--:--' : formatTime(duration)}</Text>
                </View>
              </View>
          )}
          {gestures.feedback && (
            <View pointerEvents="none" style={[
              styles.seekFeedback,
              gestures.feedback.direction < 0 ? styles.seekFeedbackLeft : styles.seekFeedbackRight,
            ]}>
              <Svg accessible={false} width={28} height={28} viewBox="0 0 24 24">
                <Path d={icons[gestures.feedback.direction < 0 ? 'backwardChevrons' : 'forwardChevrons']}
                  fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.seekFeedbackText}>
                {gestures.feedback.direction < 0 ? '-' : '+'}{gestures.feedback.seconds}s
              </Text>
            </View>
          )}
        </View>
      )}
      {controls && trackSettingsOpen && (
        <TrackSettings
          audioTracks={player.audioTracks}
          subtitleTracks={player.subtitleTracks}
          audioTrack={player.audioTrack}
          subtitleTrack={player.subtitleTrack}
          selectAudio={player.selectAudio}
          selectSubtitle={player.selectSubtitle}
          onClose={() => setTrackSettingsOpen(false)}
          onBack={hideControls}
        />
      )}
      {exitHintVisible && (
        <View pointerEvents="none" style={[styles.exitHint, { bottom: insets.bottom + edge }]}>
          <Text accessibilityLiveRegion="polite" style={styles.label}>Press Back again to exit</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  player: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, width: '100%' },
  overlay: { ...StyleSheet.absoluteFill },
  top: { position: 'absolute', zIndex: 1, flexDirection: 'row', alignItems: 'center' },
  tools: { marginLeft: 'auto', flexDirection: 'row', gap: 6 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  side: { position: 'absolute', top: '50%', marginTop: -56, alignItems: 'center', gap: 6, zIndex: 1 },
  brightnessTarget: { width: 44, height: 106, alignItems: 'center', justifyContent: 'center' },
  brightnessTrack: { width: 7, height: '100%', borderRadius: 4, overflow: 'hidden', backgroundColor: '#52627BC9', justifyContent: 'flex-end' },
  brightnessFill: { backgroundColor: colors.accent, borderRadius: 4 },
  intro: { position: 'absolute', zIndex: 2 },
  timeline: { position: 'absolute' },
  seekTarget: { minHeight: 34, justifyContent: 'center' },
  scrubLabel: {
    position: 'absolute', bottom: '100%', width: scrubLabelWidth, alignItems: 'center',
    paddingVertical: 5, borderRadius: 6, backgroundColor: '#0A1220E8',
  },
  scrubTime: { color: colors.text, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  exitHint: {
    position: 'absolute', alignSelf: 'center', backgroundColor: '#0A1220E8',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18,
  },
  seekFeedback: { position: 'absolute', top: 0, bottom: 0, width: '50%', justifyContent: 'center', alignItems: 'center', gap: 4 },
  seekFeedbackLeft: { left: 0 },
  seekFeedbackRight: { right: 0 },
  seekFeedbackText: { color: colors.text, fontSize: 24, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.muted, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Platform.isTV ? 26 : 12 },
  hideRow: { opacity: 0 },
  iconButton: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: 'transparent',
    backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  compactIcon: { width: 44, height: 44, borderRadius: 22 },
  primaryIcon: { width: 68, height: 68, borderRadius: 34 },
  stepLabel: { color: colors.text, fontSize: 12, fontWeight: '700', textShadowColor: '#000', textShadowRadius: 4 },
  button: {
    minHeight: Platform.isTV ? 54 : 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.primary,
  },
  secondary: { backgroundColor: 'transparent', borderColor: colors.border },
  active: { backgroundColor: colors.pressed },
  focused: { backgroundColor: colors.selected, borderColor: colors.focus },
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: Platform.isTV ? 18 : 15, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.error, textAlign: 'center', maxWidth: '68%', alignSelf: 'center' },
});
