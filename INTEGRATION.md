# Integrate PurePlayer into another app

Use this guide to copy PurePlayer into PurePlay or another Expo/React Native Android app. Use **`PurePlayer`** if you want the existing player UI, or **`usePurePlayer`** if you want to build your own controls and call playback methods directly. The supported targets are Android phones, tablets, Android TV, and Google TV.

**API reference:** [Props](#component-props) · [Callbacks](#callback-reference) · [Timed actions and Continue Watching](#continue-watching-skip-intro-and-next-episode) · [Methods and state](#playback-methods-and-state) · [Events](#playback-events)

## 1. Copy the files

Keep the relative layout below in the host app. This lets `PurePlayer.tsx` and `TrackSettings.tsx` import `../theme` without changes.

```text
src\
  theme.ts
  player\
    PurePlayer.tsx
    TrackSettings.tsx
    usePurePlayer.ts
    usePlaybackOrientation.ts
    usePlaybackBrightness.ts
    useSeekGestures.ts
```

- Copy [the player files](./src/player) and [theme.ts](./src/theme.ts). If your app already has `src\theme.ts`, don't overwrite it: save PurePlayer's theme as `src\player\theme.ts` and change the two imports from `../theme` to `./theme`. Edit the palette and the components' React Native `StyleSheet` styles to match your app. There is no CSS or theme prop to pass.
- Copy [parseVideoUrl.ts](./src/player/parseVideoUrl.ts) only if you want the helper for user-entered direct HTTP/HTTPS URLs. It validates the URL and detects HLS/DASH from `.m3u8`/`.mpd`; the player itself doesn't depend on it.
- If you only need the playback hook, copy [usePurePlayer.ts](./src/player/usePurePlayer.ts) and install `expo-video` rather than copying the UI and gesture files.
- Don't copy PurePlayer's standalone `App.tsx`, `index.ts`, `app.json`, assets, generated `android` directory, `node_modules`, or lockfile over your host app. Keep the host's entry point, configuration, identity, and signing.

## 2. Install dependencies and rebuild the host

Run this from the **host project root** in PowerShell:

```powershell
npx.cmd expo install expo-video expo-screen-orientation expo-brightness react-native-safe-area-context react-native-svg
```

PurePlayer was developed with Expo SDK 58. Use versions compatible with your host SDK; see PurePlayer's [package.json](./package.json) for the reference setup. The code uses React's `useEffectEvent`. The full UI imports `useTVEventHandler` from the React Native TV fork, so copying it unchanged requires the compatible TV fork. A standard React Native mobile-only host can use the playback hook by itself.

- **Android TV / Google TV:** Use one SDK-compatible `react-native-tvos` version aliased as `react-native` in the host app. Add `@react-native-tvos/config-tv` to the host's dependencies and Expo plugins if they aren't set up yet. For one app that runs on both TV and mobile, enable TV configuration without setting `androidTVRequired: true`. Use your own TV launcher artwork.
- **Expo config:** Merge the `expo-video` plugin into the host's existing `expo.plugins` if it's not already configured. Don't replace the host config. Allow orientation changes on the playback screen if you want PurePlayer's rotation options to work.
- **Plain HTTP:** Prefer HTTPS. If cleartext playback is required, configure it in the host's Android network security policy, ideally for only the relevant domains. PurePlayer's optional [withHttpPlayback.js](./plugins/withHttpPlayback.js) enables cleartext app-wide and is not required for HTTPS or local video.

For an Expo host that generates native files through prebuild, regenerate and run a development build. Set `EXPO_TV` for a TV-enabled host:

```powershell
$env:EXPO_TV = '1'
npx.cmd expo prebuild --platform android
npx.cmd expo run:android
```

If the host manages `android` manually, apply equivalent native settings there and rebuild using the host's workflow. Don't use `prebuild --clean` over manual native changes. A Metro restart alone does not install native dependencies. If you see `[runtime not ready]: TypeError: property is not writable`, check for two React Native runtimes and merge the single-runtime resolver approach from [metro.config.js](./metro.config.js), using your host's project entry path. See the [README troubleshooting steps](./README.md#troubleshooting) for restarting Metro.

### Optional: native video quality selection

To offer **Auto** and manual resolutions from the same HLS or DASH manifest:

1. Copy [patch-expo-video.cjs](./scripts/patch-expo-video.cjs) into `scripts\` and [PurePlayerVideoQuality.kt](./scripts/android-video-quality/PurePlayerVideoQuality.kt) into `scripts\android-video-quality\`.
2. Pin `expo-video` to `58.0.14` in the host's `package.json`. The patch checks this version; review it before upgrading.
3. Add `node scripts/patch-expo-video.cjs` to the host's `postinstall` script, preserving any existing steps. Merge `"expo-video"` into `expo.autolinking.android.buildFromSource` in `package.json` so Android compiles the patched source instead of using Expo's prebuilt library.
4. Install dependencies, run the patch directly if install scripts are disabled (`node .\scripts\patch-expo-video.cjs`), and rebuild and reinstall the Android app. Expo Go and a Metro restart cannot add the native methods.

The picker lists supported resolution heights reported by Media3; it does not invent qualities or transcode a source. The chosen height locks one track (the highest advertised bitrate when multiple supported tracks share that height). **Auto** clears the override and restores adaptive selection. Each new playback session starts in Auto. Without the patch, automatic quality and normal playback still work, but the manual picker is hidden.

## 3. Mount the player

Put `SafeAreaProvider` around your app once. Render the player inside it on a screen with room to fill, then unmount it when leaving that screen. Example for `src\PlaybackScreen.tsx`:

```tsx
import { View } from 'react-native';
import { PurePlayer } from './player/PurePlayer';
import type { PlayerSource } from './player/usePurePlayer';

type Props = {
  source: PlayerSource;
  goBack: () => void;
};

export function PlaybackScreen({ source, goBack }: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <PurePlayer
        source={source}
        autoRotate
        onExit={goBack}
        onEvent={(event) => {
          if (event.type === 'error') console.warn(event.message);
        }}
      />
    </View>
  );
}
```

- **Direct stream:** `source={{ id: 1, uri: 'https://example.com/episode.m3u8', format: 'hls' }}`. Pass a direct media URL, not a webpage URL.
- **Local or downloaded video:** `source={{ id: 2, uri: pickedUri }}`. Pass a readable `content://` or `file://` URI from your download storage or file picker. If you need a picker, install `expo-document-picker` and use `getDocumentAsync({ type: 'video/*' })`. PurePlayer does not download videos or grant file access.
- **Switch episodes:** Keep the numeric ID stable across re-renders of the same session and assign a new ID when changing videos or explicitly restarting a session. The new ID remounts the player; playback starts automatically when the source loads. Previous/next callbacks should update the source in the host.
- **System bars:** The host owns immersive mode, including hiding and restoring Android's status and navigation bars. See the standalone [App.tsx](./src/App.tsx) for one implementation using `StatusBar` and the optional `expo-navigation-bar` dependency on mobile, not TV.

## Component props

[PurePlayer.tsx](./src/player/PurePlayer.tsx) exports `PurePlayer` and `PurePlayerProps`. Only `source` is required.

| Prop | Type | Behavior |
| --- | --- | --- |
| `source` | `PlayerSource` | `{ id: number; uri: string; format?: 'auto' \| 'hls' \| 'dash' }`. Format defaults to `'auto'`. |
| `initialPosition` | `number` | Saved position in seconds, default `0`. Read when loading the source. A positive position is applied before autoplay if it is less than the known duration. |
| `autoPlay` | `boolean` | Defaults to `true`. Pass `false` to load and apply any saved position without starting playback. Read when loading the source. |
| `ref` | `React.Ref<PlayerControls>` | Imperative controls for the same player instance, including while the built-in controls are visible. |
| `onEvent` | `(event: PlayerEvent) => void` | Receives playback events even with built-in controls off. |
| `controls` | `boolean` | Defaults to `true`. `false` hides built-in playback UI and gestures; the Android Back exit flow still runs. This prop does not expose playback methods. |
| `autoRotate` | `boolean` | Defaults to `false`. When `true`, known video dimensions determine the orientation; square video releases the lock. Ignored on TV. |
| `initialOrientation` | `'landscape' \| 'portrait'` | Defaults to `'landscape'`. Used at startup and stays in effect if `autoRotate` is off and no `lockedOrientation` is supplied. Ignored on TV. |
| `lockedOrientation` | `'landscape' \| 'portrait'` | Overrides both startup orientation and video-based rotation. The lock is released on unmount. Ignored on TV. |
| `onExit` | `() => void` | Preferred callback when the user confirms exit. Use it to go back in the host router or unmount the player. |
| `backRoute` | `string` | Optional fallback destination when `onExit` is absent. Must be passed together with `navigate`. |
| `navigate` | `(route: string) => void` | Host function used to navigate to `backRoute` on confirmed exit. |
| `onBack` | `() => void` | Fallback when neither `onExit` nor the route pair is provided. |
| `onClose` | `() => void` | Deprecated callback, used only if none of the other exit handlers applies. |
| `onPrev` | `() => void` | Shows a Previous button. The host chooses the previous video. |
| `onNext` | `() => void` | Shows a Next button. The host chooses the next video. |
| `skipIntro` | `{ start: number; end: number }` | Seconds. Shows Skip Intro during `[start, end)` and seeks to `end`. Requires `0 <= start < end <= duration` and a known duration. |
| `timedActions` | `readonly TimedPlayerAction[]` | Custom playback buttons, such as Skip Recap, Skip Intro, or Next Episode. Each has a label, timing, and a callback that receives `PlayerControls`. |

On phones and TV, Back hides visible controls first. With controls hidden, Back shows a confirmation hint. Press Back again within two seconds to exit. Order: `onExit`, then `navigate(backRoute)`, then `onBack`, then `onClose`, then normal host/Android Back if no callback applies.

### Callback reference

| Callback signature | When it runs and what to do |
| --- | --- |
| `onEvent(event: PlayerEvent): void` | Receives one event object. Switch on `event.type` to access its payload. Use `sourceId` to associate an event with the active playback session. See [all events](#playback-events). |
| `onExit(): void` | Runs on confirmed Android Back, not when the overlay is hidden. Use `onExit={() => router.back()}` or clear the host's active source to unmount the player. PurePlayer does not navigate for you when this callback is present. |
| `navigate(route: string): void` | Runs on confirmed exit only when `backRoute` is supplied and `onExit` is absent. Example: `backRoute="/library" navigate={(route) => openRoute(route)}`. |
| `onBack(): void` | Runs on confirmed exit only when `onExit` and the route pair are absent. It is not called for every remote or system Back press. |
| `onClose(): void` | Deprecated fallback when the other exit handlers are absent. Use `onExit` for new integrations. |
| `onPrev(): void` | Runs when the Previous button is pressed. Omit it when there is no previous episode; otherwise set a new `source` with a new session ID. |
| `onNext(): void` | Runs when the Next button is pressed. It does **not** run automatically at the end and is independent of a custom Next Episode timed action. Omit it on the last episode. |
| `timedActions[].onPress(player: PlayerControls): void` | Runs only when the user presses the timed button. It receives the same methods as the current player ref. For example, `onPress: (player) => player.seekTo(75)` skips to 1:15. |

These are notification or command callbacks: PurePlayer does not use or await their return values. Episode navigation replaces the source in your app; if you need to save first, take a snapshot from the current ref and manage the save in your callback.

## Continue Watching, Skip Intro, and Next Episode

Load the saved position **before mounting the player**. Store progress in PurePlay per profile and episode, not by the temporary player session ID. Use `checkpoint` to save on pause, background, or confirmed exit; use the ended checkpoint to mark the episode complete. Optionally throttle `progress` events for periodic saves in case the app is killed. If your app removes the screen directly (without player Back), call `getPlaybackSnapshot()` before unmounting. PurePlayer does not store progress or choose the next episode.

The following example assumes `source`, `savedPosition`, `episodeId`, `hasNextEpisode`, `goBack`, `saveWatchProgress`, and `openNextEpisode` come from your app:

```tsx
import { useRef } from 'react';
import { PurePlayer } from './player/PurePlayer';
import type { PlayerControls } from './player/usePurePlayer';

// Inside the playback screen:
const playerRef = useRef<PlayerControls>(null);

return (
  <PurePlayer
    ref={playerRef}
    source={source}
    initialPosition={savedPosition ?? 0}
    onExit={goBack}
    onEvent={(event) => {
      if (event.type === 'checkpoint' && (event.duration !== null || event.ended)) {
        saveWatchProgress(episodeId, event.position, event.ended);
      }
    }}
    timedActions={[
      { id: 'recap', label: 'Skip Recap', start: 5, end: 30, onPress: (player) => player.seekTo(30) },
      { id: 'intro', label: 'Skip Intro', start: 30, end: 75, onPress: (player) => player.seekTo(75) },
      ...(hasNextEpisode ? [{
        id: 'next',
        label: 'Next Episode',
        secondsBeforeEnd: 25,
        onPress: (player: PlayerControls) => {
          const progress = player.getPlaybackSnapshot();
          saveWatchProgress(episodeId, progress.position, progress.ended);
          openNextEpisode();
        },
      }] : []),
    ]}
  />
);
```

### `TimedPlayerAction` fields

Import `TimedPlayerAction` from [PurePlayer.tsx](./src/player/PurePlayer.tsx) when defining actions outside JSX.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Unique, non-empty identifier within `timedActions`. Reported as `actionId` when pressed. |
| `label` | `string` | Non-empty button text. Supply translated text from the host if needed. |
| `start` | `number` | Inclusive start time in seconds from the beginning. Pass a finite non-negative value. Mutually exclusive with `secondsBeforeEnd`. |
| `secondsBeforeEnd` | `number` | Inclusive start calculated as `max(0, duration - secondsBeforeEnd)`. Requires known duration and a finite non-negative value. Use `0` for an end-only button. Mutually exclusive with `start`. |
| `end` | `number` (optional) | Exclusive end time in seconds **from the beginning**, even with `secondsBeforeEnd`. If supplied, use a finite timestamp after the effective start. Omit it to keep the action eligible through completion. |
| `onPress` | `(player: PlayerControls) => void` | Command or navigation callback; the player does not auto-run it when entering the window. |

The first matching action wins if windows overlap, so order them by priority. A timed action can show with the playback overlay hidden, but not with `controls={false}`. Pressing it or Back dismisses it while it remains the matching action. Windows follow the actual playback position, not wall-clock time or seek previews. The older `skipIntro` prop still works; a matching custom action takes priority.

## Playback methods and state

Use the component `ref` or the argument supplied to a timed action to call `PlayerControls`. For example, `playerRef.current?.seekBy(30)` jumps forward 30 seconds. For a completely custom UI, use [usePurePlayer.ts](./src/player/usePurePlayer.ts) directly. Don't mount the hook alongside `PurePlayer` to control it: each creates a separate player instance.

```tsx
import { Button, View } from 'react-native';
import { VideoView } from 'expo-video';
import { usePurePlayer, type PlayerSource } from './player/usePurePlayer';

export function CustomPlaybackScreen({ source }: { source: PlayerSource }) {
  return <CustomPlaybackSession key={source.id} source={source} />;
}

function CustomPlaybackSession({ source }: { source: PlayerSource }) {
  const player = usePurePlayer(source);

  return (
    <View style={{ flex: 1 }}>
      <VideoView
        style={{ flex: 1 }}
        player={player.engine}
        nativeControls={false}
        onFirstFrameRender={player.firstFrameRendered}
      />
      <Button
        title={player.isPlaying ? 'Pause' : 'Play'}
        onPress={player.isPlaying ? player.pause : player.play}
      />
      <Button
        title="Forward 10 seconds"
        disabled={player.duration === null}
        onPress={() => player.seekTo(player.position + 10)}
      />
    </View>
  );
}
```

`usePurePlayer(source, onEvent?, options?)` accepts the same source and event handler as the component, plus `{ initialPosition?, autoPlay? }`. Key the component that **calls the hook** by `source.id`, as shown. The hook doesn't add timed buttons, gestures, orientation handling, fullscreen styling, or Back behavior.

| Method | Behavior | Example (`p` is the current player) |
| --- | --- | --- |
| `play(): void` | Starts or resumes playback; replays from the start if playback ended. | `p.play()` |
| `pause(): void` | Requests a pause. Also emits a `checkpoint` with `reason: 'pause'` when duration is known. | `p.pause()` |
| `replay(): void` | Restarts playback from the beginning, even if it hasn't ended. | `p.replay()` |
| `seekTo(seconds: number): void` | Requests an absolute seek. Requires known duration and a finite input; clamps to `0..duration`. Emits `seekStarted`, not completion. | `p.seekTo(75)` |
| `seekBy(seconds: number): void` | Seeks relative to the engine's current position. Uses the same clamping and event as `seekTo`. | `p.seekBy(-10)` |
| `setVolume(level: number): void` | Sets the player's volume, not device volume. Finite values are clamped to `0..1`. | `p.setVolume(0.5)` |
| `setMuted(muted: boolean): void` | Mutes or unmutes the player without changing the configured volume. | `p.setMuted(true)` |
| `setPlaybackRate(rate: number): void` | Sets playback speed (`1` is normal). Positive finite values are clamped to `0.1..16`. | `p.setPlaybackRate(1.25)` |
| `selectAudio(track: AudioTrack): void` | Selects an Expo Video track object. Use one from the current source, not a language code, index, or track cached from another source. | `p.selectAudio(track)` |
| `selectSubtitle(track: SubtitleTrack \| null): void` | Selects an Expo Video track object from the current source, or turns subtitles off. | `p.selectSubtitle(null)` |
| `selectVideoQuality(quality: VideoQuality): Promise<void>` | Sets `'auto'` or a supported height in pixels for the current Android source. Rejects if the height is unavailable or the native patch is missing. Resolves after applying the preference, not after rendering at that resolution. | `await p.selectVideoQuality(720)` |
| `getPlaybackSnapshot(): PlaybackSnapshot` | Reads `{ position, duration, ended }` without emitting an event. Position and duration use seconds; duration can be `null`. | `const snapshot = p.getPlaybackSnapshot()` |
| `firstFrameRendered(): void` | Hook only. Wire to `VideoView.onFirstFrameRender` to forward the first-frame event. | `<VideoView player={p.engine} onFirstFrameRender={p.firstFrameRendered} />` |

For component calls, use `playerRef.current?.method(...)` after mount rather than storing the handle across source changes. The ref exposes commands and snapshots, not the hook's reactive fields or track lists. Use the built-in track picker or the hook when you need to enumerate tracks.

| Returned state | Type or meaning |
| --- | --- |
| `engine` | Expo Video `VideoPlayer`; pass it to `VideoView.player`. |
| `state` | `'idle' \| 'loading' \| 'ready' \| 'error'` |
| `isPlaying`, `ended` | Booleans for active playback and end of video. |
| `position`, `duration` | Position in seconds; duration is in seconds or `null` if unknown. |
| `videoSize` | `{ width: number; height: number }` in pixels, or `null`. |
| `videoQualities`, `videoQuality` | Available supported heights (`number[]`, highest first) and requested preference (`VideoQuality`, exported from `usePurePlayer.ts`: `'auto' \| number`). Use `videoSize` for the active dimensions. |
| `volume` | Player volume from `0` to `1`. |
| `muted`, `playbackRate` | Whether the player is muted, and its current playback speed. |
| `audioTracks`, `subtitleTracks` | Available Expo Video `AudioTrack[]` and `SubtitleTrack[]`. |
| `audioTrack`, `subtitleTrack` | Selected Expo Video track, or `null`. |
| `error` | Displayable error `string`, or `null`. |

### Optional helpers

| Export | Usage |
| --- | --- |
| `PlayerButton` from [PurePlayer.tsx](./src/player/PurePlayer.tsx) | Reuse the player button styling: `<PlayerButton label="Replay" onPress={() => playerRef.current?.replay()} />`. `onPress(): void` runs when activated. Optional booleans default to `false`: `disabled` blocks activation, `preferredFocus` requests initial TV focus, and `secondary` uses the secondary style. |
| `parseVideoUrl(input: string): Omit<PlayerSource, 'id'>` from [parseVideoUrl.ts](./src/player/parseVideoUrl.ts) | Turns a typed HTTP/HTTPS media URL into `{ uri, format }`. For example, `const source = { id: 1, ...parseVideoUrl(input) }`. It throws for invalid URLs or embedded user credentials; catch the error in the host's input screen. Do not use it to parse local file URIs. |
| `PlaybackOrientation` from [usePlaybackOrientation.ts](./src/player/usePlaybackOrientation.ts) | Type for the orientation props: `'landscape' \| 'portrait'`. |

The track settings, orientation, brightness, and seek gesture implementations support the built-in UI. You do not need to call them separately to embed the component.

## Playback events

Every `PlayerEvent` has a `type` and a numeric `sourceId` copied from `source.id`. The table lists the fields in addition to those two. `AudioTrack` and `SubtitleTrack` are types from `expo-video`.

| `type` | Additional fields | When it fires |
| --- | --- | --- |
| `loadStart` | None | A source is about to load. |
| `stateChanged` | `state: 'idle' \| 'loading' \| 'ready' \| 'error'` | The engine reports a playback state or the player reports a load failure. |
| `ready` | None | The source first becomes ready to play; this does not mean a frame rendered. |
| `firstFrameRendered` | None | The video view reports its first rendered frame. |
| `isPlayingChanged` | `isPlaying: boolean` | Playback starts or stops advancing. |
| `bufferingChanged` | `isBuffering: boolean` | The engine enters or leaves the loading state. |
| `durationChanged` | `duration: number \| null` | Source metadata loads; the duration is in seconds, or `null` if unavailable. |
| `videoSizeChanged` | `width: number`, `height: number` | Valid dimensions are discovered or change, in pixels. |
| `videoQualityChanged` | `quality: VideoQuality` | The native engine accepted a manual height or Auto. Automatic adaptation does not emit this event; monitor `videoSizeChanged` for active dimension changes. |
| `progress` | `position: number`, `bufferedPosition: number \| null` | Time updates, configured for roughly 250 ms intervals. Both fields are positions in seconds, not percentages. |
| `seekStarted` | `position: number` | A seek request is sent with the clamped target, in seconds. Previewing a seek does not emit this event. |
| `resumeApplied` | `position: number` | The saved position was sent to the engine at startup. This does not confirm seek completion. Not emitted for `0` or an unusable position. |
| `checkpoint` | `reason: 'pause' \| 'background' \| 'exit' \| 'ended'`, `position: number`, `duration: number \| null`, `ended: boolean` | A position snapshot for Continue Watching. Pause means the PurePlayer pause command was called, not buffering. Exit is emitted by the component before navigation; pause, background, and exit require a known duration. |
| `timedActionPressed` | `actionId: string`, `position: number` | The user pressed a button declared in `timedActions`; emitted just before the callback. |
| `audioTrackChanged` | `track: AudioTrack \| null` | The selected audio track changes. |
| `subtitleTrackChanged` | `track: SubtitleTrack \| null` | The selected subtitle track changes; `null` means off. |
| `volumeChanged` | `volume: number` | The player's volume changes (`0..1`). |
| `mutedChanged` | `muted: boolean` | The player's mute state changes. |
| `playbackRateChanged` | `playbackRate: number` | The engine reports a playback speed change. |
| `ended` | None | Playback reaches the end. |
| `error` | `code: 'PLAYBACK_FAILED'`, `message: string` | Source setup or playback fails. |

Available track lists are hook state, not separate `PlayerEvent` types. There are no separate events for seek completion, fullscreen, orientation, or brightness.

### Event handling examples

Use a typed handler so TypeScript narrows the payload in each case. This example logs events; replace the branches you need with app state updates, analytics, or persistence:

```ts
import type { PlayerEvent } from './player/usePurePlayer';

export function handlePlayerEvent(event: PlayerEvent) {
  const { sourceId } = event;

  switch (event.type) {
    case 'loadStart':          // Show startup UI.
    case 'ready':              // The engine is ready; the video may not be visible yet.
    case 'firstFrameRendered': // Hide a poster or startup cover.
    case 'ended':              // Update end-of-episode UI.
      console.log(sourceId, event.type);
      break;
    case 'stateChanged':
      console.log(sourceId, event.state);
      break;
    case 'isPlayingChanged':
      console.log(sourceId, event.isPlaying);
      break;
    case 'bufferingChanged':
      console.log(sourceId, event.isBuffering);
      break;
    case 'durationChanged':
      console.log(sourceId, event.duration);
      break;
    case 'videoSizeChanged':
      console.log(sourceId, event.width, event.height);
      break;
    case 'videoQualityChanged':
      console.log(sourceId, event.quality);
      break;
    case 'progress':
      console.log(sourceId, event.position, event.bufferedPosition);
      break;
    case 'seekStarted':
    case 'resumeApplied':
      console.log(sourceId, event.type, event.position);
      break;
    case 'checkpoint':
      console.log(sourceId, event.reason, event.position, event.duration, event.ended);
      break;
    case 'timedActionPressed':
      console.log(sourceId, event.actionId, event.position);
      break;
    case 'audioTrackChanged':
    case 'subtitleTrackChanged':
      console.log(sourceId, event.type, event.track);
      break;
    case 'volumeChanged':
      console.log(sourceId, event.volume);
      break;
    case 'mutedChanged':
      console.log(sourceId, event.muted);
      break;
    case 'playbackRateChanged':
      console.log(sourceId, event.playbackRate);
      break;
    case 'error':
      console.warn(sourceId, event.code, event.message);
      break;
  }
}
```

Pass `onEvent={handlePlayerEvent}` to the component or `usePurePlayer(source, handlePlayerEvent)` to the hook. In a real app, avoid logging or saving every `progress` sample.

- Use `ready` for engine readiness and `firstFrameRendered` for visual readiness. `isPlayingChanged` with `false` can mean buffering or completion, not just a user pause.
- Use `seekStarted` and `resumeApplied` as requested positions, not confirmation. Use subsequent `progress` samples for the position reported by the engine.
- `checkpoint` with `reason: 'ended'` is emitted before `ended`. Save completion once rather than persisting the same completion from both events. The `exit` checkpoint and `timedActionPressed` are component-only; they precede the corresponding host callback.
- Exit checkpoints represent confirmed player Back, not arbitrary host unmounts. For an external close, snapshot the player before unmounting.
