// components/icons/VerifiedSeal.tsx
// "Verified / certified" seal: a code-generated multi-point star (crisp on all
// platforms) with a checkmark from the icon library centred on top.
// The previous traced SVG rendered badly, so the star is now computed.

import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

export const VERIFIED_GOLD = '#F4B400';

interface Props {
  size?: number;
  /** Solid star color. If omitted, a metallic gold gradient is used. */
  starColor?: string;
  /** Checkmark color (default white). */
  checkColor?: string;
}

/** Build a regular N-spike star path on a 1024×1024 canvas. */
function buildStar(spikes: number, outerR: number, innerR: number): string {
  const cx = 512;
  const cy = 512;
  const step = Math.PI / spikes;
  let rot = -Math.PI / 2;
  let d = '';
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerR;
    let y = cy + Math.sin(rot) * outerR;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    rot += step;
    x = cx + Math.cos(rot) * innerR;
    y = cy + Math.sin(rot) * innerR;
    d += `L${x.toFixed(1)},${y.toFixed(1)}`;
    rot += step;
  }
  return d + 'Z';
}

const STAR_PATH = buildStar(12, 500, 410);

export function VerifiedSeal({ size = 16, starColor, checkColor = '#FFFFFF' }: Props) {
  const useGradient = !starColor;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 1024 1024"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {useGradient ? (
          <Defs>
            <LinearGradient id="verifiedGold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FDE08A" />
              <Stop offset="0.45" stopColor="#F4B400" />
              <Stop offset="0.75" stopColor="#C87E0A" />
              <Stop offset="1" stopColor="#FBD24E" />
            </LinearGradient>
          </Defs>
        ) : null}
        <Path d={STAR_PATH} fill={useGradient ? 'url(#verifiedGold)' : starColor} />
      </Svg>
      <Ionicons name="checkmark-sharp" size={Math.round(size * 0.5)} color={checkColor} />
    </View>
  );
}

export default VerifiedSeal;
