import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme';

export type PauseMetadata = {
  name?: string;
  image?: ImageSourcePropType;
  detailLine?: string;
  description?: string;
};

export function PauseDetails({ metadata, visible, onDismiss, landscape, bottom, left, right }: {
  metadata: PauseMetadata;
  visible: boolean;
  onDismiss: () => void;
  landscape: boolean;
  bottom: number;
  left: number;
  right: number;
}) {
  const [shade, artwork, name, details, description] = useRef([
    new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const values = [shade, artwork, name, details, description];
    const animations = values.map((value, index) => Animated.timing(value, {
      toValue: visible ? 1 : 0,
      delay: visible ? Math.max(0, index - 1) * 70 : 0,
      duration: visible ? 330 : 210,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }));
    const animation = Animated.parallel(animations);
    animation.start();
    return () => animation.stop();
  }, [visible, shade, artwork, name, details, description]);

  function slide(value: Animated.Value) {
    return { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) }] };
  }

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={styles.overlay}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: shade }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="pauseShade" x1="0%" y1={landscape ? '0%' : '100%'}
              x2={landscape ? '100%' : '0%'} y2="0%">
              <Stop offset="0%" stopColor="#000" stopOpacity={1} />
              <Stop offset="55%" stopColor="#000" stopOpacity={0.5} />
              <Stop offset="100%" stopColor="#000" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#pauseShade)" />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={[styles.content, { bottom, left }, landscape ? styles.landscapeContent : { right }]}>
        {metadata.image !== undefined && (
          <Animated.View style={slide(artwork)}>
            <Image source={metadata.image} style={styles.artwork} resizeMode="contain"
              onError={({ nativeEvent }) => console.warn('PurePlayer could not load pause artwork:', nativeEvent.error)} />
          </Animated.View>
        )}
        {!!metadata.name && <Animated.Text accessibilityRole="header" numberOfLines={2} style={[styles.name, slide(name)]}>{metadata.name}</Animated.Text>}
        {!!metadata.detailLine && <Animated.Text numberOfLines={2} style={[styles.details, slide(details)]}>{metadata.detailLine}</Animated.Text>}
        {!!metadata.description && <Animated.Text numberOfLines={3} style={[styles.description, slide(description)]}>{metadata.description}</Animated.Text>}
      </View>
      {visible && <Pressable style={StyleSheet.absoluteFill} hasTVPreferredFocus={Platform.isTV}
        accessibilityRole="button" accessibilityLabel="Return to paused playback controls" onPress={onDismiss} />}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 5, overflow: 'hidden' },
  content: { position: 'absolute', maxWidth: 680, gap: 7 },
  landscapeContent: { width: '55%' },
  artwork: { width: Platform.isTV ? 200 : 150, height: Platform.isTV ? 112 : 84, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: Platform.isTV ? 36 : 24 },
  details: { color: colors.accent, fontFamily: fonts.bold, fontSize: Platform.isTV ? 18 : 14 },
  description: { color: colors.muted, fontFamily: fonts.regular, fontSize: Platform.isTV ? 19 : 15, lineHeight: Platform.isTV ? 26 : 20 },
});
