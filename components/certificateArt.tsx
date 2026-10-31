import { useId } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText, TextPath } from 'react-native-svg'

// Everything on the printed certificates that used to be a cropped scan —
// corner scrollwork, the cross-and-dove arch, the parish seal and crest — is
// drawn here as vector art instead, so it stays crisp at any size and in the
// downloaded PNG.

const INK_NAVY = '#1b245f'
const RING_FONT = Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif', default: 'Arial, Helvetica, sans-serif' })

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function pts(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
}

// Baseline radii of the two lettering rings. Upper text runs clockwise, so its
// glyphs grow outward from the baseline; lower text runs counter-clockwise (to
// stay upright), so its glyphs grow inward. Hence the lower baseline is the
// larger radius — both lines then sit in the band between the ring strokes.
const TOP_R = 71
const BOTTOM_R = 87

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, clockwise: boolean): string {
  const [x1, y1] = polar(cx, cy, r, fromDeg)
  const [x2, y2] = polar(cx, cy, r, toDeg)
  const sweep = Math.abs(toDeg - fromDeg)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} ${clockwise ? 1 : 0} ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// Largest font size (capped) at which `text` still fits ~90% of the arc.
// Bold capitals average roughly 0.72em wide, plus the 1-unit letter spacing.
function fitFontSize(text: string, r: number, sweepDeg: number): number {
  const arcLength = (sweepDeg * Math.PI * r) / 180
  return Math.min(15, Math.max(5, ((arcLength * 0.9) / Math.max(text.length, 1) - 1) / 0.72))
}

// Jerusalem cross: one large cross with a small cross in each quadrant.
function JerusalemCross({ cx, cy, size, color }: { cx: number; cy: number; size: number; color: string }) {
  const u = size / 100
  const x = (v: number) => cx + (v - 50) * u
  const y = (v: number) => cy + (v - 50) * u
  const bar = (l: number, t: number, w: number, h: number) => <Rect key={`${l}-${t}-${w}-${h}`} x={x(l)} y={y(t)} width={w * u} height={h * u} fill={color} />
  const small = (sx: number, sy: number) => [bar(sx - 9, sy - 2.5, 18, 5), bar(sx - 2.5, sy - 9, 5, 18)]
  return (
    <G>
      {bar(14, 43, 72, 14)}
      {bar(43, 14, 14, 72)}
      {/* Cross-bars at the four ends of the large cross */}
      {bar(14, 36, 5, 28)}
      {bar(81, 36, 5, 28)}
      {bar(36, 14, 28, 5)}
      {bar(36, 81, 28, 5)}
      {small(28, 28)}
      {small(72, 28)}
      {small(28, 72)}
      {small(72, 72)}
    </G>
  )
}

/**
 * Round church seal: lettering around a ring, a pentagon with a star, and a
 * Jerusalem cross in the middle — the shape of the ELCSA emblem. `topText`
 * runs along the upper arc, `bottomText` along the lower one.
 */
export function RoundSeal({
  size,
  color,
  topText,
  bottomText,
  filled = true,
  topSweep = 240,
}: {
  size: number
  color: string
  topText: string
  bottomText: string
  // Solid pentagon (the church crest) vs. an outline-only stamp.
  filled?: boolean
  // Degrees of the ring the upper lettering runs along; the lower lettering
  // gets what's left (minus a small gap at each end).
  topSweep?: number
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const topId = `top${id}`
  const botId = `bot${id}`
  const cx = 100
  const cy = 100
  const penta: [number, number][] = [0, 1, 2, 3, 4].map((i) => polar(cx, cy, 56, -90 + i * 72))
  const star: [number, number][] = []
  for (let i = 0; i < 10; i++) star.push(polar(cx, cy, i % 2 === 0 ? 47 : 20, -90 + i * 36))
  const paper = '#ffffff'
  const botSweep = 340 - topSweep
  const topSize = fitFontSize(topText, TOP_R, topSweep)
  const botSize = fitFontSize(bottomText, BOTTOM_R, botSweep)
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <Path id={topId} d={arcPath(cx, cy, TOP_R, -90 - topSweep / 2, -90 + topSweep / 2, true)} />
        <Path id={botId} d={arcPath(cx, cy, BOTTOM_R, 90 + botSweep / 2, 90 - botSweep / 2, false)} />
      </Defs>
      <Circle cx={cx} cy={cy} r={97} fill="none" stroke={color} strokeWidth={3.5} />
      <Circle cx={cx} cy={cy} r={64} fill="none" stroke={color} strokeWidth={1.8} />
      <SvgText fill={color} fontFamily={RING_FONT} fontSize={topSize} fontWeight="bold" textAnchor="middle" letterSpacing={1}>
        <TextPath href={`#${topId}`} startOffset="50%">
          {topText}
        </TextPath>
      </SvgText>
      <SvgText fill={color} fontFamily={RING_FONT} fontSize={botSize} fontWeight="bold" textAnchor="middle" letterSpacing={1}>
        <TextPath href={`#${botId}`} startOffset="50%">
          {bottomText}
        </TextPath>
      </SvgText>
      <Polygon points={pts(penta)} fill={filled ? color : 'none'} stroke={color} strokeWidth={filled ? 0 : 2.5} strokeLinejoin="round" />
      <Polygon points={pts(star)} fill={filled ? paper : 'none'} stroke={filled ? 'none' : color} strokeWidth={1.8} strokeLinejoin="round" />
      <JerusalemCross cx={cx} cy={cy + 2} size={34} color={color} />
    </Svg>
  )
}

/**
 * One corner of the certificate's scrollwork frame, drawn for the top-left;
 * the frame mirrors it into the other three corners.
 */
export function CornerFlourish({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        {/* Corner bracket: heavy outer rule, fine inner rule */}
        <Path d="M3 64 V3 H64" strokeWidth={3} />
        <Path d="M10 58 V10 H58" strokeWidth={1} />
        {/* Two mirrored volutes meeting at the corner */}
        <Path d="M14 14 C44 12 56 30 44 42 C35 50 22 44 27 34 C30 28 38 31 36 36" strokeWidth={2} />
        <Path d="M14 14 C12 44 30 56 42 44 C50 35 44 22 34 27 C28 30 31 38 36 36" strokeWidth={2} />
        {/* Tendrils off each volute */}
        <Path d="M44 42 C54 40 62 46 60 54" strokeWidth={1.4} />
        <Path d="M42 44 C40 54 46 62 54 60" strokeWidth={1.4} />
        <Path d="M30 22 C34 14 44 10 52 14" strokeWidth={1.2} />
        <Path d="M22 30 C14 34 10 44 14 52" strokeWidth={1.2} />
      </G>
      {/* Leaves along the two arms */}
      <G fill={color}>
        <Path d="M66 3 C72 -2 82 -2 88 3 C82 9 72 9 66 3 Z" transform="translate(0 6)" />
        <Path d="M3 66 C-2 72 -2 82 3 88 C9 82 9 72 3 66 Z" transform="translate(6 0)" />
        <Circle cx={22} cy={22} r={2.6} />
        <Circle cx={94} cy={9} r={2} />
        <Circle cx={9} cy={94} r={2} />
        <Circle cx={60} cy={54} r={1.8} />
        <Circle cx={54} cy={60} r={1.8} />
      </G>
    </Svg>
  )
}

/**
 * League emblem: the Luther rose on a navy disc with the league's name
 * lettered round the edge — the form of the Prayer Youth badge on the paper
 * certificate, drawn so it works for any league.
 */
export function LeagueEmblem({ size, label }: { size: number; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const arc = `emb${id}`
  const text = label.toUpperCase()
  const fontSize = Math.min(15, Math.max(7, ((Math.PI * 78 * 0.62 * 0.9) / Math.max(text.length, 1) - 0.5) / 0.72))
  const cx = 100
  const cy = 100
  const petals = [0, 1, 2, 3, 4].map((i) => polar(cx, cy, 25, -90 + i * 72))
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <Path id={arc} d={arcPath(cx, cy, 75, -90 - 112, -90 + 112, true)} />
      </Defs>
      <Circle cx={cx} cy={cy} r={97} fill={INK_NAVY} />
      <Circle cx={cx} cy={cy} r={90} fill="none" stroke="#ffffff" strokeWidth={1.5} />
      <SvgText fill="#ffffff" fontFamily={RING_FONT} fontSize={fontSize} fontWeight="bold" textAnchor="middle" letterSpacing={0.5}>
        <TextPath href={`#${arc}`} startOffset="50%">
          {text}
        </TextPath>
      </SvgText>
      <Circle cx={cx} cy={cy} r={56} fill="#e0b32a" />
      <Circle cx={cx} cy={cy} r={52} fill={INK_NAVY} />
      {petals.map(([px, py], i) => (
        <Circle key={i} cx={px} cy={py} r={19} fill="#ffffff" />
      ))}
      <Circle cx={cx} cy={cy} r={30} fill="#ffffff" />
      <Path d="M100 126 C70 106 72 78 90 78 C96 78 100 83 100 87 C100 83 104 78 110 78 C128 78 130 106 100 126 Z" fill="#c8102e" />
      <Path d="M100 87 V114 M91 96 H109" stroke="#111111" strokeWidth={4.5} strokeLinecap="round" />
    </Svg>
  )
}

/** Small ornament set into the middle of the frame's top and bottom edges. */
export function EdgeOrnament({ width, color }: { width: number; color: string }) {
  return (
    <Svg width={width} height={width * 0.2} viewBox="0 0 120 24">
      <G fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}>
        <Path d="M60 12 C54 2 40 2 36 10 C33 16 40 19 43 15 C45 12 41 10 40 12" />
        <Path d="M60 12 C66 2 80 2 84 10 C87 16 80 19 77 15 C75 12 79 10 80 12" />
        <Path d="M36 10 C26 8 18 12 8 12" />
        <Path d="M84 10 C94 8 102 12 112 12" />
      </G>
      <G fill={color}>
        <Path d="M60 5 L64 12 L60 19 L56 12 Z" />
        <Circle cx={5} cy={12} r={2} />
        <Circle cx={115} cy={12} r={2} />
      </G>
    </Svg>
  )
}

// An outlined leaf with a centre vein, pointing along +x from (x, y), turned by `rot` degrees.
function Leaf({ x, y, rot, len = 14 }: { x: number; y: number; rot: number; len?: number }) {
  const l = len
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot})`}>
      <Path d={`M0 0 C${l * 0.3} ${-l * 0.4} ${l * 0.75} ${-l * 0.34} ${l} 0 C${l * 0.75} ${l * 0.34} ${l * 0.3} ${l * 0.4} 0 0 Z`} strokeWidth={1.1} />
      <Path d={`M0 0 L${l * 0.82} 0`} strokeWidth={0.7} />
    </G>
  )
}

// One upper-corner vine of the baptism arch: a stem that sweeps in from the
// corner and winds into a spiral, with leaves and a berry along it.
function Vine() {
  return (
    <G>
      <Path d="M24 27 C46 28 64 34 76 46 C86 56 80 72 66 70 C55 68 54 54 63 52 C70 50 72 59 66 60" strokeWidth={1.6} />
      <Path d="M30 27 C34 40 30 52 22 58" strokeWidth={1.2} />
      <Leaf x={40} y={29} rot={-28} len={13} />
      <Leaf x={52} y={33} rot={18} len={14} />
      <Leaf x={66} y={40} rot={52} len={14} />
      <Leaf x={31} y={40} rot={92} len={12} />
      <Circle cx={22} cy={58} r={2.4} />
    </G>
  )
}

/** Cross with a descending dove under an arch of vine scrollwork (baptism). */
export function BaptismArch({ width, color }: { width: number; color: string }) {
  const height = width * 0.5
  const ink = color
  return (
    <Svg width={width} height={height} viewBox="0 0 320 160">
      <G fill="none" stroke={ink} strokeLinecap="round" strokeLinejoin="round">
        {/* Frame: posts and lintel, with the arched opening inside */}
        <Path d="M10 150 V12 H310 V150" strokeWidth={2.6} />
        <Path d="M20 150 V22 H300 V150" strokeWidth={1} />
        <Path d="M34 150 V92 C34 30 286 30 286 92 V150" strokeWidth={1.8} />
        {/* Vine scrollwork filling the two upper corners (left drawn, right mirrored) */}
        <G>
          <Vine />
        </G>
        <G transform="translate(320 0) scale(-1 1)">
          <Vine />
        </G>
        {/* Small corner blocks at the foot of each post */}
        <Rect x={4} y={124} width={32} height={32} strokeWidth={2} />
        <Rect x={284} y={124} width={32} height={32} strokeWidth={2} />
        <Path d="M12 132 L28 148 M28 132 L12 148" strokeWidth={1.2} />
        <Circle cx={300} cy={140} r={9} strokeWidth={1.2} />
        <Circle cx={300} cy={140} r={3.5} strokeWidth={1.2} />
      </G>
      {/* Cross */}
      <G fill="#ffffff" stroke={ink} strokeWidth={2} strokeLinejoin="round">
        <Path d="M148 62 H172 V96 H212 V120 H172 V152 H148 V120 H108 V96 H148 Z" />
      </G>
      {/* Rays behind the dove */}
      <G stroke={ink} strokeWidth={1.4} strokeLinecap="round">
        {[-60, -35, -10, 10, 35, 60].map((deg) => {
          const [x1, y1] = polar(160, 62, 24, -90 + deg)
          const [x2, y2] = polar(160, 62, 36, -90 + deg)
          return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
      </G>
      {/* Dove: wings spread along the cross-arm, head up, tail down the shaft */}
      <G fill="#ffffff" stroke={ink} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
        <Path d="M160 100 C148 80 126 76 104 88 C114 88 120 92 124 98 C116 98 112 104 112 108 C120 104 128 106 132 110 C128 114 126 120 130 124 C142 122 152 114 160 104 Z" />
        <Path d="M160 100 C172 80 194 76 216 88 C206 88 200 92 196 98 C204 98 208 104 208 108 C200 104 192 106 188 110 C192 114 194 120 190 124 C178 122 168 114 160 104 Z" />
        <Ellipse cx={160} cy={96} rx={9} ry={20} />
        <Circle cx={160} cy={72} r={7} />
        <Path d="M154 126 L160 148 L166 126" />
      </G>
      <G fill={ink}>
        <Path d="M153 71 L146 73 L153 75 Z" />
        <Circle cx={162} cy={70.5} r={1.3} />
      </G>
      <G stroke={ink} strokeWidth={1}>
        <Line x1={120} y1={96} x2={146} y2={100} />
        <Line x1={200} y1={96} x2={174} y2={100} />
      </G>
    </Svg>
  )
}

/**
 * The ornamental border: fine double rule, scrollwork corners, and an
 * ornament in the middle of the top and bottom edges. Sits behind the
 * certificate's content and ignores touches.
 */
export function CertificateFrame({ color, inset = 6 }: { color: string; inset?: number }) {
  const corner = 74
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.ruleOuter, { top: inset, bottom: inset, left: inset, right: inset, borderColor: color }]} />
      <View style={[styles.ruleInner, { top: inset + 6, bottom: inset + 6, left: inset + 6, right: inset + 6, borderColor: color }]} />
      <View style={{ position: 'absolute', top: inset - 4, left: inset - 4 }}>
        <CornerFlourish size={corner} color={color} />
      </View>
      <View style={{ position: 'absolute', top: inset - 4, right: inset - 4, transform: [{ scaleX: -1 }] }}>
        <CornerFlourish size={corner} color={color} />
      </View>
      <View style={{ position: 'absolute', bottom: inset - 4, left: inset - 4, transform: [{ scaleY: -1 }] }}>
        <CornerFlourish size={corner} color={color} />
      </View>
      <View style={{ position: 'absolute', bottom: inset - 4, right: inset - 4, transform: [{ scale: -1 }] }}>
        <CornerFlourish size={corner} color={color} />
      </View>
      <View style={[styles.edge, { top: inset - 8 }]}>
        <EdgeOrnament width={90} color={color} />
      </View>
      <View style={[styles.edge, { bottom: inset - 8 }]}>
        <EdgeOrnament width={90} color={color} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  ruleOuter: { position: 'absolute', borderWidth: 1.5 },
  ruleInner: { position: 'absolute', borderWidth: 0.75 },
  edge: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
})

/** A fine rule with a small diamond in the middle, to divide sections. */
export function OrnamentRule({ width, color }: { width: number; color: string }) {
  return (
    <Svg width={width} height={12} viewBox="0 0 200 12">
      <G stroke={color} strokeWidth={1} strokeLinecap="round">
        <Line x1={4} y1={6} x2={86} y2={6} />
        <Line x1={114} y1={6} x2={196} y2={6} />
      </G>
      <G fill={color}>
        <Path d="M100 1 L106 6 L100 11 L94 6 Z" />
        <Circle cx={88} cy={6} r={1.6} />
        <Circle cx={112} cy={6} r={1.6} />
      </G>
    </Svg>
  )
}

/**
 * Confirmation emblem: three flames of the Holy Spirit over a cross, inside a
 * wreath. The paper certificates have no confirmation artwork, so this is
 * original, in the same line-art style as the baptism arch.
 */
export function ConfirmationEmblem({ width, color, leaf, flame }: { width: number; color: string; leaf: string; flame: string }) {
  const cx = 80
  const cy = 84
  const R = 54
  const leaves = (side: -1 | 1) =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      // Sweep up each side of the circle from the bottom, leaves pointing along the branch.
      const deg = 98 + i * 17
      const a = side === -1 ? deg : 180 - deg
      const [x, y] = polar(cx, cy, R, a)
      const tangent = a + (side === -1 ? 90 : -90)
      return <Ellipse key={`${side}-${i}`} cx={x} cy={y} rx={7.5} ry={3.1} fill={leaf} fillOpacity={0.85} transform={`rotate(${tangent + (i % 2 ? 22 : -22)} ${x} ${y})`} />
    })
  const flameAt = (x: number, y: number, h: number, fill: string) => (
    <Path d={`M${x} ${y} C${x - h * 0.3} ${y - h * 0.3} ${x - h * 0.18} ${y - h * 0.7} ${x} ${y - h} C${x + h * 0.18} ${y - h * 0.7} ${x + h * 0.3} ${y - h * 0.3} ${x} ${y} Z`} fill={fill} />
  )
  return (
    <Svg width={width} height={width * (116 / 160)} viewBox="0 24 160 116">
      <G fill="none" stroke={leaf} strokeWidth={1.2} strokeLinecap="round">
        <Path d={arcPath(cx, cy, R, 98, 98 + 7 * 17, true)} />
        <Path d={arcPath(cx, cy, R, 82, 82 - 7 * 17, false)} />
      </G>
      {leaves(-1)}
      {leaves(1)}
      <Path d="M74 58 H86 V74 H102 V86 H86 V116 H74 V86 H58 V74 H74 Z" fill={color} />
      {flameAt(80, 54, 26, flame)}
      {flameAt(60, 70, 17, flame)}
      {flameAt(100, 70, 17, flame)}
      <Circle cx={80} cy={80} r={2.2} fill="#ffffff" />
    </Svg>
  )
}
