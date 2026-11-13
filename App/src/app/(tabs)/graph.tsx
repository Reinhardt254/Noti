import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { Spacing, Typography } from '@/constants/theme';
import { graphData } from '@/features/notes/repository';
import { useTheme } from '@/hooks/use-theme';

type GNode = SimulationNodeDatum & { id: string; title: string; pinned: boolean; degree: number };
type GLink = SimulationLinkDatum<GNode> & { source: string | GNode; target: string | GNode };

type Data = Awaited<ReturnType<typeof graphData>>;

function layout(data: Data, width: number, height: number) {
  const ids = new Set(data.nodes.map((n) => n.id));
  const edges = data.edges.filter((e) => e.targetId && ids.has(e.sourceId) && ids.has(e.targetId));
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.sourceId, (degree.get(e.sourceId) ?? 0) + 1);
    degree.set(e.targetId!, (degree.get(e.targetId!) ?? 0) + 1);
  }
  const nodes: GNode[] = data.nodes.map((n) => ({
    id: n.id,
    title: n.title || 'Untitled',
    pinned: n.pinned,
    degree: degree.get(n.id) ?? 0,
  }));
  const links: GLink[] = edges.map((e) => ({ source: e.sourceId, target: e.targetId! }));

  const sim = forceSimulation<GNode>(nodes)
    .force('link', forceLink<GNode, GLink>(links).id((d) => d.id).distance(70))
    .force('charge', forceManyBody().strength(-160))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(22))
    .stop();
  for (let i = 0; i < 220; i++) sim.tick();

  return { nodes, links };
}

export default function GraphScreen() {
  const theme = useTheme();
  const [data, setData] = useState<Data | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useFocusEffect(
    useCallback(() => {
      graphData().then(setData);
    }, []),
  );

  const g = useMemo(
    () => (data && size.width ? layout(data, size.width, size.height) : null),
    [data, size],
  );

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
  }

  const linkCount = g?.links.length ?? 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Graph</Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {data?.nodes.length ?? 0} notes · {linkCount} links
        </Text>
      </View>
      <View style={styles.canvas} onLayout={onLayout}>
        {g && g.nodes.length ? (
          <Svg width={size.width} height={size.height}>
            {g.links.map((l, i) => {
              const s = l.source as GNode;
              const t = l.target as GNode;
              return (
                <Line
                  key={i}
                  x1={s.x ?? 0}
                  y1={s.y ?? 0}
                  x2={t.x ?? 0}
                  y2={t.y ?? 0}
                  stroke={theme.border}
                  strokeWidth={1.5}
                />
              );
            })}
            {g.nodes.map((n) => {
              const r = 8 + Math.min(n.degree, 6) * 2;
              return (
                <Circle
                  key={n.id}
                  cx={n.x ?? 0}
                  cy={n.y ?? 0}
                  r={r}
                  fill={n.pinned ? theme.pin : n.degree ? theme.primary : theme.accent}
                  opacity={n.degree ? 1 : 0.6}
                  onPress={() => router.push({ pathname: '/note/[id]', params: { id: n.id } })}
                />
              );
            })}
            {g.nodes.map((n) => (
              <SvgText
                key={`t${n.id}`}
                x={n.x ?? 0}
                y={(n.y ?? 0) + 8 + Math.min(n.degree, 6) * 2 + 12}
                fontSize={11}
                fill={theme.textSecondary}
                textAnchor="middle">
                {n.title.length > 18 ? `${n.title.slice(0, 17)}…` : n.title}
              </SvgText>
            ))}
          </Svg>
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing to map yet</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Link notes with [[wiki links]] to see how they connect.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: { ...Typography.display },
  count: { ...Typography.callout },
  canvas: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.five },
  emptyTitle: { ...Typography.subtitle },
  emptyBody: { ...Typography.body, textAlign: 'center' },
});
