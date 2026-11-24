PurePlayer — Reusable React Native Video Player — Development Plan
1. Project Overview

Build "PurePlayer", a standalone, reusable video player using Expo, React Native, TypeScript and Android Media3 (ExoPlayer).

The player must support:

Android smartphones
Android tablets
Android TV
Google TV
Android TV boxes

The player will play:

Network videos (HTTPS URLs)
Internal / downloaded videos (device storage, Downloads, app-private downloads, content:// and file:// URIs)

Main objective

Develop the player independently. It is first used as a standalone app, then moved into the PurePlay project.

After completing the demo, its common code and native playback module should be reusable in other React Native and Expo projects, including PurePlay.

Current scope: "JustPlayer" (v1)

For now PurePlayer is built as a plain "just a player": open a video (URL or local file) and play it well on phone, tablet and TV.
OTT-specific features (skip intro, next episode, DRM, watch history sync, analytics, ads) are OUT of v1 and are only kept as extension points for PurePlay.

v1 (JustPlayer) includes:
- Network + local/downloaded playback
- Core controls (play/pause, seek, timeline, speed, fullscreen)
- Audio and subtitle track selection (embedded + external SRT/VTT, including sidecar files next to local videos)
- Basic quality selection for HLS/DASH
- Phone/tablet touch UI and TV D-pad UI
- Resume position

v2+ (later, mostly when merged into PurePlay): advanced HDR/Dolby validation, PiP, skip intro, next video, DRM, offline download manager. A custom Media3 adapter is part of v1 if needed to deliver the required playback features or React Native events.

2. Technology Stack
Component	Technology
Framework	Expo
UI	React Native
Language	TypeScript
Initial player	Expo Video
Native Android engine	AndroidX Media3 / ExoPlayer
Native development	Kotlin
Video rendering	SurfaceView
State management	Zustand
Navigation	Expo Router
TV compatibility	React Native TV
Local preferences	Expo SecureStore / SQLite

Use Expo Video initially. Introduce a custom Kotlin Media3 module when the required playback functionality cannot be implemented adequately through Expo Video.

3. Supported Video Formats

The player should support the following HTTPS sources.

Format	Extension	Priority
HLS	.m3u8	High
MPEG-DASH	.mpd	High
MP4	.mp4	High
MKV	.mkv	High
MPEG-TS	.ts	Medium
Codec support

Test the following codecs:

Video

H.264 / AVC
H.265 / HEVC
AV1
VP9

Audio

AAC
AC3
E-AC3
Dolby Atmos
DTS
DTS-HD
TrueHD

Actual compatibility depends on Android Media3 support, container extraction, device decoders, Android version and audio output hardware.

3.1 Internal / Downloaded Video Support

Source types
Type	Example	Notes
Remote	https://...	HLS, DASH, MP4, MKV, TS
Local file	file:///storage/emulated/0/Download/movie.mkv	Needs storage access
Content URI	content://...	From Android picker (SAF) / MediaStore
App downloads	file:///data/user/0/<app>/files/downloads/x.mp4	Offline downloads saved by PurePlay; no permission needed

Requirements
- Pick a video with the system document picker (expo-document-picker) — no broad storage permission needed.
- Browse device videos via MediaStore (expo-media-library), with READ_MEDIA_VIDEO (Android 13+) / READ_EXTERNAL_STORAGE (Android 12 and below) permission handling.
- Accept any file:// or content:// URI as a source (sourceResolver detects type from URI + MIME, not only extension).
- Local library screen: list videos with thumbnail, title, duration, size; sort and search.
- Auto-detect sidecar subtitles (same name .srt/.vtt) next to a local video, plus manual "add subtitle file".
- Resume position stored per video (keyed by URI / file hash).
- Handle missing, moved, deleted or permission-revoked files with a clear error.
- Android TV: local files reachable via USB / SD / file manager intents; support "Open with" intent filter (ACTION_VIEW video/*) so PurePlayer can be chosen from other apps.
- Seeking must work on local MKV/MP4 without full read.
- Playback engine is identical for local and remote; only sourceResolver differs.

4. HDR and Dolby Support

The player should support and detect advanced video and audio formats where supported by the hardware.

Video
SDR
HDR10
HDR10+
Dolby Vision
HLG
Audio
Stereo
Dolby Digital
Dolby Digital Plus
Dolby Atmos
DTS
DTS-HD
Dolby TrueHD
Requirements
Detect supported video decoder profiles.
Detect supported HDR profiles.
Identify stream HDR characteristics.
Use compatible video rendering surfaces.
Support hardware decoding.
Support audio passthrough where available.
Expose playback capability information.
Handle unsupported formats gracefully.

Important: Detection and successful output are different things. Validate actual HDR display output and Atmos passthrough on compatible devices.

5. Player UI

Create a modern OTT-style player interface.

5.1 Video Area
Fullscreen video
Landscape playback
Aspect ratio handling
Loading indicator
Buffering indicator
Playback error screen
5.2 Main Controls
Play / Pause
Seek forward
Seek backward
Timeline
Current playback time
Total duration
Fullscreen toggle
5.3 Advanced Controls
Video quality
Audio track selection
Subtitle selection
Subtitle enable / disable
Playback speed
Playback information
HDR information
5.4 Optional Controls
Picture-in-Picture
Brightness gesture
Volume gesture
Skip intro
Next video
Resume playback

5.5 React Native styling and themes

- Build the overlay, timeline, buttons, and menus in React Native. Use `StyleSheet.create` and the `style` prop rather than browser CSS files, selectors, or media queries. Use Flexbox for layout and `useWindowDimensions()` for phone and tablet layouts.
- Keep shared defaults for colors, spacing, typography, and control sizes in a small `PlayerTheme`. Use `Pressable` focus and press state for visual feedback, with larger controls and a clear D-pad focus indicator on TV. Choose TV styling based on the platform, not screen width alone.
- Expose a `theme` override for branding and `style` for the outer container. PurePlay can also hide the built-in controls and render its own React Native overlay using `usePurePlayer()`.
- React Native styles the video container and controls, not the decoded video or native captions. Use player options for video fit; expose caption styling separately where the playback engine supports it. Verify overlays and fullscreen transitions on real Android TV / Google TV hardware.

6. Video Quality Management

Implement three playback modes.

Automatic

Default mode.

Let the adaptive streaming engine select the best available quality based on network conditions and configured constraints.

Manual

Allow selection of available resolutions:

360p
480p
720p
1080p
1440p
2160p

Only show resolutions available in the current stream.

Data Saver

Allow users to restrict the maximum video resolution.

Format-specific behaviour

HLS / DASH

Automatic adaptive bitrate.
Manual video track selection.
Maximum resolution restriction.

MP4 / MKV

Usually a single video quality.
Hide quality selection unless multiple versions are provided.
7. Audio and Subtitle Management
Audio Track Selection

Display:

Language
Codec
Channel configuration
Default track
Selected track

Allow users to switch audio tracks without restarting playback where supported.

Subtitle Selection

Support:

Embedded subtitles
External subtitle tracks
SRT
WebVTT
Embedded text subtitles
Supported embedded bitmap subtitles

Features:

Enable / disable subtitles.
Select language.
Select subtitle track.
Subtitle styling.
Subtitle synchronization where supported.
8. Device Compatibility Detection

Create a device capability service.

It should report:

Device information
Android version
Device model
Manufacturer
TV or phone classification
Video capabilities
H.264 support
HEVC support
AV1 support
VP9 support
HDR10 support
HDR10+ support
Dolby Vision support
Audio capabilities
Supported audio decoders
Audio passthrough capabilities
Supported channel configurations
Display information
Display resolution
HDR capabilities
Supported display profiles where available

The capability service should return structured information to React Native.

Do not assume that a codec decoder being available means the device can output that format through its display or speakers.

9. Playback Engine Architecture
Initial implementation: Expo Video

Use Expo Video to validate:

HTTPS playback
MP4
HLS
DASH
Playback controls
Audio track selection
Subtitle selection
Video track selection

Test MKV separately.

Advanced implementation: Custom Kotlin Media3 Module

Create a custom Expo native module if Expo Video cannot satisfy the required React Native event contract or other v1 playback requirements. Decide this during the foundation spike on both touch and TV devices; do not defer a v1 event gap to Phase 7. The module sends native playback events to React Native; the app UI and controls remain in React Native.

The module should expose:

Player methods
initialize()
setSource()
play()
pause()
stop()
release()
seekTo()
setPlaybackSpeed()
setVolume()
selectAudioTrack()
selectSubtitleTrack()
selectVideoTrack()
setMaxResolution()
getPlaybackInfo()
Player events

Both playback adapters map engine events to the public TypeScript contract in Section 10. A native Media3 adapter should forward player and analytics events as needed, without making React Native consumers depend on Media3 classes or raw event names.

Native responsibilities
Media3 player lifecycle.
SurfaceView rendering.
MediaSource selection.
Codec and decoder information.
Track selection.
Audio output.
Buffer configuration.
Playback error handling.
HDR capability reporting.

Keep native implementation details separate from the React Native UI.

10. Reusable Player API

The player should be designed as a reusable component.

Example usage:

tsx
<PurePlayer
  source={{
    uri: 'https://example.com/movie.m3u8',
    type: 'hls',
  }}
  autoPlay
  controls
  quality="auto"
  onReady={() => {}}
  onEvent={(event) => {
    if (event.type === 'error') showPlaybackError(event.error);
  }}
/>

// Local / downloaded video
<PurePlayer source={{ uri: 'file:///storage/emulated/0/Download/movie.mkv', origin: 'local' }} />

Suggested component properties
typescript
interface PurePlayerProps {
  source: {
    uri: string;                 // https://, file://, content://
    type?: 'hls' | 'dash' | 'mp4' | 'mkv' | 'ts'; // optional, auto-detected
    origin?: 'remote' | 'local';
    title?: string;
    headers?: Record<string, string>;
    subtitles?: { uri: string; language?: string; label?: string }[];
  };

  autoPlay?: boolean;
  controls?: boolean;
  quality?: 'auto' | 'manual';
  maxResolution?: number;

  startPosition?: number;
  playbackSpeed?: number;
  theme?: Partial<PlayerTheme>;
  style?: StyleProp<ViewStyle>;

  onReady?: () => void;
  onProgress?: (position: number) => void;
  onEnded?: () => void;
  onError?: (error: PlayerError) => void;
  onEvent?: (event: PlayerEvent) => void;
}

10.1 React Native event contract

PurePlayer must expose playback events even when the built-in controls are hidden. Use a TypeScript discriminated union (`PlayerEvent`, keyed by `type`) with documented payloads. React Native hosts can use `<PurePlayer onEvent={...} />` or `usePurePlayer().subscribe(listener)` for a custom UI. The named props above are convenience callbacks from the same event stream, not a second source of playback state.

| Category | Events exposed to React Native |
|---|---|
| Source and lifecycle | `sourceChanged`, `loadStart`, `ready`, `firstFrameRendered`, `ended` |
| Playback and timeline | `stateChanged`, `isPlayingChanged`, `bufferingChanged`, `progress`, `durationChanged`, `seekStarted`, `seekCompleted`, `speedChanged` |
| Tracks and quality | `tracksChanged`, `audioTrackChanged`, `subtitleTrackChanged`, `videoTrackChanged`, `qualityModeChanged`, `videoSizeChanged` |
| Output and presentation | `volumeChanged`, `mutedChanged`, `fullscreenChanged`; `audioOutputChanged`, `hdrInfoChanged`, `pictureInPictureChanged` when supported |
| Errors and diagnostics | `error` with a stable code and recoverability; opt-in diagnostics such as bandwidth estimates, decoder details, and dropped-frame counts when available |

- Include `sourceId` on source-scoped events; ignore stale events after switching sources. Define position, duration, and buffered position in seconds; use `null` for unknown values. Throttle progress separately (default 250 ms, configurable on the controller) without throttling critical events such as errors or state changes.
- Keep requested settings distinct from actual playback: `qualityModeChanged` reports auto/manual selection, while `videoTrackChanged` reports the active rendition when observable. A seek command is not proof of completion; emit `seekCompleted` only after engine confirmation.
- Document which events each adapter and platform supports. If a capability is unavailable, report it as unsupported rather than emitting a guess. Expose relevant engine diagnostics without forwarding every internal callback or leaking URLs or headers.
- Return an unsubscribe function from `subscribe`. Remove listeners on teardown and test event delivery with controls hidden, source switches, and repeated mounts. `fullscreenChanged` reflects the real presentation state; custom layouts own their own fullscreen unless they use the provided fullscreen controller.

11. Android Phone Support

Implement:

Touch controls.
Portrait and landscape modes.
Fullscreen playback.
Gesture-based seeking.
Brightness gesture.
Volume gesture.
Screen orientation handling.
Picture-in-Picture where supported.
Back button handling.

The player should work across different phone resolutions and aspect ratios.

12. Android TV Support

Android TV must receive a dedicated interaction layer.

Implement:

D-pad navigation.
Remote play/pause.
Remote seek controls.
Focus management.
Focus indicators.
Select and back buttons.
Fullscreen player.
TV-friendly settings dialogs.
Large control elements.

The player UI should be usable without a touchscreen.

Phone and TV should share the same playback engine.

13. Project Folder Structure
text
pureplayer/
│
├── app/
│   ├── index.tsx            (home: open URL / pick file)
│   ├── library.tsx          (local/downloaded videos)
│   ├── player.tsx
│   ├── settings.tsx
│   └── _layout.tsx
│
├── src/
│   ├── components/
│   │   ├── player/
│   │   │   ├── PurePlayer.tsx
│   │   │   ├── PlayerControls.tsx
│   │   │   ├── PlayerTimeline.tsx
│   │   │   ├── QualitySelector.tsx
│   │   │   ├── AudioSelector.tsx
│   │   │   ├── SubtitleSelector.tsx
│   │   │   └── PlayerSettings.tsx
│   │   │
│   │   └── common/
│   │
│   ├── hooks/
│   │   ├── usePurePlayer.ts
│   │   ├── usePlaybackState.ts
│   │   ├── useLocalVideos.ts
│   │   └── useDeviceCapabilities.ts
│   │
│   ├── playback/
│   │   ├── engines/
│   │   │   ├── ExpoVideoEngine.ts
│   │   │   └── Media3Engine.ts
│   │   │
│   │   ├── sourceResolver.ts      (remote / file / content URI)
│   │   ├── subtitleDiscovery.ts   (sidecar subtitles)
│   │   ├── trackManager.ts
│   │   ├── qualityManager.ts
│   │   └── playbackTypes.ts
│   │
│   ├── store/
│   │   └── playerStore.ts
│   │
│   ├── services/
│   │   ├── localMediaService.ts   (MediaStore, picker, permissions)
│   │   ├── resumeStore.ts
│   │   ├── deviceCapabilities.ts
│   │   └── playbackLogger.ts
│   │
│   ├── utils/
│   ├── constants/
│   └── types/
│
├── modules/
│   └── media3-player/
│       ├── android/
│       │   └── src/main/java/
│       ├── index.ts
│       └── expo-module.config.json
│
├── assets/
├── plugins/
├── app.json
├── package.json
└── tsconfig.json

14. Development Phases
Phases 1–6 plus Phase 2A form v1 "JustPlayer"; Phases 7–9 follow afterwards.

Phase 1 — Player Foundation
Create standalone Expo project (PurePlayer).
Configure TypeScript.
Configure Android development builds.
Integrate Expo Video.
Define the TypeScript event contract and test adapter coverage on Android mobile and TV. Use the native adapter in v1 if required events cannot be confirmed through Expo Video.
Create basic player screen.
Implement HTTPS source loading.
Implement play/pause and seeking.
Phase 2A — Local / Downloaded Video
Document picker (SAF) and content:// playback.
MediaStore library screen with permissions (Android 13+ and older).
file:// playback from Downloads and app-private downloads.
Sidecar subtitle detection.
Resume position store.
"Open with" intent filter for video/*.
Missing / unreadable file error handling.
Phase 2 — Format Compatibility

Test (remote AND local):

MP4
MKV
HLS
DASH
TS

Verify that each format works on both phone and TV hardware.

Phase 3 — Player Controls
Themeable React Native control overlay using StyleSheet.
Timeline.
Fullscreen.
Playback speed.
Loading indicators.
Error states.
Auto-hide controls.
Phase 4 — Audio and Subtitles
Audio track listing.
Audio selection.
Subtitle listing.
Subtitle selection.
External subtitle testing.
Language preferences.
Phase 5 — Quality Management
Automatic quality.
Manual quality.
Resolution selection.
Data saver.
Adaptive bitrate testing.
Phase 6 — Android TV (and tablet layout)
Tablet responsive layout (large screens, split library/player).
D-pad support.
TV local file access (USB / file manager / Open with).
Remote-control integration.
Focus management.
TV settings dialogs.
TV player layout.
Phase 7 — Advanced Native Playback

Expand native playback support beyond the v1 event contract as needed.

Advanced track selection.
Decoder capabilities.
HDR detection.
Dolby Vision.
HDR10+.
Atmos passthrough.
Buffer configuration.
Native playback information.
Phase 8 — Performance and Stability
Memory management.
Player lifecycle.
Network interruption.
Playback recovery.
Background/foreground handling.
Multiple device testing.
Phase 9 — Reusable Package
Separate UI from engine.
Create stable TypeScript interfaces.
Create native module configuration.
Add reusable configuration options.
Add documentation.
Add example application.
Add integration instructions.
Validate integration into a second Expo project (PurePlay).
Define OTT extension points for PurePlay (next video, skip intro, DRM, analytics).
15. Testing Matrix

Test the following scenarios.

Test	Phone	Android TV
Local file playback (file://)	Required	Required
Picked file (content://)	Required	Required
Local library + permissions	Required	Test
Sidecar subtitles on local video	Required	Required
Deleted / moved local file	Required	Required
Tablet layout	Required	N/A
MP4 playback	Required	Required
MKV playback	Required	Required
HLS playback	Required	Required
DASH playback	Required	Required
Seeking	Required	Required
Audio selection	Required	Required
Subtitle selection	Required	Required
Automatic quality	Required	Required
Manual quality	Required	Required
Remote controls	N/A	Required
Touch controls	Required	N/A
HDR10	Test	Test
HDR10+	Test	Test
Dolby Vision	Test	Test
Dolby Atmos	Test	Test

Also test:

Low bandwidth.
Network disconnection.
Invalid video URLs.
Expired URLs.
Unsupported codecs.
Corrupted files.
Very large video files.
Long-running playback.
Player screen unmounting and remounting.
16. Reusability Requirements

The final deliverable should have two parts.

A. Reusable player core

Contains:

Player engine abstraction.
Native Media3 integration.
Playback state.
Track management.
Quality management.
Device capabilities.
Source resolution.
Player TypeScript API.
B. Optional player UI

Contains:

OTT controls.
Timeline.
Settings dialogs.
Audio selection.
Subtitle selection.
Quality selection.
Phone-specific UI.
TV-specific UI.

Applications should be able to reuse the playback core without necessarily using the provided UI.

For example:

tsx
// Use the complete player UI (PurePlayer)

<PurePlayer source={source} />


Or use the playback engine independently:

tsx
// Build a completely custom UI

const player = usePurePlayer();

player.setSource(source);
player.play();
player.pause();


The second approach is particularly important for future projects with different player designs.

17. Final Deliverables

At completion, the project should contain:

Standalone PurePlayer Expo app (JustPlayer v1).
Local / downloaded video playback and library.
Reusable React Native player component.
Reusable TypeScript playback interface.
Custom Kotlin Media3 module, if required.
Phone-compatible player UI.
Android TV-compatible player UI.
Device capability detection.
Audio and subtitle management.
Automatic and manual quality management.
HDR and Dolby compatibility testing.
Integration documentation.
Example project demonstrating reuse.
Final Architecture Decision

Expo + React Native + TypeScript + AndroidX Media3

Start by validating Expo Video against v1 format and event requirements. If it falls short, use a custom Kotlin Media3 adapter in v1 without changing the public React Native API.

The most important architectural principle:

The playback engine, player UI and application integration must remain independent.

This will allow the player to be reused in multiple Expo applications without rewriting playback logic or tying it to a particular OTT application's design.