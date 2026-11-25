import { useEffect } from 'react';
import { Platform } from 'react-native';
import { lockAsync, OrientationLock, unlockAsync } from 'expo-screen-orientation';

export type PlaybackOrientation = 'landscape' | 'portrait';

const locks = {
  landscape: OrientationLock.LANDSCAPE,
  portrait: OrientationLock.PORTRAIT_UP,
};

export function usePlaybackOrientation(
  autoRotate: boolean,
  videoSize: { width: number; height: number } | null,
  initialOrientation: PlaybackOrientation = 'landscape',
  lockedOrientation?: PlaybackOrientation,
) {
  const canRotate = !Platform.isTV;
  let orientation: PlaybackOrientation | null = lockedOrientation ?? initialOrientation;
  if (!lockedOrientation && autoRotate && videoSize) {
    const { width, height } = videoSize;
    orientation = width === height ? null : width > height ? 'landscape' : 'portrait';
  }

  useEffect(() => {
    if (!canRotate || lockedOrientation) return;
    return () => {
      unlockAsync().catch((error: unknown) => console.warn('PurePlayer could not restore screen orientation.', error));
    };
  }, [canRotate, lockedOrientation]);

  useEffect(() => {
    if (!canRotate) return;
    const request = orientation === null ? unlockAsync() : lockAsync(locks[orientation]);
    request.catch((error: unknown) => console.warn('PurePlayer could not set video orientation.', error));
  }, [canRotate, orientation]);
}
