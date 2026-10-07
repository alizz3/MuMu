// Ilustraciones originales en SVG: la vaquita, Leo (gato gris/blanco) y Negra (schnauzer negra).
// Los tres comparten el mismo lenguaje visual: contorno ciruela redondeado, ojos con brillo,
// cachetes rosados y proporciones "cabezonas".
export const INK = '#5B4A5E'
const PINK = '#F7B6C2', SNOUT = '#F9D0DA', BLUSH = '#F4A3B5', CREAM = '#FFF3E3', LAV = '#C3B3D4', HOT = '#EE8FAE'
const S = (w = 3.2, c = INK) => `stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`

const heart = (x, y, s = 1, c = PINK) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C-2 -2 -10 -2 -10 4 C-10 9 -4 12 0 16 C4 12 10 9 10 4 C10 -2 2 -2 0 4Z" fill="${c}"/>`
const sparkle = (x, y, s = 1, c = '#F6C76B') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -9 Q1.5 -1.5 9 0 Q1.5 1.5 0 9 Q-1.5 1.5 -9 0 Q-1.5 -1.5 0 -9Z" fill="${c}"/>`
const zzz = (x, y) => `<g fill="${LAV}" font-family="Poppins,sans-serif" font-weight="700"><text x="${x}" y="${y}" font-size="18">z</text><text x="${x + 14}" y="${y - 14}" font-size="14">z</text><text x="${x + 25}" y="${y - 26}" font-size="10">z</text></g>`

// ---------- piezas compartidas ----------
const eyesBy = (kind, lx, rx, y, dark = INK) => {
  const open = (x, dy = 0) => `<ellipse cx="${x}" cy="${y + dy}" rx="6.5" ry="8" fill="${dark}"/><circle cx="${x + 2.5}" cy="${y - 3 + dy}" r="2.6" fill="#fff"/><circle cx="${x - 2}" cy="${y + 3 + dy}" r="1.1" fill="#fff" opacity=".8"/>`
  switch (kind) {
    case 'happy': return [lx, rx].map((x) => `<path d="M${x - 7} ${y + 2} q7 -10 14 0" fill="none" ${S(3.4, dark)}/>`).join('')
    case 'closed': return [lx, rx].map((x) => `<path d="M${x - 7} ${y} q7 7 14 0" fill="none" ${S(3.2, dark)}/>`).join('')
    case 'tired': return [lx, rx].map((x) => `<ellipse cx="${x}" cy="${y + 3}" rx="6" ry="4.5" fill="${dark}"/><path d="M${x - 8} ${y} h16" ${S(3, dark)}/>`).join('')
    case 'up': return [lx, rx].map((x) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="8" fill="${dark}"/><circle cx="${x + 1}" cy="${y - 4.5}" r="2.8" fill="#fff"/>`).join('')
    case 'wink': return open(lx) + `<path d="M${rx - 7} ${y + 2} q7 -10 14 0" fill="none" ${S(3.4, dark)}/>`
    default: return open(lx) + open(rx)
  }
}

// ================= VAQUITA =================
function cowHead(eyes = 'open', mouth = 'smile') {
  const mouths = {
    smile: `<path d="M93 123 q7 6 14 0" fill="none" ${S(2.6)}/>`,
    open: `<path d="M91 120 q9 14 18 0 z" fill="${INK}"/><path d="M95 127 q5 4 10 0" fill="${HOT}"/>`,
    flat: `<path d="M94 124 h12" ${S(2.6)}/>`,
    wavy: `<path d="M92 124 q4 -3 8 0 q4 3 8 0" fill="none" ${S(2.4)}/>`,
    o: `<ellipse cx="100" cy="124" rx="4" ry="5" fill="${INK}"/>`,
  }
  return `
  <ellipse cx="40" cy="76" rx="21" ry="11" transform="rotate(-25 40 76)" fill="#fff" ${S()}/>
  <ellipse cx="42" cy="77" rx="12" ry="5.5" transform="rotate(-25 42 77)" fill="${PINK}"/>
  <ellipse cx="160" cy="76" rx="21" ry="11" transform="rotate(25 160 76)" fill="#fff" ${S()}/>
  <ellipse cx="158" cy="77" rx="12" ry="5.5" transform="rotate(25 158 77)" fill="${PINK}"/>
  <path d="M74 48 q-6 -16 6 -20 q5 9 2 20z" fill="${CREAM}" ${S(2.8)}/>
  <path d="M126 48 q6 -16 -6 -20 q-5 9 -2 20z" fill="${CREAM}" ${S(2.8)}/>
  <ellipse cx="100" cy="88" rx="60" ry="50" fill="#fff" ${S()}/>
  <path d="M126 45 q24 -2 29 24 q-12 9 -23 0 q-9 -9 -6 -24z" fill="${PINK}"/>
  <path d="M55 74 q3 -14 17 -10 q7 9 -1 16 q-11 5 -16 -6z" fill="${PINK}"/>
  <path d="M90 42 q2 -12 10 -6 q6 -9 12 1 q-4 6 -11 4 q-6 4 -11 1z" fill="${PINK}" ${S(2.4)}/>
  ${eyesBy(eyes, 78, 122, 88)}
  <ellipse cx="59" cy="104" rx="9" ry="5.5" fill="${BLUSH}" opacity=".55"/>
  <ellipse cx="141" cy="104" rx="9" ry="5.5" fill="${BLUSH}" opacity=".55"/>
  <ellipse cx="100" cy="114" rx="29" ry="17" fill="${SNOUT}" ${S(3)}/>
  <ellipse cx="90" cy="111" rx="3" ry="4" fill="${INK}" opacity=".7"/>
  <ellipse cx="110" cy="111" rx="3" ry="4" fill="${INK}" opacity=".7"/>
  ${mouths[mouth] || mouths.smile}`
}

function cowBody(arms = 'down') {
  const armsSvg = {
    down: `<ellipse cx="62" cy="148" rx="9" ry="14" transform="rotate(18 62 148)" fill="#fff" ${S()}/><ellipse cx="138" cy="148" rx="9" ry="14" transform="rotate(-18 138 148)" fill="#fff" ${S()}/>`,
    up: `<ellipse cx="54" cy="120" rx="9" ry="16" transform="rotate(-35 54 120)" fill="#fff" ${S()}/><ellipse cx="146" cy="120" rx="9" ry="16" transform="rotate(35 146 120)" fill="#fff" ${S()}/>`,
    front: `<ellipse cx="76" cy="150" rx="9" ry="13" transform="rotate(-40 76 150)" fill="#fff" ${S()}/><ellipse cx="124" cy="150" rx="9" ry="13" transform="rotate(40 124 150)" fill="#fff" ${S()}/>`,
    pray: `<path d="M92 132 q8 -12 16 0 q2 16 -8 20 q-10 -4 -8 -20z" fill="#fff" ${S()}/><path d="M100 124 v26" ${S(2)}/>`,
    none: '',
  }
  return `
  <ellipse cx="100" cy="190" rx="50" ry="6" fill="#000" opacity=".06"/>
  <path d="M140 162 q22 -2 22 -24" fill="none" ${S(3)}/><path d="M158 134 q8 -4 8 6 q-6 4 -8 -6z" fill="${PINK}" ${S(2.4)}/>
  <path d="M58 152 Q56 112 100 112 Q144 112 142 152 Q142 186 100 186 Q58 186 58 152Z" fill="#fff" ${S()}/>
  <path d="M116 138 q16 -6 20 9 q1 14 -13 13 q-12 -3 -7 -22z" fill="${PINK}"/>
  <ellipse cx="96" cy="162" rx="21" ry="15" fill="${CREAM}"/>
  <ellipse cx="80" cy="183" rx="14" ry="8" fill="#fff" ${S()}/><ellipse cx="80" cy="186" rx="9" ry="3.6" fill="${PINK}"/>
  <ellipse cx="120" cy="183" rx="14" ry="8" fill="#fff" ${S()}/><ellipse cx="120" cy="186" rx="9" ry="3.6" fill="${PINK}"/>
  ${armsSvg[arms] || ''}`
}

const ACC = {
  bow: `<g transform="translate(138 44) rotate(18)"><path d="M0 0 q-17 -13 -17 2 q0 13 17 -2z" fill="${HOT}" ${S(2.4)}/><path d="M0 0 q17 -13 17 2 q0 13 -17 -2z" fill="${HOT}" ${S(2.4)}/><circle r="4.5" fill="${HOT}" ${S(2.4)}/></g>`,
  headphones: `<path d="M44 84 q0 -64 56 -64 q56 0 56 64" fill="none" stroke="${LAV}" stroke-width="7" stroke-linecap="round"/><rect x="34" y="76" width="16" height="26" rx="7" fill="${HOT}" ${S(2.4)}/><rect x="150" y="76" width="16" height="26" rx="7" fill="${HOT}" ${S(2.4)}/>`,
  crown: `<g>${[64, 84, 104, 124].map((x, i) => `<circle cx="${x + 6}" cy="${44 - (i % 2) * 4}" r="7" fill="${['#F9C6D3', '#E8DDF5', '#FFE29A', '#C9E8D8'][i]}" ${S(2)}/><circle cx="${x + 6}" cy="${44 - (i % 2) * 4}" r="2.5" fill="#F6C76B"/>`).join('')}</g>`,
  santa: `<path d="M56 54 q40 -46 88 0z" fill="#E86A7D" ${S(2.6)}/><path d="M140 52 q20 -10 22 10" fill="none" stroke="#E86A7D" stroke-width="10" stroke-linecap="round"/><circle cx="164" cy="64" r="8" fill="#fff" ${S(2.4)}/><rect x="52" y="48" width="96" height="12" rx="6" fill="#fff" ${S(2.4)}/>`,
  cap: `<g transform="translate(100 40)"><path d="M-38 0 L0 -15 L38 0 L0 15z" fill="${INK}"/><path d="M-20 4 v12 q20 8 40 0 v-12" fill="${INK}"/><path d="M32 2 v20" stroke="${HOT}" stroke-width="3"/><circle cx="32" cy="24" r="4.5" fill="${HOT}"/></g>`,
  backpack: `<path d="M74 118 q-4 30 8 54" fill="none" stroke="${LAV}" stroke-width="7" stroke-linecap="round"/><path d="M126 118 q4 30 -8 54" fill="none" stroke="${LAV}" stroke-width="7" stroke-linecap="round"/>`,
}
const BACK = {
  backpack: `<rect x="48" y="122" width="104" height="58" rx="20" fill="${LAV}" ${S(3)}/>`,
}

const PROPS = {
  book: `<g transform="translate(100 154)"><path d="M-32 -12 q16 -8 32 2 q16 -10 32 -2 v26 q-16 -6 -32 3 q-16 -9 -32 -3z" fill="${LAV}" ${S(2.8)}/><path d="M-27 -9 q13 -5 25 2 v22 q-12 -6 -25 -2z M27 -9 q-13 -5 -25 2 v22 q12 -6 25 -2z" fill="#fff"/><path d="M0 -10 v28" ${S(2)}/></g>`,
  laptop: `<g transform="translate(100 160)"><rect x="-34" y="-30" width="68" height="40" rx="7" fill="#EDE5F7" ${S(2.8)}/>${heart(0, -16, 0.7, PINK)}<rect x="-42" y="8" width="84" height="10" rx="5" fill="#D9CCEC" ${S(2.8)}/></g>`,
  agenda: `<g transform="translate(100 158) rotate(-6)"><rect x="-26" y="-28" width="52" height="46" rx="6" fill="${PINK}" ${S(2.8)}/><rect x="-18" y="-20" width="36" height="8" rx="3" fill="#fff"/><path d="M-16 -2 h26 M-16 6 h18" ${S(2, '#fff')}/>${[-18, -8, 2, 12].map((x) => `<circle cx="${x}" cy="-28" r="2.5" fill="#fff" ${S(1.6)}/>`).join('')}<path d="M30 -24 l-10 34" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M30 -24 l-4 12" stroke="${LAV}" stroke-width="4" stroke-linecap="round"/></g>`,
  calc: `<g transform="translate(100 156)"><rect x="-20" y="-26" width="40" height="48" rx="7" fill="#BFD7F0" ${S(2.8)}/><rect x="-13" y="-19" width="26" height="11" rx="3" fill="#fff"/>${[-10, 0, 10].flatMap((x) => [2, 12].map((y) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff"/>`)).join('')}</g>`,
  coins: `<g transform="translate(150 166)">${[0, 1, 2].map((i) => `<ellipse cx="0" cy="${-i * 7}" rx="13" ry="5" fill="#F6D27B" ${S(2.2)}/>`).join('')}<text x="-4" y="-12" font-size="9" font-weight="700" fill="${INK}" font-family="Poppins">$</text></g>`,
  coffee: `<g transform="translate(118 152)"><rect x="-13" y="-14" width="26" height="27" rx="7" fill="${CREAM}" ${S(2.8)}/><path d="M13 -6 q11 0 11 8 q0 8 -11 8" fill="none" ${S(2.6)}/>${heart(0, -5, 0.5, PINK)}<path d="M-4 -22 q5 -6 0 -11 M5 -22 q5 -6 0 -11" fill="none" ${S(2.2, LAV)}/></g>`,
  dumbbell: `<g transform="translate(150 140) rotate(-30)"><rect x="-14" y="-3" width="28" height="6" rx="3" fill="${INK}"/><rect x="-22" y="-10" width="9" height="20" rx="4" fill="${HOT}" ${S(2.2)}/><rect x="13" y="-10" width="9" height="20" rx="4" fill="${HOT}" ${S(2.2)}/></g>`,
  headband: `<path d="M44 66 q56 -28 112 0" fill="none" stroke="${HOT}" stroke-width="8" stroke-linecap="round"/>`,
  heartBig: `<g transform="translate(100 140) scale(2.1)">${heart(0, -6, 1, HOT)}</g>`,
  flag: `<g transform="translate(140 120)"><path d="M0 0 v52" ${S(3)}/><path d="M0 2 h40 l-8 10 l8 10 h-40z" fill="${PINK}" ${S(2.4)}/><text x="5" y="17" font-size="10" font-weight="700" fill="${INK}" font-family="Poppins">5 min</text></g>`,
  pillow: `<ellipse cx="100" cy="182" rx="62" ry="12" fill="#E8DDF5" ${S(2.6)}/>`,
  nightcap: `<path d="M60 50 q30 -50 80 -10 q-6 4 -10 0 q-30 -20 -60 18z" fill="${LAV}" ${S(2.6)}/><circle cx="142" cy="38" r="7" fill="#fff" ${S(2.2)}/>`,
  bubble: `<circle cx="160" cy="40" r="5" fill="#EDE5F7" ${S(2)}/><circle cx="172" cy="24" r="8" fill="#EDE5F7" ${S(2)}/><g transform="translate(178 4)"><ellipse rx="18" ry="13" fill="#EDE5F7" ${S(2)}/><text x="-5" y="5" font-size="13" font-weight="700" fill="${INK}" font-family="Poppins">?</text></g>`,
  clock: `<g transform="translate(166 40)"><circle r="14" fill="#fff" ${S(2.4)}/><path d="M0 -8 v8 l6 4" fill="none" ${S(2.4)}/></g>`,
  sweat: `<path d="M150 62 q-6 10 0 14 q6 -4 0 -14z" fill="#BFD7F0" ${S(1.8)}/>`,
  confetti: [[30, 40, PINK], [170, 30, LAV], [20, 110, '#F6D27B'], [180, 100, '#B9DCCB'], [44, 20, '#BFD7F0'], [160, 8, HOT]].map(([x, y, c], i) => `<rect x="${x}" y="${y}" width="7" height="12" rx="2" fill="${c}" transform="rotate(${i * 35} ${x} ${y})"/>`).join(''),
}

const COW_POSES = {
  happy: { eyes: 'open', mouth: 'smile', arms: 'down', extra: heart(170, 60, 0.9) + heart(28, 50, 0.6, LAV) },
  sleep: { eyes: 'closed', mouth: 'flat', arms: 'front', back: PROPS.pillow, top: PROPS.nightcap, extra: zzz(150, 40), noAcc: true },
  study: { eyes: 'open', mouth: 'smile', arms: 'front', glasses: true, front: PROPS.book },
  read: { eyes: 'happy', mouth: 'smile', arms: 'front', glasses: true, front: PROPS.book, extra: heart(170, 40, 0.7) },
  laptop: { eyes: 'open', mouth: 'smile', arms: 'front', glasses: true, front: PROPS.laptop },
  agenda: { eyes: 'wink', mouth: 'smile', arms: 'front', front: PROPS.agenda, extra: sparkle(170, 50) },
  celebrate: { eyes: 'happy', mouth: 'open', arms: 'up', extra: PROPS.confetti + sparkle(176, 70, 1.1) },
  goal: { eyes: 'happy', mouth: 'open', arms: 'up', extra: PROPS.confetti + heart(100, 6, 1, HOT) },
  tired: { eyes: 'tired', mouth: 'wavy', arms: 'down', extra: PROPS.sweat },
  think: { eyes: 'up', mouth: 'o', arms: 'down', extra: PROPS.bubble },
  pray: { eyes: 'closed', mouth: 'smile', arms: 'pray', extra: sparkle(168, 42, 0.9) + sparkle(32, 56, 0.6, '#E8DDF5') },
  calc: { eyes: 'open', mouth: 'smile', arms: 'front', glasses: true, front: PROPS.calc },
  finance: { eyes: 'open', mouth: 'smile', arms: 'front', front: PROPS.calc, extra: PROPS.coins },
  grad: { eyes: 'happy', mouth: 'open', arms: 'up', top: ACC.cap, extra: sparkle(30, 60) + sparkle(172, 64, 0.8), noAcc: true },
  backpack: { eyes: 'open', mouth: 'smile', arms: 'down', back: BACK.backpack, front: ACC.backpack },
  exercise: { eyes: 'wink', mouth: 'open', arms: 'down', top: PROPS.headband, extra: PROPS.dumbbell + PROPS.sweat, noAcc: true },
  wait: { eyes: 'up', mouth: 'smile', arms: 'front', front: PROPS.heartBig, extra: PROPS.clock },
  motivate: { eyes: 'wink', mouth: 'open', arms: 'down', extra: PROPS.flag + sparkle(30, 50, 0.8) },
  hug: { eyes: 'happy', mouth: 'smile', arms: 'front', front: PROPS.heartBig, extra: heart(30, 50, 0.7, LAV) },
  coffee: { eyes: 'happy', mouth: 'smile', arms: 'front', front: PROPS.coffee },
}
export const COW_POSE_NAMES = Object.keys(COW_POSES)

export function cow(pose = 'happy', accessory = 'bow') {
  const p = COW_POSES[pose] || COW_POSES.happy
  const acc = !p.noAcc && accessory && ACC[accessory] ? ACC[accessory] : ''
  const accBack = !p.noAcc && accessory && BACK[accessory] ? BACK[accessory] : ''
  const accFront = accessory === 'backpack' && !p.noAcc ? ACC.backpack : ''
  const glasses = p.glasses ? `<g fill="#fff" fill-opacity=".25" stroke="${HOT}" stroke-width="3"><circle cx="78" cy="88" r="13"/><circle cx="122" cy="88" r="13"/></g><path d="M91 87 q9 -5 18 0" fill="none" stroke="${HOT}" stroke-width="3"/>` : ''
  return `${p.back || ''}${accBack}${cowBody(p.arms)}${accessory === 'backpack' ? '' : ''}${cowHead(p.eyes, p.mouth)}${glasses}${p.top || ''}${acc && accessory !== 'backpack' ? acc : ''}${accFront}${p.front || ''}${p.extra || ''}`
}

// ================= LEO (gato gris y blanco) =================
const GREY = '#D9D5E0', GREY_D = '#ABA4B6'
export function leo(pose = 'sit') {
  if (pose === 'sleep') {
    return `<ellipse cx="100" cy="186" rx="66" ry="6" fill="#000" opacity=".06"/>
    <path d="M150 168 q30 4 20 -24" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M150 168 q30 4 20 -24" fill="none" stroke="${GREY}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="108" cy="154" rx="62" ry="32" fill="${GREY}" ${S()}/>
    <ellipse cx="110" cy="166" rx="36" ry="14" fill="#fff"/>
    <path d="M44 112 L46 82 L70 102z" fill="${GREY}" ${S()}/><path d="M50 106 L51 90 L63 101z" fill="${PINK}"/>
    <path d="M104 106 L110 78 L124 104z" fill="${GREY}" ${S()}/><path d="M108 102 L111 88 L119 102z" fill="${PINK}"/>
    <ellipse cx="82" cy="132" rx="44" ry="34" fill="${GREY}" ${S()}/>
    <path d="M62 146 q20 -18 40 0 q-4 14 -20 14 q-16 0 -20 -14z" fill="#fff"/>
    <path d="M76 102 v8 M84 100 v10 M92 102 v8" ${S(3.4, GREY_D)}/>
    ${eyesBy('closed', 66, 98, 130)}
    <ellipse cx="54" cy="142" rx="7" ry="4" fill="${BLUSH}" opacity=".5"/><ellipse cx="110" cy="142" rx="7" ry="4" fill="${BLUSH}" opacity=".5"/>
    <path d="M78 142 l4 4 l4 -4z" fill="${HOT}"/>
    ${zzz(140, 96)}`
  }
  const happy = pose === 'happy'
  return `<ellipse cx="100" cy="190" rx="48" ry="6" fill="#000" opacity=".06"/>
  <path d="M138 172 q40 -6 30 -52" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M138 172 q40 -6 30 -52" fill="none" stroke="${GREY}" stroke-width="10" stroke-linecap="round"/>
  <path d="M60 154 Q58 116 100 116 Q142 116 140 154 Q140 186 100 186 Q60 186 60 154Z" fill="${GREY}" ${S()}/>
  <ellipse cx="100" cy="160" rx="22" ry="20" fill="#fff"/>
  <ellipse cx="82" cy="183" rx="13" ry="7" fill="#fff" ${S()}/><ellipse cx="118" cy="183" rx="13" ry="7" fill="#fff" ${S()}/>
  <path d="M50 70 L56 26 L86 52z" fill="${GREY}" ${S()}/><path d="M57 62 L60 38 L76 54z" fill="${PINK}"/>
  <path d="M150 70 L144 26 L114 52z" fill="${GREY}" ${S()}/><path d="M143 62 L140 38 L124 54z" fill="${PINK}"/>
  <ellipse cx="100" cy="92" rx="56" ry="46" fill="${GREY}" ${S()}/>
  <path d="M66 112 q0 -26 34 -26 q34 0 34 26 q0 24 -34 24 q-34 0 -34 -24z" fill="#fff"/>
  <path d="M90 50 v12 M100 48 v14 M110 50 v12" ${S(3.6, GREY_D)}/>
  ${eyesBy(happy ? 'happy' : 'open', 80, 120, 92)}
  <ellipse cx="62" cy="108" rx="8" ry="5" fill="${BLUSH}" opacity=".55"/><ellipse cx="138" cy="108" rx="8" ry="5" fill="${BLUSH}" opacity=".55"/>
  <path d="M95 104 h10 l-5 6z" fill="${HOT}" ${S(1.6)}/>
  <path d="M100 110 v4 q-5 5 -10 1 M100 114 q5 5 10 1" fill="none" ${S(2.4)}/>
  <path d="M60 106 l-20 -3 M60 113 l-20 3 M140 106 l20 -3 M140 113 l20 3" ${S(1.8, GREY_D)}/>
  ${happy ? heart(166, 52, 0.7) : ''}`
}

// ================= NEGRA (schnauzer negra) =================
const BLK = '#3E3644', BLK_S = '#2A222E', GR = '#AFA7B6'
export function negra(pose = 'sit') {
  const eye = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="7.5" fill="#1C161F" stroke="#6E6475" stroke-width="1.5"/><circle cx="${x + 2.4}" cy="${y - 3}" r="2.6" fill="#fff"/><circle cx="${x - 2}" cy="${y + 3}" r="1.1" fill="#fff" opacity=".8"/>`
  if (pose === 'sleep') {
    return `<ellipse cx="100" cy="186" rx="66" ry="6" fill="#000" opacity=".06"/>
    <ellipse cx="110" cy="156" rx="62" ry="30" fill="${BLK}" ${S(3, BLK_S)}/>
    <ellipse cx="80" cy="134" rx="44" ry="34" fill="${BLK}" ${S(3, BLK_S)}/>
    <path d="M44 116 q-12 -22 10 -30 q14 8 8 30z" fill="${BLK}" ${S(3, BLK_S)}/>
    <path d="M58 122 q8 -6 16 0 M86 122 q8 -6 16 0" fill="none" stroke="${GR}" stroke-width="5" stroke-linecap="round"/>
    <path d="M58 130 q7 6 14 0 M88 130 q7 6 14 0" fill="none" ${S(3, '#EDE6F2')}/>
    <path d="M58 142 q22 -8 44 0 q2 22 -22 24 q-24 -2 -22 -24z" fill="${GR}" ${S(2.6, BLK_S)}/>
    <ellipse cx="80" cy="142" rx="6" ry="4.5" fill="#1C161F"/>
    <path d="M58 158 q22 12 44 0" stroke="${PINK}" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${zzz(140, 100)}`
  }
  const happy = pose === 'happy'
  return `<ellipse cx="100" cy="190" rx="48" ry="6" fill="#000" opacity=".06"/>
  <path d="M136 150 q14 -10 12 -26" fill="none" stroke="${BLK_S}" stroke-width="13" stroke-linecap="round"/><path d="M136 150 q14 -10 12 -26" fill="none" stroke="${BLK}" stroke-width="8" stroke-linecap="round"/>
  <path d="M60 154 Q58 116 100 116 Q142 116 140 154 Q140 186 100 186 Q60 186 60 154Z" fill="${BLK}" ${S(3, BLK_S)}/>
  <path d="M84 132 q16 30 32 0 q-2 22 -16 26 q-14 -4 -16 -26z" fill="${GR}" opacity=".85"/>
  <ellipse cx="82" cy="183" rx="13" ry="7" fill="${BLK}" ${S(3, BLK_S)}/><ellipse cx="118" cy="183" rx="13" ry="7" fill="${BLK}" ${S(3, BLK_S)}/>
  <path d="M44 66 q-10 -32 22 -32 q12 14 4 40 q-16 6 -26 -8z" fill="${BLK}" ${S(3, BLK_S)}/>
  <path d="M156 66 q10 -32 -22 -32 q-12 14 -4 40 q16 6 26 -8z" fill="${BLK}" ${S(3, BLK_S)}/>
  <ellipse cx="100" cy="90" rx="54" ry="46" fill="${BLK}" ${S(3, BLK_S)}/>
  <path d="M66 76 q12 -14 28 -2" fill="none" stroke="${GR}" stroke-width="7" stroke-linecap="round"/><path d="M134 76 q-12 -14 -28 -2" fill="none" stroke="${GR}" stroke-width="7" stroke-linecap="round"/>
  ${happy ? `<path d="M73 92 q7 -9 14 0 M113 92 q7 -9 14 0" fill="none" ${S(3.4, '#EDE6F2')}/>` : eye(80, 90) + eye(120, 90)}
  <ellipse cx="62" cy="106" rx="8" ry="5" fill="${BLUSH}" opacity=".45"/><ellipse cx="138" cy="106" rx="8" ry="5" fill="${BLUSH}" opacity=".45"/>
  <path d="M70 106 q30 -16 60 0 q6 34 -30 38 q-36 -4 -30 -38z" fill="${GR}" ${S(2.6, BLK_S)}/>
  <path d="M80 122 l-4 10 M90 126 l-2 10 M110 126 l2 10 M120 122 l4 10" ${S(2, '#8F8797')}/>
  <ellipse cx="100" cy="106" rx="9" ry="6.5" fill="#1C161F"/><ellipse cx="97" cy="104" rx="3" ry="1.8" fill="#fff" opacity=".7"/>
  ${happy ? `<path d="M94 124 q6 12 12 0z" fill="${HOT}" ${S(1.8, BLK_S)}/>` : `<path d="M94 122 q6 4 12 0" fill="none" ${S(2.2, BLK_S)}/>`}
  <path d="M68 136 q32 16 64 0" stroke="${PINK}" stroke-width="7" fill="none" stroke-linecap="round"/>
  <circle cx="100" cy="146" r="5" fill="#F6D27B" ${S(1.8)}/>
  ${happy ? heart(166, 52, 0.7) : ''}`
}

export const ART = { cow, leo, negra, heart, sparkle }
