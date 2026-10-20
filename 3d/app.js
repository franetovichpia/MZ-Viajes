import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
const body = document.body;

/* =====================================================================
   Renderer / scene / camera
   ===================================================================== */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  $('#fallback').style.display = 'flex';
  $('#loader').remove();
  throw e;
}
const PR = Math.min(devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(PR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 420);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.fog = new THREE.Fog('#e6e9ee', 45, 170);

/* =====================================================================
   Sky dome + stars
   ===================================================================== */
const skyU = {
  top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
  glow: { value: new THREE.Color('#ffa070') }, glowAmt: { value: 0 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(200, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform vec3 top, bottom, glow; uniform float glowAmt; varying vec3 vDir;
      void main(){
        float h = smoothstep(-.35,.6,vDir.y);
        vec3 c = mix(bottom, top, h);
        float s = pow(max(dot(normalize(vDir), normalize(vec3(-.3,0.02,.95))),0.),3.);
        c = mix(c, glow, s*glowAmt);
        gl_FragColor = vec4(c,1.);
      }`
  })
);
sky.renderOrder = -10;
scene.add(sky);

const starGeo = new THREE.BufferGeometry();
{
  const n = 2200, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    p.set([r * Math.cos(a) * 170, u * 170, r * Math.sin(a) * 170], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: '#dfe9ff', transparent: true, opacity: 0, depthWrite: false, fog: false }));
stars.renderOrder = -9;
scene.add(stars);

/* =====================================================================
   Cloud sea (fbm shader) + sprite puffs
   ===================================================================== */
const seaLayers = [];
function makeSea(y, scale, cover, speed, opacity) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 }, uLight: { value: new THREE.Color('#fff') }, uShadow: { value: new THREE.Color('#aab') },
      uCam: { value: new THREE.Vector3() }, uOpacity: { value: opacity }, uScale: { value: scale }, uCover: { value: cover }, uSpeed: { value: speed },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform float uTime,uOpacity,uScale,uCover,uSpeed; uniform vec3 uLight,uShadow,uCam; varying vec3 vW;
      float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
      void main(){
        vec2 p = vW.xz*uScale + vec2(uTime*uSpeed, uTime*uSpeed*.4);
        vec2 q = vec2(fbm(p), fbm(p+vec2(5.2,1.3)));
        float d = fbm(p + 1.5*q);
        float cov = smoothstep(uCover-.1, uCover+.2, d);
        float dl = fbm(p + 1.5*q + vec2(.07,.05));
        float shade = clamp((d-dl)*6.+.55, 0., 1.);
        vec3 col = mix(uShadow, uLight, shade);
        float dist = length(vW.xz - uCam.xz);
        float fade = 1. - smoothstep(70., 280., dist);
        float near = smoothstep(2., 14., abs(uCam.y - vW.y));
        gl_FragColor = vec4(col, cov*fade*near*uOpacity);
      }`
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), mat);
  m.position.y = y; m.frustumCulled = false; m.renderOrder = -5;
  scene.add(m); seaLayers.push(m); return m;
}
makeSea(-11, 0.028, 0.46, 0.012, 0.85);
makeSea(-17, 0.016, 0.42, 0.007, 0.9);

function cloudTexture(seed) {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * 0.3 * s;
    const x = s / 2 + Math.cos(a) * d * 1.5, y = s / 2 + Math.sin(a) * d * 0.55 + 10, rad = s * (0.12 + rnd() * 0.17);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.35 + rnd() * 0.25})`); gr.addColorStop(0.55, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const cloudTex = [1, 2, 3, 4].map(cloudTexture);
const cloudTint = new THREE.Color('#fff');
const puffs = [];
function addPuff(x, y, z, size, op, drift = 0.03, hero = false) {
  const mat = new THREE.SpriteMaterial({ map: cloudTex[(Math.random() * 4) | 0], transparent: true, opacity: op, depthWrite: false, color: cloudTint });
  mat.rotation = Math.random() * 6.28;
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z); s.scale.set(size * 1.5, size, 1);
  s.userData = { drift, base: op, phase: Math.random() * 6, hero };
  scene.add(s); puffs.push(s);
}
addPuff(-4.5, -3.6, 5.2, 6.5, 0.6, 0.03, true);
addPuff(-8.5, -4.2, 4.6, 8, 0.65, 0.03, true);
addPuff(-2.0, -5.4, 6.0, 7, 0.55, 0.03, true);
addPuff(-12.5, -3.6, 5.4, 9, 0.5, 0.03, true);
{ let seed = 11; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 12; i++) addPuff((R() - .5) * 90, -4 - R() * 6, -26 - R() * 30, 14 + R() * 14, 0.22 + R() * 0.25, 0.2); }

/* =====================================================================
   Airliner
   ===================================================================== */
const plane = new THREE.Group();
scene.add(plane);

function fuselageTexture() {
  const W = 1024, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  // panel seams
  g.strokeStyle = 'rgba(0,0,0,.20)'; g.lineWidth = 2;
  for (let y = 40; y < H; y += 96) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.12)';
  for (let x = 0; x < W; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  // cheatline (orange) under the windows — one per side
  for (const cx of [0.468, 0.032]) {
    const x = cx * W;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,122,47,0)'); gr.addColorStop(.12, '#ff7a2f'); gr.addColorStop(.88, '#ff7a2f'); gr.addColorStop(1, 'rgba(255,122,47,0)');
    g.fillStyle = gr; g.fillRect(x - 11, 0, 22, H);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 14, 0, 3, H);
  }
  // livery text (viewer side, reads toward the nose)
  g.save(); g.translate(0.524 * W, 1090); g.rotate(-Math.PI / 2);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.font = '600 58px Inter, Helvetica, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '14px';
  g.fillText('HORIZONTE VIAJES', 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.offset.x = 0.5; t.anisotropy = 8;
  return t;
}
function wingTexture() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 3; g.strokeRect(0, 0, s, s);
  g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, s * .5); g.lineTo(s, s * .5); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.3, 0.3); t.anisotropy = 8; return t;
}
const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#5a5f69', metalness: 0.92, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25, envMapIntensity: 1.2 });
const fusMat = bodyMat.clone(); fusMat.map = fuselageTexture();
const darkMat = new THREE.MeshPhysicalMaterial({ color: '#3a3e46', metalness: 0.9, roughness: 0.42, clearcoat: 0.5, envMapIntensity: 1.1 });
const wingMat = new THREE.MeshPhysicalMaterial({ color: '#626772', metalness: 0.9, roughness: 0.34, clearcoat: 0.6, envMapIntensity: 1.2, map: wingTexture() });
const finMat = new THREE.MeshPhysicalMaterial({ color: '#ff7a2f', metalness: 0.6, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.2, envMapIntensity: 1.0 });

const smoothLathe = (pts, n = 120) => new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getSpacedPoints(n).map(p => new THREE.Vector2(Math.max(p.x, 0), p.y));

// fuselage + windows
{
  const geo = new THREE.LatheGeometry(smoothLathe([[0,-10.4],[0.2,-10.2],[0.5,-9.2],[0.85,-7.6],[1.15,-5.6],[1.28,-3.6],[1.32,-1.5],[1.32,4.5],[1.26,6.4],[1.08,7.9],[0.8,9.0],[0.45,9.8],[0.12,10.25],[0,10.4]], 160), 96);
  geo.rotateZ(-Math.PI / 2);
  plane.add(new THREE.Mesh(geo, fusMat));

  const wGeo = new THREE.PlaneGeometry(0.2, 0.15);
  const wMat = new THREE.MeshStandardMaterial({ color: '#0e1118', metalness: 0.4, roughness: 0.15 });
  const xs = []; for (let x = -4.6; x <= 5.6; x += 0.52) xs.push(x);
  const inst = new THREE.InstancedMesh(wGeo, wMat, xs.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const yy = 0.42, Rr = 1.32, zz = Math.sqrt(Rr * Rr - yy * yy) + 0.004, tilt = Math.asin(yy / Rr);
  let k = 0;
  for (const side of [1, -1]) for (const x of xs) {
    e.set(-tilt * side, side === 1 ? 0 : Math.PI, 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, yy, zz * side), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(k++, m);
  }
  plane.add(inst);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), wMat);
  ws.position.set(8.55, 0.42, 0.62); ws.rotation.set(-0.2, 0.55, 0); plane.add(ws);
  const ws2 = ws.clone(); ws2.position.z = -0.62; ws2.rotation.set(0.2, Math.PI - 0.55, 0); plane.add(ws2);
}

// wings
function makeWing(sign) {
  const sh = new THREE.Shape();
  sh.moveTo(1.9, 0.6); sh.lineTo(-2.2, 10.2); sh.lineTo(-3.7, 10.2); sh.lineTo(-3.5, 9.4); sh.lineTo(-4.1, 0.6); sh.lineTo(1.9, 0.6);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.1, bevelSegments: 4, curveSegments: 4 });
  geo.rotateX(Math.PI / 2); geo.translate(0, 0.08, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.pow(Math.max(p.getZ(i), 0), 1.6) * 0.035);
  geo.computeVertexNormals();
  const w = new THREE.Mesh(geo, wingMat); w.position.y = -0.55; if (sign < 0) w.scale.z = -1;
  const g = new THREE.Group(); g.add(w); return g;
}
plane.add(makeWing(1), makeWing(-1));
for (const sg of [1, -1]) {  // winglets
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(-1.1, 0); sh.lineTo(-1.9, 1.5); sh.lineTo(-1.5, 1.5);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  const a = new THREE.Mesh(geo, wingMat); a.position.set(-2.55, -0.55 + Math.pow(10.2, 1.6) * 0.035, 10.25 * sg); plane.add(a);
}

// tail
{
  const fin = new THREE.Shape(); fin.moveTo(-5.4, 1.0); fin.lineTo(-8.9, 6.1); fin.lineTo(-10.3, 6.1); fin.lineTo(-10.2, 1.2); fin.lineTo(-5.4, 1.0);
  const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 3 });
  fg.translate(0, 0, -0.06); plane.add(new THREE.Mesh(fg, finMat));
  const st = new THREE.Shape(); st.moveTo(-8.0, 0.4); st.lineTo(-10.0, 4.0); st.lineTo(-10.9, 4.0); st.lineTo(-10.6, 0.4);
  const sg = new THREE.ExtrudeGeometry(st, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2 });
  sg.rotateX(Math.PI / 2); sg.translate(0, 0.3, 0);
  const sa = new THREE.Mesh(sg, wingMat), sb = new THREE.Mesh(sg, wingMat); sb.scale.z = -1; plane.add(sa, sb);
}

// engines
const fanTex = (() => {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), m = s / 2;
  g.fillStyle = '#1a0d05'; g.fillRect(0, 0, s, s);
  const bg = g.createRadialGradient(m, m, 0, m, m, m);
  bg.addColorStop(0, '#fff2c4'); bg.addColorStop(0.35, '#ffa84a'); bg.addColorStop(0.8, '#c4511a'); bg.addColorStop(1, '#3a1608');
  g.fillStyle = bg; g.beginPath(); g.arc(m, m, m * 0.97, 0, 7); g.fill();
  for (let i = 0; i < 26; i++) {
    g.save(); g.translate(m, m); g.rotate((i / 26) * Math.PI * 2);
    const gr = g.createLinearGradient(0, 0, m, 0); gr.addColorStop(0, 'rgba(40,14,3,.85)'); gr.addColorStop(1, 'rgba(60,20,4,.55)'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(m * 0.1, 0); g.quadraticCurveTo(m * 0.55, m * 0.02, m * 0.96, m * 0.16); g.lineTo(m * 0.96, m * 0.04); g.quadraticCurveTo(m * 0.55, -m * 0.12, m * 0.1, -m * 0.05); g.fill(); g.restore();
  }
  const hub = g.createRadialGradient(m, m, 0, m, m, m * 0.2); hub.addColorStop(0, '#fff8de'); hub.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = hub; g.beginPath(); g.arc(m, m, m * 0.2, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(g.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const fanMat = new THREE.MeshBasicMaterial({ map: fanTex, color: new THREE.Color(4.2, 3.2, 2.2), toneMapped: false });
const streakTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, 'rgba(255,140,60,0)'); gr.addColorStop(.5, 'rgba(255,190,120,1)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr; g.fillRect(0, 26, 512, 12);
  const vg = g.createLinearGradient(0, 0, 0, 64); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = vg; g.fillRect(0, 0, 512, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const fans = []; let engineLight, streak;
function makeEngine(z, hero) {
  const eng = new THREE.Group();
  const shell = new THREE.LatheGeometry(smoothLathe([[0,-2.25],[0.35,-2.05],[0.62,-1.7],[0.85,-1.1],[1.02,-0.2],[1.14,0.7],[1.18,1.4],[1.12,1.95],[1.06,2.2],[1.0,2.26],[0.95,2.2]], 80), 72).rotateZ(-Math.PI / 2);
  const inner = new THREE.LatheGeometry([[0.95,2.2],[0.92,1.9],[0.9,1.3],[0.9,1.0],[0,1.0]].map(([r, y]) => new THREE.Vector2(r, y)), 48).rotateZ(-Math.PI / 2);
  eng.add(new THREE.Mesh(shell, bodyMat));
  eng.add(new THREE.Mesh(inner, new THREE.MeshStandardMaterial({ color: '#2a1408', metalness: 0.6, roughness: 0.5, emissive: '#7a3410', emissiveIntensity: 0.9, side: THREE.DoubleSide })));
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64).rotateY(Math.PI / 2), fanMat); fan.position.x = 1.0; eng.add(fan); fans.push(fan);
  const spin = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 32).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffe9bb', emissive: '#ffb25a', emissiveIntensity: 1.4, metalness: 0.5, roughness: 0.3 }));
  spin.position.x = 1.25; eng.add(spin);
  const py = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.22), darkMat); py.position.set(-0.2, 1.05, 0); eng.add(py);
  eng.position.set(1.2, -1.95, z); eng.rotation.y = z > 0 ? -0.035 : 0.035;
  if (hero) {
    engineLight = new THREE.PointLight('#ff8a2a', 22, 9, 1.8); engineLight.position.set(3.6, 0, 0.2); eng.add(engineLight);
  }
  plane.add(eng);
}
makeEngine(3.9, true); makeEngine(-3.9, false);

const key = new THREE.DirectionalLight('#fff1e0', 2.2); key.position.set(10, 14, 12); scene.add(key);
const rim = new THREE.DirectionalLight('#b8cdf0', 1.0); rim.position.set(-12, 6, -8); scene.add(rim);
scene.add(new THREE.HemisphereLight('#f3f6fb', '#9aa3b4', 0.55));

/* =====================================================================
   Globe (dotted land, glowing routes)
   ===================================================================== */
const GR = 22;
const GLOBE_POS = new THREE.Vector3(0, 170, 0);
const HOME = { name: 'Buenos Aires', lat: -34.6, lon: -58.4 };
const DESTS = [
  { name: 'Caribe', sub: 'Punta Cana', lat: 18.58, lon: -68.4, price: 'USD 1.490', nights: '7 noches' },
  { name: 'Brasil', sub: 'Río de Janeiro', lat: -22.9, lon: -43.2, price: 'USD 890', nights: '6 noches' },
  { name: 'Patagonia', sub: 'Bariloche', lat: -41.13, lon: -71.3, price: 'USD 1.190', nights: '6 noches' },
  { name: 'Estados Unidos', sub: 'Miami', lat: 25.76, lon: -80.19, price: 'USD 1.650', nights: '8 noches' },
  { name: 'Europa', sub: 'Roma', lat: 41.9, lon: 12.5, price: 'USD 2.350', nights: '12 noches' },
  { name: 'Maldivas', sub: 'Malé', lat: 4.18, lon: 73.51, price: 'USD 2.890', nights: '8 noches' },
];
const ll2v = (lat, lon, r = 1) => {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)).multiplyScalar(r);
};

const globe = new THREE.Group();
globe.position.copy(GLOBE_POS); globe.visible = false; scene.add(globe);
const globeSpin = new THREE.Group(); globe.add(globeSpin);   // rotates toward the active destination

// ocean + atmosphere
globeSpin.add(new THREE.Mesh(new THREE.SphereGeometry(GR * 0.994, 64, 48), new THREE.ShaderMaterial({
  uniforms: { uA: { value: new THREE.Color('#071230') }, uB: { value: new THREE.Color('#2d62b0') } },
  vertexShader: `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 uA,uB; varying vec3 vN,vV; void main(){ float f = pow(1.-abs(dot(normalize(vN),normalize(vV))),2.6); gl_FragColor = vec4(mix(uA,uB,f),1.); }`
})));
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  gr.addColorStop(0, 'rgba(70,130,255,0)'); gr.addColorStop(0.7, 'rgba(70,130,255,0)'); gr.addColorStop(0.745, 'rgba(110,170,255,.55)');
  gr.addColorStop(0.82, 'rgba(70,120,255,.18)'); gr.addColorStop(1, 'rgba(40,80,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const atmo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
atmo.scale.setScalar(GR * 2 / 0.72 * 0.998); globe.add(atmo);

const dotMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uScale: { value: 800 }, uTime: { value: 0 }, uSize: { value: 0.19 }, uLight: { value: new THREE.Vector3(-0.55, 0.45, 0.7).normalize() } },
  vertexShader: `
    attribute float aSeed; uniform float uScale, uSize, uTime; uniform vec3 uLight; varying float vB; varying float vS;
    void main(){
      vec4 mv = modelViewMatrix*vec4(position,1.);
      vec3 wn = normalize(mat3(modelMatrix)*normalize(position));
      float lit = dot(wn, uLight)*.5+.5;
      vec3 vn = normalize(normalMatrix*normalize(position));
      float facing = smoothstep(-.1,.35,vn.z);
      vB = (.35 + .9*lit) * (.88+.12*sin(uTime*1.4+aSeed*40.)) * facing;
      vS = facing;
      gl_PointSize = uSize*uScale/-mv.z;
      gl_Position = projectionMatrix*mv;
    }`,
  fragmentShader: `varying float vB; varying float vS; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.28,d); gl_FragColor = vec4(vec3(.66,.82,1.)*vB, a*vS*.9); }`
});
globeSpin.add(new THREE.Points(new THREE.BufferGeometry(), dotMat)); // geometry filled once the land mask loads
const dots = globeSpin.children[globeSpin.children.length - 1];

function buildDots(img) {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H).data;
  const N = 70000, pos = [], seed = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), th = ga * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;           // unit vector
    const lat = Math.asin(y), lon = Math.atan2(x, z);           // matches ll2v(): x=cos(la)sin(lo), z=cos(la)cos(lo)
    const px = Math.min(W - 1, Math.floor((lon / Math.PI * 0.5 + 0.5) * W)), py = Math.min(H - 1, Math.floor((0.5 - lat / Math.PI) * H));
    if (data[(py * W + px) * 4] < 110) { pos.push(x * GR * 1.002, y * GR * 1.002, z * GR * 1.002); seed.push(Math.random()); }
  }
  dots.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  dots.geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  dots.geometry.computeBoundingSphere();
}

// pins + arcs
const pinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.7, 0.5), toneMapped: false });
const homeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 3.2, 4), toneMapped: false });
const ringGeo = new THREE.RingGeometry(0.62, 0.74, 48);
const markers = [];
function makeMarker(d, mat) {
  const n = ll2v(d.lat, d.lon);
  const g = new THREE.Group(); g.position.copy(n.clone().multiplyScalar(GR * 1.004));
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), mat));
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  g.add(ring); globeSpin.add(g);
  return { g, ring, n };
}
const home = makeMarker(HOME, homeMat);
const arcMat = (act) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uProg: { value: 1 }, uAct: { value: act } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uProg,uAct; varying vec2 vUv;
    void main(){
      float vis = step(vUv.x, uProg);
      float tail = smoothstep(uProg-.3, uProg, vUv.x);
      float base = .3 + .7*uAct;
      float head = exp(-pow((vUv.x-uProg)*16.,2.))*uAct;
      vec3 col = vec3(1.,.52,.18)*(1.+head*2.5);
      gl_FragColor = vec4(col, min(1., (vis*base*(.35+.65*tail) + head*.8)*1.8));
    }`
});
DESTS.forEach((d, i) => {
  d.n = ll2v(d.lat, d.lon);
  d.marker = makeMarker(d, pinMat);
  const a = home.n, b = d.n, ang = a.angleTo(b);
  const mid = a.clone().add(b).normalize().multiplyScalar(GR * (1.04 + ang * 0.2));
  d.curve = new THREE.QuadraticBezierCurve3(a.clone().multiplyScalar(GR * 1.004), mid, b.clone().multiplyScalar(GR * 1.004));
  d.arc = new THREE.Mesh(new THREE.TubeGeometry(d.curve, 90, 0.085, 5, false), arcMat(0));
  globeSpin.add(d.arc);
});
const traveler = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4, 3), toneMapped: false }));
globeSpin.add(traveler);

/* =====================================================================
   Post-processing
   ===================================================================== */
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.85, 1.7);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmt: { value: 0.02 }, uVig: { value: 0.1 }, uCA: { value: 0.0007 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uAmt,uVig,uCA; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv-.5; float d = dot(c,c);
      vec2 off = c*uCA*d*10.;
      vec3 col = vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
      col *= 1. - uVig*smoothstep(.12,.8,d*2.4);
      col += (rnd(vUv*vec2(1920.,1080.)+fract(uTime)*91.)-.5)*uAmt;
      gl_FragColor = vec4(col,1.);
    }`
});
composer.addPass(finalPass);

/* =====================================================================
   Keyframes (one per act)
   ===================================================================== */
const C = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const KF = o => [...o.cam, ...o.tgt, o.fov, ...C(o.top), ...C(o.bot), o.glow, ...C(o.cloud), ...C(o.fog), o.exp, o.space, o.env, o.key];
const K = [
  KF({ cam: [21, -1.0, 19.5], tgt: [0.2, 3.7, 3.0], fov: 30, top: '#c9d0da', bot: '#eceef2', glow: 0, cloud: '#ffffff', fog: '#e9ecf0', exp: 1.0, space: 0, env: 0.75, key: 2.2 }),
  KF({ cam: [-1.0, 1.0, 1.9], tgt: [-4.2, 0.2, 9.0], fov: 55, top: '#7fa3cc', bot: '#f4c3a4', glow: 1, cloud: '#ffd7bf', fog: '#eebba3', exp: 0.8, space: 0, env: 0.35, key: 0.8 }),
  KF({ cam: [-13, 3.5, 17], tgt: [0.5, 3.6, 1.0], fov: 34, top: '#1f3558', bot: '#9fb0cd', glow: 0.35, cloud: '#d3dcef', fog: '#a9b9d3', exp: 0.95, space: 0, env: 0.6, key: 1.8 }),
  KF({ cam: [0, 170, 105], tgt: [10, 170, 0], fov: 32, top: '#02050d', bot: '#0a1634', glow: 0, cloud: '#9fb4d8', fog: '#050a18', exp: 1.0, space: 1, env: 0.3, key: 1.0 }),
  KF({ cam: [12.5, -0.6, 6.8], tgt: [-3.2, -1.3, 8.4], fov: 34, top: '#cfd5de', bot: '#eef0f3', glow: 0, cloud: '#ffffff', fog: '#eceff3', exp: 1.0, space: 0, env: 0.75, key: 2.2 }),
];
const NK = K[0].length, tmp = new Array(NK);
function sample(p) {
  const i = Math.min(Math.floor(p), K.length - 2), t = smooth(clamp(p - i));
  for (let j = 0; j < NK; j++) tmp[j] = K[i][j] + (K[i + 1][j] - K[i][j]) * t;
  return tmp;
}

/* =====================================================================
   Scroll, pointer, UI
   ===================================================================== */
const journey = $('#journey');
const screens = $$('.screen');
const dotBtns = $$('#dots button');
const navLinks = $$('.nav-links a[data-go]');
let target = 0, prog = 0;
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
const jMax = () => Math.max(1, journey.offsetHeight - innerHeight);
const goTo = i => scrollTo({ top: (i / (K.length - 1)) * jMax(), behavior: reduce ? 'auto' : 'smooth' });
function readScroll() {
  const y = scrollY;
  target = clamp(y / jMax()) * (K.length - 1);
  body.classList.toggle('past', y > jMax() - 60);
}
addEventListener('scroll', readScroll, { passive: true });
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
$$('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goTo(+a.dataset.go); }));
$$('[data-scroll]').forEach(a => a.addEventListener('click', e => {
  const el = $(a.getAttribute('href')); if (!el) return;
  e.preventDefault(); el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}));
dotBtns.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

// destinations list + active state
const destList = $('#destList'), pinLabel = $('#pinLabel');
let active = 0, manualUntil = 0, activatedAt = 0;
DESTS.forEach((d, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<span class="n">0${i + 1}</span><span class="t">${d.name}<small>${d.sub} · ${d.nights}</small></span><span class="p">${d.price}</span>`;
  li.addEventListener('pointerenter', () => { setActive(i); manualUntil = performance.now() + 9000; });
  li.addEventListener('click', () => { setActive(i); manualUntil = performance.now() + 9000; });
  destList.appendChild(li);
});
function setActive(i) {
  if (i === active && activatedAt) return;
  active = i; activatedAt = performance.now();
  $$('li', destList).forEach((li, k) => li.classList.toggle('on', k === i));
  pinLabel.textContent = `${DESTS[i].sub} · desde ${DESTS[i].price}`;
}
setActive(0);

// reveal + counters + tilt + form
const io = new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return;
  en.target.classList.add('in'); io.unobserve(en.target);
  $$('[data-count]', en.target).forEach(countUp);
  if (en.target.matches('[data-count]')) countUp(en.target);
}), { threshold: 0.15 });
$$('[data-r]').forEach(el => io.observe(el));
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), dur = 1600;
  const step = now => { const k = clamp((now - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = v + suf; if (k < 1) requestAnimationFrame(step); };
  reduce ? (el.textContent = end + suf) : requestAnimationFrame(step);
}
if (finePointer && !reduce) {
  $$('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transition = 'box-shadow .5s'; card.style.transform = `perspective(900px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateZ(10px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transition = 'transform .8s cubic-bezier(.2,.7,.2,1), box-shadow .5s'; card.style.transform = ''; });
  });
}
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, ok = f.nombre.value.trim() && /\S+@\S+\.\S+/.test(f.email.value);
  [f.nombre, f.email].forEach(i => i.style.borderColor = '');
  if (!ok) { (f.nombre.value.trim() ? f.email : f.nombre).style.borderColor = '#ff6b6b'; (f.nombre.value.trim() ? f.email : f.nombre).focus(); return; }
  $('#sent').classList.add('show'); f.reset();
});
$('#year').textContent = new Date().getFullYear();

/* =====================================================================
   Resize
   ===================================================================== */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h); composer.setPixelRatio(PR);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  readScroll();
}
addEventListener('resize', resize); resize();

/* =====================================================================
   Loop
   ===================================================================== */
const camV = new THREE.Vector3(), tgtV = new THREE.Vector3(), dir = new THREE.Vector3(), tmpV = new THREE.Vector3();
const tq = new THREE.Quaternion(), te = new THREE.Euler();
let last = performance.now(), time = 0, ready = false;
const shadow = new THREE.Color(), botC = new THREE.Color();

const navSec = $$('.nav-links a[data-scroll]').map(a => [a, $(a.getAttribute('href'))]);
function updateSections() {
  if (!body.classList.contains('past')) { navSec.forEach(([a]) => a.classList.remove('on')); return; }
  let cur = null; navSec.forEach(([a, el]) => { if (el && el.getBoundingClientRect().top < innerHeight * 0.45) cur = a; });
  navSec.forEach(([a]) => a.classList.toggle('on', a === cur));
}
addEventListener('scroll', updateSections, { passive: true });

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05); last = now; time += dt;
  const y = scrollY, done = y > journey.offsetHeight + 80;       // content fully covers the canvas
  if (done) return;

  prog += (target - prog) * (reduce ? 1 : 1 - Math.exp(-dt * 4.5));
  mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 3)); mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 3));

  const s = sample(prog), asp = camera.aspect;
  const gw = clamp(1 - Math.abs(prog - 3));                       // closeness to the globe act
  camV.set(s[0], s[1], s[2]); tgtV.set(s[3], s[4], s[5]);
  if (asp < 1) { tgtV.x -= 10 * gw; tgtV.y -= 15 * gw; }          // portrait: globe on top, list below
  const pull = asp < 1 ? 1 + (1 - asp) * 0.9 : 1;
  dir.subVectors(camV, tgtV).multiplyScalar(pull); camV.copy(tgtV).add(dir);
  camV.x += mouse.sx * -0.9 * (1 - gw * 0.9); camV.y += mouse.sy * -0.6 * (1 - gw * 0.9) + Math.sin(time * 0.6) * 0.06;
  camera.position.copy(camV); camera.lookAt(tgtV);
  camera.fov = s[6] * (asp < 1 ? 1 + (1 - asp) * 0.35 : 1); camera.updateProjectionMatrix();
  plane.rotation.x = Math.sin(time * 0.5) * 0.004; plane.position.y = Math.sin(time * 0.7) * 0.05;

  // atmosphere
  skyU.top.value.setRGB(s[7], s[8], s[9]); skyU.bottom.value.setRGB(s[10], s[11], s[12]); skyU.glowAmt.value = s[13];
  cloudTint.setRGB(s[14], s[15], s[16]);
  scene.fog.color.setRGB(s[17], s[18], s[19]);
  renderer.toneMappingExposure = s[20];
  const space = s[21];
  scene.environmentIntensity = s[22]; key.intensity = s[23];
  key.color.setRGB(1, 0.95 - s[13] * 0.12, 0.88 - s[13] * 0.2);
  sky.position.copy(camera.position); stars.position.copy(camera.position); stars.material.opacity = clamp(space * 1.1);

  // cloud sea
  botC.setRGB(s[10], s[11], s[12]); shadow.setRGB(s[14], s[15], s[16]).multiplyScalar(0.62).lerp(botC, 0.25);
  seaLayers.forEach((m, i) => {
    const u = m.material.uniforms;
    u.uTime.value = time; u.uCam.value.copy(camera.position); u.uLight.value.setRGB(s[14], s[15], s[16]); u.uShadow.value.copy(shadow);
    u.uOpacity.value = (i ? 0.9 : 0.85) * (1 - space);
    m.position.x = camera.position.x; m.position.z = camera.position.z; m.visible = space < 0.98;
  });
  const pv = Math.max(clamp(1 - prog * 2.5), clamp(1 - Math.abs(prog - 4) * 2.5));
  puffs.forEach(c => {
    c.position.x += c.userData.drift * dt; if (c.position.x > 48) c.position.x = -48;
    let o = c.userData.base * (1 - s[13] * 0.45) * (0.92 + 0.08 * Math.sin(time * 0.3 + c.userData.phase)) * (1 - space);
    if (c.userData.hero) o *= pv; c.material.opacity = o;
  });

  // engines
  fans.forEach(f => f.rotation.x += dt * 9);
  if (engineLight) engineLight.intensity = 20 + Math.sin(time * 5) * 1.5;

  // globe
  const showGlobe = prog > 2.2 && prog < 3.85; globe.visible = showGlobe;
  if (showGlobe) {
    dotMat.uniforms.uTime.value = time;
    dotMat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    if (gw > 0.4 && performance.now() > manualUntil && time > 0 && Math.floor(time / 4.2) !== globe.userData.cycle) {
      globe.userData.cycle = Math.floor(time / 4.2); setActive((active + 1) % DESTS.length);
    }
    const d = DESTS[active];
    te.set(THREE.MathUtils.degToRad(d.lat) * 0.92 + 0.18, -THREE.MathUtils.degToRad(d.lon), 0, 'XYZ'); tq.setFromEuler(te);
    globeSpin.quaternion.slerp(tq, 1 - Math.exp(-dt * 2.6));
    globe.rotation.y = Math.sin(time * 0.25) * 0.03;
    const since = (performance.now() - activatedAt) / 1000, grow = clamp(since / 1.5);
    DESTS.forEach((dd, i) => {
      const on = i === active, m = dd.marker;
      dd.arc.material.uniforms.uAct.value += ((on ? 1 : 0) - dd.arc.material.uniforms.uAct.value) * (1 - Math.exp(-dt * 6));
      dd.arc.material.uniforms.uProg.value = on ? Math.max(grow, 0.001) : 1;
      const sc = on ? 1.5 + Math.sin(time * 4) * 0.12 : 0.9; m.g.scale.setScalar(m.g.scale.x + (sc - m.g.scale.x) * 0.12);
      const ph = (time * 0.8 + i * 0.3) % 1; m.ring.scale.setScalar(1 + ph * (on ? 2.4 : 1.2)); m.ring.material.opacity = (1 - ph) * (on ? 0.7 : 0.25);
    });
    { const ph = (time * 0.7) % 1; home.ring.scale.setScalar(1 + ph * 2); home.ring.material.opacity = (1 - ph) * 0.6; }
    const a = DESTS[active], tt = clamp(since / 1.5);
    traveler.visible = tt < 1 || true; traveler.position.copy(a.curve.getPoint(tt < 1 ? tt : (time * 0.35) % 1));
    // floating label above the active pin
    tmpV.copy(a.marker.g.position); globeSpin.localToWorld(tmpV); tmpV.project(camera);
    const front = a.marker.n.clone().applyQuaternion(globeSpin.quaternion).z > 0.15;
    const px = (tmpV.x * 0.5 + 0.5) * innerWidth, py = (-tmpV.y * 0.5 + 0.5) * innerHeight;
    pinLabel.style.transform = `translate(${px.toFixed(1)}px,${(py - 46).toFixed(1)}px) translateX(-50%)`;
    pinLabel.style.opacity = (front && gw > 0.7) ? 1 : 0;
  } else pinLabel.style.opacity = 0;

  // overlays
  body.classList.toggle('dark', prog > 0.6 && prog < 3.5 && !body.classList.contains('past'));
  screens.forEach((el, i) => {
    const d = Math.abs(prog - i), o = clamp(1 - d * 2.2);
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translateY(${((prog - i) * -26).toFixed(1)}px) scale(${(1 - Math.min(d, 1) * 0.015).toFixed(4)})`;
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    el.classList.toggle('live', o > 0.6);
  });
  const idx = Math.round(prog);
  dotBtns.forEach((d, i) => d.classList.toggle('on', i === idx));
  const past = body.classList.contains('past');
  navLinks.forEach(a => a.classList.toggle('on', !past && +a.dataset.go === idx));

  finalPass.uniforms.uTime.value = time;
  composer.render();
  if (!ready) { ready = true; $('#loader').classList.add('done'); }
}

// load land mask, then start
const img = new Image();
const start = () => { readScroll(); prog = target; requestAnimationFrame(frame); };
img.onload = () => { try { buildDots(img); } catch (e) { console.warn('globe dots', e); } start(); };
img.onerror = () => { console.warn('land mask not found'); start(); };
img.src = 'assets/earth-mask.jpg';

window.__setProg = v => { target = v; prog = v; };
window.__ready = () => ready;
