import { useEffect, useEffectEvent, useState } from 'react';
import GoogleCast, { PlayServicesState, type CastSession } from 'react-native-google-cast';
import type { PlayerSource } from './usePurePlayer';

function getContentType(source: PlayerSource) {
  const path = source.uri.split(/[?#]/, 1)[0].toLowerCase();
  if (source.format === 'hls' || (source.format !== 'dash' && path.endsWith('.m3u8'))) return 'application/x-mpegURL';
  if (source.format === 'dash' || path.endsWith('.mpd')) return 'application/dash+xml';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mp4') || path.endsWith('.m4v')) return 'video/mp4';
  return undefined;
}

export function usePlaybackCast(
  enabled: boolean,
  source: PlayerSource,
  getPosition: () => number,
  pauseLocal: () => void,
  title?: string,
  subtitle?: string,
) {
  const [available, setAvailable] = useState(false);
  const [session, setSession] = useState<CastSession | null>(null);
  const [casting, setCasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playback = useEffectEvent(() => ({ startTime: getPosition(), title, subtitle }));
  const pause = useEffectEvent(() => pauseLocal());
  const contentType = getContentType(source);
  const { uri } = source;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let sessionChanged = false;
    let unsubscribe: (() => void) | undefined;

    async function initialize() {
      if (await GoogleCast.getPlayServicesState() !== PlayServicesState.SUCCESS || !active) return;
      const manager = GoogleCast.getSessionManager();
      const update = (next: CastSession | null) => {
        sessionChanged = true;
        if (active) setSession((current) => current?.id === next?.id ? current : next);
      };
      const subscriptions = [
        manager.onSessionStarted(update),
        manager.onSessionResumed(update),
        manager.onSessionEnded(() => update(null)),
      ];
      unsubscribe = () => subscriptions.forEach((subscription) => subscription.remove());
      const current = await manager.getCurrentCastSession();
      if (!active) return;
      if (!sessionChanged) update(current);
      setAvailable(true);
    }

    void initialize().catch((cause: unknown) => console.warn('PurePlayer could not initialize Google Cast.', cause));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [enabled]);

  useEffect(() => {
    setCasting(false);
    setError(null);
    if (!enabled || !session) return;
    let active = true;
    const { startTime, title, subtitle } = playback();

    async function load() {
      const status = await session?.client.getMediaStatus();
      if (!active || !session) return;
      if (status?.mediaInfo?.contentUrl !== uri || status.playerState === 'idle') {
        await session.client.loadMedia({
          autoplay: true,
          startTime,
          mediaInfo: { contentUrl: uri, contentType, metadata: { type: 'generic', title, subtitle } },
        });
      }
      if (!active) return;
      pause();
      setCasting(true);
    }

    void load().catch((cause: unknown) => {
      if (!active) return;
      console.warn('PurePlayer could not load media on the Cast receiver.', cause);
      setError('Could not cast this video. Check that the TV can open the stream URL.');
    });
    return () => { active = false; };
  }, [enabled, session, uri, contentType]);

  async function openControls() {
    try {
      await GoogleCast.showExpandedControls();
    } catch (cause) {
      console.warn('PurePlayer could not open Cast controls.', cause);
      setError('Could not open Cast controls. Use the Cast button to manage your connection.');
    }
  }

  return { available: enabled && available, casting: enabled && casting, error, openControls };
}
