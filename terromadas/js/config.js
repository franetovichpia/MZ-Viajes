// ============================================================
//  CONFIGURACIÓN DE TERROMADAS
//  Mientras "firebase.apiKey" esté vacío, el sitio funciona en
//  MODO DEMO (datos guardados solo en este navegador).
//  Para el sitio real, completá los datos de Firebase (ver README.md).
// ============================================================
export const CONFIG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: ''
  },
  // Solo se usa en modo demo para entrar a admin.html
  demoPassword: 'terromadas',
  // Tope de ofertas destacadas activas
  maxOffers: 5,
  // Valores iniciales de "Ajustes" (el dueño los cambia desde el panel)
  defaults: {
    whatsapp: '5491121542210',
    armaUrl: '',
    heroTitle: 'Viajá distinto. Viajá terromada.',
    heroText: 'Paquetes, escapadas y viajes armados a tu medida, con atención personal de principio a fin.',
    about: 'Somos Terromadas, una agencia de turismo para quienes viajan con ganas de vivir cada lugar. Te acompañamos desde que elegís el destino hasta que volvés, con propuestas claras, precios transparentes y trato directo.',
    instagram: 'terromadas',
    email: '',
    city: '',
    heroImage: ''
  }
};
