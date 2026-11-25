/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useVideoPlayer, type AudioTrack, type SubtitleTrack } from 'expo-video';

export type PlayerSource = {
  id: number;
  uri: string;
  format?: 'hls' | 'dash' | 'auto';
  headers?: Record<string, string>;
};

type PlaybackState = 'idle' | 'loading' | 'ready' | 'error';
type VideoSize = { width: number; height: number };

export type PlaybackSnapshot = {
  position: number;
  duration: number | null;
  ended: boolean;
};

export type PreferredTracks = {
  audioLanguage?: string | null;
  subtitleLanguage?: string | null;
  quality?: VideoQuality | string | null;
};

export type PlaybackOptions = {
  initialPosition?: number;
  autoPlay?: boolean;
  preferredTracks?: PreferredTracks;
  onTracksChanged?: (selected: {
    audioLanguage?: string;
    subtitleLanguage?: string | null;
    quality?: VideoQuality;
  }) => void;
};

export type VideoQuality = 'auto' | number;

type AndroidQualityMethods = {
  purePlayerGetVideoQualities?: () => Promise<number[]>;
  purePlayerSetVideoQuality?: (height: number | null) => Promise<void>;
};

export type PlayerControls = {
  play: () => void;
  pause: () => void;
  replay: () => void;
  seekTo: (seconds: number) => void;
  seekBy: (seconds: number) => void;
  setVolume: (level: number) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  selectAudio: (track: AudioTrack) => void;
  selectSubtitle: (track: SubtitleTrack | null) => void;
  selectVideoQuality: (quality: VideoQuality) => Promise<void>;
  getPlaybackSnapshot: () => PlaybackSnapshot;
};

export type PlayerEvent = { sourceId: number } & (
  | { type: 'loadStart' | 'ready' | 'firstFrameRendered' | 'ended' }
  | { type: 'stateChanged'; state: PlaybackState }
  | { type: 'isPlayingChanged'; isPlaying: boolean }
  | { type: 'bufferingChanged'; isBuffering: boolean }
  | { type: 'durationChanged'; duration: number | null }
  | { type: 'videoSizeChanged'; width: number; height: number }
  | { type: 'videoQualityChanged'; quality: VideoQuality }
  | { type: 'volumeChanged'; volume: number }
  | { type: 'mutedChanged'; muted: boolean }
  | { type: 'playbackRateChanged'; playbackRate: number }
  | { type: 'audioTrackChanged'; track: AudioTrack | null }
  | { type: 'subtitleTrackChanged'; track: SubtitleTrack | null }
  | { type: 'progress'; position: number; bufferedPosition: number | null }
  | { type: 'seekStarted'; position: number }
  | { type: 'resumeApplied'; position: number }
  | ({ type: 'checkpoint'; reason: 'pause' | 'background' | 'exit' | 'ended' } & PlaybackSnapshot)
  | { type: 'timedActionPressed'; actionId: string; position: number }
  | { type: 'error'; code: 'PLAYBACK_FAILED'; message: string }
);

type EventPayload = PlayerEvent extends infer Event
  ? Event extends PlayerEvent ? Omit<Event, 'sourceId'> : never
  : never;

function matchesLanguage(track: AudioTrack | SubtitleTrack, targetLang?: string | null): boolean {
  if (!targetLang || !track) return false;
  const target = targetLang.trim().toLowerCase();
  if (!target) return false;

  const trackLang = (track.language ?? '').toLowerCase();
  const trackLabel = (track.label ?? '').toLowerCase();
  const trackName = ((track as any).name ?? '').toLowerCase();

  return (
    trackLang === target ||
    trackLang.startsWith(target) ||
    target.startsWith(trackLang) ||
    trackLabel.includes(target) ||
    trackName.includes(target) ||
    (target === 'hin' && (trackLang === 'hi' || trackLabel.includes('hindi') || trackName.includes('hindi'))) ||
    (target === 'hindi' && (trackLang === 'hi' || trackLang === 'hin')) ||
    (target === 'eng' && (trackLang === 'en' || trackLabel.includes('english') || trackName.includes('english'))) ||
    (target === 'english' && (trackLang === 'en' || trackLang === 'eng')) ||
    (target === 'jpn' && (trackLang === 'ja' || trackLabel.includes('japanese') || trackName.includes('japanese'))) ||
    (target === 'japanese' && (trackLang === 'ja' || trackLang === 'jpn'))
  );
}

const playbackStates = {
  idle: 'idle',
  loading: 'loading',
  readyToPlay: 'ready',
  error: 'error',
} as const;

// Mount a new player for each source ID so events from an old source cannot be relabeled.
export function usePurePlayer(
  source: PlayerSource,
  onEvent?: (event: PlayerEvent) => void,
  options?: PlaybackOptions,
) {
  const engine: ReturnType<typeof useVideoPlayer> & AndroidQualityMethods = useVideoPlayer(null, (player) => {
    player.timeUpdateEventInterval = 0.25;
  });
  const [state, setState] = useState<PlaybackState>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playRequested, setPlayRequested] = useState(options?.autoPlay ?? true);
  const playRequestedRef = useRef(playRequested);
  const [ended, setEnded] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);
  const [videoQualities, setVideoQualities] = useState<number[]>([]);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('auto');
  const [volume, setVolume] = useState(() => engine.volume);
  const [muted, setMuted] = useState(() => engine.muted);
  const [playbackRate, setPlaybackRate] = useState(() => engine.playbackRate);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [subtitleTrack, setSubtitleTrack] = useState<SubtitleTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notify = useEffectEvent((event: EventPayload) => {
    onEvent?.({ ...event, sourceId: source.id });
  });
  const { uri, format } = source;
  const getStartupOptions = useEffectEvent(() => options);

  function requestPlayback(playing: boolean) {
    playRequestedRef.current = playing;
    setPlayRequested(playing);
  }

  function getPlaybackSnapshot(): PlaybackSnapshot {
    return {
      position: ended && duration !== null ? duration : engine.currentTime,
      duration,
      ended,
    };
  }

  const reportBackground = useEffectEvent(() => {
    if (duration !== null && onEvent) {
      notify({ type: 'checkpoint', reason: 'background', ...getPlaybackSnapshot() });
    }
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') reportBackground();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    let failed = false;
    let ready = false;
    let buffering = false;
    let lastSize: VideoSize | undefined;
    let loadedDuration: number | null = null;
    const { initialPosition = 0, autoPlay = true } = getStartupOptions() ?? {};
    const shouldResume = Number.isFinite(initialPosition) && initialPosition > 0;
    let replaced = false;
    let receivedMetadata = false;
    let started = false;
    let qualityRequest = 0;
    requestPlayback(autoPlay);
    setVideoQualities([]);
    setVideoQuality('auto');

    function refreshVideoQualities() {
      if (Platform.OS !== 'android' || !engine.purePlayerGetVideoQualities) return;
      const request = ++qualityRequest;
      engine.purePlayerGetVideoQualities().then((heights) => {
        if (!active || request !== qualityRequest) return;
        setVideoQualities((previous) =>
          previous.length === heights.length && previous.every((height, index) => height === heights[index]) ? previous : heights);
      }).catch((cause: unknown) => {
        if (active && request === qualityRequest) console.warn('PurePlayer could not list video qualities.', cause);
      });
    }

    if (!Number.isFinite(initialPosition) || initialPosition < 0) {
      console.warn('PurePlayer initialPosition must be a non-negative, finite number of seconds.');
    }

    function startPlayback() {
      if (!active || failed || started || !replaced || (shouldResume && !receivedMetadata)) return;
      started = true;
        // An end-of-video position is not a useful resume point.
      if (shouldResume && loadedDuration !== null && initialPosition < loadedDuration) {
        engine.currentTime = initialPosition;
        // Do not publish a progress sample until the engine reports its actual position.
        setPosition(initialPosition);
        notify({ type: 'resumeApplied', position: initialPosition });
      } else if (shouldResume) {
        console.warn('PurePlayer could not resume: the saved position is outside the playable duration or the duration is unknown.');
      }
      if (playRequestedRef.current) engine.play();
    }

    function updateSize(size?: VideoSize) {
      if (!size || size.width <= 0 || size.height <= 0 ||
          (size.width === lastSize?.width && size.height === lastSize.height)) return;
      lastSize = size;
      setVideoSize(size);
      notify({ type: 'videoSizeChanged', ...size });
    }
    function reportError() {
      if (failed || !active) return;
      failed = true;
      const message = 'Could not play this video. Check the URL, file access, or video format.';
      setError(message);
      setState('error');
      notify({ type: 'stateChanged', state: 'error' });
      notify({ type: 'error', code: 'PLAYBACK_FAILED', message });
    }

    const subscriptions = [
      engine.addListener('statusChange', ({ status }) => {
        const nextState = playbackStates[status];
        const nextBuffering = status === 'loading';
        if (nextBuffering !== buffering) {
          buffering = nextBuffering;
          notify({ type: 'bufferingChanged', isBuffering: buffering });
        }
        if (status === 'error') {
          reportError();
          return;
        }
        setState(nextState);
        notify({ type: 'stateChanged', state: nextState });
        if (status === 'readyToPlay' && !ready) {
          ready = true;
          notify({ type: 'ready' });
        }
      }),
      engine.addListener('playingChange', ({ isPlaying: playing }) => {
        setIsPlaying(playing);
        if (playing) setEnded(false);
        notify({ type: 'isPlayingChanged', isPlaying: playing });
      }),
      engine.addListener('sourceLoad', (event) => {
        refreshVideoQualities();
        setAudioTracks(event.availableAudioTracks);
        setSubtitleTracks(event.availableSubtitleTracks);

        // Auto-select preferred audio if requested
        if (options?.preferredTracks?.audioLanguage) {
          const matchedAudio = event.availableAudioTracks.find((t) =>
            matchesLanguage(t, options.preferredTracks?.audioLanguage),
          );
          if (matchedAudio && matchedAudio.id !== engine.audioTrack?.id) {
            engine.audioTrack = matchedAudio;
          }
        }

        // Auto-select preferred subtitle if requested
        if (options?.preferredTracks?.subtitleLanguage !== undefined) {
          const prefSub = options.preferredTracks.subtitleLanguage;
          if (!prefSub || prefSub.toLowerCase() === 'off' || prefSub.toLowerCase() === 'none') {
            engine.subtitleTrack = null;
          } else {
            const matchedSub = event.availableSubtitleTracks.find((t) =>
              matchesLanguage(t, prefSub),
            );
            if (matchedSub && matchedSub.id !== engine.subtitleTrack?.id) {
              engine.subtitleTrack = matchedSub;
            }
          }
        }

        // Auto-select preferred quality if requested
        if (options?.preferredTracks?.quality && options.preferredTracks.quality !== 'auto') {
          const parsed = typeof options.preferredTracks.quality === 'string'
            ? parseInt(options.preferredTracks.quality.replace(/[^0-9]/g, ''), 10)
            : options.preferredTracks.quality;
          if (parsed && !isNaN(parsed) && engine.purePlayerSetVideoQuality) {
            engine.purePlayerSetVideoQuality(parsed).catch(() => {});
          }
        }

        setAudioTrack(engine.audioTrack);
        setSubtitleTrack(engine.subtitleTrack);
        const seconds = Number.isFinite(event.duration) && event.duration > 0
          ? event.duration : null;
        loadedDuration = seconds;
        receivedMetadata = true;
        setDuration(seconds);
        notify({ type: 'durationChanged', duration: seconds });
        updateSize(engine.videoTrack?.size ?? event.availableVideoTracks.find(
          (track) => track.isSupported && track.size.width > 0 && track.size.height > 0,
        )?.size);
        startPlayback();
      }),
      engine.addListener('videoTrackChange', ({ videoTrack }) => {
        updateSize(videoTrack?.size);
        refreshVideoQualities();
      }),
      engine.addListener('availableAudioTracksChange', ({ availableAudioTracks }) => setAudioTracks(availableAudioTracks)),
      engine.addListener('availableSubtitleTracksChange', ({ availableSubtitleTracks }) => setSubtitleTracks(availableSubtitleTracks)),
      engine.addListener('audioTrackChange', ({ audioTrack: track }) => {
        setAudioTrack(track);
        notify({ type: 'audioTrackChanged', track });
      }),
      engine.addListener('subtitleTrackChange', ({ subtitleTrack: track }) => {
        setSubtitleTrack(track);
        notify({ type: 'subtitleTrackChanged', track });
      }),
      engine.addListener('volumeChange', ({ volume: level }) => {
        setVolume(level);
        notify({ type: 'volumeChanged', volume: level });
      }),
      engine.addListener('mutedChange', ({ muted: nextMuted }) => {
        setMuted(nextMuted);
        notify({ type: 'mutedChanged', muted: nextMuted });
      }),
      engine.addListener('playbackRateChange', ({ playbackRate: rate }) => {
        setPlaybackRate(rate);
        notify({ type: 'playbackRateChanged', playbackRate: rate });
      }),
      engine.addListener('timeUpdate', ({ currentTime, bufferedPosition }) => {
        setPosition(currentTime);
        notify({
          type: 'progress',
          position: currentTime,
          bufferedPosition: bufferedPosition >= 0 ? bufferedPosition : null,
        });
      }),
      engine.addListener('playToEnd', () => {
        setEnded(true);
        notify({
          type: 'checkpoint', reason: 'ended', ended: true,
          position: loadedDuration ?? engine.currentTime, duration: loadedDuration,
        });
        notify({ type: 'ended' });
      }),
    ];

    notify({ type: 'loadStart' });
    setState('loading');
    engine.replaceAsync({ uri, contentType: format ?? 'auto', headers: source.headers }).then(() => {
      replaced = true;
      startPlayback();
    }).catch(reportError);

    return () => {
      active = false;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [engine, format, uri]);

  function seekTo(seconds: number) {
    if (!Number.isFinite(seconds)) {
      console.warn('PurePlayer seek position must be finite.');
      return;
    }
    if (duration === null) return;
    const target = Math.max(0, Math.min(seconds, duration));
    if (target < duration) setEnded(false);
    engine.currentTime = target;
    onEvent?.({ sourceId: source.id, type: 'seekStarted', position: target });
  }

  function replay() {
    requestPlayback(true);
    setEnded(false);
    setPosition(0);
    engine.replay();
  }

  const commands: PlayerControls = {
    selectAudio: (track: AudioTrack) => {
      engine.audioTrack = track;
      setAudioTrack(track);
      options?.onTracksChanged?.({
        audioLanguage: track.language || (track as any).name || track.label,
        subtitleLanguage: engine.subtitleTrack ? (engine.subtitleTrack.language || (engine.subtitleTrack as any).name || engine.subtitleTrack.label) : null,
        quality: videoQuality,
      });
    },
    selectSubtitle: (track: SubtitleTrack | null) => {
      engine.subtitleTrack = track;
      setSubtitleTrack(track);
      options?.onTracksChanged?.({
        audioLanguage: engine.audioTrack ? (engine.audioTrack.language || (engine.audioTrack as any).name || engine.audioTrack.label) : undefined,
        subtitleLanguage: track ? (track.language || (track as any).name || track.label) : null,
        quality: videoQuality,
      });
    },
    async selectVideoQuality(quality) {
      if (Platform.OS !== 'android' || !engine.purePlayerSetVideoQuality) {
        throw new Error('Manual video quality requires a rebuilt Android app with the PurePlayer quality patch.');
      }
      if (quality !== 'auto' && (!Number.isInteger(quality) || quality <= 0 || !videoQualities.includes(quality))) {
        throw new Error('Select one of the available video resolutions.');
      }
      await engine.purePlayerSetVideoQuality(quality === 'auto' ? null : quality);
      setVideoQuality(quality);
      onEvent?.({ type: 'videoQualityChanged', sourceId: source.id, quality });
      options?.onTracksChanged?.({
        audioLanguage: engine.audioTrack ? (engine.audioTrack.language || (engine.audioTrack as any).name || engine.audioTrack.label) : undefined,
        subtitleLanguage: engine.subtitleTrack ? (engine.subtitleTrack.language || (engine.subtitleTrack as any).name || engine.subtitleTrack.label) : null,
        quality,
      });
    },
    play: () => {
      if (ended) replay();
      else {
        requestPlayback(true);
        engine.play();
      }
    },
    pause: () => {
      requestPlayback(false);
      engine.pause();
      const snapshot = getPlaybackSnapshot();
      if (snapshot.duration !== null) onEvent?.({ type: 'checkpoint', sourceId: source.id, reason: 'pause', ...snapshot });
    },
    replay,
    setVolume: (level) => {
      if (!Number.isFinite(level)) {
        console.warn('PurePlayer volume must be finite.');
        return;
      }
      engine.volume = Math.min(1, Math.max(0, level));
    },
    setMuted: (value) => { engine.muted = value; },
    setPlaybackRate: (rate) => {
      if (!Number.isFinite(rate) || rate <= 0) {
        console.warn('PurePlayer playback rate must be a positive, finite number.');
        return;
      }
      engine.playbackRate = Math.min(16, Math.max(0.1, rate));
    },
    seekTo,
    seekBy: (seconds) => seekTo(engine.currentTime + seconds),
    getPlaybackSnapshot,
  };

  return {
    engine, state, isPlaying, playRequested, ended, position, duration, videoSize, videoQualities, videoQuality, volume, muted, playbackRate, error,
    audioTracks, subtitleTracks, audioTrack, subtitleTrack,
    ...commands,
    firstFrameRendered() {
      onEvent?.({ sourceId: source.id, type: 'firstFrameRendered' });
    },
  };
}
