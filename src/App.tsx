import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getDocumentAsync } from 'expo-document-picker';
import { NavigationBar } from 'expo-navigation-bar';
import { SpaceGrotesk_400Regular, SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import { PlayerButton, PurePlayer, type PurePlayerProps } from './player/PurePlayer';
import { parseVideoUrl } from './player/parseVideoUrl';
import type { PlayerSource } from './player/usePurePlayer';
import { colors, fonts } from './theme';

const demoMetadata = {
  title: 'Beyond the Blue',
  subtitle: '2026 | Season 1, Episode 1',
  pauseMetadata: {
    name: 'Beyond the Blue',
    image: require('../assets/icon.png'),
    detailLine: '7.8 / 10  |  42 min  |  2026  |  Science Fiction',
    description: 'A deep-space survey crew follows a forgotten signal to an ocean world, where a new discovery forces them to rethink their mission. A deep-space survey crew follows a forgotten signal to an ocean world, where a new discovery forces them to rethink their mission. A deep-space survey crew follows a forgotten signal to an ocean world, where a new discovery forces them to rethink their mission.',
  },
} satisfies Pick<PurePlayerProps, 'title' | 'subtitle' | 'pauseMetadata'>;

export function App() {
  const [fontsLoaded, fontError] = useFonts({ SpaceGrotesk_400Regular, SpaceGrotesk_700Bold });
  useEffect(() => {
    if (fontError) console.warn('PurePlayer could not load Space Grotesk.', fontError);
  }, [fontError]);

  if (!fontsLoaded && !fontError) return <View style={styles.screen} />;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <Home />
    </SafeAreaProvider>
  );
}

function Home() {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const nextId = useRef(0);
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  function openUrl() {
    if (picking) return;
    try {
      const video = parseVideoUrl(url);
      setError('');
      setSource({ ...video, id: ++nextId.current });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open this video URL.');
    }
  }

  async function pickVideo() {
    setError('');
    setPicking(true);
    try {
      const result = await getDocumentAsync({ type: 'video/*', copyToCacheDirectory: false });
      if (!result.canceled) {
        setSource({ id: ++nextId.current, uri: result.assets[0].uri });
      }
    } catch {
      setError('Could not open the file picker. This device may not provide one.');
    } finally {
      setPicking(false);
    }
  }

  if (source) {
    return (
      <View style={styles.screen}>
        <StatusBar hidden={!Platform.isTV} />
        {!Platform.isTV && <NavigationBar hidden />}
        <PurePlayer source={source} autoRotate onExit={() => setSource(null)} {...demoMetadata} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.home}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>Pure<Text style={styles.blue}>Player</Text></Text>
        </View>
        <View style={[styles.hero, wide && styles.heroWide]}>
          {wide && (
            <View pointerEvents="none" style={styles.heroArt}>
              <View style={styles.artHalo}>
                <View style={styles.artTile}><View style={styles.playMark} /></View>
              </View>
            </View>
          )}
          <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
            <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header">
              Your video.<Text style={styles.blue}> On any screen.</Text>
            </Text>
            <Text style={styles.description}>Stream from a direct video link, or play a file from your device.</Text>
          </View>
        </View>
        <View style={[styles.actions, wide && styles.actionsWide]}>
          <View style={[styles.card, wide && styles.streamCard]}>
            <Text accessibilityRole="header" style={styles.cardTitle}>Stream a video</Text>
            <Text style={styles.description}>Use an HTTPS or HTTP video link. HTTPS is recommended.</Text>
            <TextInput
              accessibilityLabel="Video URL (HTTP or HTTPS)"
              style={[styles.input, inputFocused && styles.inputFocused]}
              value={url}
              onChangeText={setUrl}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="https://example.com/video.mp4"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={openUrl}
            />
            <PlayerButton label="Play URL" onPress={openUrl} disabled={picking} preferredFocus />
            {error !== '' && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          </View>
          <View style={[styles.card, wide && styles.fileCardWide]}>
            <Text accessibilityRole="header" style={styles.cardTitle}>Downloaded videos</Text>
            <Text style={styles.description}>Choose a video saved on this device.</Text>
            <PlayerButton label={picking ? 'Opening files...' : 'Open downloaded video'} onPress={pickVideo} disabled={picking} secondary />
          </View>
        </View>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  brand: { flexShrink: 1, color: colors.text, fontSize: 23, letterSpacing: -0.5, fontFamily: fonts.bold },
  blue: { color: colors.accent },
  home: { alignItems: 'center', paddingHorizontal: Platform.isTV ? 40 : 20, paddingTop: 16, paddingBottom: 28 },
  content: { width: '100%', maxWidth: 1120, gap: 16 },
  hero: { borderWidth: 1, borderColor: '#274266', borderRadius: 22, overflow: 'hidden', backgroundColor: '#101F39' },
  heroWide: { minHeight: 206, justifyContent: 'center' },
  heroCopy: { padding: 22, gap: 10 },
  heroCopyWide: { width: '65%', padding: 32 },
  heroArt: { position: 'absolute', right: 12, width: '35%', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  artHalo: { width: 184, height: 184, borderRadius: 92, borderWidth: 1, borderColor: '#365D91', backgroundColor: '#183057', alignItems: 'center', justifyContent: 'center' },
  artTile: { width: 100, height: 74, borderRadius: 20, backgroundColor: colors.primary, borderColor: colors.accent, borderWidth: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-10deg' }] },
  playMark: { width: 0, height: 0, marginLeft: 5, borderLeftWidth: 24, borderLeftColor: colors.text, borderTopWidth: 15, borderBottomWidth: 15, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  title: { color: colors.text, fontSize: 34, fontFamily: fonts.bold, letterSpacing: -1.1 },
  titleWide: { fontSize: Platform.isTV ? 48 : 42 },
  description: { color: colors.muted, fontFamily: fonts.regular, fontSize: Platform.isTV ? 17 : 15, lineHeight: Platform.isTV ? 24 : 21 },
  actions: { gap: 12 },
  actionsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  card: { padding: 16, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  streamCard: { flex: 1 },
  fileCardWide: { flex: 0.65 },
  cardTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  input: {
    minHeight: Platform.isTV ? 54 : 48, color: colors.text, fontFamily: fonts.regular, backgroundColor: colors.field,
    borderColor: colors.border, borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, fontSize: Platform.isTV ? 17 : 15,
  },
  inputFocused: { borderColor: colors.focus },
  error: { color: colors.error, fontFamily: fonts.regular },
});
