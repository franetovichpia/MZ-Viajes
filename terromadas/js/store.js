// Capa de datos. Con Firebase configurado usa Firestore + Auth; si no, modo demo (localStorage).
import { CONFIG } from './config.js';
import { SEED_PACKAGES, SEED_PHOTOS } from './seed.js';

const FB_VER = '10.12.2';
const FB = `https://www.gstatic.com/firebasejs/${FB_VER}`;
export const isDemo = !CONFIG.firebase.apiKey;

// ---------- MODO DEMO ----------
const LS = 'terromadas-demo-v1';
const load = () => {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s) return s; } catch {}
  return { settings: { ...CONFIG.defaults }, packages: SEED_PACKAGES, photos: SEED_PHOTOS };
};
const persist = s => {
  try { localStorage.setItem(LS, JSON.stringify(s)); }
  catch { throw new Error('No hay más espacio en el navegador (modo demo). Usá fotos más livianas.'); }
};

const demo = {
  async getSettings() { return { ...CONFIG.defaults, ...load().settings }; },
  async saveSettings(v) { const s = load(); s.settings = v; persist(s); },
  async listPackages() { return load().packages; },
  async getPhotos(id) { return load().photos[id] || []; },
  async savePackage(pkg, photos) {
    const s = load();
    const i = s.packages.findIndex(p => p.id === pkg.id);
    if (i >= 0) s.packages[i] = pkg; else s.packages.push(pkg);
    if (photos) s.photos[pkg.id] = photos;
    persist(s);
  },
  async patchPackage(id, patch) {
    const s = load();
    const p = s.packages.find(x => x.id === id);
    if (p) Object.assign(p, patch);
    persist(s);
  },
  async deletePackage(id) {
    const s = load();
    s.packages = s.packages.filter(p => p.id !== id);
    delete s.photos[id];
    persist(s);
  },
  async login(_email, pw) {
    if (pw !== CONFIG.demoPassword) throw new Error('Contraseña incorrecta');
    sessionStorage.setItem('terromadas-demo-auth', '1');
  },
  async logout() { sessionStorage.removeItem('terromadas-demo-auth'); },
  onAuth(cb) { cb(sessionStorage.getItem('terromadas-demo-auth') ? { email: 'demo' } : null); },
  async resetDemo() { localStorage.removeItem(LS); }
};

// ---------- FIREBASE ----------
let _fb;
async function fb() {
  if (_fb) return _fb;
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-firestore.js`)
  ]);
  const app = initializeApp(CONFIG.firebase);
  _fb = { auth: auth.getAuth(app), db: fs.getFirestore(app), a: auth, f: fs };
  return _fb;
}

const real = {
  async getSettings() {
    const { db, f } = await fb();
    const snap = await f.getDoc(f.doc(db, 'site', 'settings'));
    return { ...CONFIG.defaults, ...(snap.exists() ? snap.data() : {}) };
  },
  async saveSettings(v) { const { db, f } = await fb(); await f.setDoc(f.doc(db, 'site', 'settings'), v); },
  async listPackages() {
    const { db, f } = await fb();
    const snap = await f.getDocs(f.collection(db, 'packages'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  },
  async getPhotos(id) {
    const { db, f } = await fb();
    const snap = await f.getDoc(f.doc(db, 'photos', id));
    return snap.exists() ? snap.data().list || [] : [];
  },
  async savePackage(pkg, photos) {
    const { db, f } = await fb();
    const { id, ...data } = pkg;
    await f.setDoc(f.doc(db, 'packages', id), data);
    if (photos) await f.setDoc(f.doc(db, 'photos', id), { list: photos });
  },
  async patchPackage(id, patch) { const { db, f } = await fb(); await f.updateDoc(f.doc(db, 'packages', id), patch); },
  async deletePackage(id) {
    const { db, f } = await fb();
    await f.deleteDoc(f.doc(db, 'packages', id));
    await f.deleteDoc(f.doc(db, 'photos', id));
  },
  async login(email, pw) { const { auth, a } = await fb(); await a.signInWithEmailAndPassword(auth, email, pw); },
  async logout() { const { auth, a } = await fb(); await a.signOut(auth); },
  async onAuth(cb) { const { auth, a } = await fb(); a.onAuthStateChanged(auth, u => cb(u ? { email: u.email } : null)); }
};

export const store = isDemo ? demo : real;
