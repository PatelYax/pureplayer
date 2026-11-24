import { useEffect, useRef, useState } from 'react';
import { getBrightnessAsync, restoreSystemBrightnessAsync, setBrightnessAsync } from 'expo-brightness';

const minimum = 0.05;

export function usePlaybackBrightness(enabled: boolean) {
  const [value, setValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apply = useRef<((level: number) => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let changed = false;
    let pending: number | null = null;
    let write: Promise<void> | null = null;

    getBrightnessAsync().then((level) => {
      if (active) setValue(Math.max(minimum, level));
    }).catch((cause: unknown) => {
      if (active) setError('Screen brightness is unavailable.');
      console.warn('PurePlayer could not read screen brightness.', cause);
    });

    async function flush() {
      while (active && pending !== null) {
        const level = pending;
        pending = null;
        try {
          await setBrightnessAsync(level);
          changed = true;
        } catch (cause) {
          if (active) {
            setError('Could not adjust screen brightness.');
            setValue(null);
          }
          pending = null;
          console.warn('PurePlayer could not set screen brightness.', cause);
        }
      }
    }

    apply.current = (level) => {
      const clamped = Math.min(1, Math.max(minimum, level));
      pending = clamped;
      setValue(clamped);
      write ??= flush().finally(() => { write = null; });
    };

    return () => {
      active = false;
      apply.current = null;
      void (write ?? Promise.resolve()).then(async () => {
        if (changed) await restoreSystemBrightnessAsync();
      }).catch((cause: unknown) => {
        console.warn('PurePlayer could not restore screen brightness.', cause);
      });
    };
  }, [enabled]);

  return { value, error, setLevel: (level: number) => apply.current?.(level) };
}
