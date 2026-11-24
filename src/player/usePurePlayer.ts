import { useEffect, useEffectEvent, useState } from 'react';
import { useVideoPlayer, type AudioTrack, type SubtitleTrack } from 'expo-video';

export type PlayerSource = {
  id: number;
  uri: string;
  format?: 'hls' | 'dash' | 'auto';
};

type PlaybackState = 'idle' | 'loading' | 'ready' | 'error';
type VideoSize = { width: number; height: number };

export type PlayerEvent = { sourceId: number } & (
  | { type: 'loadStart' | 'ready' | 'firstFrameRendered' | 'ended' }
  | { type: 'stateChanged'; state: PlaybackState }
  | { type: 'isPlayingChanged'; isPlaying: boolean }
  | { type: 'bufferingChanged'; isBuffering: boolean }
  | { type: 'durationChanged'; duration: number | null }
  | { type: 'videoSizeChanged'; width: number; height: number }
  | { type: 'volumeChanged'; volume: number }
  | { type: 'audioTrackChanged'; track: AudioTrack | null }
  | { type: 'subtitleTrackChanged'; track: SubtitleTrack | null }
  | { type: 'progress'; position: number; bufferedPosition: number | null }
  | { type: 'seekStarted'; position: number }
  | { type: 'error'; code: 'PLAYBACK_FAILED'; message: string }
);

type EventPayload = PlayerEvent extends infer Event
  ? Event extends PlayerEvent ? Omit<Event, 'sourceId'> : never
  : never;

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
) {
  const engine = useVideoPlayer(null, (player) => {
    player.timeUpdateEventInterval = 0.25;
  });
  const [state, setState] = useState<PlaybackState>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);
  const [volume, setVolume] = useState(() => engine.volume);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [subtitleTrack, setSubtitleTrack] = useState<SubtitleTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notify = useEffectEvent((event: EventPayload) => {
    onEvent?.({ ...event, sourceId: source.id });
  });
  const { uri, format } = source;

  useEffect(() => {
    let active = true;
    let failed = false;
    let ready = false;
    let buffering = false;
    let lastSize: VideoSize | undefined;
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
        setAudioTracks(event.availableAudioTracks);
        setSubtitleTracks(event.availableSubtitleTracks);
        setAudioTrack(engine.audioTrack);
        setSubtitleTrack(engine.subtitleTrack);
        const seconds = Number.isFinite(event.duration) && event.duration > 0
          ? event.duration : null;
        setDuration(seconds);
        notify({ type: 'durationChanged', duration: seconds });
        updateSize(engine.videoTrack?.size ?? event.availableVideoTracks.find(
          (track) => track.isSupported && track.size.width > 0 && track.size.height > 0,
        )?.size);
      }),
      engine.addListener('videoTrackChange', ({ videoTrack }) => updateSize(videoTrack?.size)),
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
        notify({ type: 'ended' });
      }),
    ];

    notify({ type: 'loadStart' });
    setState('loading');
    engine.replaceAsync({ uri, contentType: format ?? 'auto' }).then(() => {
      if (active && !failed) engine.play();
    }).catch(reportError);

    return () => {
      active = false;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [engine, format, uri]);

  return {
    engine, state, isPlaying, ended, position, duration, videoSize, volume, error,
    audioTracks, subtitleTracks, audioTrack, subtitleTrack,
    selectAudio: (track: AudioTrack) => { engine.audioTrack = track; },
    selectSubtitle: (track: SubtitleTrack | null) => { engine.subtitleTrack = track; },
    play: () => ended ? engine.replay() : engine.play(),
    pause: () => engine.pause(),
    setVolume: (level: number) => { engine.volume = Math.min(1, Math.max(0, level)); },
    seekTo(seconds: number) {
      if (duration === null || !Number.isFinite(seconds)) return;
      const target = Math.max(0, Math.min(seconds, duration));
      if (target < duration) setEnded(false);
      engine.currentTime = target;
      onEvent?.({ sourceId: source.id, type: 'seekStarted', position: target });
    },
    firstFrameRendered() {
      onEvent?.({ sourceId: source.id, type: 'firstFrameRendered' });
    },
  };
}
