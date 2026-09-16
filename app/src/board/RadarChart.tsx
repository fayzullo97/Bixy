import { Platform, View } from 'react-native';
import type { Answered } from './levelCheck';
import { polygonPoints, spokePoint, spokes } from './radar';
import { sky } from '../theme';

/**
 * The level test's radar chart (Part 07 §12) — a sector per CEFR tier that grows
 * as questions are answered, so the student sees where they're landing while the
 * test runs.
 *
 * Display only: it reads the same answer history the placement algorithm reads
 * and never influences it (§12).
 */
export function RadarChart({ answered, size = 240 }: { answered: readonly Answered[]; size?: number }) {
  if (Platform.OS !== 'web') return <View style={{ height: size }} />;

  const cx = size / 2;
  const cy = size / 2;
  // Leaves room for the tier labels sitting just outside the outer ring.
  const radius = size / 2 - 26;
  const data = spokes(answered);
  const rings = [0.33, 0.66, 1];

  return (
    <svg width={size} height={size} role="img" aria-label="Your level so far" style={{ display: 'block' }}>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={polygonPoints(data.map(() => ring), radius, cx, cy)}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.55}
          strokeWidth={1}
        />
      ))}

      {data.map((spoke, i) => {
        const end = spokePoint(i, data.length, 1, radius, cx, cy);
        return (
          <line
            key={spoke.level}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="#FFFFFF"
            strokeOpacity={0.55}
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={polygonPoints(data.map((s) => s.value), radius, cx, cy)}
        fill="#7D52F4"
        fillOpacity={0.28}
        stroke="#7D52F4"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {data.map((spoke, i) => {
        const at = spokePoint(i, data.length, 1.18, radius, cx, cy);
        // The tier currently carrying answers is the one worth calling out.
        const active = spoke.total > 0;
        return (
          <text
            key={spoke.level}
            x={at.x}
            y={at.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={13}
            fontWeight={active ? 700 : 500}
            fill={active ? '#7D52F4' : sky.hint}
            fillOpacity={active ? 1 : 0.65}
          >
            {spoke.level}
          </text>
        );
      })}
    </svg>
  );
}

