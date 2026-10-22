// Datos de ejemplo SOLO para el modo demo. Las imágenes son ilustraciones generadas.
const scene = (c1, c2, c3) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="620" cy="170" r="62" fill="#fff" opacity=".75"/><path d="M0 420 L170 250 L300 380 L450 200 L640 400 L800 300 V600 H0Z" fill="${c3}" opacity=".85"/><path d="M0 500 L220 360 L420 480 L620 340 L800 460 V600 H0Z" fill="#12261d" opacity=".55"/></svg>`);

const mk = (id, o) => ({
  id, status: 'active', offer: false, offerOrder: 0, oldPrice: null, currency: 'ARS',
  priceNote: 'por persona', createdAt: Date.now(), ...o
});

export const SEED_PACKAGES = [
  mk('demo1', { category: 'Argentina', title: 'Bariloche clásico', destination: 'Bariloche, Río Negro', duration: '7 noches', dates: ['12/12/2026 al 19/12/2026', '09/01/2027 al 16/01/2027'], price: 890000, oldPrice: 1050000, offer: true, offerOrder: 1,
    description: 'Una semana entre lagos y montañas con circuito chico, Cerro Catedral y tiempo libre para recorrer.',
    includes: ['Aéreo ida y vuelta', 'Traslados', '7 noches de hotel con desayuno', 'Excursión Circuito Chico', 'Asistencia al viajero'], thumb: scene('#8fc1d4', '#e7f1ee', '#4f7d8c') }),
  mk('demo2', { category: 'Argentina', title: 'Cataratas del Iguazú', destination: 'Puerto Iguazú, Misiones', duration: '4 noches', dates: ['20/11/2026 al 24/11/2026'], price: 520000, offer: true, offerOrder: 2,
    description: 'Selva, agua y aventura. Visita a ambos lados de las cataratas con guía.',
    includes: ['Bus semicama ida y vuelta', '4 noches de hotel', 'Entradas al Parque Nacional', 'Coordinación en destino'], thumb: scene('#a8d98c', '#f4ecc2', '#3e7a46') }),
  mk('demo3', { category: 'Argentina', title: 'Mendoza y sus bodegas', destination: 'Mendoza', duration: '5 noches', dates: ['05/11/2026 al 10/11/2026', '03/12/2026 al 08/12/2026'], price: 640000,
    description: 'Ruta del vino con degustaciones, alta montaña y gastronomía mendocina.',
    includes: ['Aéreo', '5 noches con desayuno', 'Visita a 3 bodegas', 'Excursión a alta montaña'], thumb: scene('#e9b3a3', '#fbeedd', '#8a3f4d') }),
  mk('demo4', { category: 'Argentina', title: 'Salta y Jujuy', destination: 'Salta y Jujuy', duration: '6 noches', dates: ['14/11/2026 al 20/11/2026'], price: 720000, offer: true, offerOrder: 3, oldPrice: 790000,
    description: 'Quebrada de Humahuaca, Salinas Grandes y los colores del Norte.',
    includes: ['Aéreo', '6 noches de hotel', 'Excursión Quebrada de Humahuaca', 'Salinas Grandes', 'Traslados'], thumb: scene('#f0b27a', '#fdf0d5', '#b4532a') }),
  mk('demo5', { category: 'Full Day', title: 'Escapada a Colonia', destination: 'Colonia del Sacramento, Uruguay', duration: '3 noches', dates: ['27/11/2026 al 30/11/2026'], price: 310000,
    description: 'Un fin de semana largo en el casco histórico, con barco incluido.',
    includes: ['Buquebús ida y vuelta', '3 noches con desayuno', 'City tour'], thumb: scene('#f6c58e', '#e6f0f5', '#6c7f8f') }),
  mk('demo6', { category: 'Brasil', title: 'Río de Janeiro', destination: 'Río de Janeiro, Brasil', duration: '7 noches', dates: ['06/02/2027 al 13/02/2027'], price: 1250000, status: 'soldout',
    description: 'Playa, Pan de Azúcar y Cristo Redentor.',
    includes: ['Aéreo', '7 noches con desayuno', 'Traslados', 'City tour'], thumb: scene('#7fd0c8', '#fff3c4', '#2f7a6f') }),
  mk('demo7', { category: 'Argentina', title: 'El Calafate y Perito Moreno', destination: 'El Calafate, Santa Cruz', duration: '4 noches', dates: ['10/03/2027 al 14/03/2027'], price: 980000, status: 'paused',
    description: 'El glaciar más famoso de la Patagonia.',
    includes: ['Aéreo', '4 noches', 'Excursión al glaciar'], thumb: scene('#b6d7ef', '#f2f8fb', '#5e8fb3') })
];

export const SEED_PHOTOS = Object.fromEntries(SEED_PACKAGES.map(p => [p.id, [p.thumb]]));
