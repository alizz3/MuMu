// Catálogo de la casita y dibujo de la escena. Todo se gana con progreso real (monedas), nunca con dinero.
import { cow, INK } from '../components/art'
import { ROOM_ITEMS, pets } from './rooms'

const S = (w = 2.6) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`
const PINK = '#F7B6C2', LAV = '#C3B3D4', HOT = '#EE8FAE', CREAM = '#FFF3E3', LEAF = '#9CCFB4', LEAF_D = '#78B596'

export const DECOR = [
  // fondos
  { id: 'wall-pink', name: 'Pared rosita', cat: 'Fondos', slot: 'wall', price: 0, base: true },
  { id: 'wall-lav', name: 'Pared lavanda', cat: 'Fondos', slot: 'wall', price: 90 },
  { id: 'wall-cream', name: 'Pared crema con estrellas', cat: 'Fondos', slot: 'wall', price: 110 },
  { id: 'wall-night', name: 'Noche estrellada', cat: 'Fondos', slot: 'wall', price: 160 },
  // muebles
  { id: 'bed-basic', name: 'Camita sencilla', cat: 'Muebles', slot: 'bed', price: 0 },
  { id: 'bed-pretty', name: 'Cama con dosel', cat: 'Muebles', slot: 'bed', price: 220 },
  { id: 'sofa-pink', name: 'Sofá rosado', cat: 'Muebles', slot: 'sofa', price: 150 },
  { id: 'sofa-lav', name: 'Sofá lavanda', cat: 'Muebles', slot: 'sofa', price: 180 },
  { id: 'desk', name: 'Escritorio con laptop', cat: 'Muebles', slot: 'desk', price: 160 },
  { id: 'shelf-books', name: 'Biblioteca', cat: 'Muebles', slot: 'shelf', price: 140 },
  { id: 'kitchen', name: 'Rinconcito de cocina', cat: 'Muebles', slot: 'kitchen', price: 200 },
  { id: 'rug-round', name: 'Tapete redondo', cat: 'Muebles', slot: 'rug', price: 80 },
  // plantas y deco
  { id: 'plant-small', name: 'Planta pequeña', cat: 'Decoración', slot: 'plantL', price: 0 },
  { id: 'plant-monstera', name: 'Monstera', cat: 'Decoración', slot: 'plantR', price: 120 },
  { id: 'plant-hanging', name: 'Planta colgante', cat: 'Decoración', slot: 'hanging', price: 90 },
  { id: 'lamp', name: 'Lámpara de pie', cat: 'Decoración', slot: 'lamp', price: 110 },
  { id: 'art-cow', name: 'Cuadro de vaquita', cat: 'Decoración', slot: 'wallart', price: 120 },
  { id: 'art-heart', name: 'Cuadro de corazón', cat: 'Decoración', slot: 'wallart', price: 70 },
  { id: 'window', name: 'Ventana', cat: 'Decoración', slot: 'window', price: 0 },
  { id: 'window-garden', name: 'Ventana al jardín', cat: 'Decoración', slot: 'window', price: 210 },
  { id: 'garland-spring', name: 'Guirnalda de primavera', cat: 'Temporadas', slot: 'season', price: 70 },
  { id: 'garland-xmas', name: 'Luces de Navidad', cat: 'Temporadas', slot: 'season', price: 120 },
  { id: 'garland-uni', name: 'Banderines universitarios', cat: 'Temporadas', slot: 'season', price: 90 },
  { id: 'moto', name: 'Mini moto', cat: 'Decoración', slot: 'toy', price: 190 },
  // mascotas
  { id: 'leo-bed', name: 'Camita de Leo', cat: 'Mascotas', slot: 'leoBed', price: 90 },
  { id: 'negra-bed', name: 'Camita de Negra', cat: 'Mascotas', slot: 'negraBed', price: 90 },
  { id: 'leo', name: 'Leo vive aquí', cat: 'Mascotas', slot: 'leo', price: 0 },
  { id: 'negra', name: 'Negra vive aquí', cat: 'Mascotas', slot: 'negra', price: 0 },
  // accesorios de la vaquita
  { id: 'bow', name: 'Moño', cat: 'Accesorios', slot: 'accessory', price: 0 },
  { id: 'headphones', name: 'Audífonos', cat: 'Accesorios', slot: 'accessory', price: 80 },
  { id: 'crown', name: 'Corona de flores', cat: 'Accesorios', slot: 'accessory', price: 90 },
  { id: 'backpack', name: 'Mochila', cat: 'Accesorios', slot: 'accessory', price: 100 },
  { id: 'cap', name: 'Birrete', cat: 'Accesorios', slot: 'accessory', price: 150 },
  { id: 'santa', name: 'Gorrito navideño', cat: 'Accesorios', slot: 'accessory', price: 120 },
  // nuevos para el dormitorio
  { id: 'tv', name: 'Televisor', cat: 'Muebles', slot: 'tv', price: 170 },
  { id: 'nightstand', name: 'Mesita de noche', cat: 'Muebles', slot: 'nightstand', price: 90 },
  { id: 'clock', name: 'Reloj de pared', cat: 'Decoración', slot: 'clock', price: 60 },
  // cuartos nuevos y ropita de Leo y Negra
  ...ROOM_ITEMS,
]

const WALLS = {
  'wall-pink': { wall: '#FCE4EC', dots: '#F9D0DC', floor: '#F2D8C4', plank: '#E8C7AE' },
  'wall-lav': { wall: '#EEE6F7', dots: '#E0D3F0', floor: '#EBD9C8', plank: '#DEC6B0' },
  'wall-cream': { wall: '#FFF5E6', dots: '#F6D27B', floor: '#F0D4C0', plank: '#E2C0A8', stars: true },
  'wall-night': { wall: '#5E5277', dots: '#7A6E95', floor: '#C9B2A6', plank: '#B89E92', stars: true, night: true },
}

const pot = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 0 h28 l-4 22 h-20z" fill="#F4C3A5" ${S()}/></g>`
const DRAW = {
  window: () => `<g><rect x="56" y="26" width="92" height="82" rx="40" fill="#DDEFF8" ${S()}/><path d="M102 26 v82 M56 70 h92" ${S(2.2)}/><ellipse cx="84" cy="52" rx="14" ry="6" fill="#fff" opacity=".9"/><path d="M50 110 h104" stroke="#fff" stroke-width="7" stroke-linecap="round"/></g>`,
  'window-garden': () => `<g><rect x="56" y="26" width="92" height="82" rx="40" fill="#DDEFF8" ${S()}/><path d="M58 92 q20 -16 44 -4 q20 -12 44 4 v14 h-88z" fill="${LEAF}"/>${[70, 90, 112, 132].map((x, i) => `<circle cx="${x}" cy="${88 - (i % 2) * 4}" r="4" fill="${['#F48FB1', '#FFE29A', '#fff', '#C3B3D4'][i]}"/>`).join('')}<circle cx="128" cy="46" r="9" fill="#FFE29A"/><path d="M102 26 v82 M56 70 h92" ${S(2.2)}/><path d="M50 110 h104" stroke="#fff" stroke-width="7" stroke-linecap="round"/></g>`,
  'bed-basic': () => `<g transform="translate(10 150)"><rect x="0" y="26" width="104" height="40" rx="10" fill="#fff" ${S()}/><rect x="0" y="0" width="16" height="70" rx="6" fill="#E8C7AE" ${S()}/><rect x="20" y="16" width="30" height="16" rx="8" fill="#fff" ${S()}/><path d="M18 34 h86 v18 q-43 8 -86 0z" fill="${PINK}" ${S()}/></g>`,
  'bed-pretty': () => `<g transform="translate(6 120)"><path d="M0 0 q56 -26 112 0" fill="none" ${S()}/><path d="M2 2 q-4 50 6 70 M110 2 q4 50 -6 70" fill="none" stroke="#F9D0DC" stroke-width="10" stroke-linecap="round" opacity=".9"/><rect x="2" y="56" width="108" height="42" rx="12" fill="#fff" ${S()}/><rect x="0" y="22" width="18" height="80" rx="8" fill="${LAV}" ${S()}/><rect x="22" y="46" width="32" height="16" rx="8" fill="#fff" ${S()}/><path d="M20 64 h90 v20 q-45 9 -90 0z" fill="${PINK}" ${S()}/><path d="M40 72 l4 4 l4 -4" stroke="#fff" stroke-width="2" fill="none"/><path d="M70 74 l4 4 l4 -4" stroke="#fff" stroke-width="2" fill="none"/></g>`,
  'sofa-pink': () => `<g transform="translate(252 148)"><rect x="0" y="22" width="120" height="44" rx="16" fill="${PINK}" ${S()}/><rect x="10" y="0" width="100" height="40" rx="16" fill="${PINK}" ${S()}/><rect x="-6" y="20" width="22" height="44" rx="10" fill="#F4A7B8" ${S()}/><rect x="104" y="20" width="22" height="44" rx="10" fill="#F4A7B8" ${S()}/><rect x="24" y="12" width="26" height="22" rx="8" fill="#fff" ${S(2)}/></g>`,
  'sofa-lav': () => `<g transform="translate(252 148)"><rect x="0" y="22" width="120" height="44" rx="16" fill="${LAV}" ${S()}/><rect x="10" y="0" width="100" height="40" rx="16" fill="#D3C6E2" ${S()}/><rect x="-6" y="20" width="22" height="44" rx="10" fill="#B6A4CA" ${S()}/><rect x="104" y="20" width="22" height="44" rx="10" fill="#B6A4CA" ${S()}/><rect x="70" y="12" width="26" height="22" rx="8" fill="${PINK}" ${S(2)}/></g>`,
  desk: () => `<g transform="translate(176 112)"><rect x="0" y="40" width="64" height="8" rx="3" fill="#E8C7AE" ${S()}/><path d="M6 48 v34 M58 48 v34" ${S(3.4)}/><rect x="14" y="16" width="36" height="24" rx="4" fill="#EDE5F7" ${S()}/><rect x="10" y="38" width="44" height="5" rx="2" fill="#D9CCEC" ${S(2)}/><rect x="52" y="26" width="8" height="14" rx="2" fill="${HOT}" ${S(1.8)}/></g>`,
  'shelf-books': () => `<g transform="translate(312 30)"><rect x="0" y="0" width="64" height="70" rx="6" fill="#F5E1CF" ${S()}/><path d="M0 34 h64" ${S()}/>${[[6, PINK], [16, LAV], [26, '#BFD7F0'], [36, '#FFE29A'], [46, '#B9DCCB']].map(([x, c]) => `<rect x="${x}" y="8" width="8" height="24" rx="2" fill="${c}" ${S(1.6)}/>`).join('')}${[[8, '#B9DCCB'], [18, PINK], [28, LAV]].map(([x, c]) => `<rect x="${x}" y="42" width="8" height="24" rx="2" fill="${c}" ${S(1.6)}/>`).join('')}<circle cx="50" cy="56" r="8" fill="${LEAF}" ${S(1.6)}/></g>`,
  kitchen: () => `<g transform="translate(-4 74)"><rect x="0" y="0" width="44" height="30" rx="6" fill="#fff" ${S()}/><circle cx="12" cy="16" r="5" fill="${PINK}"/><circle cx="30" cy="16" r="5" fill="${LAV}"/><path d="M8 -10 q6 -8 0 -14" stroke="${LAV}" stroke-width="2" fill="none"/></g>`,
  'rug-round': () => `<ellipse cx="200" cy="224" rx="92" ry="20" fill="#F9D0DC" ${S()}/><ellipse cx="200" cy="224" rx="70" ry="13" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6"/>`,
  'plant-small': () => `<g>${pot(132, 196, 0.9)}<path d="M132 196 q-14 -18 -4 -30 q8 12 4 30 q2 -22 14 -26 q4 16 -14 26" fill="${LEAF}" ${S(2)}/></g>`,
  'plant-monstera': () => `<g>${pot(382, 196, 1.1)}<path d="M382 196 v-30" ${S(2.4)}/><ellipse cx="368" cy="160" rx="16" ry="12" fill="${LEAF_D}" ${S(2)}/><ellipse cx="394" cy="152" rx="15" ry="11" fill="${LEAF}" ${S(2)}/><ellipse cx="380" cy="138" rx="14" ry="10" fill="${LEAF}" ${S(2)}/></g>`,
  'plant-hanging': () => `<g><path d="M250 0 v20" ${S(2)}/><path d="M238 20 h24 l-4 14 h-16z" fill="#F4C3A5" ${S(2)}/><path d="M240 32 q-6 20 -2 34 M250 34 q0 16 4 28 M258 32 q8 14 6 24" fill="none" stroke="${LEAF_D}" stroke-width="3"/>${[[238, 50], [242, 62], [252, 48], [255, 60], [263, 48]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.6" fill="${LEAF}"/>`).join('')}</g>`,
  lamp: () => `<g><path d="M240 200 v-70" ${S(3)}/><ellipse cx="240" cy="202" rx="12" ry="4" fill="#E8C7AE" ${S(2)}/><path d="M226 132 h28 l-6 -22 h-16z" fill="#FFE8B0" ${S()}/><ellipse cx="240" cy="150" rx="26" ry="14" fill="#FFE8B0" opacity=".35"/></g>`,
  'art-cow': () => `<g transform="translate(190 34)"><rect x="0" y="0" width="54" height="44" rx="6" fill="#fff" ${S()}/><g transform="translate(9 4) scale(.18)">${cow('happy', 'bow')}</g></g>`,
  'art-heart': () => `<g transform="translate(196 36)"><rect x="0" y="0" width="44" height="40" rx="6" fill="#fff" ${S()}/><path transform="translate(22 12)" d="M0 4 C-2 -2 -10 -2 -10 4 C-10 9 -4 12 0 16 C4 12 10 9 10 4 C10 -2 2 -2 0 4Z" fill="${HOT}"/></g>`,
  'garland-spring': () => `<path d="M0 8 q100 26 200 0 q100 26 200 0" fill="none" ${S(1.8)}/>${Array.from({ length: 13 }, (_, i) => { const x = 14 + i * 30, y = 8 + Math.sin((x % 200) / 200 * Math.PI) * 13; return `<circle cx="${x}" cy="${y + 4}" r="5" fill="${['#F48FB1', '#FFE29A', '#fff', LAV][i % 4]}" ${S(1.4)}/>` }).join('')}`,
  'garland-xmas': () => `<path d="M0 8 q100 26 200 0 q100 26 200 0" fill="none" stroke="${LEAF_D}" stroke-width="3"/>${Array.from({ length: 13 }, (_, i) => { const x = 14 + i * 30, y = 8 + Math.sin((x % 200) / 200 * Math.PI) * 13; return `<ellipse cx="${x}" cy="${y + 6}" rx="3.5" ry="5" fill="${['#E86A7D', '#FFE29A', '#9CCFB4', '#BFD7F0'][i % 4]}"/>` }).join('')}`,
  'garland-uni': () => `<path d="M0 6 q100 22 200 0 q100 22 200 0" fill="none" ${S(1.8)}/>${Array.from({ length: 12 }, (_, i) => { const x = 18 + i * 32, y = 6 + Math.sin((x % 200) / 200 * Math.PI) * 11; return `<path d="M${x - 8} ${y} h16 l-8 14z" fill="${[LAV, PINK, '#FFE29A'][i % 3]}" ${S(1.4)}/>` }).join('')}`,
  moto: () => `<g transform="translate(330 220)"><circle cx="0" cy="12" r="9" fill="#fff" ${S()}/><circle cx="34" cy="12" r="9" fill="#fff" ${S()}/><path d="M0 12 l12 -16 h16 l6 16" fill="none" ${S(3)}/><path d="M8 -2 h20 q4 -8 -2 -10 h-14z" fill="${HOT}" ${S(2)}/><path d="M28 -4 l6 -10" ${S(2.6)}/></g>`,
  tv: () => `<g transform="translate(176 112)"><rect x="0" y="0" width="64" height="40" rx="5" fill="#2F2A3A" ${S()}/><rect x="5" y="5" width="54" height="30" rx="2" fill="#BFD7F0"/><path d="M12 28 q10 -14 20 -4 q10 -12 22 2" fill="none" stroke="#fff" stroke-width="2.4"/><rect x="-4" y="40" width="72" height="10" rx="3" fill="#E8C7AE" ${S()}/><path d="M4 50 v30 M60 50 v30" ${S(3.4)}/></g>`,
  nightstand: () => `<g transform="translate(118 176)"><rect x="0" y="0" width="34" height="40" rx="5" fill="#F5E1CF" ${S()}/><path d="M0 20 h34" ${S(2)}/><circle cx="17" cy="11" r="2.4" fill="${INK}"/><circle cx="17" cy="30" r="2.4" fill="${INK}"/><path d="M10 0 v-10 h14 v10" fill="#FFE8B0" ${S(2)}/></g>`,
  clock: () => `<g transform="translate(160 30)"><circle r="16" fill="#fff" ${S()}/><path d="M0 0 v-9 M0 0 l7 4" ${S(2.4)}/><circle r="2" fill="${HOT}"/></g>`,
  'leo-bed': () => `<ellipse cx="318" cy="232" rx="36" ry="12" fill="#D9D5E0" ${S()}/><ellipse cx="318" cy="228" rx="26" ry="7" fill="#fff"/>`,
  'negra-bed': () => `<ellipse cx="96" cy="236" rx="38" ry="12" fill="${PINK}" ${S()}/><ellipse cx="96" cy="232" rx="27" ry="7" fill="#fff"/>`,
}

export function scene(placed, opts = {}) {
  const w = WALLS[placed.wall] || WALLS['wall-pink']
  const order = ['window', 'season', 'clock', 'wallart', 'shelf', 'hanging', 'kitchen', 'rug', 'bed', 'nightstand', 'desk', 'tv', 'sofa', 'lamp', 'plantL', 'plantR', 'leoBed', 'negraBed', 'toy']
  const dots = Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 47) % 400}" cy="${18 + ((i * 29) % 140)}" r="${w.stars ? 1.6 : 2.4}" fill="${w.dots}" opacity=".9"/>`).join('')
  const stars = w.stars ? Array.from({ length: 8 }, (_, i) => `<path transform="translate(${30 + i * 48} ${30 + ((i * 37) % 90)}) scale(.5)" d="M0 -9 Q1.5 -1.5 9 0 Q1.5 1.5 0 9 Q-1.5 1.5 -9 0 Q-1.5 -1.5 0 -9Z" fill="#F6D27B"/>`).join('') : ''
  const planks = Array.from({ length: 6 }, (_, i) => `<path d="M0 ${176 + i * 15} H400" stroke="${w.plank}" stroke-width="1.6"/>`).join('')
  let s = `<rect width="400" height="172" fill="${w.wall}"/>${dots}${stars}<rect y="170" width="400" height="90" fill="${w.floor}"/>${planks}<path d="M0 170 H400" stroke="#fff" stroke-width="5"/>`
  for (const slot of order) { const id = placed[slot]; if (id && DRAW[id]) s += DRAW[id]() }
  const pet = opts.pet || {}
  s += pets({ negra: [placed.negraBed ? 58 : 60, placed.negraBed ? 186 : 182], leo: [placed.leoBed ? 282 : 286, 182] }, { ...opts, showLeo: placed.leo !== null, showNegra: placed.negra !== null })
  s += `<g transform="translate(140 118) scale(.62)">${cow(pet.pose || 'happy', opts.accessory)}</g>`
  if (w.night) s += `<rect width="400" height="260" fill="#2a2140" opacity=".08"/>`
  return s
}

// Recorte de la escena para las miniaturas de la tienda
export const SLOT_BOX = { window: '40 18 130 100', bed: '0 110 130 130', sofa: '240 130 140 100', desk: '165 100 90 100', shelf: '300 22 90 90', kitchen: '-10 50 70 70', rug: '100 190 200 60', plantL: '105 150 60 70', plantR: '345 120 60 90', hanging: '220 0 60 80', lamp: '205 100 70 110', wallart: '180 25 80 60', season: '0 0 400 60', toy: '310 195 75 50', leoBed: '270 200 95 50', negraBed: '50 205 95 45', tv: '165 100 90 100', nightstand: '108 160 54 60', clock: '136 6 48 48', wall: '0 0 400 260', leo: '270 160 110 100', negra: '40 165 110 100' }
