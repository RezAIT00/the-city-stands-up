import * as THREE from 'three';
const QS = new URLSearchParams(location.search), DEMO = QS.get('demo') === '1', DEV = QS.get('dev') === '1';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: DEMO || DEV });
renderer.autoClear = false; renderer.sortObjects = false; renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.enabled = false; renderer.info.autoReset = false; renderer.debug.checkShaderErrors = DEV || DEMO;
const gl = renderer.getContext();
const CLIP = gl.getExtension('EXT_clip_control'); if (CLIP) CLIP.clipControlEXT(CLIP.LOWER_LEFT_EXT, CLIP.ZERO_TO_ONE_EXT);
gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_float_blend'); gl.getExtension('OES_texture_float_linear');
const dbgExt = gl.getExtension('WEBGL_debug_renderer_info'); const GPU_NAME = dbgExt ? gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL) : 'unknown';
window.gpuName = GPU_NAME;
// ---- quality. film = deterministic offline render
const Q = { film: DEMO, shadow: DEMO ? 4096 : 2048, sub: +(QS.get('sub') || (DEMO ? 8 : 1)), ss: +(QS.get('ss') || (DEMO ? 2 : 1)), lodK: DEMO ? 1.7 : .8, volDiv: DEMO ? 4 : 3 };
// ---- shared uniforms
const G = {};
const U = (name, value) => (G[name] = { value });
['uVP', 'uVPnj', 'uPrevVP', 'uInvVP'].forEach(n => U(n, new THREE.Matrix4()));
U('uCam', new THREE.Vector3()); U('uCR', new THREE.Vector3(1, 0, 0)); U('uCU', new THREE.Vector3(0, 1, 0)); U('uCF', new THREE.Vector3(0, 0, -1)); U('uTan', new THREE.Vector2(1, 1)); U('uJit', new THREE.Vector2()); U('uNear', .12); U('uRes', new THREE.Vector2(1, 1));
U('uTime', 0); U('uFrame', 0); U('uSunDir', new THREE.Vector3(0, .3, 1)); U('uSunCol', new THREE.Vector3(1, 1, 1)); U('uStorm', 0); U('uWet', 0); U('uRain', 0); U('uDustCoat', 0); U('uLit', .4); U('uPower', 0); U('uEye', 0); U('uReactor', 0); U('uSignal', 0); U('uFlash', new THREE.Vector4()); U('uExposure', 1);
U('uSky', null); U('uTrans', null); U('uNoise', null); U('uDepth', null); U('uLinZ', null); U('uG0', null); U('uG1', null); U('uG2', null); U('uG3', null); U('uAO', null); U('uShadow', null);
U('uCasVP', [0, 1, 2, 3].map(() => new THREE.Matrix4())); U('uCasR', new THREE.Vector4()); U('uCasTexel', new THREE.Vector4()); U('uShTaps', DEMO ? 14 : 9);
U('uGiant', new Float32Array(16 * 4)); U('uStep', new Float32Array(8 * 4)); U('uCloudA', new THREE.Vector4(330, 560, .4, 0)); U('uShock', new THREE.Vector4(0, 0, 0, -1)); U('uShockP', new THREE.Vector4()); U('uBeam0', new THREE.Vector4()); U('uBeam1', new THREE.Vector4()); U('uHole', new THREE.Vector4(0, 0, 0, 0));
U('uSigR', 0); U('uSigG', new THREE.Vector4()); U('uTitan', new THREE.Vector4(0, 0, 1, 0)); U('uEyeDir', new THREE.Vector3(0, 0, 1)); U('uSea', new THREE.Vector4(-4, 0, 0, 0)); U('uGeo', null); U('uBlast', new THREE.Vector4(0, 0, 0, -1));
const GLSL_V = `precision highp float; precision highp int; precision highp sampler2D; precision highp sampler3D;
uniform mat4 uVP, uVPnj, uPrevVP; uniform vec3 uCam; uniform float uTime; uniform vec4 uStep[8];
vec3 qr(vec4 q, vec3 v){ vec3 t = 2.*cross(q.xyz, v); return v + q.w*t + cross(q.xyz, t); }
float h11(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 h31(float p){ vec3 p3 = fract(vec3(p)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
// ground shock from giant footsteps: xyz = place, w = start time. cars, lamps and people hop when the wave arrives
float groundHop(vec3 p, float amp){ float y = 0.; for(int i=0;i<8;i++){ vec4 s = uStep[i]; if(s.w < -900.) continue; float d = distance(p.xz, s.xy); float t = uTime - s.w - d/420.; if(t>0. && t<1.6){ float a = s.z*amp/(1.+d*.006); float T = .62*sqrt(max(a,.05)/1.2); float u = t/T; if(u<1.) y += a*4.*u*(1.-u); else if(u<1.5){ float v=(u-1.)*2.; y += a*.22*4.*v*(1.-v); } } } return y; }
`;
const GLSL_F = `precision highp float; precision highp int; precision highp sampler2D; precision highp sampler3D;
uniform vec3 uCam, uCR, uCU, uCF, uSunDir, uSunCol; uniform vec2 uTan, uJit, uRes; uniform float uNear, uTime, uFrame, uStorm, uWet, uRain, uDustCoat, uLit, uPower, uEye, uReactor, uSignal, uExposure; uniform vec4 uFlash; uniform sampler3D uNoise;
#define PI 3.14159265
float sat(float x){ return clamp(x,0.,1.); } vec3 sat(vec3 x){ return clamp(x,0.,1.); }
float h11(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float h31(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float ign(vec2 p){ p += uFrame*vec2(5.588238, 3.1735); return fract(52.9829189*fract(dot(p, vec2(.06711056,.00583715)))); }
vec2 octE(vec3 n){ n /= abs(n.x)+abs(n.y)+abs(n.z); vec2 e = n.z>=0. ? n.xy : (1.-abs(n.yx))*vec2(n.x>=0.?1.:-1., n.y>=0.?1.:-1.); return e; }
vec3 octD(vec2 e){ vec3 n = vec3(e, 1.-abs(e.x)-abs(e.y)); float t = max(-n.z,0.); n.xy += vec2(n.x>=0.?-t:t, n.y>=0.?-t:t); return normalize(n); }
vec3 rayDir(vec2 uv){ vec2 n = uv*2.-1. - uJit; return uCF + uCR*n.x*uTan.x + uCU*n.y*uTan.y; } // not normalised: scale by linear depth
float lum(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
`;
const FS_V = `in vec3 position; out vec2 vUv; void main(){ vUv = position.xy*.5+.5; gl_Position = vec4(position.xy, 0., 1.); }`;
function rawMat(o) {
  const m = new THREE.RawShaderMaterial(Object.assign({ glslVersion: THREE.GLSL3, depthFunc: THREE.GreaterEqualDepth, side: THREE.FrontSide }, o.state || {}, {
    vertexShader: (o.fs2d ? 'precision highp float;\n' : GLSL_V) + o.vs, fragmentShader: GLSL_F + o.fs, defines: o.defines || {}, uniforms: Object.assign({}, G, o.uniforms || {}) })); m.name = o.name || ''; return m;
}
const fsGeo = new THREE.BufferGeometry(); fsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
const fsScene = new THREE.Scene(), fsMesh = new THREE.Mesh(fsGeo); fsMesh.frustumCulled = false; fsScene.add(fsMesh); fsScene.matrixWorldAutoUpdate = false;
const dummyCam = new THREE.Camera(); dummyCam.matrixWorldAutoUpdate = false;
function pass(name, fs, uniforms, o = {}) { return rawMat({ name, vs: FS_V, fs2d: true, fs: 'in vec2 vUv;\n' + fs, uniforms, defines: o.defines, state: Object.assign({ depthTest: false, depthWrite: false, blending: THREE.NoBlending }, o.state || {}) }); }
function runPass(mat, rt) { fsMesh.material = mat; renderer.setRenderTarget(rt); renderer.render(fsScene, dummyCam); }
function RT(w, h, o = {}) { return new THREE.WebGLRenderTarget(w, h, Object.assign({ depthBuffer: false, stencilBuffer: false, type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping }, o)); }
function makeScene() { const s = new THREE.Scene(); s.matrixWorldAutoUpdate = false; return s; }
function mesh(geo, mat, scene) { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false; if (scene) scene.add(m); return m; }
const sceneG = makeScene(), sceneS = [0, 1, 2, 3].map(makeScene), sceneT = makeScene(), sceneW = makeScene(), sceneL = makeScene();
