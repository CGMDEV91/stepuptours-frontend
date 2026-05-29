// components/chat/ChatBackground.tsx
// WhatsApp-style tiled doodle background for chat screens.
// Travel-themed line icons (globe, paper plane, map pin, compass, camera,
// mountain) drawn with react-native-svg as a repeating pattern. Works on
// web and native. Sits behind the (transparent) message thread.

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path, Circle, G } from 'react-native-svg';

// Doodles are authored on a 230-unit grid, then scaled down (SCALE) and packed
// into a smaller tile so the icons render smaller AND appear more frequently.
const SCALE = 0.5;
const TILE = 130;
const STROKE = '#D8DDE4';
// Stroke scales with the group transform, so author it larger to land ~1.5px.
const STROKE_WIDTH = 3;
const OPACITY = 0.8;

interface Props {
  /** Base fill behind the doodles. Defaults to a faint cool tint. */
  baseColor?: string;
}

export function ChatBackground({ baseColor = '#F6F7F9' }: Props) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id="travelDoodles"
          patternUnits="userSpaceOnUse"
          width={TILE}
          height={TILE}
        >
          {/* Base tint */}
          <Rect x={0} y={0} width={TILE} height={TILE} fill={baseColor} />

          <G transform={`scale(${SCALE})`} stroke={STROKE} strokeWidth={STROKE_WIDTH} fill="none" opacity={OPACITY} strokeLinejoin="round" strokeLinecap="round">
            {/* Globe (top-left) */}
            <Circle cx={45} cy={45} r={17} />
            <Path d="M45 28 C36 34 36 56 45 62 C54 56 54 34 45 28" />
            <Path d="M28 45 H62" />
            <Path d="M31 37 C38 41 52 41 59 37" />
            <Path d="M31 53 C38 49 52 49 59 53" />

            {/* Paper plane (top-right) */}
            <Path d="M151 50 L189 35 L173 63 L168 52 Z" />
            <Path d="M168 52 L189 35" />

            {/* Map pin (right) */}
            <Path d="M200 134 C191 134 184 141 184 150 C184 162 200 176 200 176 C200 176 216 162 216 150 C216 141 209 134 200 134 Z" />
            <Circle cx={200} cy={149} r={5} />

            {/* Compass (left) */}
            <Circle cx={55} cy={160} r={16} />
            <Path d="M55 148 L61 165 L55 159 L49 165 Z" />

            {/* Camera (center-bottom) */}
            <Rect x={120} y={108} width={40} height={28} rx={5} />
            <Path d="M130 108 l3 -5 h10 l3 5" />
            <Circle cx={140} cy={122} r={8} />

            {/* Mountain (bottom) */}
            <Path d="M126 214 L142 188 L152 202 L160 192 L176 214 Z" />
          </G>
        </Pattern>
      </Defs>

      <Rect x={0} y={0} width="100%" height="100%" fill="url(#travelDoodles)" />
    </Svg>
  );
}
