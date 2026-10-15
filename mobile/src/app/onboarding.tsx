import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop, Body, Eyebrow, GoldButton, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/lib/config';

const PAGES = [
  {
    image: require('@/assets/images/onboard-1.webp'),
    eyebrow: 'Battle royale',
    title: 'Drop in. Loot up.',
    body: '30 soldiers on one island: real players and bots. Grab guns, scopes and med kits from houses and crates.',
  },
  {
    image: require('@/assets/images/onboard-2.webp'),
    eyebrow: 'Last one standing',
    title: 'Outlast the zone.',
    body: 'The blue zone shrinks every few minutes. Stay inside, fight smart, and be the last soldier alive.',
  },
];

/** Two intro screens, shown once on first launch. */
export default function Onboarding() {
  const [page, setPage] = useState(0);
  const { finishOnboarding } = useAuth();
  const insets = useSafeAreaInsets();
  const p = PAGES[page];
  const last = page === PAGES.length - 1;

  return (
    <Backdrop source={p.image}>
      <View style={[styles.wrap, { paddingLeft: insets.left + 32, paddingRight: insets.right + 32, paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={[styles.skip, { right: insets.right + 24 }]} onPress={finishOnboarding} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <View style={styles.copy}>
          <Eyebrow>{p.eyebrow}</Eyebrow>
          <Title size={38}>{p.title}</Title>
          <Body>{p.body}</Body>
        </View>
        <View style={styles.footer}>
          <View style={styles.dots}>
            {PAGES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
          <GoldButton title={last ? 'Get started' : 'Next'} onPress={() => (last ? finishOnboarding() : setPage(page + 1))} style={styles.cta} />
        </View>
      </View>
    </Backdrop>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  skip: { position: 'absolute', top: 20 },
  skipText: { fontFamily: fonts.semibold, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: colors.inkDim },
  copy: { maxWidth: 480, gap: 10 },
  footer: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { width: 26, backgroundColor: colors.gold },
  cta: { minWidth: 200 },
});
