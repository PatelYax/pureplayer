const fs = require('node:fs');
const path = require('node:path');

const manifestPath = require.resolve('expo-video/package.json', { paths: [path.join(__dirname, '..')] });
const { version } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (version !== '58.0.14') {
  throw new Error(`PurePlayer's Android video quality patch expects expo-video 58.0.14; found ${version}. Review the native patch before upgrading.`);
}

const root = path.join(path.dirname(manifestPath), 'android', 'src', 'main', 'java', 'expo', 'modules', 'video');
const edits = [
  ['VideoModule.kt', [
    ['      Property("maxResolution")', `      AsyncFunction("purePlayerGetVideoQualities") { ref: VideoPlayer ->
        ref.purePlayerVideoQuality.availableHeights()
      }.runOnQueue(Queues.MAIN)

      AsyncFunction("purePlayerSetVideoQuality") { ref: VideoPlayer, height: Int? ->
        ref.purePlayerVideoQuality.select(height)
      }.runOnQueue(Queues.MAIN)

      Property("maxResolution")`],
  ]],
  [path.join('player', 'VideoPlayer.kt'), [
    ['  private val playerListener = object : Player.Listener {', `  internal val purePlayerVideoQuality = PurePlayerVideoQuality(player)

  private val playerListener = object : Player.Listener {`],
    ['    override fun onTracksChanged(tracks: Tracks) {', `    override fun onTracksChanged(tracks: Tracks) {
      purePlayerVideoQuality.refresh()`],
    ['  fun prepare() {', `  fun prepare() {
    purePlayerVideoQuality.reset()`],
  ]],
];

const updates = edits.map(([file, changes]) => {
  const target = path.join(root, file);
  const original = fs.readFileSync(target, 'utf8');
  let updated = original.replace(/\r\n/g, '\n');
  for (const [anchor, replacement] of changes) {
    if (updated.includes(replacement)) continue;
    if (updated.split(anchor).length !== 2) throw new Error(`Could not apply PurePlayer video quality patch to ${file}: ${anchor}`);
    updated = updated.replace(anchor, replacement);
  }
  return { target, original, updated };
});

for (const { target, original, updated } of updates) {
  if (updated !== original.replace(/\r\n/g, '\n')) fs.writeFileSync(target, updated);
}
fs.copyFileSync(
  path.join(__dirname, 'android-video-quality', 'PurePlayerVideoQuality.kt'),
  path.join(root, 'player', 'PurePlayerVideoQuality.kt'),
);
