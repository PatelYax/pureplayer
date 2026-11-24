# PurePlayer

PurePlayer is a standalone player for Android phones, tablets, Android TV, and Google TV. It plays direct HTTPS or HTTP video URLs and local files picked through Android. The controls are built with React Native and TypeScript; Expo Video uses Android Media3/ExoPlayer for native playback. No custom Kotlin player is required.

## Run on Windows

Install Android Studio and its Android SDK, then start an emulator or connect a device with USB debugging enabled. From the project root in PowerShell:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

npm.cmd ci
npm.cmd run android
```

Adjust the paths if Android Studio or the SDK is installed elsewhere. These environment variables apply to the current terminal. `npm.cmd run android` builds and installs the development app and starts Metro. If the app is already installed and only JavaScript changed, use `npm.cmd start`. Run `npm.cmd run typecheck` to check the TypeScript code.

### Android TV / Google TV

Start a TV emulator or connect a TV device. From the project root, after installing dependencies:

```powershell
$env:EXPO_TV = '1'
npx.cmd expo prebuild --clean --platform android
npm.cmd run android
```

`--clean` recreates the generated Android project. Keep permanent native settings in Expo config or a config plugin.

### Android release builds

Build **one universal APK** for supported Android phones, tablets, Android TV, and Google TV. From the project root, after completing the Windows setup above, generate Android with both the standard and TV launcher entries:

```powershell
$env:EXPO_TV = '1'
npx.cmd expo prebuild --clean --platform android
```

The TV flag adds the TV launcher entry without making TV hardware a requirement. Skip prebuild if your Android project already has both launcher entries and no native settings have changed. Clean prebuild replaces manual changes in the generated Android project.

After prebuild succeeds, build the APK with all four supported CPU architectures:

```powershell
Push-Location .\android
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64'
Pop-Location
```

Use the same `android\app\build\outputs\apk\release\app-release.apk` on each supported device. It does not need Metro. The generated release configuration uses debug signing, so use this APK for sideloading and testing only.

The custom PurePlayer launcher icon, adaptive icon, and TV banner are configured in [app.json](./app.json). After changing the artwork, run Android prebuild and rebuild and reinstall the app; restarting Metro does not update launcher assets.

For Google Play, configure the Gradle release build to use your upload key instead of the debug key, then build an Android App Bundle:

```powershell
Push-Location .\android
.\gradlew.bat :app:bundleRelease
Pop-Location
```

The bundle is at `android\app\build\outputs\bundle\release\app-release.aab`. Apply signing after any clean prebuild if you configured it directly in the generated Android project. Keep the keystore and its passwords out of source control.

## Player controls

- **Play a URL:** Under **Stream a video**, paste a direct media URL, such as an MP4, HLS (`.m3u8`), or DASH (`.mpd`) link. A webpage URL is not a video URL. Prefer HTTPS. Plain HTTP is unencrypted; use it only for trusted sources such as a local media server. The project enables Android cleartext traffic app-wide through its Expo config plugin. Changing that setting requires regenerating and rebuilding the native app, not just restarting Metro.
- **Play a local file:** Select **Open downloaded video** and choose a file from Android's picker. PurePlayer opens files you already have; it does not download videos.
- **Fullscreen and orientation:** The standalone app hides Android's status and navigation bars during phone/tablet playback. It opens in landscape and follows the video's dimensions once known because the app enables `autoRotate`. Android TV and Google TV never request rotation. On phones and tablets, spread two fingers to fill the screen (which can crop the edges), or pinch inward to fit the whole frame. TV always uses Fit.
- **Touch:** Tap the video to show or hide controls. Tap the timeline to seek directly, or drag it to preview a timestamp and release to seek. Double-tap either side, then keep tapping to add 10 seconds per tap; PurePlayer previews the target and seeks once the taps stop. Drag the left brightness slider up or down; system brightness takes over again when playback closes. Use the device controls for volume.
- **TV remote:** The controls and timeline hide after four seconds without remote input during playback. Auto-hide waits while paused, buffering, previewing a seek, or using audio and subtitle settings. Press OK to show the controls again. Hold Left or Right to gradually speed up the seek preview. The timeline and target timestamp update alongside the same chevrons and signed offset used by mobile touch seeking, even when controls are hidden. Playback jumps only on release. The timeline is display-only. Short presses navigate visible controls; when controls are hidden, Left and Right queue 10-second steps instead. Brightness gestures are disabled on TV.
- **Audio and subtitles:** The music-note icon appears for multiple audio tracks, and the subtitle icon appears when subtitles are available. Choosing a track or turning subtitles off closes its picker. **Subtitle style** opens Android's device-wide accessibility caption settings, where available.
- **Video quality:** Use the video quality icon to choose **Auto** or a resolution offered by the stream and supported by your device. The icon appears when multiple supported resolutions are available. A successful selection closes the picker and may briefly buffer without changing the stream URL. Manual quality requires a rebuilt Android app; installing dependencies applies the native patch automatically.
- **Navigation:** Tap outside a picker or press Back to close it without hiding playback controls. The on-screen back arrow hides the controls. Android Back hides visible controls first; when they are already hidden, one Back press exits playback with no confirmation prompt. The standalone app returns to its home screen.
- **Loading and errors:** A centered blue spinner shows during loading or buffering without a dimming background. Playback failures show a message, and finishing a video exposes Replay.

Dolby Vision, HDR, and Atmos output are not guaranteed: they depend on the stream or file, Android device, and connected display or audio equipment. Verify the actual output on the target hardware.

## Embed PurePlayer

See [INTEGRATION.md](./INTEGRATION.md) for the exact copy/paste file list, host build setup, usage examples, and full API reference.

For Continue Watching, pass `initialPosition` and persist `checkpoint` events in the host app. Use `timedActions` for buttons such as Skip Intro or Next Episode, or a `ref` to call playback methods on the built-in player. See the [Continue Watching and timed actions example](./INTEGRATION.md#continue-watching-skip-intro-and-next-episode).

Import the component from [PurePlayer.tsx](./src/player/PurePlayer.tsx) and render it inside your app's `SafeAreaProvider`, in a container with available space (for example, `flex: 1`). Keep the native dependencies listed in [package.json](./package.json) and rebuild the host app after adding them. If the host should hide Android system bars during playback, apply that behavior in the surrounding screen as [the standalone app](./src/App.tsx) does.

```tsx
<PurePlayer
  source={{ id: 1, uri: 'https://example.com/episode.m3u8', format: 'hls' }}
  autoRotate
  onExit={goBack}
  onPrev={playPreviousEpisode}
  onNext={playNextEpisode}
  skipIntro={{ start: 5, end: 42 }}
  onEvent={(event) => {
    if (event.type === 'error') {
      showPlaybackError(event.message);
    }
  }}
/>
```

Use a stable numeric `source.id` for the current video and a new ID when switching videos. A new ID mounts a fresh player session. `uri` can be a direct media URL or a readable local file URI. `format` is optional: `'auto'` is the default, with `'hls'` and `'dash'` available for explicit stream types. Playback starts automatically after the source is set.

| Prop | Behavior |
| --- | --- |
| `source` | Required video source: `{ id, uri, format? }`. |
| `initialPosition`, `autoPlay` | Optional saved position in seconds and whether playback starts automatically (default `true`). |
| `ref` | Optional React ref for `PlayerControls` methods. |
| `onEvent` | Receives typed playback events even when the built-in controls are hidden. |
| `controls` | Defaults to `true`. Pass `false` to hide the built-in playback UI and gestures. |
| `autoRotate` | Defaults to `false` on the component; the standalone app enables it. When enabled, playback follows the video dimensions once available. Square video releases the orientation lock. Ignored on TV. |
| `initialOrientation` | `'landscape'` (default) or `'portrait'`. With `autoRotate` off, playback stays in this orientation. Ignored on TV. |
| `lockedOrientation` | `'landscape'` or `'portrait'`. Overrides the starting orientation and video-based rotation for the whole session. The lock is released on exit. Ignored on TV. |
| `onExit` | Called when Android Back exits playback with the controls already hidden. Takes precedence over route navigation and the legacy back callbacks. |
| `onBack` | Fallback callback for confirmed exit when neither `onExit` nor `backRoute` is supplied. If no exit action is configured, the confirmed press falls through to normal Android or host back navigation. |
| `backRoute` and `navigate` | Pass both, for example `backRoute="/library" navigate={navigateToRoute}`. Used on confirmed exit if no `onExit` is passed. PurePlayer does not own the router. |
| `onClose` | Deprecated fallback for `onBack`. |
| `onPrev`, `onNext` | Show their respective buttons only when supplied. The host chooses the previous or next source. |
| `skipIntro` | `{ start, end }` in seconds. Shows **Skip Intro** while playback is within `[start, end)` and seeks to `end` when pressed. Requires a valid range within a known duration. |
| `timedActions` | Custom buttons with a label, a time window, and a callback that receives playback methods. |

### Playback events

Every `PlayerEvent` has a `type` discriminant and the numeric `sourceId` from `source.id`. The payload column below lists additional fields. Position and duration values are in **seconds**; dimensions are in **pixels**.

| Event type | Additional payload | When it fires |
| --- | --- | --- |
| `loadStart` | None | PurePlayer is about to load the source. |
| `stateChanged` | `state: 'idle' \| 'loading' \| 'ready' \| 'error'` | The engine reports a playback status change or PurePlayer reports a load failure. `idle` does not by itself mean the video ended. |
| `ready` | None | The engine first reports that the source is ready to play. This is not a first-frame notification. |
| `firstFrameRendered` | None | The rendered `VideoView` reports a first frame. |
| `isPlayingChanged` | `isPlaying: boolean` | The engine reports a change in whether playback is advancing. |
| `bufferingChanged` | `isBuffering: boolean` | The engine enters or leaves its loading state, including startup or rebuffering. |
| `durationChanged` | `duration: number \| null` | Source metadata loads. `null` means a positive finite duration was unavailable. |
| `videoSizeChanged` | `width: number`, `height: number` | Valid video dimensions are discovered from metadata or change with the active track. Repeated identical sizes are suppressed. |
| `videoQualityChanged` | `quality: 'auto' \| number` | Media3 accepted a quality preference. This does not confirm that the new resolution is rendering. |
| `progress` | `position: number`, `bufferedPosition: number \| null` | Expo Video sends a time update (configured for roughly every 250 ms). `bufferedPosition` is a position on the timeline, not a percent; `null` means unavailable. |
| `seekStarted` | `position: number` | PurePlayer sends a seek request, with the target clamped to the known duration. Previewing a drag or queued seek does not emit it. It **does not** confirm seek completion. |
| `resumeApplied` | `position: number` | A saved starting position is sent to the engine. |
| `checkpoint` | `reason: 'pause' \| 'background' \| 'exit' \| 'ended'`, `position`, `duration`, `ended` | Snapshot for saving Continue Watching progress. |
| `timedActionPressed` | `actionId: string`, `position: number` | The user presses a custom timed button. |
| `audioTrackChanged` | `track: AudioTrack \| null` | The engine reports a change to the selected audio track. `null` means no selected track was reported. |
| `subtitleTrackChanged` | `track: SubtitleTrack \| null` | The engine reports a change to the selected subtitle track. `null` means no subtitle track is selected. |
| `volumeChanged` | `volume: number` | The engine reports its volume level (`0` to `1`). This is player volume, not Android's master volume. |
| `mutedChanged` | `muted: boolean` | The engine reports a mute change. |
| `playbackRateChanged` | `playbackRate: number` | The engine reports a playback speed change. |
| `ended` | None | The engine reports playback reached the end. |
| `error` | `code: 'PLAYBACK_FAILED'`, `message: string` | Source setup or playback fails. The message is suitable for display. |

`AudioTrack` and `SubtitleTrack` are Expo Video types. Initial track selections and the available track lists are exposed as hook state; a metadata update does not itself emit track-selection events. There is no separate seek-completed, fullscreen, orientation, or brightness event in the current API.

### Use the playback hook directly

[usePurePlayer.ts](./src/player/usePurePlayer.ts) exports `usePurePlayer(source, onEvent?, options?)`, `PlayerSource`, `PlayerEvent`, and `PlayerControls`. The hook exposes the Expo Video `engine`, reactive player state, and the same playback methods available through the component ref. See the [full method and state reference](./INTEGRATION.md#playback-methods-and-state).

For a custom UI, use `engine` as your Expo `VideoView`'s `player` and wire `onFirstFrameRender` to the hook's `firstFrameRendered` callback if you need that event. Key the component that calls the hook by `source.id`, as `PurePlayer` does.

## Troubleshooting

### `[runtime not ready]: TypeError: property is not writable`

This startup error can happen when Metro bundles both standard React Native and the React Native TV fork. Both copies try to initialize the same globals. An error saying `"main" has not been registered` or a blank screen can follow the initial crash. This is a JavaScript startup issue, not a TypeScript compiler or Gradle error.

1. Keep the project's [metro.config.js](./metro.config.js). It resolves React Native imports from the project root so the app and its dependencies use the same TV runtime.
2. Stop the old Metro server with **Ctrl+C**. From the PurePlayer project root, run:

   ```powershell
   npx.cmd expo start --clear
   ```

   Or use `npm.cmd start -- --clear`. `npm expo start --clear` is not a valid command.
3. Keep Metro running and reopen PurePlayer. If the screen stays white, force-stop the app and reopen it, and check that it's connecting to the new Metro session rather than an older one. No Gradle rebuild is needed for this Metro-only fix.

When embedding the player in another React Native TV app, preserve the equivalent single-runtime resolution in the host's Metro config if it has the same dependency layout.

### `JAVA_HOME is not set`

Set `JAVA_HOME` to the JDK directory (not its `bin` folder or `java.exe`) using the Windows setup commands above. Run `java -version` in the same terminal before starting the build.

### CMake/Ninja: `Filename longer than 260 characters`

Install **CMake 4.1.2** in Android Studio under **SDK Manager > SDK Tools**. The project adds this setting to `android\gradle.properties` during Expo prebuild:

```properties
android.cmakeVersion=4.1.2
```

Expo's Gradle plugin reads it directly. The default is configured in [app.json](./app.json); no machine-specific `cmake.dir` override is needed. If you still hit Windows path limits, try building from a short project path such as `C:\pp`. Copy the source without the generated `android`, `dist`, or `node_modules` directories, then reinstall dependencies and prebuild.

### Stop Gradle daemons

From the project root, run `.\android\gradlew.bat --stop`. This stops daemons for the current wrapper's Gradle version. `.\android\gradlew.bat --status` shows their state.
