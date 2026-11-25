// ---------- shared GLSL: sky, shadows, brdf, volumes ----------
const GLSL_SKY = `
uniform sampler2D uSky;
vec2 skyUV(vec3 d){ float az = atan(d.x, d.z), saz = atan(uSunDir.x, uSunDir.z); float el = asin(clamp(d.y,-1.,1.)); return vec2(fract((az-saz)/(2.*PI)+.5), .5+.5*sign(el)*sqrt(abs(el)/(PI*.5))); }
vec3 skyL(vec3 d, float lod){ return textureLod(uSky, skyUV(d), lod).rgb; }
vec3 skyAmb(vec3 n){ vec3 up = textureLod(uSky, vec2(.5,.93), 5.).rgb; vec3 h = normalize(vec3(n.x, .18, n.z)+1e-4); vec3 side = textureLod(uSky, skyUV(h), 5.).rgb; vec3 opp = textureLod(uSky, skyUV(vec3(-h.x,.25,-h.z)), 6.).rgb; float u = n.y*.5+.5; vec3 c = mix(mix(side,opp,.3)*.75, up*1.05, u*u); return c; }
`;
const GLSL_SHADOW = `
uniform sampler2D uShadow; uniform mat4 uCasVP[4]; uniform vec4 uCasR, uCasTexel; uniform float uShTaps;
vec3 casCoord(vec3 wp, int c){ return (uCasVP[c]*vec4(wp,1.)).xyz; }
vec2 casUV(vec2 ndc, int c){ return (ndc*.5+.5)*.5 + vec2(float(c&1), float(c>>1))*.5; }
float shTap(vec2 ndc, int c, float z){ return step(z, textureLod(uShadow, casUV(ndc,c), 0.).r); }
float sunShadow(vec3 wp, vec3 n, float dither){
  for(int c=0;c<4;c++){ float tex = uCasTexel[c]; vec3 s = casCoord(wp + n*tex*1.6, c); if(max(abs(s.x),abs(s.y))>.96) continue; float r = uCasR[c]; float z = s.z - 2e-5;
    float an = dither*6.2831; float bl=0., nb=0.; float sr = min(14./r, .08) + 2.*tex/r;
    for(int i=0;i<6;i++){ float a = an+float(i)*2.4; float q = sqrt((float(i)+.5)/6.)*sr; float d = textureLod(uShadow, casUV(clamp(s.xy+vec2(cos(a),sin(a))*q,-.995,.995),c),0.).r; if(d<z-1e-5){ bl+=d; nb+=1.; } }
    if(nb<.5) return 1.; bl/=nb; float pen = clamp((z-bl)*6000.*.011, tex*1.1, 14.)/r; float res=0.; int N=int(uShTaps);
    for(int i=0;i<N;i++){ float a = an+float(i)*2.399963; float q = sqrt((float(i)+.5)/float(N))*pen; res += shTap(clamp(s.xy+vec2(cos(a),sin(a))*q,-.995,.995), c, z); }
    return res/float(N); }
  return 1.; }
float volShadow(vec3 wp){ for(int c=0;c<4;c++){ vec3 s = casCoord(wp,c); if(max(abs(s.x),abs(s.y))>.985) continue; return shTap(s.xy,c,s.z-2e-5); } return 1.; }
`;
const GLSL_BRDF = `
float D_GGX(float nh, float a){ float a2=a*a; float d=nh*nh*(a2-1.)+1.; return a2/(PI*d*d+1e-6); }
float V_Sm(float nv,float nl,float a){ float k=a*.5; return .25/((nv*(1.-k)+k)*(nl*(1.-k)+k)+1e-4); }
vec3 F_S(vec3 f0,float vh){ return f0+(1.-f0)*pow(1.-vh,5.); }
vec3 envBRDF(vec3 f0,float rough,float nv){ vec4 r = rough*vec4(-1.,-.0275,-.572,.022)+vec4(1.,.0425,1.04,-.04); float a004 = min(r.x*r.x, exp2(-9.28*nv))*r.x+r.y; vec2 AB = vec2(-1.04,1.04)*a004+r.zw; return f0*AB.x+AB.y; }
`;
// clouds: slab between uCloudA.x and .y with coverage .z; giants carve it, the shockwave and the beam open it
const GLSL_CLOUD = `
uniform vec4 uCloudA, uShock, uShockP, uBeam0, uBeam1, uHole; uniform vec4 uGiant[16];
float cloudOpen(vec3 p){ float o = 1.;
  if(uShock.w>0.){ float d = distance(p.xz, uShock.xz)+abs(p.y-uShock.y)*.35; o *= smoothstep(uShock.w*.72, uShock.w, d)*(1.+1.4*exp(-pow((d-uShock.w*1.04)/(40.+uShock.w*.06),2.))); if(d>uShock.w*1.3) o = 1.; }
  if(uHole.w>0.){ vec2 a = uHole.xz; float d = distance(p.xz, a); float edge = uHole.w*(.82+.3*texture(uNoise, vec3(p.xz*.0011,.3)).b); o *= smoothstep(edge*.75, edge, d)*(1.+.9*exp(-pow((d-edge*1.08)/(30.+uHole.w*.08),2.))); }
  return o; }
float cloudDens(vec3 p, bool hi){
  float h = (p.y-uCloudA.x)/(uCloudA.y-uCloudA.x); if(h<0.||h>1.) return 0.;
  vec3 q = p*vec3(.00052,.00085,.00052)+vec3(uTime*.0022,0.,uTime*.0012); vec4 n = textureLod(uNoise, q, 0.); float cov = uCloudA.z;
  float prof = smoothstep(0.,.16,h)*smoothstep(1.,.35+.4*cov,h); float big = textureLod(uNoise, p.xzy*vec3(.00013,.00013,.0)+vec3(0.,0.,.37+uTime*.0004), 0.).b;
  float d = n.r*.62+n.b*.5+(big-.5)*.75*(1.-cov*.6) - (1.-cov)*.95 - .18; d *= prof;
  float carve = 1., pile = 0.; for(int i=0;i<16;i++){ vec4 g = uGiant[i]; if(g.w<=0.) continue; float k = length((p-g.xyz)*vec3(1.,.8,1.))/g.w; carve = min(carve, smoothstep(.92,1.35,k)); pile += exp(-pow((k-1.5)*3.2,2.))*.16; }
  d = (d+pile*prof*step(.05,cov))*carve; d *= cloudOpen(p); if(d<=0.) return 0.;
  if(hi){ vec3 e = textureLod(uNoise, p*.0062+vec3(0.,-uTime*.012,uTime*.004), 0.).gbr; d -= (e.x*.5+e.y*.35+.15*e.z)*.22*(1.-d); d = max(d,0.); d = smoothstep(0.,.42,d)*1.15; }
  return d; }
float cloudShadowAt(vec3 wp){ if(uSunDir.y<.02) return 1.; float tH = (mix(uCloudA.x,uCloudA.y,.4)-wp.y)/uSunDir.y; if(tH<0.) return 1.; vec3 p = wp+uSunDir*tH; float d = cloudDens(p,false); p = wp+uSunDir*tH*1.12; d += cloudDens(p,false); return mix(1., exp(-max(d,0.)*(1.2+3.2*uCloudA.z)), smoothstep(.1,.5,uCloudA.z+.1)); }
`;
// dust, smoke, spray and fire: ellipsoid volumes + the dust front that rolls through the real street network
const NBLOB = 40;
const GLSL_VOL = `
uniform vec4 uBA[${NBLOB}], uBB[${NBLOB}], uBC[${NBLOB}]; uniform int uNB; uniform sampler2D uGeo; uniform vec4 uBlast; uniform vec4 uDustP;
vec2 geoUV(vec2 xz){ return (xz-vec2(-1400.,-900.))/vec2(2800.,1800.); }
// returns density; out albedo and emission
float volDens(vec3 p, out vec3 alb, out vec3 emi){
  alb = vec3(0.); emi = vec3(0.); float D = 0.; vec4 n0 = textureLod(uNoise, p*.0085+vec3(0.,-uTime*.035,uTime*.015), 0.); vec4 n1 = textureLod(uNoise, p*.031+vec3(uTime*.02,-uTime*.06,0.), 0.); float nz = n0.b*.55+n0.g*.25+n1.g*.28;
  for(int i=0;i<uNB;i++){ vec4 A=uBA[i], B=uBB[i]; vec3 q=(p-A.xyz)/(A.w*B.xyz); float r2 = dot(q,q); if(r2>1.) continue; vec4 C=uBC[i];
    float r = 1.-r2; if(C.w>1.5){ emi += C.rgb*B.w*r*r*r; continue; } float k = r*1.75 - (1.-nz)*1.25; if(C.w>0.5){ // fire: hot rising tongues
      vec4 f = textureLod(uNoise, p*vec3(.045,.028,.045)+vec3(0.,-uTime*.32+float(i)*.31,0.), 0.); vec4 f2 = textureLod(uNoise, p*vec3(.15,.085,.15)+vec3(f.r*.12,-uTime*.62+float(i)*.17,f.a*.12), 0.); k = r*1.55 - (1.-(f.b*.5+f.g*.35+f2.g*.5))*2.1 - (q.y*.5+.1); if(k<=0.) continue; float d = smoothstep(0.,.34,k)*B.w; float heat = sat(k*1.9); emi += mix(vec3(.75,.06,.005),vec3(1.,.50,.12),heat)*d*heat*(.35+1.5*heat); D += d*.35; alb += vec3(.10)*d*.35; continue; }
    if(k<=0.) continue; float d = smoothstep(0.,.55,k)*B.w; D += d; alb += C.rgb*d; }
  if(uBlast.w>0.){ vec2 uv = geoUV(p.xz); if(all(lessThan(abs(uv-.5),vec2(.5))) && p.y<95.){ vec4 g = textureLod(uGeo, uv, 0.); float front = uBlast.w; float dd = front-g.r; // rolls through streets: g.r = walking distance from the impact
      if(dd>0. && g.r<3000.){ float age = dd; float H = (16.+34.*smoothstep(0.,60.,age)*exp(-age*.0022))*(.75+.6*n0.b)*smoothstep(uBlast.z,uBlast.z*.55,g.r); float head = smoothstep(0.,14.,age); vec2 dir = normalize(vec2(textureLod(uGeo,uv+vec2(.004,0.),0.).r-g.r, textureLod(uGeo,uv+vec2(0.,.006),0.).r-g.r)+1e-4);
        vec3 pp = p - vec3(dir.x,0.,dir.y)*front*.82; vec4 m0 = textureLod(uNoise, pp*.017+vec3(0.,-uTime*.05,0.),0.), m1 = textureLod(uNoise, pp*.06+vec3(0.,-uTime*.1,0.),0.); float w = m0.b*.55+m0.g*.35+m1.g*.3;
        float k = (1.-p.y/max(H,1.))*1.42 - (1.-w)*1.62 + (head-1.)*.9 + .06; if(k>0.){ float d = smoothstep(0.,.4,k)*uDustP.x; D += d; alb += vec3(.70,.57,.43)*d; } } } }
  if(D>0.) alb/=D; return D; }
`;
