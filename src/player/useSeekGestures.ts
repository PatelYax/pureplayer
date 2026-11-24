import { useEffect, useRef, useState } from 'react';
import { Platform, useTVEventHandler } from 'react-native';

type Direction = -1 | 1;
const step = 10;

export function useSeekGestures(position: number, duration: number | null, seekTo: (time: number) => void, enabled: boolean) {
  const [timelineFocused, setTimelineFocused] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ direction: Direction; seconds: number } | null>(null);
  const target = useRef<number | null>(null);
  const base = useRef(0);
  const tap = useRef<{ direction: Direction | null; time: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef({ position, duration, seekTo });
  useEffect(() => { latest.current = { position, duration, seekTo }; }, [position, duration, seekTo]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (hold.current !== null) clearInterval(hold.current);
  }, []);

  function stopHold() {
    if (hold.current !== null) clearInterval(hold.current);
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

  function queue(direction: Direction) {
    const { duration, position } = latest.current;
    if (duration === null) return;
    if (target.current === null) base.current = position;
    const next = Math.min(duration, Math.max(0, (target.current ?? position) + direction * step));
    target.current = next;
    setPreview(next);
    const delta = next - base.current;
    setFeedback({ direction: delta === 0 ? direction : delta < 0 ? -1 : 1, seconds: Math.round(Math.abs(delta)) });
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = hold.current === null ? setTimeout(commit, 360) : null;
  }

  useTVEventHandler(({ eventType, eventKeyAction }) => {
    if (!Platform.isTV || !enabled || !timelineFocused) return;
    // Android sends numeric key actions; the public TV event type describes strings.
    const action = String(eventKeyAction);
    if (eventType === 'longLeft' || eventType === 'longRight') {
      if (action === '0' && hold.current === null) {
        const direction = eventType === 'longLeft' ? -1 : 1;
        hold.current = setInterval(() => queue(direction), 250);
        queue(direction);
      } else if (action === '1') {
        const wasHeld = hold.current !== null;
        stopHold();
        if (!wasHeld) queue(eventType === 'longLeft' ? -1 : 1);
        commit();
      }
    } else if ((eventType === 'left' || eventType === 'right') && (action === '1' || eventKeyAction === undefined)) {
      queue(eventType === 'left' ? -1 : 1);
    }
  });

  return {
    preview, feedback, timelineFocused,
    cancelTouchSeek: clearTouch,
    focusTimeline: () => setTimelineFocused(true),
    blurTimeline() {
      stopHold();
      if (target.current !== null) commit();
      setTimelineFocused(false);
    },
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
        clearTouch();
        toggle();
        return;
      }
      tap.current = { direction, time };
      timer.current = setTimeout(() => {
        clearTouch();
        toggle();
      }, 300);
    },
  };

  function clearTouch() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    target.current = null;
    tap.current = null;
    setPreview(null);
    setFeedback(null);
  }
}
