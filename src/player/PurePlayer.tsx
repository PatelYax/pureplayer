import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { VideoView } from 'expo-video';
import { CastButton } from 'react-native-google-cast';
import { ActivityIndicator, BackHandler, Dimensions, Platform, Pressable, StyleSheet, Text, useTVEventHandler, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { usePurePlayer, type PlaybackOptions, type PlayerControls, type PlayerEvent, type PlayerSource } from './usePurePlayer';
import { usePlaybackOrientation, type PlaybackOrientation } from './usePlaybackOrientation';
import { usePlaybackBrightness } from './usePlaybackBrightness';
import { usePlaybackCast } from './usePlaybackCast';
import { useSeekGestures } from './useSeekGestures';
import { TrackSettings, type TrackSettingsMode } from './TrackSettings';
import { PauseDetails, type PauseMetadata } from './PauseDetails';
import { colors, fonts } from '../theme';

export type { PauseMetadata } from './PauseDetails';

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

function formatTime(seconds: number, forceHours: boolean = false) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  if (hours > 0 || forceHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
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
  subtitles: 'M3 5h18v12h-8l-4 3v-3H3zM6 9h5m2 0h5M6 13h8m2 0h2',
  audio: 'M9 18V5l11-2v13M9 9l11-2M9 18a3 2 0 1 1-3-2 3 2 0 0 1 3 2Zm11-2a3 2 0 1 1-3-2 3 2 0 0 1 3 2Z',
  quality: 'M3 4h18v13H3zM8 21h8m-4-4v4M7 13v-2m5 2V9m5 4V7',
};

const scrubLabelWidth = 72;
const controlsIdleMs = 4000;
const pauseDetailsDelayMs = 3500;

function pinchDistance({ nativeEvent: { touches } }: GestureResponderEvent) {
  if (touches.length !== 2) return null;
  const [first, second] = touches;
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
}

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

export type TimedPlayerAction = {
  id: string;
  label: string;
  end?: number;
  onPress: (player: PlayerControls) => void;
} & (
  | { start: number; secondsBeforeEnd?: never }
  | { start?: never; secondsBeforeEnd: number }
);

export type PurePlayerProps = BackNavigation & PlaybackOptions & {
  source: PlayerSource;
  ref?: Ref<PlayerControls>;
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
  timedActions?: readonly TimedPlayerAction[];
  title?: string;
  subtitle?: string;
  pauseMetadata?: PauseMetadata;
};

export function PurePlayer({
  source, ...props
}: PurePlayerProps) {
  return <PlayerSession key={source.id} source={source} {...props} />;
}

function PlayerSession({
  source, onEvent, controls = true, autoRotate = false, initialOrientation, lockedOrientation,
  onExit, onBack, onClose, backRoute, navigate, onNext, onPrev, skipIntro, timedActions,
  ref, initialPosition, autoPlay, title, subtitle, pauseMetadata,
}: PurePlayerProps) {
  const player = usePurePlayer(source, onEvent, { initialPosition, autoPlay });
  const screen = Dimensions.get('screen');
  const cast = usePlaybackCast(
    controls && Platform.OS === 'android' && !Platform.isTV && Math.min(screen.width, screen.height) < 600 &&
      /^https?:\/\//i.test(source.uri),
    source, () => player.getPlaybackSnapshot().position, player.pause, title, subtitle,
  );
  const playerControls: PlayerControls = {
    play: player.play, pause: player.pause, replay: player.replay, seekTo: player.seekTo, seekBy: player.seekBy,
    setVolume: player.setVolume, setMuted: player.setMuted, setPlaybackRate: player.setPlaybackRate,
    selectAudio: player.selectAudio, selectSubtitle: player.selectSubtitle, selectVideoQuality: player.selectVideoQuality,
    getPlaybackSnapshot: player.getPlaybackSnapshot,
  };
  useImperativeHandle(ref, () => playerControls);
  const insets = useSafeAreaInsets();
  const edge = Platform.isTV ? 24 : 14;
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pauseDetailsVisible, setPauseDetailsVisible] = useState(false);
  const [pauseActivity, setPauseActivity] = useState(0);
  const [dismissedAction, setDismissedAction] = useState<string | null>(null);
  const [controlsActivity, setControlsActivity] = useState(0);
  const [trackSettings, setTrackSettings] = useState<TrackSettingsMode | null>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const scrubStart = useRef<{ pageX: number; localX: number } | null>(null);
  const surfaceWidth = useRef(0);
  const [landscape, setLandscape] = useState(false);
  const pinchStart = useRef<number | null>(null);
  const [fillScreen, setFillScreen] = useState(false);
  const brightness = usePlaybackBrightness(controls && !Platform.isTV);
  const { duration, videoSize } = player;
  usePlaybackOrientation(autoRotate, videoSize, initialOrientation, lockedOrientation);
  const seekDisabled = duration === null || player.state === 'error';
  const hasPauseMetadata = !!(pauseMetadata?.name || pauseMetadata?.detailLine || pauseMetadata?.description || pauseMetadata?.image !== undefined);
  const canShowPauseDetails = controls && hasPauseMetadata && !player.playRequested && !player.isPlaying &&
    !player.ended && !player.error && !trackSettings && !cast.casting;
  const showPauseDetails = canShowPauseDetails && pauseDetailsVisible;
  const showControls = controls && controlsVisible && !showPauseDetails;
  const gestures = useSeekGestures(player.position, duration, player.seekTo, controls && !seekDisabled && !trackSettings && !showPauseDetails && !cast.casting, showControls);
  const tvSeekPreview = Platform.isTV ? gestures.preview : null;
  const timelinePreview = scrubPosition ?? tvSeekPreview;
  const displayedPosition = timelinePreview ?? gestures.preview ?? player.position;
  const progress = duration ? Math.min(100, Math.max(0, displayedPosition / duration * 100)) : 0;
  const showHours = (duration !== null && duration >= 3600) || displayedPosition >= 3600;

  const loading = player.state === 'loading' || (player.state === 'idle' && !player.ended);
  const actionPosition = player.ended ? duration ?? player.position : player.position;
  const activeAction = timedActions?.find((action) => {
    const offset = action.start ?? action.secondsBeforeEnd;
    if (!action.id.trim() || !action.label.trim() || !Number.isFinite(offset) || offset < 0 ||
      (action.end !== undefined && !Number.isFinite(action.end))) return false;
    const start = action.start ?? (duration === null ? null : Math.max(0, duration - action.secondsBeforeEnd));
    return start !== null && actionPosition >= start && (action.end === undefined || actionPosition < action.end);
  });
  const activeActionId = activeAction?.id;
  const showAction = controls && !cast.casting && activeAction !== undefined && activeActionId !== dismissedAction &&
    !loading && !player.error && !trackSettings && !showPauseDetails && timelinePreview === null && gestures.preview === null;

  useEffect(() => {
    setDismissedAction((id) => id === activeActionId ? id : null);
  }, [activeActionId]);

  useEffect(() => {
    if (!timedActions) return;
    const ids = new Set<string>();
    for (const action of timedActions) {
      const start = action.start ?? action.secondsBeforeEnd;
      if (!action.id.trim() || !action.label.trim() || ids.has(action.id) || !Number.isFinite(start) || start < 0 ||
        (action.end !== undefined && (!Number.isFinite(action.end) || action.end <= (action.start ?? 0)))) {
        console.warn(`PurePlayer timed action "${action.id}" needs a unique ID, a label, and a valid time window.`);
      }
      ids.add(action.id);
    }
  }, [timedActions]);

  const canAutoHide = showControls && player.isPlaying && !player.ended &&
    !loading && !player.error && !trackSettings && timelinePreview === null && gestures.preview === null;

  function noteControlsActivity() {
    if (canAutoHide) setControlsActivity((activity) => activity + 1);
    if (canShowPauseDetails && !showPauseDetails) setPauseActivity((activity) => activity + 1);
  }

  useTVEventHandler(({ eventType }) => {
    if (!Platform.isTV || eventType === 'focus' || eventType === 'blur') return;
    if (showPauseDetails) {
      dismissPauseDetails();
    } else {
      noteControlsActivity();
    }
  });

  useEffect(() => {
    if (!canAutoHide) return;
    const timer = setTimeout(() => setControlsVisible(false), controlsIdleMs);
    return () => clearTimeout(timer);
  }, [canAutoHide, controlsActivity]);

  useEffect(() => {
    if (!canShowPauseDetails) {
      setPauseDetailsVisible(false);
      return;
    }
    if (timelinePreview !== null || gestures.preview !== null) return;
    const timer = setTimeout(() => setPauseDetailsVisible(true), pauseDetailsDelayMs);
    return () => clearTimeout(timer);
  }, [canShowPauseDetails, pauseActivity, timelinePreview !== null, gestures.preview !== null]);

  function dismissPauseDetails() {
    setPauseDetailsVisible(false);
    setControlsVisible(true);
    setPauseActivity((activity) => activity + 1);
  }

  function toggleControls() {
    setControlsVisible((visible) => !visible);
  }

  function hideControls() {
    gestures.cancelSeek();
    scrubStart.current = null;
    setScrubPosition(null);
    setTrackSettings(null);
    setControlsVisible(false);
    if (activeAction) setDismissedAction(activeAction.id);
  }

  const handleHardwareBack = useEffectEvent(() => {
    if (showPauseDetails) {
      dismissPauseDetails();
      return true;
    }
    if (showControls || trackSettings || showAction || gestures.preview !== null) {
      hideControls();
      return true;
    }

    if (!cast.casting) {
      const snapshot = player.getPlaybackSnapshot();
      if (snapshot.duration !== null) onEvent?.({ type: 'checkpoint', sourceId: source.id, reason: 'exit', ...snapshot });
    }
    const exit = onExit ?? (backRoute !== undefined ? () => navigate(backRoute) : onBack ?? onClose);
    if (!exit) return false;
    exit();
    return true;
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handleHardwareBack());
    return () => subscription.remove();
  }, []);

  function startPinch(event: GestureResponderEvent) {
    gestures.cancelSeek();
    pinchStart.current = pinchDistance(event);
  }

  function movePinch(event: GestureResponderEvent) {
    const distance = pinchDistance(event);
    const start = pinchStart.current;
    if (distance === null || start === null || start <= 0) return;
    const threshold = Math.max(12, start * 0.15);
    if (distance >= start + threshold) setFillScreen(true);
    else if (distance <= start - threshold) setFillScreen(false);
  }

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
    <View style={styles.player} onLayout={({ nativeEvent: { layout: { width, height } } }) => {
      surfaceWidth.current = width;
      setLandscape(width > height);
    }}>
      <VideoView
        style={styles.video}
        player={player.engine}
        surfaceType="surfaceView"
        contentFit={fillScreen ? 'cover' : 'contain'}
        nativeControls={false}
        onFirstFrameRender={player.firstFrameRendered}
      />
      {controls && (
        <View
          pointerEvents="box-none"
          style={StyleSheet.absoluteFill}
          onTouchStart={Platform.isTV ? undefined : noteControlsActivity}
          onTouchEnd={Platform.isTV ? undefined : noteControlsActivity}
          onStartShouldSetResponderCapture={(event) => !Platform.isTV && pinchDistance(event) !== null}
          onMoveShouldSetResponderCapture={(event) => !Platform.isTV && pinchDistance(event) !== null}
          onResponderGrant={startPinch}
          onResponderMove={movePinch}
          onResponderEnd={(event) => { if (pinchDistance(event) === null) pinchStart.current = null; }}
          onResponderTerminate={() => { pinchStart.current = null; }}
        >
          {!Platform.isTV && !showPauseDetails && (
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={showControls ? 'Hide playback controls' : 'Show playback controls'}
              accessibilityActions={[{ name: 'toggleZoom', label: fillScreen ? 'Fit video to screen' : 'Zoom video to fill' }]}
              onAccessibilityAction={({ nativeEvent }) => {
                if (nativeEvent.actionName === 'toggleZoom') setFillScreen((fill) => !fill);
              }}
              onPress={({ nativeEvent }) => {
                const fraction = surfaceWidth.current > 0 ? nativeEvent.locationX / surfaceWidth.current : 0.5;
                gestures.tapVideo(fraction < 0.4 ? -1 : fraction > 0.6 ? 1 : null, toggleControls);
              }}
            />
          )}
          {Platform.isTV && !showControls && !showPauseDetails && (
            <Pressable
              style={showAction ? styles.tvShowControlsTarget : StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Show playback controls"
              hasTVPreferredFocus={!showAction}
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
                {(!!title || !!subtitle) && (
                  <View style={styles.headerCopy}>
                    {!!title && <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</Text>}
                    {!!subtitle && <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text>}
                  </View>
                )}
                <View pointerEvents="box-none" style={styles.tools}>
                  {onPrev && <IconButton icon="previous" label="Previous video" compact onPress={onPrev} />}
                  {onNext && <IconButton icon="next" label="Next video" compact onPress={onNext} />}
                  {!cast.casting && player.subtitleTracks.length > 0 && (
                    <IconButton icon="subtitles" label="Subtitles" compact onPress={() => setTrackSettings('subtitles')} />
                  )}
                  {!cast.casting && player.audioTracks.length > 1 && (
                    <IconButton icon="audio" label="Audio tracks" compact onPress={() => setTrackSettings('audio')} />
                  )}
                  {!cast.casting && (player.videoQualities.length > 1 || player.videoQuality !== 'auto') && (
                    <IconButton icon="quality" label="Video quality" compact onPress={() => setTrackSettings('quality')} />
                  )}
                  {cast.available && <CastButton accessibilityLabel="Cast" tintColor={colors.text} style={styles.compactIcon} />}
                </View>
              </View>
              <View pointerEvents="box-none" style={styles.center}>
                {cast.casting ? (
                  <PlayerButton label="Cast controls" onPress={cast.openControls} />
                ) : loading ? (
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
              {!Platform.isTV && !cast.casting && brightness.value !== null && !loading && !player.error && (
                <BrightnessSlider value={brightness.value} onChange={brightness.setLevel} left={insets.left + edge} />
              )}
            </View>
          )}
          {!cast.casting && (showControls || tvSeekPreview !== null) && (
              <View pointerEvents={Platform.isTV && !showControls ? 'none' : 'auto'} style={[styles.timeline, { bottom: insets.bottom + edge, left: insets.left + edge, right: insets.right + edge }]}>
                {brightness.error && <Text accessibilityRole="alert" style={styles.error}>{brightness.error}</Text>}
                {duration !== null && (
                  <View
                    accessible={!Platform.isTV}
                    accessibilityRole={Platform.isTV ? undefined : 'adjustable'}
                    accessibilityState={{ disabled: seekDisabled }}
                    accessibilityLabel="Playback position"
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(progress), text: formatTime(displayedPosition, showHours) }}
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
                        <Text style={styles.scrubTime}>{formatTime(timelinePreview, showHours || timelinePreview >= 3600)}</Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.times}>
                  <Text style={styles.time}>{formatTime(displayedPosition, showHours)}</Text>
                  <Text style={styles.time}>{duration === null ? '--:--' : formatTime(duration, showHours)}</Text>
                </View>
              </View>
          )}
          {!cast.casting && (showAction || (showControls && !activeAction && introEnd !== null)) && (
            <View style={[styles.intro, {
              right: insets.right + edge, bottom: insets.bottom + edge + (showControls ? 62 : 0),
            }]}>
              {showAction ? (
                <PlayerButton
                  label={activeAction.label}
                  preferredFocus={!showControls}
                  onPress={() => {
                    setDismissedAction(activeAction.id);
                    onEvent?.({ type: 'timedActionPressed', sourceId: source.id, actionId: activeAction.id, position: actionPosition });
                    activeAction.onPress(playerControls);
                  }}
                />
              ) : introEnd !== null ? (
                <PlayerButton label="Skip Intro" onPress={() => player.seekTo(introEnd)} />
              ) : null}
            </View>
          )}
          {cast.error && <Text pointerEvents="none" accessibilityRole="alert"
            style={[styles.castError, { bottom: insets.bottom + 76 }]}>{cast.error}</Text>}
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
      {controls && hasPauseMetadata && pauseMetadata && (
        <PauseDetails metadata={pauseMetadata} visible={showPauseDetails} onDismiss={dismissPauseDetails} landscape={landscape}
          bottom={insets.bottom + edge * 2} left={insets.left + edge * 2} right={insets.right + edge * 2} />
      )}
      {controls && trackSettings && !cast.casting && (
        <TrackSettings
          mode={trackSettings}
          audioTracks={player.audioTracks}
          subtitleTracks={player.subtitleTracks}
          audioTrack={player.audioTrack}
          subtitleTrack={player.subtitleTrack}
          selectAudio={player.selectAudio}
          selectSubtitle={player.selectSubtitle}
          videoQualities={player.videoQualities}
          videoQuality={player.videoQuality}
          videoSize={player.videoSize}
          selectVideoQuality={player.selectVideoQuality}
          onClose={() => setTrackSettings(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  castError: { position: 'absolute', alignSelf: 'center', maxWidth: '85%', padding: 8,
    backgroundColor: colors.surface, color: colors.error, fontFamily: fonts.regular, textAlign: 'center' },
  player: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, width: '100%' },
  overlay: { ...StyleSheet.absoluteFill },
  top: { position: 'absolute', zIndex: 1, flexDirection: 'row', alignItems: 'center' },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  headerTitle: { color: colors.text, fontSize: Platform.isTV ? 24 : 18, fontFamily: fonts.bold },
  headerSubtitle: { color: colors.muted, fontSize: Platform.isTV ? 16 : 13, fontFamily: fonts.regular },
  tools: { marginLeft: 'auto', flexDirection: 'row', gap: 6 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  side: { position: 'absolute', top: '50%', marginTop: -56, alignItems: 'center', gap: 6, zIndex: 1 },
  brightnessTarget: { width: 44, height: 106, alignItems: 'center', justifyContent: 'center' },
  brightnessTrack: { width: 7, height: '100%', borderRadius: 4, overflow: 'hidden', backgroundColor: '#52627BC9', justifyContent: 'flex-end' },
  brightnessFill: { backgroundColor: colors.accent, borderRadius: 4 },
  intro: { position: 'absolute', zIndex: 2 },
  tvShowControlsTarget: { position: 'absolute', width: 72, height: 72, top: '50%', alignSelf: 'center', marginTop: -36 },
  timeline: { position: 'absolute' },
  seekTarget: { minHeight: 34, justifyContent: 'center' },
  scrubLabel: {
    position: 'absolute', bottom: '100%', width: scrubLabelWidth, alignItems: 'center',
    paddingVertical: 5, borderRadius: 6, backgroundColor: '#0A1220E8',
  },
  scrubTime: { color: colors.text, fontSize: 14, fontFamily: fonts.bold, fontVariant: ['tabular-nums'] },
  seekFeedback: { position: 'absolute', top: 0, bottom: 0, width: '50%', justifyContent: 'center', alignItems: 'center', gap: 4 },
  seekFeedbackLeft: { left: 0 },
  seekFeedbackRight: { right: 0 },
  seekFeedbackText: { color: colors.text, fontSize: 24, fontFamily: fonts.bold, textShadowColor: '#000', textShadowRadius: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.muted, fontFamily: fonts.regular, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Platform.isTV ? 26 : 12 },
  hideRow: { opacity: 0 },
  iconButton: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: 'transparent',
    backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  compactIcon: { width: 44, height: 44, borderRadius: 22 },
  primaryIcon: { width: 68, height: 68, borderRadius: 34 },
  stepLabel: { color: colors.text, fontSize: 12, fontFamily: fonts.bold, textShadowColor: '#000', textShadowRadius: 4 },
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
  label: { color: colors.text, fontSize: Platform.isTV ? 18 : 15, fontFamily: fonts.bold, textAlign: 'center' },
  error: { color: colors.error, fontFamily: fonts.regular, textAlign: 'center', maxWidth: '68%', alignSelf: 'center' },
});
