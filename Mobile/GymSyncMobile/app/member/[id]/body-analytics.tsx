import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';

import { AthletixHeader } from '@/components/AthletixHeader';
import { useAuth } from '@/contexts/AuthContext';
import {
  BodyMeasurementDto,
  getMeasurementsForUser,
  ROLE,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Metric configuration (mirrors /body-analytics, but read-only here)
// ─────────────────────────────────────────────────────────────────────────────

type MetricKey =
  | 'weightKg'
  | 'fatPercentage'
  | 'shoulderCm'
  | 'chestCm'
  | 'leftArmCm'
  | 'rightArmCm'
  | 'forearmCm'
  | 'waistCm'
  | 'hipsCm'
  | 'leftThighCm'
  | 'rightThighCm'
  | 'calvesCm';

type Section = 'core' | 'upper' | 'lower';

interface MetricConfig {
  key: MetricKey;
  label: string;
  unit: string;
  section: Section;
}

const METRICS: MetricConfig[] = [
  { key: 'weightKg', label: 'Kilo', unit: 'kg', section: 'core' },
  { key: 'fatPercentage', label: 'Yağ Oranı', unit: '%', section: 'core' },
  { key: 'shoulderCm', label: 'Omuz', unit: 'cm', section: 'upper' },
  { key: 'chestCm', label: 'Göğüs', unit: 'cm', section: 'upper' },
  { key: 'leftArmCm', label: 'Sol Kol', unit: 'cm', section: 'upper' },
  { key: 'rightArmCm', label: 'Sağ Kol', unit: 'cm', section: 'upper' },
  { key: 'forearmCm', label: 'Ön Kol', unit: 'cm', section: 'upper' },
  { key: 'waistCm', label: 'Bel', unit: 'cm', section: 'lower' },
  { key: 'hipsCm', label: 'Kalça', unit: 'cm', section: 'lower' },
  { key: 'leftThighCm', label: 'Sol Bacak', unit: 'cm', section: 'lower' },
  { key: 'rightThighCm', label: 'Sağ Bacak', unit: 'cm', section: 'lower' },
  { key: 'calvesCm', label: 'Baldır', unit: 'cm', section: 'lower' },
];

type ChartOption =
  | { kind: 'single'; key: MetricKey; label: string; unit: string }
  | {
      kind: 'pair';
      pair: 'arm' | 'thigh';
      leftKey: MetricKey;
      rightKey: MetricKey;
      label: string;
      unit: string;
    };

const CHART_OPTIONS: ChartOption[] = [
  { kind: 'single', key: 'weightKg', label: 'Kilo', unit: 'kg' },
  { kind: 'single', key: 'fatPercentage', label: 'Yağ Oranı', unit: '%' },
  { kind: 'single', key: 'shoulderCm', label: 'Omuz', unit: 'cm' },
  { kind: 'single', key: 'chestCm', label: 'Göğüs', unit: 'cm' },
  { kind: 'pair', pair: 'arm', leftKey: 'leftArmCm', rightKey: 'rightArmCm', label: 'Kol', unit: 'cm' },
  { kind: 'single', key: 'forearmCm', label: 'Ön Kol', unit: 'cm' },
  { kind: 'single', key: 'waistCm', label: 'Bel', unit: 'cm' },
  { kind: 'single', key: 'hipsCm', label: 'Kalça', unit: 'cm' },
  { kind: 'pair', pair: 'thigh', leftKey: 'leftThighCm', rightKey: 'rightThighCm', label: 'Bacak', unit: 'cm' },
  { kind: 'single', key: 'calvesCm', label: 'Baldır', unit: 'cm' },
];

const SYMMETRY_THRESHOLD = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MemberBodyAnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const memberId = Number(params.id);
  const passedName = typeof params.name === 'string' ? params.name : '';

  const canView = user?.role === ROLE.PT || user?.role === ROLE.Admin;

  const [measurements, setMeasurements] = useState<BodyMeasurementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedChart, setSelectedChart] = useState<number>(3);
  const [pairSide, setPairSide] = useState<'both' | 'left' | 'right'>('both');

  const load = useCallback(async () => {
    if (!Number.isFinite(memberId)) return;
    try {
      setError(null);
      const list = await getMeasurementsForUser(memberId);
      setMeasurements(list);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Ölçümler yüklenemedi.');
    }
  }, [memberId]);

  useEffect(() => {
    if (!canView) return;
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [canView, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const option = CHART_OPTIONS[selectedChart];
  const { primary, secondary } = useMemo(
    () => buildChartSeries(measurements, option),
    [measurements, option],
  );
  const deltas = useMemo(() => buildDeltas(measurements), [measurements]);
  const totalCmDelta = useMemo(() => {
    let total = 0;
    for (const m of METRICS) {
      if (m.unit !== 'cm') continue;
      const d = deltas[m.key];
      if (d?.delta != null) total += d.delta;
    }
    return total;
  }, [deltas]);
  const symmetryWarnings = useMemo(() => buildSymmetryWarnings(measurements), [measurements]);

  if (!canView) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-black px-6">
        <Ionicons name="lock-closed-outline" size={42} color="#9a9078" />
        <Text
          className="mt-3 text-on-background"
          style={{ fontFamily: 'Lexend_700Bold', fontSize: 16 }}
        >
          Yetkin yok
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-6 rounded-sm border border-outline-variant px-5 py-3 active:bg-surface-container"
        >
          <Text
            className="text-on-background"
            style={{ fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1 }}
          >
            GERİ DÖN
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <AthletixHeader onBack={() => router.back()} />

      <ScrollView
        contentContainerClassName="px-5 pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
      >
        <View className="pb-4 pt-6">
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.5 }}
          >
            ÜYE TAKİBİ · VÜCUT ANALİZİ
          </Text>
          <Text
            className="mt-1 text-3xl text-on-background"
            style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 36 }}
          >
            {passedName || 'Üye'}
          </Text>
          <Text
            className="mt-1 text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
          >
            {measurements.length} ölçüm kaydı · sadece görüntüleme
          </Text>
        </View>

        {error && (
          <View className="mb-4 rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
            <Text className="text-sm text-accent-red">{error}</Text>
          </View>
        )}

        {loading ? (
          <View className="items-center py-12">
            <ActivityIndicator color="#facc15" />
          </View>
        ) : measurements.length === 0 ? (
          <View className="items-center rounded-sm border border-outline-variant bg-surface-container p-8">
            <Ionicons name="bar-chart-outline" size={48} color="#9a9078" />
            <Text
              className="mt-3 text-on-background"
              style={{ fontFamily: 'Lexend_700Bold', fontSize: 16 }}
            >
              Henüz ölçüm yok
            </Text>
            <Text
              className="mt-2 text-center text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              Bu üye henüz vücut ölçümü girmedi.
            </Text>
          </View>
        ) : (
          <>
            <TotalChangeCard totalCm={totalCmDelta} measurementCount={measurements.length} />

            {symmetryWarnings.map((w) => (
              <SymmetryWarning key={w.pair} text={w.text} />
            ))}

            <Text
              className="mb-2 mt-6 text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2 }}
            >
              METRİK
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8 }}
            >
              {CHART_OPTIONS.map((o, idx) => {
                const active = idx === selectedChart;
                return (
                  <Pressable
                    key={o.label}
                    onPress={() => {
                      setSelectedChart(idx);
                      setPairSide('both');
                    }}
                    className={`mr-2 rounded-sm border px-4 py-2 ${
                      active
                        ? 'border-primary bg-primary'
                        : 'border-outline-variant bg-surface-container'
                    }`}
                  >
                    <Text
                      style={{
                        fontFamily: 'Inter_700Bold',
                        fontSize: 12,
                        letterSpacing: 0.5,
                        color: active ? '#3c2f00' : '#e8dfd0',
                      }}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {option.kind === 'pair' && (
              <View className="mt-3 flex-row rounded-sm border border-outline-variant bg-surface-container-low p-1">
                {(['both', 'left', 'right'] as const).map((side) => {
                  const active = pairSide === side;
                  const label = side === 'both' ? 'İkisi' : side === 'left' ? 'Sol' : 'Sağ';
                  return (
                    <Pressable
                      key={side}
                      onPress={() => setPairSide(side)}
                      className={`flex-1 items-center rounded-sm py-2 ${
                        active ? 'bg-primary' : 'bg-transparent'
                      }`}
                    >
                      <Text
                        style={{
                          fontFamily: 'Inter_700Bold',
                          fontSize: 11,
                          letterSpacing: 1,
                          color: active ? '#3c2f00' : '#9a9078',
                        }}
                      >
                        {label.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <ChartCard
              option={option}
              primary={primary}
              secondary={secondary}
              pairSide={pairSide}
            />

            <Text
              className="mb-2 mt-6 text-on-surface-variant"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.2 }}
            >
              SON vs ŞİMDİ
            </Text>

            <SectionGroup title="Temel" deltas={deltas} section="core" />
            <SectionGroup title="Üst Vücut" deltas={deltas} section="upper" />
            <SectionGroup title="Alt Vücut" deltas={deltas} section="lower" />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents (read-only copies — no add modal here)
// ─────────────────────────────────────────────────────────────────────────────

function TotalChangeCard({
  totalCm,
  measurementCount,
}: {
  totalCm: number;
  measurementCount: number;
}) {
  const positive = totalCm >= 0;
  const sign = positive ? '+' : '';
  return (
    <View
      className="mb-3 rounded-sm border-2 border-primary bg-primary p-5"
      style={{
        shadowColor: '#facc15',
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="text-on-primary"
          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 2 }}
        >
          TOPLAM DEĞİŞİM
        </Text>
        <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={18} color="#3c2f00" />
      </View>
      <Text
        className="mt-2 text-on-primary"
        style={{
          fontFamily: 'Lexend_900Black',
          fontSize: 56,
          letterSpacing: -1.5,
          lineHeight: 60,
        }}
      >
        {sign}
        {totalCm.toFixed(1)} <Text style={{ fontSize: 22 }}>cm</Text>
      </Text>
      <Text
        className="text-on-primary/80"
        style={{ fontFamily: 'Inter_500Medium', fontSize: 12 }}
      >
        Tüm vücut ölçülerinin başlangıçtan itibaren toplamı · {measurementCount} kayıt
      </Text>
    </View>
  );
}

function SymmetryWarning({ text }: { text: string }) {
  return (
    <View className="mb-2 flex-row items-start rounded-sm border border-accent-red/40 bg-accent-red/10 p-3">
      <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginTop: 2 }} />
      <Text
        className="ml-2 flex-1 text-accent-red"
        style={{ fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 }}
      >
        {text}
      </Text>
    </View>
  );
}

function ChartCard({
  option,
  primary,
  secondary,
  pairSide,
}: {
  option: ChartOption;
  primary: { value: number; label?: string }[];
  secondary: { value: number; label?: string }[];
  pairSide: 'both' | 'left' | 'right';
}) {
  const screenW = Dimensions.get('window').width;
  const chartWidth = Math.max(220, screenW - 88);

  const showPrimary =
    option.kind === 'single' || pairSide === 'both' || pairSide === 'left';
  const showSecondary =
    option.kind === 'pair' && (pairSide === 'both' || pairSide === 'right');

  const primaryData = showPrimary ? primary : [];
  const secondaryData = showSecondary ? secondary : [];

  const hasData = primaryData.length + secondaryData.length > 0;

  const allValues = [...primaryData, ...secondaryData].map((p) => p.value);
  const minV = allValues.length ? Math.min(...allValues) : 0;
  const maxV = allValues.length ? Math.max(...allValues) : 1;
  const padV = Math.max(1, (maxV - minV) * 0.15);

  return (
    <View className="mt-3 rounded-sm border border-outline-variant bg-surface-container p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text
          className="text-on-background"
          style={{ fontFamily: 'Lexend_700Bold', fontSize: 15 }}
        >
          {option.label} Gelişimi
        </Text>
        {option.kind === 'pair' && pairSide === 'both' && (
          <View className="flex-row items-center">
            <View className="flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-primary" />
              <Text
                className="ml-1 mr-3 text-on-surface-variant"
                style={{ fontFamily: 'Inter_500Medium', fontSize: 10 }}
              >
                Sol
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              <Text
                className="ml-1 text-on-surface-variant"
                style={{ fontFamily: 'Inter_500Medium', fontSize: 10 }}
              >
                Sağ
              </Text>
            </View>
          </View>
        )}
      </View>

      {!hasData ? (
        <View className="items-center py-10">
          <Ionicons name="bar-chart-outline" size={36} color="#6b6354" />
          <Text
            className="mt-2 text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
          >
            Henüz veri yok
          </Text>
        </View>
      ) : (
        <LineChart
          data={primaryData}
          data2={secondaryData.length ? secondaryData : undefined}
          width={chartWidth}
          height={200}
          color1="#facc15"
          color2="#ef4444"
          thickness1={3}
          thickness2={3}
          dataPointsColor1="#facc15"
          dataPointsColor2="#ef4444"
          dataPointsRadius={4}
          startFillColor1="#facc15"
          startOpacity={0.25}
          endOpacity={0.02}
          areaChart
          curved
          hideRules
          xAxisColor="#3a3525"
          yAxisColor="#3a3525"
          yAxisTextStyle={{ color: '#9a9078', fontSize: 10 }}
          xAxisLabelTextStyle={{ color: '#9a9078', fontSize: 9 }}
          noOfSections={4}
          spacing={Math.max(
            30,
            chartWidth / Math.max(primaryData.length || secondaryData.length, 4),
          )}
          initialSpacing={12}
          endSpacing={12}
          minValue={Math.max(0, minV - padV)}
          maxValue={maxV + padV}
          isAnimated
          animationDuration={600}
        />
      )}
    </View>
  );
}

function SectionGroup({
  title,
  deltas,
  section,
}: {
  title: string;
  deltas: Record<MetricKey, DeltaInfo | undefined>;
  section: Section;
}) {
  const items = METRICS.filter((m) => m.section === section);
  return (
    <View className="mb-3 rounded-sm border border-outline-variant bg-surface-container p-4">
      <Text
        className="mb-3 text-on-background"
        style={{ fontFamily: 'Lexend_700Bold', fontSize: 13, letterSpacing: 0.5 }}
      >
        {title}
      </Text>
      {items.map((m, idx) => (
        <DeltaRow
          key={m.key}
          label={m.label}
          unit={m.unit}
          delta={deltas[m.key]}
          isLast={idx === items.length - 1}
        />
      ))}
    </View>
  );
}

function DeltaRow({
  label,
  unit,
  delta,
  isLast,
}: {
  label: string;
  unit: string;
  delta?: DeltaInfo;
  isLast: boolean;
}) {
  if (!delta) {
    return (
      <View
        className={`flex-row items-center justify-between py-2.5 ${
          isLast ? '' : 'border-b border-outline-variant/40'
        }`}
      >
        <Text
          className="text-on-background"
          style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
        >
          {label}
        </Text>
        <Text
          className="text-on-surface-variant"
          style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
        >
          —
        </Text>
      </View>
    );
  }

  const { previous, current, delta: d } = delta;
  const positive = d != null && d > 0;
  const negative = d != null && d < 0;
  const color = positive ? '#22c55e' : negative ? '#ef4444' : '#9a9078';

  return (
    <View
      className={`flex-row items-center justify-between py-2.5 ${
        isLast ? '' : 'border-b border-outline-variant/40'
      }`}
    >
      <Text
        className="text-on-background"
        style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
      >
        {label}
      </Text>
      <View className="flex-row items-center">
        {previous != null && (
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
          >
            {previous.toFixed(1)} →{' '}
          </Text>
        )}
        <Text
          className="text-on-background"
          style={{ fontFamily: 'Lexend_700Bold', fontSize: 14 }}
        >
          {current.toFixed(1)}
          {unit}
        </Text>
        {d != null && d !== 0 && (
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 11,
              color,
              marginLeft: 6,
            }}
          >
            {d > 0 ? '+' : ''}
            {d.toFixed(1)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface DeltaInfo {
  current: number;
  previous: number | null;
  delta: number | null;
}

function buildDeltas(measurements: BodyMeasurementDto[]): Record<MetricKey, DeltaInfo | undefined> {
  const result = {} as Record<MetricKey, DeltaInfo | undefined>;
  for (const meta of METRICS) {
    let firstVal: number | null = null;
    let lastVal: number | null = null;
    for (const m of measurements) {
      const v = (m as any)[meta.key] as number | null | undefined;
      if (v == null) continue;
      if (firstVal == null) firstVal = v;
      lastVal = v;
    }
    if (lastVal == null) {
      result[meta.key] = undefined;
      continue;
    }
    const delta =
      firstVal != null && firstVal !== lastVal ? lastVal - firstVal : firstVal == null ? null : 0;
    result[meta.key] = {
      current: lastVal,
      previous: firstVal != null && firstVal !== lastVal ? firstVal : null,
      delta,
    };
  }
  return result;
}

function buildChartSeries(
  measurements: BodyMeasurementDto[],
  option: ChartOption,
): {
  primary: { value: number; label?: string }[];
  secondary: { value: number; label?: string }[];
} {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;
  };
  const primaryKey: MetricKey = option.kind === 'single' ? option.key : option.leftKey;
  const secondaryKey: MetricKey | null = option.kind === 'pair' ? option.rightKey : null;

  const primary: { value: number; label?: string }[] = [];
  const secondary: { value: number; label?: string }[] = [];

  measurements.forEach((m, idx) => {
    const showLabel =
      idx === 0 ||
      idx === measurements.length - 1 ||
      idx % Math.max(1, Math.floor(measurements.length / 4)) === 0;
    const pv = (m as any)[primaryKey] as number | null | undefined;
    if (pv != null) {
      primary.push({ value: pv, label: showLabel ? fmt(m.measuredAt) : undefined });
    }
    if (secondaryKey) {
      const sv = (m as any)[secondaryKey] as number | null | undefined;
      if (sv != null) {
        secondary.push({ value: sv, label: showLabel ? fmt(m.measuredAt) : undefined });
      }
    }
  });

  return { primary, secondary };
}

function buildSymmetryWarnings(measurements: BodyMeasurementDto[]) {
  if (measurements.length === 0) return [] as { pair: string; text: string }[];
  const latest = [...measurements].reverse();
  const pairs: { pair: 'arm' | 'thigh'; left: MetricKey; right: MetricKey; label: string }[] = [
    { pair: 'arm', left: 'leftArmCm', right: 'rightArmCm', label: 'kol' },
    { pair: 'thigh', left: 'leftThighCm', right: 'rightThighCm', label: 'bacak' },
  ];
  const warnings: { pair: string; text: string }[] = [];
  for (const p of pairs) {
    let l: number | null = null;
    let r: number | null = null;
    for (const m of latest) {
      const lv = (m as any)[p.left] as number | null | undefined;
      const rv = (m as any)[p.right] as number | null | undefined;
      if (lv != null && l == null) l = lv;
      if (rv != null && r == null) r = rv;
      if (l != null && r != null) break;
    }
    if (l != null && r != null) {
      const diff = Math.abs(l - r);
      if (diff > SYMMETRY_THRESHOLD) {
        const bigger = l > r ? 'sol' : 'sağ';
        warnings.push({
          pair: p.pair,
          text: `Simetri uyarısı: ${p.label} ölçüleri arasında ${diff.toFixed(1)} cm fark var (${bigger} taraf daha büyük).`,
        });
      }
    }
  }
  return warnings;
}
