import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';

import { AthletixHeader } from '@/components/AthletixHeader';
import {
  BodyMeasurementDto,
  CreateBodyMeasurementPayload,
  createMeasurement,
  getMyMeasurements,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Metric configuration
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
  short: string;
  unit: string;
  section: Section;
  /** Pair key for symmetry (left/right). Undefined if not paired. */
  pair?: 'arm' | 'thigh';
  /** Side within the pair. */
  side?: 'left' | 'right';
}

const METRICS: MetricConfig[] = [
  { key: 'weightKg', label: 'Kilo', short: 'Kilo', unit: 'kg', section: 'core' },
  { key: 'fatPercentage', label: 'Yağ Oranı', short: 'Yağ', unit: '%', section: 'core' },

  { key: 'shoulderCm', label: 'Omuz', short: 'Omuz', unit: 'cm', section: 'upper' },
  { key: 'chestCm', label: 'Göğüs', short: 'Göğüs', unit: 'cm', section: 'upper' },
  { key: 'leftArmCm', label: 'Sol Kol', short: 'Sol Kol', unit: 'cm', section: 'upper', pair: 'arm', side: 'left' },
  { key: 'rightArmCm', label: 'Sağ Kol', short: 'Sağ Kol', unit: 'cm', section: 'upper', pair: 'arm', side: 'right' },
  { key: 'forearmCm', label: 'Ön Kol', short: 'Ön Kol', unit: 'cm', section: 'upper' },

  { key: 'waistCm', label: 'Bel', short: 'Bel', unit: 'cm', section: 'lower' },
  { key: 'hipsCm', label: 'Kalça', short: 'Kalça', unit: 'cm', section: 'lower' },
  { key: 'leftThighCm', label: 'Sol Bacak', short: 'Sol Bacak', unit: 'cm', section: 'lower', pair: 'thigh', side: 'left' },
  { key: 'rightThighCm', label: 'Sağ Bacak', short: 'Sağ Bacak', unit: 'cm', section: 'lower', pair: 'thigh', side: 'right' },
  { key: 'calvesCm', label: 'Baldır', short: 'Baldır', unit: 'cm', section: 'lower' },
];

const METRICS_BY_KEY: Record<MetricKey, MetricConfig> = METRICS.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<MetricKey, MetricConfig>,
);

// Selectable chart options. Pairs are exposed as a single "arm" / "thigh" item.
type ChartOption =
  | { kind: 'single'; key: MetricKey; label: string; unit: string }
  | { kind: 'pair'; pair: 'arm' | 'thigh'; leftKey: MetricKey; rightKey: MetricKey; label: string; unit: string };

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

const SYMMETRY_THRESHOLD = 2; // cm

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function BodyAnalyticsScreen() {
  const router = useRouter();

  const [measurements, setMeasurements] = useState<BodyMeasurementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedChart, setSelectedChart] = useState<number>(3); // default Göğüs
  const [pairSide, setPairSide] = useState<'both' | 'left' | 'right'>('both');
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await getMyMeasurements();
      setMeasurements(list);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Ölçümler yüklenemedi.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const option = CHART_OPTIONS[selectedChart];

  // ── Build chart data ──────────────────────────────────────────────────────
  const { primary, secondary } = useMemo(() => buildChartSeries(measurements, option), [
    measurements,
    option,
  ]);

  // ── Last vs Now deltas for every metric ──────────────────────────────────
  const deltas = useMemo(() => buildDeltas(measurements), [measurements]);

  // ── Total cm gained/lost across cm-based metrics ─────────────────────────
  const totalCmDelta = useMemo(() => {
    let total = 0;
    for (const m of METRICS) {
      if (m.unit !== 'cm') continue;
      const d = deltas[m.key];
      if (d?.delta != null) total += d.delta;
    }
    return total;
  }, [deltas]);

  // ── Symmetry warnings ────────────────────────────────────────────────────
  const symmetryWarnings = useMemo(() => buildSymmetryWarnings(measurements), [measurements]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <AthletixHeader onBack={() => router.back()} />

      <ScrollView
        contentContainerClassName="px-5 pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#facc15" />
        }
      >
        {/* Header */}
        <View className="pb-4 pt-6">
          <Text
            className="text-on-surface-variant"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.5 }}
          >
            VÜCUT ANALİZİ
          </Text>
          <Text
            className="mt-1 text-3xl text-on-background"
            style={{ fontFamily: 'Lexend_800ExtraBold', lineHeight: 36 }}
          >
            Body Analytics
          </Text>
          <Text
            className="mt-1 text-on-surface-variant"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
          >
            {measurements.length} ölçüm kaydı
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
        ) : (
          <>
            {/* Total change card */}
            <TotalChangeCard
              totalCm={totalCmDelta}
              measurementCount={measurements.length}
            />

            {/* Symmetry warnings */}
            {symmetryWarnings.map((w) => (
              <SymmetryWarning key={w.pair} text={w.text} />
            ))}

            {/* Metric selector */}
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

            {/* Pair side toggle */}
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

            {/* Chart card */}
            <ChartCard
              option={option}
              primary={primary}
              secondary={secondary}
              pairSide={pairSide}
            />

            {/* Last vs Now grid */}
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

      {/* Floating add button */}
      <Pressable
        onPress={() => setShowAddModal(true)}
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-sm bg-primary"
        style={{
          shadowColor: '#facc15',
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        }}
      >
        <Ionicons name="add" size={28} color="#3c2f00" />
      </Pressable>

      <AddMeasurementModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={async () => {
          setShowAddModal(false);
          await load();
        }}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
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
  // Card has px-5 on parent (20+20) + p-4 on card (16+16) → ~72px total. Chart needs spacing room.
  const chartWidth = Math.max(220, screenW - 88);

  const showPrimary =
    option.kind === 'single' || pairSide === 'both' || pairSide === 'left';
  const showSecondary =
    option.kind === 'pair' && (pairSide === 'both' || pairSide === 'right');

  const primaryData = showPrimary ? primary : [];
  const secondaryData = showSecondary ? secondary : [];

  const hasData =
    (primaryData.length >= 1 || secondaryData.length >= 1) &&
    [...primaryData, ...secondaryData].length > 0;

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
          spacing={Math.max(30, chartWidth / Math.max(primaryData.length || secondaryData.length, 4))}
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
// Add modal
// ─────────────────────────────────────────────────────────────────────────────

function AddMeasurementModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<Record<MetricKey, string>>(() =>
    METRICS.reduce(
      (acc, m) => {
        acc[m.key] = '';
        return acc;
      },
      {} as Record<MetricKey, string>,
    ),
  );
  const [saving, setSaving] = useState(false);

  const handleChange = (key: MetricKey, raw: string) => {
    // Normalize Turkish decimal comma → dot
    const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    setValues((prev) => ({ ...prev, [key]: cleaned }));
  };

  const reset = () => {
    setValues(
      METRICS.reduce(
        (acc, m) => {
          acc[m.key] = '';
          return acc;
        },
        {} as Record<MetricKey, string>,
      ),
    );
  };

  const handleSave = async () => {
    const payload: CreateBodyMeasurementPayload = {};
    let any = false;
    for (const m of METRICS) {
      const raw = values[m.key];
      if (!raw) continue;
      const num = parseFloat(raw);
      if (!Number.isFinite(num)) continue;
      (payload as any)[m.key] = num;
      any = true;
    }
    if (!any) {
      Alert.alert('Eksik veri', 'Kaydetmek için en az bir ölçüm girmelisin.');
      return;
    }
    try {
      setSaving(true);
      await createMeasurement(payload);
      reset();
      await onSaved();
    } catch (err: any) {
      Alert.alert(
        'Hata',
        err?.response?.data?.message ?? err?.message ?? 'Ölçüm kaydedilemedi.',
      );
    } finally {
      setSaving(false);
    }
  };

  const sections: { title: string; section: Section; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { title: 'Temel Metrikler', section: 'core', icon: 'speedometer-outline' },
    { title: 'Üst Vücut', section: 'upper', icon: 'body-outline' },
    { title: 'Alt Vücut', section: 'lower', icon: 'walk-outline' },
  ];

  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View className="flex-1 bg-background" style={{ paddingBottom: insets.bottom }}>
        {/* Header — manually padded with top inset so it never hides behind the notch/status bar */}
        <View
          className="border-b border-outline-variant bg-background"
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="h-10 w-10 items-center justify-center rounded-sm border border-outline-variant active:bg-surface-container"
            >
              <Ionicons name="close" size={20} color="#facc15" />
            </Pressable>
            <Text
              className="text-on-background"
              style={{ fontFamily: 'Lexend_700Bold', fontSize: 14, letterSpacing: 0.5 }}
            >
              YENİ ÖLÇÜM
            </Text>
            {/* Placeholder to balance the close button so the title stays perfectly centered */}
            <View className="h-10 w-10" />
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView contentContainerClassName="px-5 pb-8" keyboardShouldPersistTaps="handled">
            <Text
              className="mt-4 text-on-surface-variant"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
            >
              Sadece ölçtüğün metrikleri doldur. Boş bırakılan alanlar atlanır.
            </Text>

            {sections.map((s) => (
              <View
                key={s.section}
                className="mt-4 rounded-sm border border-outline-variant bg-surface-container p-4"
              >
                <View className="mb-3 flex-row items-center">
                  <Ionicons name={s.icon} size={18} color="#facc15" />
                  <Text
                    className="ml-2 text-on-background"
                    style={{ fontFamily: 'Lexend_700Bold', fontSize: 14 }}
                  >
                    {s.title}
                  </Text>
                </View>
                {METRICS.filter((m) => m.section === s.section).map((m) => (
                  <View key={m.key} className="mb-3 flex-row items-center">
                    <Text
                      className="w-28 text-on-background"
                      style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
                    >
                      {m.label}
                    </Text>
                    <TextInput
                      value={values[m.key]}
                      onChangeText={(t) => handleChange(m.key, t)}
                      placeholder="0"
                      placeholderTextColor="#6b6354"
                      keyboardType="decimal-pad"
                      className="flex-1 rounded-sm border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-background"
                      style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
                    />
                    <Text
                      className="ml-2 w-8 text-on-surface-variant"
                      style={{ fontFamily: 'Inter_500Medium', fontSize: 12 }}
                    >
                      {m.unit}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            <Pressable
              disabled={saving}
              onPress={handleSave}
              className="mt-6 flex-row items-center justify-center rounded-sm bg-primary py-4 active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? (
                <ActivityIndicator color="#3c2f00" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#000" />
                  <Text
                    className="ml-2 text-black"
                    style={{
                      fontFamily: 'Lexend_900Black',
                      fontSize: 13,
                      letterSpacing: 1,
                    }}
                  >
                    KAYDET
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  // measurements come oldest → newest. For each metric find first & last non-null entry.
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
  // Take latest non-null pair
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
          text: `Simetri uyarısı: ${p.label} ölçüleri arasında ${diff.toFixed(1)} cm fark var (${bigger} taraf daha büyük). Antrenmanda dengeyi kontrol et.`,
        });
      }
    }
  }
  return warnings;
}

// METRICS_BY_KEY is intentionally exported via re-import elsewhere if ever needed.
void METRICS_BY_KEY;
