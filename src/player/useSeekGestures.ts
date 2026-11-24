import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, useTVEventHandler } from 'react-native';

type Direction = -1 | 1;
const step = 10;
const holdTickMs = 125;

export function useSeekGestures(position: number, duration: number | null, seekTo: (time: number) => void, enabled: boolean, controlsVisible: boolean) {
  const [preview, setPreview] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ direction: Direction; seconds: number } | null>(null);
  const target = useRef<number | null>(null);
  const base = useRef(0);
  const tap = useRef<{ direction: Direction | null; time: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = useRef<{ direction: Direction; interval: ReturnType<typeof setInterval> } | null>(null);
  const latest = useRef({ position, duration, seekTo });
  useEffect(() => { latest.current = { position, duration, seekTo }; }, [position, duration, seekTo]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (hold.current !== null) clearInterval(hold.current.interval);
  }, []);

  function stopHold() {
    if (hold.current !== null) clearInterval(hold.current.interval);
    hold.current = null;
  }

  function commit() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (target.current !== null) latest.current.seekTo(target.current);
    target.current = null;
    tap.current = null;
    setPreview(null);
    setFeedback(null);
  }

  function queue(direction: Direction, distance = step) {
    const { duration, position } = latest.current;
    if (duration === null) return;
    if (target.current === null) base.current = position;
    const next = Math.min(duration, Math.max(0, (target.current ?? position) + direction * distance));
    target.current = next;
    setPreview(next);
    const delta = next - base.current;
    setFeedback({ direction: delta === 0 ? direction : delta < 0 ? -1 : 1, seconds: Math.round(Math.abs(delta)) });
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = hold.current === null ? setTimeout(commit, 360) : null;
  }

  useTVEventHandler(({ eventType, eventKeyAction }) => {
    if (!Platform.isTV || !enabled) return;
    // Android sends numeric key actions; the public TV event type describes strings.
    const action = String(eventKeyAction);
    const isLong = eventType === 'longLeft' || eventType === 'longRight';
    const direction = eventType === 'left' || eventType === 'longLeft' ? -1
      : eventType === 'right' || eventType === 'longRight' ? 1 : null;
    if (direction === null) return;

    if (action === '1' && hold.current?.direction === direction) {
      stopHold();
      commit();
    } else if (isLong && action === '0' && hold.current === null) {
      let heldSeconds = 0;
      const interval = setInterval(() => {
        heldSeconds += holdTickMs / 1000;
        const speed = Math.min(120, 16 + heldSeconds * 32);
        queue(direction, speed * holdTickMs / 1000);
      }, holdTickMs);
      hold.current = { direction, interval };
      queue(direction);
    } else if (!isLong && !controlsVisible && hold.current === null &&
      (action === '1' || eventKeyAction === undefined)) {
      queue(direction);
    }
  });

  useEffect(() => {
    if (!enabled) cancelSeek();
  }, [enabled]);

  useEffect(() => {
    if (!Platform.isTV) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') cancelSeek();
    });
    return () => subscription.remove();
  }, []);

  return {
    preview, feedback, cancelSeek,
    tapVideo(direction: Direction | null, toggle: () => void) {
      if (target.current !== null && direction !== null && enabled && duration !== null) {
        queue(direction);
        return;
      }
      const time = Date.now();
      if (direction !== null && enabled && duration !== null && tap.current?.direction === direction && time - tap.current.time <= 300) {
        tap.current = null;
        queue(direction);
        return;
      }
      if (timer.current !== null) clearTimeout(timer.current);
      if (direction === null || !enabled || duration === null) {
        cancelSeek();
        toggle();
        return;
      }
      tap.current = { direction, time };
      timer.current = setTimeout(() => {
        cancelSeek();
        toggle();
      }, 300);
    },
  };

  function cancelSeek() {
    stopHold();
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    target.current = null;
    tap.current = null;
    setPreview(null);
    setFeedback(null);
  }
}
