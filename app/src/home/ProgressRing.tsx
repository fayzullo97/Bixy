import { Platform, StyleSheet, Text, View } from 'react-native';
import { status as statusTokens, text } from '../theme';

/**
 * The circular progress indicator (Part 07 §9) — the level card's "75%" ring on
 * the home screen, and the smaller per-tier badge in the All Levels grid.
 *
 * Drawn rather than imported: the design exports one SVG per state, but the ring
 * has to render an arbitrary percentage, which a fixed export can't. The
 * geometry (a stroked circle with a dash offset) is the same technique
 * `DoodleSvg` uses to draw a path in stroke by stroke.
 */
export function ProgressRing({
  percent,
  size = 48,
  showLabel = true,
}: {
  /** 0–100. Values outside the range are clamped rather than drawn wrong. */
  percent: number;
  size?: number;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = size <= 26 ? 2.6 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
        {showLabel ? <Text style={styles.fallbackText}>{pct}%</Text> : null}
      </View>
    );
  }

  return (
    <div
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label={`${pct}% complete`}
    >
      <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={statusTokens.track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={statusTokens.done}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      {showLabel ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size <= 26 ? 8 : 12,
            fontWeight: 600,
            letterSpacing: -0.4,
            color: text.strong,
          }}
        >
          {pct}%
        </span>
      ) : null}
    </div>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderWidth: 3,
    borderColor: statusTokens.done,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { fontSize: 10, fontWeight: '600', color: text.strong },
});
