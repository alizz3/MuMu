// Cuartos de la casita (además del dormitorio), ropita y juguetes de Leo y Negra, y su cuidado tipo "Talking Tom".
// Todo se dibuja en SVG con el mismo trazo de la vaquita. Nada se compra con dinero real.
import { cow, leo, negra, INK } from '../components/art'

const S = (w = 2.6, c = INK) => `stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`
const PINK = '#F7B6C2', LAV = '#C3B3D4', HOT = '#EE8FAE', LEAF = '#9CCFB4', LEAF_D = '#78B596', BUTTER = '#FFE29A', SKY = '#BFD7F0', WOOD = '#E8C7AE', WOOD_D = '#D4A985'
const heart = (x, y, s = 1, c = HOT) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C-2 -2 -10 -2 -10 4 C-10 9 -4 12 0 16 C4 12 10 9 10 4 C10 -2 2 -2 0 4Z" fill="${c}"/>`
const flower = (x, y, c = HOT, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-5" rx="3.6" ry="5" fill="${c}" transform="rotate(${a})"/>`).join('')}<circle r="3" fill="${BUTTER}"/></g>`

// ---------- Cuartos ----------
export const ROOMS = [
  { id: 'dormitorio', name: 'Dormitorio', icon: 'bed', price: 0 },
  { id: 'cocina', name: 'Cocina', icon: 'pan', price: 200 },
  { id: 'patio', name: 'Patio', icon: 'tree', price: 250 },
  { id: 'bano', name: 'Baño', icon: 'bath', price: 180 },
  { id: 'estudio', name: 'Estudio', icon: 'book', price: 220 },
]
// Dónde se para cada quien en cada cuarto
const LAYOUT = {
  cocina: { cow: [150, 116], leo: [300, 186], negra: [52, 190] },
  patio: { cow: [150, 112], leo: [300, 184], negra: [40, 186] },
  bano: { cow: [200, 120], leo: [40, 190], negra: [300, 190] },
  estudio: { cow: [196, 118], leo: [36, 188], negra: [306, 190] },
}

// ---------- Catálogo nuevo (se suma al de decor.js) ----------
export const ROOM_ITEMS = [
  // Cocina
  { id: 'k-wall-mint', name: 'Azulejos menta', room: 'cocina', cat: 'Fondos', slot: 'wall', price: 0, base: true },
  { id: 'k-wall-peach', name: 'Azulejos durazno', room: 'cocina', cat: 'Fondos', slot: 'wall', price: 90 },
  { id: 'k-counter', name: 'Mesón', room: 'cocina', cat: 'Muebles', slot: 'counter', price: 0 },
  { id: 'k-fridge', name: 'Nevera rosada', room: 'cocina', cat: 'Muebles', slot: 'fridge', price: 160 },
  { id: 'k-stove', name: 'Estufa con olla', room: 'cocina', cat: 'Muebles', slot: 'stove', price: 140 },
  { id: 'k-table', name: 'Mesita con sillas', room: 'cocina', cat: 'Muebles', slot: 'table', price: 150 },
  { id: 'k-cups', name: 'Repisa de tacitas', room: 'cocina', cat: 'Decoración', slot: 'shelf', price: 70 },
  { id: 'k-fruits', name: 'Frutero', room: 'cocina', cat: 'Decoración', slot: 'fruits', price: 60 },
  { id: 'k-cake', name: 'Torta de fresa', room: 'cocina', cat: 'Decoración', slot: 'cake', price: 90 },
  { id: 'k-herbs', name: 'Maticas aromáticas', room: 'cocina', cat: 'Decoración', slot: 'herbs', price: 80 },
  { id: 'k-lamp', name: 'Lámpara colgante', room: 'cocina', cat: 'Decoración', slot: 'lamp', price: 80 },
  { id: 'pet-bowls', name: 'Platos de Leo y Negra', room: 'cocina', cat: 'Leo y Negra', slot: 'bowls', price: 70 },
  // Patio
  { id: 'p-day', name: 'Día soleado', room: 'patio', cat: 'Fondos', slot: 'wall', price: 0, base: true },
  { id: 'p-sunset', name: 'Atardecer llanero', room: 'patio', cat: 'Fondos', slot: 'wall', price: 120 },
  { id: 'p-night', name: 'Noche de luciérnagas', room: 'patio', cat: 'Fondos', slot: 'wall', price: 150 },
  { id: 'p-fence', name: 'Cerquita', room: 'patio', cat: 'Muebles', slot: 'fence', price: 0 },
  { id: 'p-tree', name: 'Árbol de mango', room: 'patio', cat: 'Muebles', slot: 'tree', price: 140 },
  { id: 'p-hammock', name: 'Hamaca', room: 'patio', cat: 'Muebles', slot: 'hammock', price: 190 },
  { id: 'p-swing', name: 'Columpio', room: 'patio', cat: 'Muebles', slot: 'swing', price: 180 },
  { id: 'p-pool', name: 'Piscinita inflable', room: 'patio', cat: 'Muebles', slot: 'pool', price: 200 },
  { id: 'p-flowers', name: 'Jardín de flores', room: 'patio', cat: 'Decoración', slot: 'flowers', price: 80 },
  { id: 'p-lights', name: 'Bombillitos', room: 'patio', cat: 'Decoración', slot: 'lights', price: 110 },
  { id: 'p-doghouse', name: 'Casita de Negra', room: 'patio', cat: 'Leo y Negra', slot: 'doghouse', price: 170 },
  { id: 'p-ball', name: 'Pelota de Negra', room: 'patio', cat: 'Leo y Negra', slot: 'petToy', price: 40 },
  { id: 'p-yarn', name: 'Ovillo de Leo', room: 'patio', cat: 'Leo y Negra', slot: 'petToy', price: 40 },
  // Baño
  { id: 'b-wall-lav', name: 'Baldosa lavanda', room: 'bano', cat: 'Fondos', slot: 'wall', price: 0, base: true },
  { id: 'b-wall-blue', name: 'Baldosa cielo', room: 'bano', cat: 'Fondos', slot: 'wall', price: 90 },
  { id: 'b-sink', name: 'Lavamanos', room: 'bano', cat: 'Muebles', slot: 'sink', price: 0 },
  { id: 'b-tub', name: 'Tina con burbujas', room: 'bano', cat: 'Muebles', slot: 'tub', price: 180 },
  { id: 'b-mirror', name: 'Espejo redondo', room: 'bano', cat: 'Decoración', slot: 'mirror', price: 90 },
  { id: 'b-towels', name: 'Toallas', room: 'bano', cat: 'Decoración', slot: 'towels', price: 60 },
  { id: 'b-shelf', name: 'Repisa de cremitas', room: 'bano', cat: 'Decoración', slot: 'shelf', price: 80 },
  { id: 'b-mat', name: 'Tapete de nube', room: 'bano', cat: 'Decoración', slot: 'mat', price: 50 },
  { id: 'b-duck', name: 'Patico de hule', room: 'bano', cat: 'Decoración', slot: 'duck', price: 40 },
  { id: 'b-plant', name: 'Helecho', room: 'bano', cat: 'Decoración', slot: 'plant', price: 70 },
  // Estudio
  { id: 'e-wall-cream', name: 'Pared crema', room: 'estudio', cat: 'Fondos', slot: 'wall', price: 0, base: true },
  { id: 'e-wall-sage', name: 'Pared salvia', room: 'estudio', cat: 'Fondos', slot: 'wall', price: 90 },
  { id: 'e-desk', name: 'Escritorio con PC', room: 'estudio', cat: 'Muebles', slot: 'desk', price: 200 },
  { id: 'e-chair', name: 'Silla rosada', room: 'estudio', cat: 'Muebles', slot: 'chair', price: 120 },
  { id: 'e-books', name: 'Estante de libros', room: 'estudio', cat: 'Muebles', slot: 'books', price: 140 },
  { id: 'e-board', name: 'Tablero con notitas', room: 'estudio', cat: 'Decoración', slot: 'board', price: 120 },
  { id: 'e-lamp', name: 'Lámpara de escritorio', room: 'estudio', cat: 'Decoración', slot: 'lamp', price: 70 },
  { id: 'e-globe', name: 'Globo terráqueo', room: 'estudio', cat: 'Decoración', slot: 'globe', price: 80 },
  { id: 'e-diploma', name: 'Diploma de ingeniera', room: 'estudio', cat: 'Decoración', slot: 'diploma', price: 150 },
  { id: 'e-cattree', name: 'Torre para Leo', room: 'estudio', cat: 'Leo y Negra', slot: 'cattree', price: 160 },
  // Ropita (se ve en todos los cuartos)
  ...[['bow', 'Moñito', 50], ['collar', 'Collar con cascabel', 60], ['hat', 'Gorrito de fiesta', 70], ['glasses', 'Gafitas de sol', 90], ['sweater', 'Saquito tejido', 110], ['crown', 'Coronita de flores', 100]].flatMap(([k, n, p]) => [
    { id: `leo-w-${k}`, name: `${n} de Leo`, room: 'ropita', cat: 'Ropita', slot: 'leoWear', price: p, pet: 'leo', wear: k },
    { id: `negra-w-${k}`, name: `${n} de Negra`, room: 'ropita', cat: 'Ropita', slot: 'negraWear', price: p, pet: 'negra', wear: k },
  ]),
]

// ---------- Fondos ----------
const tiles = (c1, c2, y0 = 0, h = 172) => { let s = ''; for (let y = y0; y < y0 + h; y += 24) for (let x = 0; x < 400; x += 24) s += `<rect x="${x + 1}" y="${y + 1}" width="22" height="22" rx="4" fill="${(x / 24 + y / 24) % 2 ? c1 : c2}"/>`; return s }
const checker = (c1, c2) => { let s = ''; for (let y = 170; y < 260; y += 18) for (let x = 0; x < 400; x += 18) s += `<rect x="${x}" y="${y}" width="18" height="18" fill="${(x / 18 + (y - 170) / 18) % 2 ? c1 : c2}"/>`; return s }
const BG = {
  'k-wall-mint': () => `<rect width="400" height="172" fill="#E3F4EC"/>${tiles('#D2EDE0', '#E3F4EC', 72, 98)}${checker('#F6E7DA', '#fff')}<path d="M0 170 H400" stroke="#fff" stroke-width="5"/>`,
  'k-wall-peach': () => `<rect width="400" height="172" fill="#FFE9DD"/>${tiles('#FFDCCB', '#FFE9DD', 72, 98)}${checker('#F6E7DA', '#fff')}<path d="M0 170 H400" stroke="#fff" stroke-width="5"/>`,
  'p-day': () => `<rect width="400" height="260" fill="#CFE8F7"/><circle cx="350" cy="40" r="20" fill="${BUTTER}"/><ellipse cx="90" cy="46" rx="34" ry="11" fill="#fff"/><ellipse cx="110" cy="38" rx="20" ry="10" fill="#fff"/><ellipse cx="250" cy="62" rx="26" ry="8" fill="#fff" opacity=".9"/><path d="M0 150 q100 -26 200 -6 q100 18 200 -4 v120 H0z" fill="#B5E0C6"/><rect y="170" width="400" height="90" fill="#A6D8B7"/>${Array.from({ length: 24 }, (_, i) => `<path d="M${8 + i * 17} ${200 + (i % 3) * 18} l3 -8 l3 8" fill="none" stroke="${LEAF_D}" stroke-width="2"/>`).join('')}`,
  'p-sunset': () => `<defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7B6C2"/><stop offset=".6" stop-color="#FFD7A8"/><stop offset="1" stop-color="#FFE9C7"/></linearGradient></defs><rect width="400" height="260" fill="url(#sun)"/><circle cx="300" cy="120" r="30" fill="#FFB98A" opacity=".9"/><path d="M40 60 q12 -6 24 0 M70 46 q10 -5 20 0" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M0 150 q100 -20 200 -2 q100 14 200 -6 v120 H0z" fill="#C9D9A6"/><rect y="170" width="400" height="90" fill="#B8D195"/>${Array.from({ length: 24 }, (_, i) => `<path d="M${8 + i * 17} ${200 + (i % 3) * 18} l3 -8 l3 8" fill="none" stroke="#93B06E" stroke-width="2"/>`).join('')}`,
  'p-night': () => `<rect width="400" height="260" fill="#3D3560"/><circle cx="330" cy="44" r="16" fill="#FFF3C4"/><circle cx="337" cy="40" r="14" fill="#3D3560"/>${Array.from({ length: 22 }, (_, i) => `<circle cx="${(i * 53) % 400}" cy="${10 + ((i * 31) % 110)}" r="1.4" fill="#fff" opacity=".8"/>`).join('')}<path d="M0 150 q100 -26 200 -6 q100 18 200 -4 v120 H0z" fill="#4E6E5E"/><rect y="170" width="400" height="90" fill="#46644F"/>${Array.from({ length: 14 }, (_, i) => `<circle cx="${20 + i * 28}" cy="${120 + ((i * 37) % 70)}" r="2.6" fill="#F6E58D" opacity=".85"/>`).join('')}`,
  'b-wall-lav': () => `<rect width="400" height="172" fill="#F1EBF8"/>${tiles('#E6DCF2', '#F1EBF8', 0, 172)}<rect y="170" width="400" height="90" fill="#EAE3F3"/>${checker('#E0D6EE', '#F3EEF9')}<path d="M0 170 H400" stroke="#fff" stroke-width="5"/>`,
  'b-wall-blue': () => `<rect width="400" height="172" fill="#E6F1FA"/>${tiles('#D5E8F6', '#E6F1FA', 0, 172)}<rect y="170" width="400" height="90" fill="#E3EDF5"/>${checker('#D8E6F2', '#F1F7FB')}<path d="M0 170 H400" stroke="#fff" stroke-width="5"/>`,
  'e-wall-cream': () => `<rect width="400" height="172" fill="#FFF6E8"/>${Array.from({ length: 10 }, (_, i) => `<path d="M${i * 44} 0 V172" stroke="#F8EAD2" stroke-width="10"/>`).join('')}<rect y="170" width="400" height="90" fill="#E9CDB3"/>${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${176 + i * 15} H400" stroke="${WOOD_D}" stroke-width="1.4" opacity=".6"/>`).join('')}<path d="M0 170 H400" stroke="#fff" stroke-width="5"/>`,
  'e-wall-sage': () => `<rect width="400" height="172" fill="#E4EEDF"/>${Array.from({ length: 10 }, (_, i) => `<path d="M${i * 44} 0 V172" stroke="#D9E7D2" stroke-width="10"/>`).join('')}<rect y="170" width="400" height="90" fill="#E2C6AC"/>${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${176 + i * 15} H400" stroke="${WOOD_D}" stroke-width="1.4" opacity=".6"/>`).join('')}<path d="M0 170 H400" stroke="#fff" stroke-width="5"/>`,
}

// ---------- Muebles y deco ----------
const DRAW = {
  // Cocina
  'k-counter': () => `<g transform="translate(150 128)"><rect x="0" y="0" width="150" height="46" rx="6" fill="#fff" ${S()}/><rect x="-4" y="-6" width="158" height="10" rx="4" fill="${WOOD}" ${S()}/><path d="M50 4 v40 M100 4 v40" ${S(2)}/><circle cx="42" cy="24" r="2.4" fill="${INK}"/><circle cx="58" cy="24" r="2.4" fill="${INK}"/><circle cx="108" cy="24" r="2.4" fill="${INK}"/></g>`,
  'k-fridge': () => `<g transform="translate(316 74)"><rect x="0" y="0" width="70" height="104" rx="12" fill="${PINK}" ${S()}/><path d="M0 40 h70" ${S()}/><rect x="56" y="14" width="5" height="18" rx="2.5" fill="#fff" ${S(1.6)}/><rect x="56" y="52" width="5" height="26" rx="2.5" fill="#fff" ${S(1.6)}/><circle cx="20" cy="60" r="6" fill="${BUTTER}" ${S(1.6)}/>${heart(36, 66, .5)}<rect x="12" y="82" width="16" height="12" rx="2" fill="#fff" ${S(1.4)}/></g>`,
  'k-stove': () => `<g transform="translate(200 98)"><path d="M10 26 h52 v-12 q0 -8 -8 -8 h-36 q-8 0 -8 8z" fill="#BFD7F0" ${S()}/><path d="M4 26 h64" ${S(3)}/><path d="M26 2 q4 -8 0 -14 M38 0 q4 -8 0 -14 M50 2 q4 -8 0 -14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M60 12 h12" ${S(3)}/></g>`,
  'k-table': () => `<g transform="translate(26 168)"><ellipse cx="70" cy="10" rx="62" ry="12" fill="${WOOD}" ${S()}/><path d="M70 20 v40 M50 60 h40" ${S(3.4)}/><rect x="-6" y="16" width="22" height="30" rx="6" fill="${LAV}" ${S()}/><path d="M0 46 v18 M12 46 v18" ${S(2.6)}/><rect x="124" y="16" width="22" height="30" rx="6" fill="${LAV}" ${S()}/><path d="M128 46 v18 M140 46 v18" ${S(2.6)}/><circle cx="60" cy="4" r="6" fill="#fff" ${S(1.6)}/><path d="M80 0 h12 v10 h-12z" fill="#fff" ${S(1.6)}/></g>`,
  'k-cups': () => `<g transform="translate(30 50)"><rect x="0" y="22" width="110" height="7" rx="3" fill="${WOOD}" ${S()}/>${[[8, PINK], [36, LAV], [64, BUTTER], [90, LEAF]].map(([x, c]) => `<path d="M${x} 6 h16 v12 q0 6 -8 6 q-8 0 -8 -6z" fill="${c}" ${S(1.8)}/><path d="M${x + 16} 9 q6 0 6 5 q0 4 -6 4" fill="none" ${S(1.8)}/>`).join('')}</g>`,
  'k-fruits': () => `<g transform="translate(258 104)"><path d="M0 14 h40 q-2 14 -20 14 q-18 0 -20 -14z" fill="#fff" ${S()}/><circle cx="12" cy="10" r="7" fill="#F48C8C" ${S(1.6)}/><circle cx="26" cy="9" r="7" fill="${BUTTER}" ${S(1.6)}/><path d="M18 4 q6 -10 14 -6 q-4 8 -14 6z" fill="${LEAF}" ${S(1.4)}/></g>`,
  'k-cake': () => `<g transform="translate(166 100)"><rect x="0" y="8" width="34" height="18" rx="4" fill="#fff" ${S()}/><path d="M0 14 q8 6 17 0 q9 6 17 0" fill="none" stroke="${PINK}" stroke-width="4"/><circle cx="17" cy="4" r="4" fill="#E86A7D" ${S(1.4)}/><path d="M-4 28 h42" ${S(2.4)}/></g>`,
  'k-herbs': () => `<g transform="translate(150 96)">${[0, 14].map((x) => `<path d="M${x} 10 h12 l-2 12 h-8z" fill="#F4C3A5" ${S(1.6)}/><path d="M${x + 6} 10 q-6 -10 -2 -16 M${x + 6} 10 q6 -10 2 -16 M${x + 6} 10 v-14" fill="none" stroke="${LEAF_D}" stroke-width="2.4"/>`).join('')}</g>`,
  'k-lamp': () => `<g><path d="M240 0 v34" ${S(2)}/><path d="M222 50 q18 -22 36 0z" fill="${BUTTER}" ${S()}/><ellipse cx="240" cy="66" rx="30" ry="12" fill="${BUTTER}" opacity=".35"/></g>`,
  'pet-bowls': () => `<g transform="translate(250 228)"><ellipse cx="0" cy="0" rx="18" ry="6" fill="${GREY_BOWL}" ${S(2)}/><path d="M-18 0 q18 14 36 0" fill="#BFB6CA" ${S(2)}/><text x="0" y="14" font-size="7" text-anchor="middle" fill="${INK}" font-family="Poppins">LEO</text><ellipse cx="46" cy="0" rx="18" ry="6" fill="${PINK}" ${S(2)}/><path d="M28 0 q18 14 36 0" fill="#F4A7B8" ${S(2)}/><text x="46" y="14" font-size="7" text-anchor="middle" fill="${INK}" font-family="Poppins">NEGRA</text></g>`,
  // Patio
  'p-fence': () => `<g>${Array.from({ length: 21 }, (_, i) => `<path d="M${i * 20 + 4} 172 v-34 l6 -8 l6 8 v34z" fill="#fff" ${S(2)}/>`).join('')}<path d="M0 146 H400 M0 162 H400" ${S(2.4)}/></g>`,
  'p-tree': () => `<g transform="translate(300 40)"><path d="M40 140 q-4 -50 2 -90" stroke="${WOOD_D}" stroke-width="16" stroke-linecap="round" fill="none"/><path d="M40 140 q-4 -50 2 -90" ${S(2)} fill="none"/><circle cx="20" cy="40" r="30" fill="${LEAF}" ${S()}/><circle cx="62" cy="34" r="32" fill="${LEAF_D}" ${S()}/><circle cx="42" cy="12" r="28" fill="${LEAF}" ${S()}/>${[[18, 46], [56, 44], [44, 20], [70, 26]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" fill="#FFB347" ${S(1.4)}/>`).join('')}</g>`,
  'p-hammock': () => `<g><path d="M14 92 v90 M190 92 v90" stroke="${WOOD_D}" stroke-width="7" stroke-linecap="round"/><path d="M14 104 q88 70 176 0" fill="none" ${S(2)}/><path d="M24 112 q78 58 156 0 q-10 26 -78 30 q-68 -4 -78 -30z" fill="${HOT}" ${S()}/><path d="M40 124 q62 36 124 0" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6"/></g>`,
  'p-swing': () => `<g transform="translate(210 56)"><path d="M0 0 h90" stroke="${WOOD_D}" stroke-width="8" stroke-linecap="round"/><path d="M14 0 v86 M76 0 v86" ${S(2)}/><rect x="6" y="84" width="78" height="10" rx="4" fill="${BUTTER}" ${S()}/></g>`,
  'p-pool': () => `<g transform="translate(140 214)"><ellipse cx="60" cy="10" rx="64" ry="20" fill="${PINK}" ${S()}/><ellipse cx="60" cy="8" rx="50" ry="13" fill="#9ED3F0" ${S(2)}/><path d="M24 8 q10 -4 20 0 M66 4 q10 -4 20 0" stroke="#fff" stroke-width="2.4" fill="none"/></g>`,
  'p-flowers': () => `<g>${[[20, 176, HOT], [44, 182, BUTTER], [70, 174, LAV], [96, 180, '#fff'], [330, 178, HOT], [356, 184, BUTTER], [382, 176, LAV]].map(([x, y, c]) => `<path d="M${x} ${y + 26} v-22" stroke="${LEAF_D}" stroke-width="2.4"/>${flower(x, y, c, 1.1)}`).join('')}</g>`,
  'p-lights': () => `<path d="M0 26 q100 30 200 0 q100 30 200 0" fill="none" ${S(1.6)}/>${Array.from({ length: 13 }, (_, i) => { const x = 14 + i * 30, y = 26 + Math.sin((x % 200) / 200 * Math.PI) * 15; return `<circle cx="${x}" cy="${y + 6}" r="5" fill="${['#FFE29A', '#F7B6C2', '#C3B3D4', '#B9DCCB'][i % 4]}" ${S(1.2)}/><circle cx="${x}" cy="${y + 6}" r="10" fill="#FFE29A" opacity=".25"/>` }).join('')}`,
  'p-doghouse': () => `<g transform="translate(20 140)"><path d="M0 40 L50 0 L100 40z" fill="#E86A7D" ${S()}/><rect x="8" y="38" width="84" height="56" fill="${WOOD}" ${S()}/><path d="M36 94 v-26 q14 -16 28 0 v26z" fill="#6E5A55" ${S(2)}/><rect x="34" y="44" width="32" height="10" rx="3" fill="#fff" ${S(1.4)}/><text x="50" y="52" font-size="7" text-anchor="middle" fill="${INK}" font-family="Poppins" font-weight="700">NEGRA</text></g>`,
  'p-ball': () => `<g transform="translate(250 236)"><circle r="10" fill="#E86A7D" ${S(2)}/><path d="M-10 0 q10 6 20 0 M0 -10 q-6 10 0 20" fill="none" stroke="#fff" stroke-width="2"/></g>`,
  'p-yarn': () => `<g transform="translate(250 236)"><circle r="10" fill="${LAV}" ${S(2)}/><path d="M-7 -5 q8 4 14 -2 M-9 2 q9 5 18 -1 M-5 7 q6 2 10 -1" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M8 6 q14 6 24 -2" fill="none" stroke="${LAV}" stroke-width="2"/></g>`,
  // Baño
  'b-sink': () => `<g transform="translate(40 98)"><rect x="0" y="0" width="70" height="20" rx="8" fill="#fff" ${S()}/><path d="M24 20 h22 v52 h-22z" fill="#fff" ${S()}/><path d="M35 0 v-14 h10" fill="none" ${S(3)}/><circle cx="35" cy="-16" r="3" fill="${SKY}" ${S(1.4)}/></g>`,
  'b-tub': () => `<g transform="translate(200 156)"><path d="M0 0 h180 v20 q0 36 -40 36 h-100 q-40 0 -40 -36z" fill="#fff" ${S()}/><path d="M10 64 l-4 10 M170 64 l4 10" ${S(3)}/>${[[20, -6, 12], [40, -12, 14], [64, -6, 11], [90, -14, 15], [118, -6, 12], [146, -12, 14], [168, -4, 10]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#EAF4FB" ${S(1.6)}/>`).join('')}<path d="M182 0 v-40 h-18" fill="none" ${S(3)}/></g>`,
  'b-mirror': () => `<g transform="translate(75 30)"><circle cx="0" cy="0" r="26" fill="#DDEFF8" ${S()}/><path d="M-12 -10 l8 -8 M-6 -2 l14 -14" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>`,
  'b-towels': () => `<g transform="translate(140 60)"><path d="M0 0 h70" stroke="${WOOD_D}" stroke-width="5" stroke-linecap="round"/><path d="M6 0 h26 v46 h-26z" fill="${PINK}" ${S()}/><path d="M38 0 h26 v38 h-26z" fill="${LEAF}" ${S()}/><path d="M6 38 h26 M38 30 h26" stroke="#fff" stroke-width="2.4"/></g>`,
  'b-shelf': () => `<g transform="translate(300 54)"><rect x="0" y="30" width="80" height="6" rx="3" fill="#fff" ${S()}/>${[[6, 14, PINK], [24, 20, LAV], [44, 16, BUTTER], [62, 22, LEAF]].map(([x, h, c]) => `<rect x="${x}" y="${30 - h}" width="12" height="${h}" rx="3" fill="${c}" ${S(1.6)}/>`).join('')}</g>`,
  'b-mat': () => `<path d="M90 236 q-20 -16 10 -20 q10 -14 30 -4 q20 -12 32 4 q30 2 14 20 q-6 12 -30 6 q-14 8 -32 0 q-22 6 -24 -6z" fill="#fff" ${S()}/>`,
  'b-duck': () => `<g transform="translate(270 142)"><ellipse cx="0" cy="6" rx="12" ry="8" fill="${BUTTER}" ${S(1.8)}/><circle cx="8" cy="-4" r="6" fill="${BUTTER}" ${S(1.8)}/><path d="M13 -4 l6 1 l-6 2z" fill="#FFB347" ${S(1.2)}/><circle cx="9" cy="-6" r="1.2" fill="${INK}"/></g>`,
  'b-plant': () => `<g transform="translate(370 190)"><path d="M-12 0 h24 l-4 22 h-16z" fill="#F4C3A5" ${S()}/><path d="M0 0 q-20 -14 -26 -34 M0 0 q-6 -24 0 -40 M0 0 q14 -20 22 -32" fill="none" stroke="${LEAF_D}" stroke-width="3"/>${[[-20, -26], [-4, -32], [14, -26], [-12, -14], [10, -12]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3" fill="${LEAF}"/>`).join('')}</g>`,
  // Estudio
  'e-desk': () => `<g transform="translate(250 112)"><rect x="0" y="42" width="130" height="9" rx="3" fill="${WOOD}" ${S()}/><path d="M8 51 v44 M122 51 v44" ${S(3.4)}/><rect x="30" y="0" width="62" height="38" rx="5" fill="#2F2A3A" ${S()}/><rect x="35" y="5" width="52" height="28" rx="2" fill="${LAV}"/>${heart(61, 13, .6, '#fff')}<path d="M56 38 v4 h10 v-4" ${S(2)}/><rect x="40" y="44" width="40" height="5" rx="2" fill="#EDE5F7" ${S(1.6)}/><circle cx="104" cy="38" r="6" fill="${PINK}" ${S(1.6)}/></g>`,
  'e-chair': () => `<g transform="translate(276 150)"><rect x="0" y="0" width="36" height="34" rx="12" fill="${PINK}" ${S()}/><rect x="-2" y="30" width="40" height="10" rx="5" fill="${HOT}" ${S()}/><path d="M18 40 v24 M4 70 h28" ${S(3)}/></g>`,
  'e-books': () => `<g transform="translate(16 40)"><rect x="0" y="0" width="80" height="134" rx="6" fill="#F5E1CF" ${S()}/><path d="M0 44 h80 M0 88 h80" ${S()}/>${[0, 44, 88].map((y, r) => [[6, PINK], [16, LAV], [26, SKY], [36, BUTTER], [48, LEAF], [60, HOT]].slice(0, 6 - r).map(([x, c]) => `<rect x="${x}" y="${y + 8}" width="9" height="${32 - (x % 3) * 2}" rx="2" fill="${c}" ${S(1.4)}/>`).join('')).join('')}</g>`,
  'e-board': () => `<g transform="translate(120 34)"><rect x="0" y="0" width="100" height="66" rx="6" fill="#E9C9A6" ${S()}/>${[[10, 10, BUTTER], [44, 8, PINK], [72, 14, LEAF], [20, 38, LAV], [58, 40, SKY]].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="20" height="18" fill="${c}" ${S(1.2)}/><circle cx="${x + 10}" cy="${y + 2}" r="2" fill="#E86A7D"/>`).join('')}</g>`,
  'e-lamp': () => `<g transform="translate(360 112)"><path d="M0 42 h18 M9 42 l-10 -22 l14 -14" fill="none" ${S(2.6)}/><path d="M4 2 l18 -4 l2 16z" fill="${BUTTER}" ${S(2)}/></g>`,
  'e-globe': () => `<g transform="translate(240 138)"><circle cx="0" cy="0" r="12" fill="${SKY}" ${S(1.8)}/><path d="M-6 -6 q4 2 2 6 q-4 2 -2 8 M4 -8 q4 6 0 10" fill="none" stroke="${LEAF_D}" stroke-width="2.4"/><path d="M0 12 v4 M-8 18 h16" ${S(2)}/></g>`,
  'e-diploma': () => `<g transform="translate(250 30)"><rect x="0" y="0" width="70" height="48" rx="4" fill="#fff" ${S()}/><rect x="5" y="5" width="60" height="38" rx="2" fill="none" stroke="${BUTTER}" stroke-width="2"/><path d="M14 16 h42 M18 24 h34 M22 31 h26" stroke="${LAV}" stroke-width="2"/><circle cx="56" cy="38" r="6" fill="#E86A7D"/></g>`,
  'e-cattree': () => `<g transform="translate(110 92)"><rect x="18" y="20" width="12" height="80" fill="#F5E1CF" ${S(2)}/><path d="M18 30 h12 M18 46 h12 M18 62 h12 M18 78 h12" stroke="${WOOD_D}" stroke-width="1.4"/><ellipse cx="24" cy="18" rx="28" ry="8" fill="${LAV}" ${S()}/><ellipse cx="24" cy="60" rx="22" ry="7" fill="${PINK}" ${S()}/><rect x="-6" y="96" width="60" height="12" rx="5" fill="${LAV}" ${S()}/><path d="M44 60 v14" ${S(1.6)}/><circle cx="44" cy="78" r="4" fill="${BUTTER}" ${S(1.4)}/></g>`,
}
const GREY_BOWL = '#D9D5E0'

// ---------- Ropita sobre Leo y Negra (coordenadas del dibujo 200×200) ----------
const WEAR = {
  bow: (k) => `<g transform="translate(${k === 'leo' ? 128 : 132} ${k === 'leo' ? 48 : 46})"><path d="M0 0 l-14 -9 v18z M0 0 l14 -9 v18z" fill="${HOT}" ${S(2)}/><circle r="4" fill="${PINK}" ${S(1.6)}/></g>`,
  collar: (k) => `<path d="M${k === 'leo' ? '66 134 q34 14 68 0' : '68 136 q32 16 64 0'}" stroke="${k === 'leo' ? SKY : '#9CCFB4'}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="100" cy="${k === 'leo' ? 145 : 148}" r="6" fill="#F6D27B" ${S(1.8)}/><path d="M97 146 h6" stroke="${INK}" stroke-width="1.4"/>`,
  hat: () => `<g transform="translate(100 46)"><path d="M-18 4 L0 -40 L18 4z" fill="${LAV}" ${S(2.4)}/><path d="M-12 -10 l20 6 M-6 -24 l12 4" stroke="${BUTTER}" stroke-width="3"/><circle cx="0" cy="-42" r="6" fill="${HOT}" ${S(1.8)}/></g>`,
  glasses: () => `<g transform="translate(100 90)"><rect x="-34" y="-10" width="26" height="18" rx="8" fill="#2F2A3A" ${S(2)}/><rect x="8" y="-10" width="26" height="18" rx="8" fill="#2F2A3A" ${S(2)}/><path d="M-8 -3 h16" ${S(2.4)}/><path d="M-28 -6 l6 -2" stroke="#fff" stroke-width="2" opacity=".7"/><path d="M14 -6 l6 -2" stroke="#fff" stroke-width="2" opacity=".7"/></g>`,
  sweater: (k) => `<path d="M62 150 Q64 ${k === 'leo' ? 138 : 140} 100 ${k === 'leo' ? 138 : 140} Q136 ${k === 'leo' ? 138 : 140} 138 150 Q140 182 100 182 Q60 182 62 150Z" fill="${k === 'leo' ? PINK : LAV}" ${S(2.6)}/><path d="M66 156 h68 M64 166 h72" stroke="#fff" stroke-width="3" stroke-dasharray="4 5"/>`,
  crown: () => `<g transform="translate(100 46)">${[-30, -15, 0, 15, 30].map((x, i) => flower(x, Math.abs(x) / 3, [HOT, BUTTER, '#fff', LAV, HOT][i], 1.2)).join('')}<path d="M-34 6 q34 -10 68 0" fill="none" stroke="${LEAF_D}" stroke-width="2.4"/></g>`,
}
export const petSvg = (kind, pose, wear) => (kind === 'leo' ? leo(pose) : negra(pose)) + (wear && WEAR[wear] && pose !== 'sleep' ? WEAR[wear](kind) : '')

// ---------- Escena de un cuarto ----------
// fx: { pet: 'leo'|'negra', kind: 'comida'|'baño'|'juego'|'cariño' } → animación encima
export function roomScene(roomId, placed, opts = {}) {
  const L = LAYOUT[roomId]
  const base = ROOM_ITEMS.find((d) => d.room === roomId && d.slot === 'wall' && d.base)
  let s = (BG[placed.wall] || BG[base.id])()
  const order = {
    cocina: ['lamp', 'shelf', 'fridge', 'counter', 'herbs', 'stove', 'fruits', 'cake', 'table', 'bowls'],
    patio: ['lights', 'fence', 'tree', 'swing', 'hammock', 'flowers', 'doghouse', 'pool', 'petToy'],
    bano: ['mirror', 'towels', 'shelf', 'sink', 'plant', 'mat', 'tub', 'duck'],
    estudio: ['board', 'diploma', 'books', 'cattree', 'desk', 'chair', 'lamp', 'globe'],
  }[roomId]
  for (const slot of order) { const id = placed[slot]; if (id && DRAW[id]) s += DRAW[id]() }
  if (!opts.bare) {
    s += pets(L, opts)
    s += `<g transform="translate(${L.cow[0]} ${L.cow[1]}) scale(.62)">${cow(opts.pose || 'happy', opts.accessory)}</g>`
  }
  if (placed.wall === 'p-night') s += `<rect width="400" height="260" fill="#1d1830" opacity=".12"/>`
  return s
}
// Leo y Negra (con su ropita y la animación de cuidado) — se usa también en el dormitorio
export function pets(L, opts = {}) {
  const p = opts.pet || {}, w = opts.wear || {}
  let s = ''
  if (opts.showNegra !== false) s += `<g class="petg" data-pet="negra" transform="translate(${L.negra[0]} ${L.negra[1]}) scale(.36)">${petSvg('negra', p.negra || 'sit', w.negra)}${fxSvg(opts.fx, 'negra')}</g>`
  if (opts.showLeo !== false) s += `<g class="petg" data-pet="leo" transform="translate(${L.leo[0]} ${L.leo[1]}) scale(.36)">${petSvg('leo', p.leo || 'sit', w.leo)}${fxSvg(opts.fx, 'leo')}</g>`
  return s
}
function fxSvg(fx, kind) {
  if (!fx || fx.pet !== kind) return ''
  if (fx.kind === 'baño') return `<g class="fx">${[[40, 40, 14], [150, 30, 18], [100, 0, 12], [170, 90, 12], [30, 110, 16]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#EAF4FB" stroke="#9ED3F0" stroke-width="3"/>`).join('')}</g>`
  if (fx.kind === 'comida') return `<g class="fx"><text x="150" y="40" font-size="54">${kind === 'leo' ? '🐟' : '🦴'}</text></g>`
  if (fx.kind === 'juego') return `<g class="fx"><text x="150" y="40" font-size="54">${kind === 'leo' ? '🧶' : '🎾'}</text></g>`
  return `<g class="fx">${heart(40, 20, 2.2)}${heart(160, 0, 1.8, PINK)}${heart(100, -20, 1.4)}</g>`
}
export const ROOM_SLOT_BOX = {
  counter: '140 110 170 70', fridge: '306 64 90 120', stove: '190 80 90 50', table: '10 150 170 90', shelf: '20 30 130 50', fruits: '250 90 60 45', cake: '156 88 54 44', herbs: '144 80 40 40', lamp: '200 0 80 80', bowls: '224 214 100 34',
  fence: '0 120 200 60', tree: '270 0 130 180', hammock: '0 86 200 100', swing: '200 46 110 110', pool: '70 190 140 46', flowers: '0 160 120 60', doghouse: '10 130 120 110', petToy: '230 216 50 40', lights: '0 10 200 50',
  sink: '30 74 90 100', tub: '190 110 210 130', mirror: '40 0 70 60', towels: '130 50 90 60', mat: '60 205 140 40', duck: '252 126 40 34', plant: '334 140 66 80',
  board: '110 26 120 80', diploma: '240 22 90 64', books: '6 32 100 150', cattree: '96 82 76 130', desk: '240 100 150 110', chair: '266 140 60 90', globe: '222 120 36 50',
  leoWear: '0 0 200 200', negraWear: '0 0 200 200',
}

// ---------- Cuidado de Leo y Negra ----------
// Cada uno tiene comida, limpieza y juego (0-100). Bajan poquito con las horas; nunca regañan.
const DECAY = { comida: 4, limpio: 1.5, juego: 3 } // puntos por hora
export function careOf(game, kind) {
  const c = (game.care ||= {})[kind] ||= { comida: 80, limpio: 80, juego: 80, at: Date.now() }
  const h = (Date.now() - (c.at || Date.now())) / 3600e3
  const v = (k) => Math.max(0, Math.round(c[k] - DECAY[k] * h))
  const out = { comida: v('comida'), limpio: v('limpio'), juego: v('juego') }
  out.animo = Math.round((out.comida + out.limpio + out.juego) / 3)
  return out
}
export function careAction(game, kind, what) {
  const now = careOf(game, kind)
  const key = { comida: 'comida', baño: 'limpio', juego: 'juego', cariño: 'juego' }[what]
  const add = what === 'cariño' ? 8 : 40
  game.care[kind] = { comida: now.comida, limpio: now.limpio, juego: now.juego, at: Date.now() }
  game.care[kind][key] = Math.min(100, game.care[kind][key] + add)
  return careOf(game, kind)
}
export const SOUNDS = { leo: ['¡Miau!', 'Purrrr…', '¡Mrrrau!', '*se estira*', 'Miau miau'], negra: ['¡Guau!', '¡Wuf wuf!', '*mueve la colita*', '¡Guau guau!', '*te da la patita*'] }
