/* Dither Suite - render engine.
 *
 * Framework free on purpose. This module owns the settings object, the canvas
 * pipeline and every pixel operation; it knows nothing about React. The host
 * supplies a canvas and a few callbacks, then mutates `S` and calls schedule().
 *
 * Ported from the original single-file build with the render pipeline intact,
 * so behaviour is unchanged - only the ~2,200 lines of hand-wired DOM
 * listeners were discarded in favour of declarative controls.
 */


/* ---- seams left by the UI split ----
 * These were defined in the old DOM wiring. The engine calls them at a few
 * points, so they are declared here as the boundary between engine and host:
 * the React layer overrides the ones it implements. Audio and motion sources
 * are ported in the next stage and currently no-op rather than throw. */
export const host = {
  onSourceKind: (_k) => {},
  onModelRefresh: () => {},
  onTileSlots: () => {},
  onNote: (_m) => {},
};
function audioMods(){ return null; }
function audioRestore(_saved){}
function buildSlots(){ host.onTileSlots(); }
function refreshModel(){ host.onModelRefresh(); }
function setSourceKind(k){ srcKind = k; host.onSourceKind(k); }
function showTriCountSoon(){}
function stopMotionLoop(){}
function clearMotion(){}
function urlNote(m){ host.onNote(m); }

export const hooks = {
  onFrame: (_s) => {},      // per-render stats for the status bar
  onToast: (_m) => {},      // transient messages
  onSource: (_i) => {},     // source name and dimensions
  onDepth: (_f) => {},      // depth-map preview for the 3D relief
};
export const stats = { grid: '-', steps: '-', cells: '-', size: '-', empty: true };
export const paletteNote = { text: '' };




/* ---------------- state ---------------- */
export const DEF = {
  mode:'text', cols:120, aspect:0.55, cellPx:11,
  frame:'source', fit:'fill', autoRows:true, rows:66, grid:'rect', angle:0, upright:false,
  quadDetail:35, quadDepth:4,
  bright:0, contrast:0, gamma:1, black:0, white:1, blur:0, sat:100, invert:0,
  dither:'fs', damt:1, serp:true, edge:0, steps:7, stepLock:true, keepSteps:true, flipSteps:false,
  merge:0, mergeT:0.5, mergeSoft:0.04, mergeOut:0,
  anim:false, aSpeed:1, aShimmer:0, aWave:0, aFreq:3, aAngle:0, aSweep:0, aDrift:0, aPulse:0,
  flow:'image', flowSm:4, hatchW:0.13, hatchL:1.35,
  ramp:' .:-=+*#%@', reverseRamp:false, font:'ui-monospace, Menlo, Consolas, monospace',
  fscale:1, fweight:400,
  tmin:1, tmax:1, sizeRnd:0, jitter:0, rot:'none', snap:'0', tileInk:'auto', feather:1.6,
  colorMode:'mono', fg:'#f2ede3', fg2:'#0f8b94', bg:'#14171a', transparent:false,
  harmony:'auto', paperKey:'auto', pContrast:7,
  sep:'off', sepSpread:1, misreg:0,
  gradType:'linear', gradAng:45, gc1:'#ff5c2b', gc2:'#c026d3', gc3:'#33b8c2', gradMid:true, paperMode:'solid',
  gain:0, inkVar:0, bleed:0, grain:0, grainSize:1.5,
  escale:2
};
export const S = Object.assign({}, DEF);
export let src = null;            // HTMLImageElement or canvas
export let srcKind = 'image';
export let lastImage = null;
export let lastImageName = 'plate';
export let srcName = 'plate';
export let layers = new Array(8).fill(null);
export let layerColors = new Array(8).fill(null);
export function blankAnim(){
  return {spin:0, angle:0, pulse:0, pulseSpd:1, orbit:0, orbitSpd:1, stagger:0};
}
export let layerAnim = [];
for(var _la=0; _la<8; _la++) layerAnim.push(blankAnim());
var laSel = 0;
export function tilesAnimated(){
  for(var i=0;i<8;i++){
    var a = layerAnim[i];
    if(a.spin || a.pulse || a.orbit || a.stagger) return true;
  }
  return false;
}
var tintCache = {};
export function invalidateTiles(){ tintCache = {}; wedgeKey = null; }
export let lastText = '';
var zoomFit = true;


/* ---------------- ramps ---------------- */
export const RAMPS = [
  ['Classic 10', ' .:-=+*#%@'],
  ['Dense 70', ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'],
  ['Blocks', ' \u2591\u2592\u2593\u2588'],
  ['Quadrants', ' \u2597\u2596\u2584\u258c\u259a\u2599\u2588'],
  ['Shades + dots', ' \u00b7\u2022\u25aa\u2591\u2592\u2593\u2588'],
  ['Binary', ' 01'],
  ['Punch card', ' .-+o08'],
  ['Circles', ' \u00b7\u2218\u25cb\u25cf\u2b24'],
  ['Plus grid', ' \u00b7\u2010+\u253c\u2588'],
  ['Slashes', ' /\\|X#'],
  ['Hex', ' 0123456789ABCDEF'],
  ['Type sample', ' iltfjrxnuvczXYUJCLQ0OZmwqpdbkhao#MW&8%B@'],
  ['Minimal 5', ' .oO@'],
  ['Braille dots', '\u2800\u2801\u2803\u2807\u280f\u281f\u283f\u287f\u28ff']
];


/* ---------------- element cache ---------------- */
export let out = document.createElement('canvas');
let octx = out.getContext('2d');
export function attachCanvas(c){ out = c; octx = out.getContext('2d'); }
var pre = document.createElement('canvas'), pctx = pre.getContext('2d', {willReadFrequently:true});
var smp = document.createElement('canvas'), sctx = smp.getContext('2d', {willReadFrequently:true});
var maskC = document.createElement('canvas'), mctx = maskC.getContext('2d');
var mrgC = document.createElement('canvas'), rctx = mrgC.getContext('2d');
var blurC = document.createElement('canvas'), bctx = blurC.getContext('2d', {willReadFrequently:true});
var colC = document.createElement('canvas'), cctx = colC.getContext('2d');


/* ---------------- helpers ---------------- */
export function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
export function hex2rgb(h){
  h = h.replace('#','');
  if(h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var n = parseInt(h,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
export function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
export function rgbcss(c){ return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; }
function toast(msg){ hooks.onToast(msg); }
var raf = null;
export function schedule(){ if(raf) return; raf = requestAnimationFrame(function(){ raf = null; render(); }); }


/* ---------------- bayer ---------------- */
function bayer(n){
  if(n===1) return [[0]];
  var s = bayer(n/2), m = [], i, j, h = n/2;
  for(i=0;i<n;i++) m.push(new Array(n));
  for(i=0;i<h;i++) for(j=0;j<h;j++){
    var v = s[i][j]*4;
    m[i][j]=v; m[i][j+h]=v+2; m[i+h][j]=v+3; m[i+h][j+h]=v+1;
  }
  return m;
}
var B2 = bayer(2), B4 = bayer(4), B8 = bayer(8);
function bmat(k){ return k==='b2'?{m:B2,n:2,d:4}:k==='b4'?{m:B4,n:4,d:16}:{m:B8,n:8,d:64}; }


/* ---------------- sampling ---------------- */
export function dimsOf(el){
  if(!el) return {w:1, h:1};
  return {
    w: el.videoWidth || el.naturalWidth || el.width || 1,
    h: el.videoHeight || el.naturalHeight || el.height || 1
  };
}
var taintWarned = false;
function handleTaint(){
  stopMotionLoop();
  // a tainted canvas stays tainted, so replace the scratch surfaces
  pre = document.createElement('canvas'); pctx = pre.getContext('2d', {willReadFrequently:true});
  smp = document.createElement('canvas'); sctx = smp.getContext('2d', {willReadFrequently:true});
  if(!taintWarned){
    taintWarned = true;
    toast('That source blocks pixel access');
    if(typeof urlNote === 'function'){
      urlNote(/archive\.org/i.test(lastUrlHost)
        ? 'That item played, but its storage node blocks pixel reads. Archive.org serves files from many nodes and only some allow it, so it varies item by item. Download the mp4 and drop it on the panel above instead.'
        : 'That video played but blocks pixel reads, so the server has no open CORS header. Download the file and drop it on the panel above instead.');
    }
    setTimeout(function(){ taintWarned = false; }, 4000);
  }
  setTimeout(function(){ clearMotion(); }, 0);
}
export function frameRatio(){
  if(S.frame === 'source'){
    var sd = dimsOf(src);
    return sd.h / sd.w;
  }
  var pr = S.frame.split(':');
  return (+pr[1]) / (+pr[0]);
}
export function gridDims(){
  if(!src) return {cols:0, rows:0};
  var cols = S.cols;
  var rows = S.autoRows
    ? Math.max(1, Math.round(cols * frameRatio() * S.aspect))
    : Math.max(1, S.rows|0);
  return {cols:cols, rows:rows};
}
// crop-to-fill or fit-inside, centred
function drawFitted(ctx, img, W, H, mode){
  var sd = dimsOf(img);
  var sr = sd.w/sd.h, dr = W/H, dw, dh;
  if((mode === 'fill') === (sr > dr)){ dh = H; dw = H*sr; }
  else { dw = W; dh = W/sr; }
  ctx.drawImage(img, (W-dw)/2, (H-dh)/2, dw, dh);
}
// returns {lum:Float32Array, rgb:Uint8ClampedArray} at w x h
function sampleTo(w,h){
  var fr = frameRatio();
  var pw = Math.min(Math.max(640, w*3), 1600);
  var ph = Math.max(1, Math.round(pw * fr));
  pw = Math.max(pw, w); ph = Math.max(ph, h);
  if(pre.width !== pw || pre.height !== ph){ pre.width = pw; pre.height = ph; }
  else pctx.clearRect(0,0,pw,ph);
  var blurPx = S.blur * (pw / Math.max(1,w));
  var f = [];
  if(blurPx > 0.01) f.push('blur('+blurPx.toFixed(2)+'px)');
  if(S.sat !== 100) f.push('saturate('+S.sat+'%)');
  pctx.filter = f.length ? f.join(' ') : 'none';
  drawFitted(pctx, src, pw, ph, S.fit);
  pctx.filter = 'none';

  if(smp.width !== w || smp.height !== h){ smp.width = w; smp.height = h; }
  else sctx.clearRect(0,0,w,h);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(pre, 0, 0, w, h);
  var d;
  try{
    d = sctx.getImageData(0,0,w,h).data;
  }catch(err){
    handleTaint();
    return null;
  }

  var lum = new Float32Array(w*h);
  for(var i=0,p=0;i<lum.length;i++,p+=4){
    var a = d[p+3]/255;
    lum[i] = (0.2126*d[p] + 0.7152*d[p+1] + 0.0722*d[p+2]) / 255 * a;
  }
  return {lum:lum, rgb:d, w:w, h:h};
}


/* ---------------- grid layout ----------------
   Every grid type resolves to the same three per-cell arrays: where the mark
   sits, how big it is and which way it faces. Everything downstream then
   stops caring whether the lattice is square, hexagonal or polar. */
var HEXK = 0.8660254;
function layoutKind(){
  // braille packs 2x4 dots into a character cell, which only means anything
  // on an upright square lattice
  if(S.mode === 'braille') return {gt:'rect', ang:0};
  return {gt:S.grid, ang:S.angle*Math.PI/180};
}
export function buildLayout(W, H, cw, ch, cols, rows, angOverride){
  var lk = layoutKind(), gt = lk.gt;
  var ang = (angOverride === undefined) ? lk.ang : (S.mode === 'braille' ? 0 : angOverride);
  var ca = Math.cos(ang), sa = Math.sin(ang);
  var cx = W/2, cy = H/2;
  var gcols, grows, rowSp = (gt === 'hex') ? ch*HEXK : ch;
  var plain = (gt === 'rect' && ang === 0);
  if(gt === 'polar'){
    gcols = Math.max(3, cols); grows = Math.max(2, rows);
  } else if(plain){
    gcols = cols; grows = rows;
  } else {
    var Wl = Math.abs(W*ca) + Math.abs(H*sa);
    var Hl = Math.abs(W*sa) + Math.abs(H*ca);
    gcols = Math.ceil(Wl/cw) + 2;
    grows = Math.ceil(Hl/rowSp) + 2;
  }
  var n = gcols*grows;
  var px = new Float32Array(n), py = new Float32Array(n), pr = new Float32Array(n);
  var pw = new Float32Array(n), ph = new Float32Array(n);
  var i, j, k = 0;
  if(gt === 'polar'){
    var maxR = Math.sqrt(W*W + H*H)/2;
    var ringH = maxR/grows;
    for(j=0;j<grows;j++){
      var r0 = (j+0.5)*ringH;
      var arc = Math.PI*2*r0/gcols;
      for(i=0;i<gcols;i++,k++){
        var th = (i+0.5)/gcols*Math.PI*2 + ang;
        px[k] = cx + Math.cos(th)*r0;
        py[k] = cy + Math.sin(th)*r0;
        pr[k] = th + Math.PI/2;
        pw[k] = Math.max(0.6, arc);
        ph[k] = ringH;
      }
    }
  } else {
    var hex = (gt === 'hex');
    for(j=0;j<grows;j++){
      var ly = (j + 0.5 - grows/2)*rowSp;
      for(i=0;i<gcols;i++,k++){
        var lx = (i + 0.5 - gcols/2)*cw + (hex && (j & 1) ? cw/2 : 0);
        px[k] = cx + lx*ca - ly*sa;
        py[k] = cy + lx*sa + ly*ca;
        pr[k] = ang;
        pw[k] = cw; ph[k] = ch;
      }
    }
  }
  return {gcols:gcols, grows:grows, px:px, py:py, pr:pr, pw:pw, ph:ph,
          gt:gt, ang:ang, plain:plain};
}
// Adaptive subdivision: recurse while a region still has contrast to describe.
// Leaf size then encodes detail, which is information the uniform grid throws away.
function buildQuadLayout(pd, W, H, cw, ch, cols, rows){
  var d = pd.d, pw2 = pd.w, ph2 = pd.h;
  var maxD = clamp(S.quadDepth|0, 1, 6);
  var thr = Math.pow(1 - S.quadDetail/100, 2) * 0.16 + 0.0009;
  var root = cw * Math.pow(2, maxD);
  var nx = Math.max(1, Math.ceil(W/root)), ny = Math.max(1, Math.ceil(H/root));
  var xs = [], ys = [], ws = [], hs = [];
  function stats(x, y, w, h){
    var mn = 1, mx = 0, sum = 0, cnt = 0;
    for(var sy=0; sy<4; sy++) for(var sx=0; sx<4; sx++){
      var u = (x + (sx+0.5)/4*w)/W, v = (y + (sy+0.5)/4*h)/H;
      var px2 = clamp(Math.round(u*pw2), 0, pw2-1), py2 = clamp(Math.round(v*ph2), 0, ph2-1);
      var q = (py2*pw2 + px2)*4;
      var l = (0.2126*d[q] + 0.7152*d[q+1] + 0.0722*d[q+2])/255;
      if(l < mn) mn = l;
      if(l > mx) mx = l;
      sum += l; cnt++;
    }
    return {range: mx-mn, mean: sum/cnt};
  }
  function rec(x, y, w, h, depth){
    if(depth >= maxD || w <= cw*1.01 || h <= ch*1.01 || stats(x,y,w,h).range < thr){
      xs.push(x + w/2); ys.push(y + h/2); ws.push(w); hs.push(h);
      return;
    }
    var hw = w/2, hh = h/2;
    rec(x, y, hw, hh, depth+1);
    rec(x+hw, y, hw, hh, depth+1);
    rec(x, y+hh, hw, hh, depth+1);
    rec(x+hw, y+hh, hw, hh, depth+1);
  }
  for(var j=0;j<ny;j++) for(var i=0;i<nx;i++) rec(i*root, j*root, root, root, 0);
  var n = xs.length;
  var px = new Float32Array(n), py = new Float32Array(n), pr = new Float32Array(n);
  var pwA = new Float32Array(n), phA = new Float32Array(n);
  var ang = S.angle*Math.PI/180;
  for(var k=0;k<n;k++){
    px[k] = xs[k]; py[k] = ys[k]; pr[k] = ang;
    pwA[k] = ws[k]; phA[k] = hs[k];
  }
  return {gcols:n, grows:1, px:px, py:py, pr:pr, pw:pwA, ph:phA,
          gt:'quad', ang:ang, plain:false, quad:true};
}
// one readback of the conditioned source, shared by every cell lookup
function preData(gw){
  var fr = frameRatio();
  var pwid = clamp(Math.round(gw*2.5), 64, 1400);
  var phei = Math.max(2, Math.round(pwid*fr));
  if(pre.width !== pwid || pre.height !== phei){ pre.width = pwid; pre.height = phei; }
  else pctx.clearRect(0,0,pwid,phei);
  var blurPx = S.blur * (pwid/Math.max(1,gw));
  var f = [];
  if(blurPx > 0.01) f.push('blur('+blurPx.toFixed(2)+'px)');
  if(S.sat !== 100) f.push('saturate('+S.sat+'%)');
  pctx.filter = f.length ? f.join(' ') : 'none';
  drawFitted(pctx, src, pwid, phei, S.fit);
  pctx.filter = 'none';
  try{
    return {d: pctx.getImageData(0,0,pwid,phei).data, w:pwid, h:phei};
  }catch(err){ handleTaint(); return null; }
}
function sampleLayout(LT, W, H, pdIn){
  var pd = pdIn || preData(LT.gcols);
  if(!pd) return null;
  var n = LT.gcols*LT.grows, d = pd.d, pw2 = pd.w, ph2 = pd.h;
  var lum = new Float32Array(n), rgb = new Uint8ClampedArray(n*4);
  for(var k=0;k<n;k++){
    var sx = Math.round(LT.px[k]/W*pw2 - 0.5), sy = Math.round(LT.py[k]/H*ph2 - 0.5);
    var r=0,g=0,b=0,a=0,cnt=0;
    for(var dy=0;dy<2;dy++) for(var dx=0;dx<2;dx++){
      var xx = sx+dx, yy = sy+dy;
      if(xx<0||yy<0||xx>=pw2||yy>=ph2) continue;
      var q = (yy*pw2+xx)*4;
      r+=d[q]; g+=d[q+1]; b+=d[q+2]; a+=d[q+3]; cnt++;
    }
    if(!cnt) continue;
    r/=cnt; g/=cnt; b/=cnt; a/=cnt;
    var o = k*4;
    rgb[o]=r; rgb[o+1]=g; rgb[o+2]=b; rgb[o+3]=a;
    lum[k] = (0.2126*r + 0.7152*g + 0.0722*b)/255 * (a/255);
  }
  return {lum:lum, rgb:rgb, w:LT.gcols, h:LT.grows};
}


/* ---------------- tone ---------------- */
function applyTone(lum, sweep){
  var k = Math.tan((clamp(S.contrast,-99,99)/100 + 1) * Math.PI/4);
  var br = S.bright/100 + (sweep||0);
  var invK = S.invert/100;
  var bp = S.black, wp = Math.max(S.white, S.black+0.01);
  var span = wp - bp;
  for(var i=0;i<lum.length;i++){
    var v = lum[i];
    v = (v - bp) / span;
    v = (v - 0.5) * k + 0.5 + br;
    v = clamp(v,0,1);
    if(S.gamma !== 1) v = Math.pow(v, S.gamma);
    if(invK) v = v + (1 - 2*v)*invK;
    lum[i] = v;
  }
  return lum;
}


/* ---------------- edges ---------------- */
function sobel(lum,w,h){
  var mag = new Float32Array(w*h), ang = new Float32Array(w*h);
  function at(x,y){ return lum[clamp(y,0,h-1)*w + clamp(x,0,w-1)]; }
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){
    var gx = -at(x-1,y-1) - 2*at(x-1,y) - at(x-1,y+1) + at(x+1,y-1) + 2*at(x+1,y) + at(x+1,y+1);
    var gy = -at(x-1,y-1) - 2*at(x,y-1) - at(x+1,y-1) + at(x-1,y+1) + 2*at(x,y+1) + at(x+1,y+1);
    var i = y*w+x;
    mag[i] = Math.sqrt(gx*gx + gy*gy) / 4;
    ang[i] = Math.atan2(gy,gx);
  }
  return {mag:mag, ang:ang};
}


/* ---------------- quantise + dither ---------------- */
function quantise(lum,w,h,L,method,amt,serp){
  var q = L-1, out = new Uint8Array(w*h), i, x, y;
  if(q <= 0){ return out; }
  if(method==='none' || amt===0){
    for(i=0;i<w*h;i++) out[i] = clamp(Math.round(lum[i]*q),0,q);
    return out;
  }
  if(method==='b2'||method==='b4'||method==='b8'){
    var bm = bmat(method);
    for(y=0;y<h;y++) for(x=0;x<w;x++){
      i = y*w+x;
      var t = (bm.m[y%bm.n][x%bm.n]/bm.d - 0.5) * amt / q;
      out[i] = clamp(Math.round((lum[i]+t)*q),0,q);
    }
    return out;
  }
  if(method==='noise'){
    for(i=0;i<w*h;i++){
      var n = ((Math.random()+Math.random()+Math.random())/3 - 0.5) * amt / q * 2;
      out[i] = clamp(Math.round((lum[i]+n)*q),0,q);
    }
    return out;
  }
  // error diffusion
  var b = Float32Array.from(lum);
  var K = method==='fs'   ? [[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]]
        : method==='atkinson' ? [[1,0,1/8],[2,0,1/8],[-1,1,1/8],[0,1,1/8],[1,1,1/8],[0,2,1/8]]
        : [[1,0,7/48],[2,0,5/48],[-2,1,3/48],[-1,1,5/48],[0,1,7/48],[1,1,5/48],[2,1,3/48],
           [-2,2,1/48],[-1,2,3/48],[0,2,5/48],[1,2,3/48],[2,2,1/48]];
  for(y=0;y<h;y++){
    var rtl = serp && (y & 1);
    for(var xi=0;xi<w;xi++){
      x = rtl ? (w-1-xi) : xi;
      i = y*w+x;
      var old = b[i];
      var idx = clamp(Math.round(old*q),0,q);
      out[i] = idx;
      var err = (old - idx/q) * amt;
      for(var kI=0;kI<K.length;kI++){
        var dx = rtl ? -K[kI][0] : K[kI][0], dy = K[kI][1];
        var nx = x+dx, ny = y+dy;
        if(nx<0||nx>=w||ny<0||ny>=h) continue;
        b[ny*w+nx] += err * K[kI][2];
      }
    }
  }
  return out;
}


/* ---------------- level count ---------------- */
export function rampChars(){
  var r = S.ramp.length ? Array.from(S.ramp) : [' '];
  if(S.reverseRamp) r = r.slice().reverse();
  if(S.stepLock && S.steps < r.length){
    var out = [], n = S.steps;
    for(var i=0;i<n;i++) out.push(r[Math.round(i*(r.length-1)/(n-1))]);
    return out;
  }
  return r;
}
export function levelCount(){
  if(S.mode==='braille') return 2;
  if(S.mode==='hatch') return S.steps;
  if(S.mode==='tiles') return S.steps;
  return Math.max(2, rampChars().length);
}


/* ---------------- palette generation ---------------- */
function hsl2rgb(h, sat, li){
  h = ((h % 360) + 360) % 360;
  var c = (1 - Math.abs(2*li - 1)) * sat;
  var x = c * (1 - Math.abs(((h/60) % 2) - 1));
  var m = li - c/2, r, g, b;
  if(h < 60){ r=c; g=x; b=0; }
  else if(h < 120){ r=x; g=c; b=0; }
  else if(h < 180){ r=0; g=c; b=x; }
  else if(h < 240){ r=0; g=x; b=c; }
  else if(h < 300){ r=x; g=0; b=c; }
  else { r=c; g=0; b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
export function rgb2hex(c){
  return '#' + c.map(function(v){
    return ('0' + clamp(Math.round(v),0,255).toString(16)).slice(-2);
  }).join('');
}
// WCAG relative luminance, so contrast is judged perceptually rather than by raw value
export function relLum(c){
  var a = c.map(function(v){
    v /= 255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
}
export function contrastRatio(a, b){
  var l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
}
// walk lightness away from the paper until the target ratio is met
function inkFor(hue, sat, paper, target, dark){
  var best = null, bestC = 0;
  for(var i=0;i<=44;i++){
    var li = dark ? clamp(0.34 + i*0.015, 0, 0.98) : clamp(0.66 - i*0.015, 0.02, 1);
    var c = hsl2rgb(hue, sat, li);
    var ct = contrastRatio(c, paper);
    if(ct >= target) return c;
    if(ct > bestC){ bestC = ct; best = c; }
  }
  return best;
}
var SCHEMES = {
  mono:          {offs:[0], label:'Monochrome'},
  analogous:     {offs:[-34,-17,0,17,34], label:'Analogous'},
  complementary: {offs:[0,180], label:'Complementary'},
  split:         {offs:[0,150,210], label:'Split complementary'},
  triadic:       {offs:[0,120,240], label:'Triadic'},
  tetradic:      {offs:[0,90,180,270], label:'Tetradic'}
};
var paletteHistory = [];
export function snapshotPalette(){
  return {fg:S.fg, fg2:S.fg2, bg:S.bg, layers:layerColors.slice()};
}
export function applyPalette(p){
  S.fg = p.fg; S.fg2 = p.fg2; S.bg = p.bg;
  layerColors = p.layers.slice();
    
  invalidateTiles(); buildSlots(); schedule();
}
export function randomisePalette(){
  paletteHistory.push(snapshotPalette());
  if(paletteHistory.length > 20) paletteHistory.shift();

  var keys = Object.keys(SCHEMES);
  var name = (S.harmony === 'auto') ? keys[(Math.random()*keys.length)|0] : S.harmony;
  var scheme = SCHEMES[name];
  var offs = scheme.offs;
  var base = Math.random()*360;
  var dark = (S.paperKey === 'auto') ? (Math.random() < 0.62) : (S.paperKey === 'dark');
  var target = S.pContrast;
  var mono = (name === 'mono');

  // paper: low chroma, parked at one end of the value scale
  var paperSat = mono ? 0.08 + Math.random()*0.16 : 0.05 + Math.random()*0.14;
  var paperL = dark ? 0.04 + Math.random()*0.06 : 0.90 + Math.random()*0.07;
  var paper = hsl2rgb(base + (Math.random()*36 - 18), paperSat, paperL);

  function pickHue(i){ return base + offs[i % offs.length] + (Math.random()*12 - 6); }
  var satBase = mono ? (0.10 + Math.random()*0.16) : (0.42 + Math.random()*0.40);

  var ink = inkFor(pickHue(0), satBase, paper, target, dark);
  var second = inkFor(pickHue(offs.length > 1 ? 1 + ((Math.random()*(offs.length-1))|0) : 0),
                      clamp(satBase*(0.8 + Math.random()*0.5), 0, 1),
                      paper, Math.max(2.2, target*0.75), dark);

  // tile ramp: lightness climbs shadow to highlight so the tonal reading survives any hue
  var newLayers = [];
  for(var i=0;i<8;i++){
    var t = i/7;
    var li = 0.15 + t*0.70;
    var st = clamp(satBase * (0.55 + 0.65*Math.sin(t*Math.PI)), 0, 1);
    newLayers.push(rgb2hex(hsl2rgb(pickHue(i), st, li)));
  }

  applyPalette({fg:rgb2hex(ink), fg2:rgb2hex(second), bg:rgb2hex(paper), layers:newLayers});
  var ratio = contrastRatio(ink, paper);
  paletteNote.text = scheme.label + ' on ' + (dark ? 'dark' : 'light') +
    ' paper, base hue ' + Math.round(((base%360)+360)%360) + '\u00b0, ink contrast ' +
    ratio.toFixed(1) + ':1.';
  toast(scheme.label + ' \u00b7 ' + ratio.toFixed(1) + ':1');
}


/* ---------------- gradients ----------------
   Position-based rather than tone-based, so the ramp runs across the plate
   and the image keeps its own tonal reading underneath. */
export function gradStops(){
  var a = hex2rgb(S.gc1), c = hex2rgb(S.gc3);
  return S.gradMid ? [a, hex2rgb(S.gc2), c] : [a, c];
}
export function gradAt(stops, t){
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  var seg = stops.length - 1;
  var f = t*seg, i = Math.min(seg-1, f|0);
  return mix(stops[i], stops[i+1], f - i);
}
// t along the gradient for a point, in 0..1
function gradT(x, y, W, H){
  var ang = S.gradAng*Math.PI/180;
  if(S.gradType === 'radial'){
    var dx = (x - W/2)/(W/2), dy = (y - H/2)/(H/2);
    return Math.min(1, Math.sqrt(dx*dx + dy*dy)/1.4142*1.4142);
  }
  if(S.gradType === 'conic'){
    var a2 = Math.atan2(y - H/2, x - W/2) - ang;
    return (((a2/(Math.PI*2)) % 1) + 1) % 1;
  }
  var ca = Math.cos(ang), sa = Math.sin(ang);
  var ext = Math.abs(W*ca) + Math.abs(H*sa);
  return ((x - W/2)*ca + (y - H/2)*sa)/ext + 0.5;
}
function paperFill(ctx, W, H){
  if(S.paperMode === 'none') return;                 // leave the plate clear
  if(S.paperMode !== 'grad'){ ctx.fillStyle = S.bg; ctx.fillRect(0,0,W,H); return; }
  var stops = gradStops(), g;
  var ang = S.gradAng*Math.PI/180;
  if(S.gradType === 'radial'){
    g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)/1.6);
  } else {
    var ca = Math.cos(ang)*Math.max(W,H)/2, sa = Math.sin(ang)*Math.max(W,H)/2;
    g = ctx.createLinearGradient(W/2-ca, H/2-sa, W/2+ca, H/2+sa);
  }
  for(var i=0;i<stops.length;i++) g.addColorStop(i/(stops.length-1), rgbcss(stops[i]));
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}


/* ---------------- colour per level ---------------- */
function makeColorFn(L, rgb, w, LT, W, H){
  var fg = hex2rgb(S.fg), fg2 = hex2rgb(S.fg2);
  if(S.colorMode === 'grad' && LT){
    var stops = gradStops(), cache = {};
    return function(idx, i){
      var t = gradT(LT.px[i], LT.py[i], W, H);
      var key = (t*255)|0;
      if(cache[key]) return cache[key];
      return (cache[key] = rgbcss(gradAt(stops, key/255)));
    };
  }
  if(S.colorMode==='mono'){
    var css = rgbcss(fg);
    return function(){ return css; };
  }
  if(S.colorMode==='duo'){
    var cache = [];
    for(var i=0;i<L;i++) cache.push(rgbcss(mix(fg,fg2, L>1 ? i/(L-1) : 0)));
    return function(idx){ return cache[idx]||cache[0]; };
  }
  return function(idx,i){
    var p = i*4;
    return 'rgb('+rgb[p]+','+rgb[p+1]+','+rgb[p+2]+')';
  };
}


/* ---------------- animation modulators ---------------- */
export let animT = 0;
export function animMods(){
  if(!S.anim) return {on:false, sweep:0, wave:0, shimmer:0, rot:0, scale:1, t:0};
  return {
    on: true,
    t: animT,
    sweep: Math.sin(animT)*S.aSweep/100,
    wave: S.aWave/100,
    shimmer: S.aShimmer/100,
    rot: animT*S.aDrift,
    scale: 1 + Math.sin(animT*1.7)*S.aPulse/100
  };
}
function applyWave(lum, w, h, A){
  if(!A.on || A.wave <= 0) return;
  var ang = S.aAngle*Math.PI/180;
  var ca = Math.cos(ang), sa = Math.sin(ang);
  var f = S.aFreq*Math.PI*2;
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){
    var u = (x/w)*ca + (y/h)*sa;
    var v = lum[y*w+x] + Math.sin(u*f - A.t*2)*A.wave;
    lum[y*w+x] = v<0?0:v>1?1:v;
  }
}
function applyShimmer(lum, A){
  if(!A.on || A.shimmer <= 0) return;
  for(var i=0;i<lum.length;i++){
    var v = lum[i] + (Math.random()-0.5)*A.shimmer;
    lum[i] = v<0?0:v>1?1:v;
  }
}


/* ---------------- blob merge ----------------
   Blur the isolated mark layer so neighbours overlap, then push the alpha
   back through a hard S-curve. Marks that were merely near each other come
   out as one body, which is the metaball trick done in 2D. */
function smoothAlpha(a, lo, hi){
  if(hi <= lo) return a >= hi ? 1 : 0;
  var x = (a - lo)/(hi - lo);
  if(x <= 0) return 0;
  if(x >= 1) return 1;
  return x*x*(3 - 2*x);
}
// Chrome and Firefox run SVG filters natively on a canvas, which does the whole
// blur-and-threshold on the compositor. Safari accepts the string and ignores it,
// so probe for real behaviour rather than trusting the property.
export const GOO_OK = (function(){
  try{
    var c = document.createElement('canvas'); c.width = c.height = 40;
    var x = c.getContext('2d', {willReadFrequently:true});
    x.filter = 'url(#gooProbe)';
    x.fillStyle = '#fff';
    x.fillRect(10,10,20,20);
    x.filter = 'none';
    return x.getImageData(0,0,40,40).data[(9*40+20)*4+3] > 6;
  }catch(e){ return false; }
})();
function setGoo(prefix, radius, lo, hi){
  var k = 1/Math.max(0.002, hi-lo);
  var row = '0 0 0 ' + k.toFixed(4) + ' ' + (-lo*k).toFixed(4);
  document.getElementById(prefix+'Blur').setAttribute('stdDeviation', radius.toFixed(2));
  document.getElementById(prefix+'Mat').setAttribute('values',
    '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ' + row);
}
var mergeLutIn = new Uint8Array(256), mergeLutRing = new Uint8Array(256), mergeLutUse = new Uint8Array(256);
var mergeLutKey = '';
function buildMergeLut(lo, hi, ow){
  var key = lo+'|'+hi+'|'+ow;
  if(key === mergeLutKey) return;
  mergeLutKey = key;
  for(var a=0;a<256;a++){
    var inA = smoothAlpha(a, lo, hi);
    mergeLutIn[a] = (inA*255)|0;
    if(ow > 0){
      var ring = smoothAlpha(a, lo-ow, hi-ow) - inA;
      if(ring < 0) ring = 0;
      mergeLutRing[a] = (ring*255)|0;
      mergeLutUse[a] = ring > inA ? 1 : 0;
    } else { mergeLutRing[a] = 0; mergeLutUse[a] = 0; }
  }
}
function applyMerge(ctx, W, H, radius){
  var t = S.mergeT, w = Math.max(0.008, S.mergeSoft);
  var lo = t - w, hi = t + w;
  var ow = (S.mergeOut/100) * 0.35;

  if(GOO_OK){
    // A gaussian is low frequency and the result gets hard-thresholded, so
    // blurring at full plate size is wasted work. Cap it and let the upscale
    // supply the antialiasing the threshold would have thrown away.
    var k = Math.min(1, 1000/Math.max(W,H));
    var bw = Math.max(2, Math.round(W*k)), bh = Math.max(2, Math.round(H*k));
    if(blurC.width !== bw || blurC.height !== bh){ blurC.width = bw; blurC.height = bh; }
    else bctx.clearRect(0,0,bw,bh);
    if(ow > 0){
      setGoo('gooOut', radius*k, lo-ow, hi-ow);
      bctx.filter = 'url(#gooOut)';
      bctx.drawImage(mrgC, 0, 0, bw, bh);
      bctx.filter = 'none';
      bctx.globalCompositeOperation = 'source-in';
      bctx.fillStyle = S.fg2;
      bctx.fillRect(0,0,bw,bh);
      bctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(blurC, 0, 0, W, H);
      bctx.globalCompositeOperation = 'copy';
      bctx.clearRect(0,0,bw,bh);
      bctx.globalCompositeOperation = 'source-over';
    }
    setGoo('goo', radius*k, lo, hi);
    bctx.filter = 'url(#goo)';
    bctx.drawImage(mrgC, 0, 0, bw, bh);
    bctx.filter = 'none';
    ctx.drawImage(blurC, 0, 0, W, H);
    return;
  }

  // fallback: same curve, done by hand
  if(blurC.width !== W || blurC.height !== H){ blurC.width = W; blurC.height = H; }
  else bctx.clearRect(0,0,W,H);
  bctx.filter = 'blur(' + radius.toFixed(2) + 'px)';
  bctx.drawImage(mrgC, 0, 0);
  bctx.filter = 'none';
  buildMergeLut(lo*255, hi*255, ow*255);
  var id = bctx.getImageData(0,0,W,H), d = id.data, i, a;
  if(ow > 0){
    var oc = hex2rgb(S.fg2), or_ = oc[0], og = oc[1], ob = oc[2];
    for(i=0;i<d.length;i+=4){
      a = d[i+3];
      if(a === 0) continue;
      if(mergeLutUse[a]){ d[i]=or_; d[i+1]=og; d[i+2]=ob; d[i+3]=mergeLutRing[a]; }
      else { var vi = mergeLutIn[a], vr = mergeLutRing[a]; d[i+3] = vi > vr ? vi : vr; }
    }
  } else {
    for(i=0;i<d.length;i+=4){ a = d[i+3]; if(a !== 0) d[i+3] = mergeLutIn[a]; }
  }
  bctx.putImageData(id, 0, 0);
  ctx.drawImage(blurC, 0, 0);
}


/* ---------------- SVG export ----------------
   Every mark is already a known shape at a known place, so the vector form
   is mostly bookkeeping. Glyphs, braille and hatching come out as real
   vectors; tiles are bitmaps by nature and get embedded and referenced. */
export function xmlEsc(t){
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;');
}
function computePlate(cellPx){
  var g = gridDims();
  var cols = g.cols, rows = g.rows;
  var cw = cellPx, ch = cellPx / S.aspect;
  var W = Math.max(1, Math.round(cols*cw)), H = Math.max(1, Math.round(rows*ch));
  var L = levelCount();
  var sup = (S.mode==='braille') ? {x:2,y:4} : {x:1,y:1};
  var A = animMods();
  var LT = buildLayout(W, H, cw, ch, cols, rows);
  var data = LT.plain ? sampleTo(LT.gcols*sup.x, LT.grows*sup.y) : sampleLayout(LT, W, H);
  if(!data) return null;
  applyTone(data.lum, A.sweep);
  var qw = LT.gcols*sup.x, qh = LT.grows*sup.y;
  applyWave(data.lum, qw, qh, A);
  applyShimmer(data.lum, A);
  var idx = quantise(data.lum, qw, qh, L, S.dither, S.damt, S.serp);
  if(S.flipSteps){ var q = L-1; for(var i=0;i<idx.length;i++) idx[i] = q - idx[i]; }
  return {W:W, H:H, cw:cw, ch:ch, LT:LT, idx:idx, data:data, L:L, sup:sup};
}
export function buildSVG(){
  var P = computePlate(S.cellPx);
  if(!P) return null;
  var LT = P.LT, idx = P.idx, L = P.L, W = P.W, H = P.H;
  var cols = LT.gcols, rows = LT.grows, n = cols*rows;
  var out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
           'width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">');
  if(S.paperMode === 'solid') out.push('<rect width="'+W+'" height="'+H+'" fill="'+S.bg+'"/>');
  out.push(overlaysSVG(W, H, 0, artZ));

  var color = makeColorFn(L, P.data.rgb, cols);
  var deg = 180/Math.PI;
  var i, k;

  if(S.mode === 'tiles'){
    var R = resolveTiles(L);
    var defs = ['<defs>'];
    for(k=0;k<L;k++){
      if(!R.art[k]) continue;
      var art = R.art[k];
      var url = art.toDataURL ? art.toDataURL() : art.src;
      defs.push('<image id="t'+k+'" width="100" height="100" preserveAspectRatio="none" xlink:href="'+url+'"/>');
    }
    defs.push('</defs>');
    out.push(defs.join(''));
    var scales = [];
    for(k=0;k<L;k++) scales[k] = markScale(k, L);
    for(i=0;i<n;i++){
      var li = clamp(idx[i],0,L-1);
      if(!R.art[li]) continue;
      var tw = LT.pw[i]*scales[li], th = LT.ph[i]*scales[li];
      if(tw <= 0) continue;
      var rot = S.upright ? 0 : LT.pr[i];
      var tr = 'translate('+LT.px[i].toFixed(2)+' '+LT.py[i].toFixed(2)+')' +
               (rot ? ' rotate('+(rot*deg).toFixed(2)+')' : '') +
               ' scale('+(tw/100).toFixed(4)+' '+(th/100).toFixed(4)+')';
      out.push('<use xlink:href="#t'+li+'" transform="'+tr+'" x="-50" y="-50"/>');
    }
  } else if(S.mode === 'hatch'){
    var ff = (S.flow === 'image') ? flowField(P.data.lum, cols, rows, S.flowSm) : null;
    var fixed = S.angle*Math.PI/180;
    for(i=0;i<n;i++){
      var lh = idx[i];
      if(lh <= 0) continue;
      var cell = Math.min(LT.pw[i], LT.ph[i]);
      var len = cell*S.hatchL*markScale(lh, L);
      var base = ff ? ff.ang[i] : fixed;
      var col = color(lh, i);
      var lw = Math.max(0.2, cell*S.hatchW).toFixed(2);
      for(var sI=0; sI<lh; sI++){
        var a = base + HATCH_OFF[sI % 4];
        var band = (sI/4)|0;
        var offp = band ? ((band % 2 ? 1 : -1) * Math.ceil(band/2) * cell*0.30) : 0;
        var ca = Math.cos(a), sa2 = Math.sin(a);
        var x1 = LT.px[i] - ca*len/2 - sa2*offp, y1 = LT.py[i] - sa2*len/2 + ca*offp;
        var x2 = LT.px[i] + ca*len/2 - sa2*offp, y2 = LT.py[i] + sa2*len/2 + ca*offp;
        out.push('<line x1="'+x1.toFixed(2)+'" y1="'+y1.toFixed(2)+'" x2="'+x2.toFixed(2)+
                 '" y2="'+y2.toFixed(2)+'" stroke="'+col+'" stroke-width="'+lw+'" stroke-linecap="round"/>');
      }
    }
  } else {
    var chars = rampChars();
    var fam = xmlEsc(S.font);
    out.push('<g font-family="'+fam+'" font-weight="'+S.fweight+
             '" text-anchor="middle" dominant-baseline="central">');
    if(S.mode === 'braille'){
      var BITS = [[0,0,1],[0,1,2],[0,2,4],[1,0,8],[1,1,16],[1,2,32],[0,3,64],[1,3,128]];
      for(var y=0;y<rows;y++) for(var x=0;x<cols;x++){
        var kk = y*cols+x, bits = 0;
        for(var bI=0;bI<BITS.length;bI++){
          var sx = x*2+BITS[bI][0], sy = y*4+BITS[bI][1];
          if(idx[sy*(cols*2)+sx] > 0) bits |= BITS[bI][2];
        }
        if(!bits) continue;
        out.push('<text x="'+LT.px[kk].toFixed(2)+'" y="'+LT.py[kk].toFixed(2)+
                 '" font-size="'+(LT.ph[kk]*S.fscale).toFixed(2)+'" fill="'+color(1,kk)+
                 '">'+xmlEsc(String.fromCharCode(0x2800+bits))+'</text>');
      }
    } else {
      for(i=0;i<n;i++){
        var lg = idx[i];
        var glyph = chars[clamp(lg,0,chars.length-1)];
        if(glyph === ' ') continue;
        var rr = S.upright ? 0 : LT.pr[i];
        var fs = (LT.ph[i]*S.fscale*markScale(lg, L)).toFixed(2);
        var tag = '<text x="'+LT.px[i].toFixed(2)+'" y="'+LT.py[i].toFixed(2)+
                  '" font-size="'+fs+'" fill="'+color(lg,i)+'"';
        if(rr) tag += ' transform="rotate('+(rr*deg).toFixed(2)+' '+LT.px[i].toFixed(2)+' '+LT.py[i].toFixed(2)+')"';
        out.push(tag + '>' + xmlEsc(glyph) + '</text>');
      }
    }
    out.push('</g>');
  }
  out.push(overlaysSVG(W, H, artZ, overlays.length));
  out.push('</svg>');
  return out.join('\n');
}


/* ---------------- flow field ----------------
   Structure tensor: square and smooth the gradient before taking its
   direction. Raw gradients are noisy and flip sign across a ridge; the
   tensor averages orientation rather than direction, so it survives that. */
function flowField(lum, w, h, passes){
  var n = w*h;
  var gxx = new Float32Array(n), gyy = new Float32Array(n), gxy = new Float32Array(n);
  function at(x,y){ return lum[clamp(y,0,h-1)*w + clamp(x,0,w-1)]; }
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){
    var gx = (at(x+1,y) - at(x-1,y))*0.5;
    var gy = (at(x,y+1) - at(x,y-1))*0.5;
    var i = y*w+x;
    gxx[i] = gx*gx; gyy[i] = gy*gy; gxy[i] = gx*gy;
  }
  if(passes > 0){
    boxBlur(gxx, w, h, 1, passes);
    boxBlur(gyy, w, h, 1, passes);
    boxBlur(gxy, w, h, 1, passes);
  }
  var ang = new Float32Array(n), coh = new Float32Array(n);
  for(var k=0;k<n;k++){
    // dominant gradient orientation; the flow runs perpendicular to it
    var th = 0.5*Math.atan2(2*gxy[k], gxx[k] - gyy[k]);
    ang[k] = th + Math.PI/2;
    var tr = gxx[k] + gyy[k];
    var dsc = Math.sqrt((gxx[k]-gyy[k])*(gxx[k]-gyy[k]) + 4*gxy[k]*gxy[k]);
    coh[k] = tr > 1e-9 ? dsc/tr : 0;
  }
  return {ang:ang, coh:coh};
}
export const HATCH_OFF = [0, Math.PI/2, Math.PI/4, -Math.PI/4];
function drawHatch(ctx,W,H,LT,idx,data,L,ink){
  lastText = '';
  var cols = LT.gcols, rows = LT.grows, n = cols*rows;
  var ff = (S.flow === 'image') ? flowField(data.lum, cols, rows, S.flowSm) : null;
  var fixed = S.angle*Math.PI/180;
  var color = ink ? function(){ return ink; } : makeColorFn(L, data.rgb, cols, LT, W, H);
  var inkVar = S.inkVar/100;
  ctx.lineCap = 'round';
  for(var i=0;i<n;i++){
    var li = idx[i];
    if(li <= 0) continue;
    var cw = LT.pw[i], ch = LT.ph[i];
    var cell = Math.min(cw, ch);
    var len = cell * S.hatchL * markScale(li, L);
    var base = ff ? ff.ang[i] : fixed;
    ctx.strokeStyle = color(li, i);
    ctx.lineWidth = Math.max(0.4, cell*S.hatchW);
    ctx.globalAlpha = inkVar ? (1 - Math.random()*inkVar*0.4) : 1;
    ctx.save();
    ctx.translate(LT.px[i], LT.py[i]);
    for(var sIdx=0; sIdx<li; sIdx++){
      var a = base + HATCH_OFF[sIdx % 4];
      var band = (sIdx/4)|0;
      var off = band ? ((band % 2 ? 1 : -1) * Math.ceil(band/2) * cell*0.30) : 0;
      var l2 = len*(inkVar ? 1 + (Math.random()-0.5)*inkVar*0.5 : 1);
      var ca = Math.cos(a), sa = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(-ca*l2/2 - sa*off, -sa*l2/2 + ca*off);
      ctx.lineTo( ca*l2/2 - sa*off,  sa*l2/2 + ca*off);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}


/* ---------------- overlay layers ----------------
   Drawn after everything, in output coordinates, never screened. Positions
   are percentages so a layer survives a change of plate size or export scale. */
export let overlays = [], ovSel = -1;
// how many overlays sit BELOW the artwork. The artwork is a layer in the
// stack rather than a fixed backdrop, so things can sit under it too.
export let artZ = 0;
export function stackTopDown(){
  // returns display order, topmost first
  var out = [], i;
  for(i = overlays.length - 1; i >= artZ; i--) out.push({t:'ov', i:i});
  out.push({t:'art'});
  for(i = artZ - 1; i >= 0; i--) out.push({t:'ov', i:i});
  return out;
}
export function moveLayer(item, dir){
  // dir: +1 towards the front, -1 towards the back
  var n = overlays.length;
  if(item.t === 'art'){
    artZ = clamp(artZ + dir, 0, n);
    return true;
  }
  var i = item.i;
  if(dir > 0){
    if(i === artZ - 1){ artZ--; return true; }          // crosses above the art
    if(i < n - 1){ var t1 = overlays[i]; overlays[i] = overlays[i+1]; overlays[i+1] = t1;
      if(ovSel === i) ovSel = i+1; else if(ovSel === i+1) ovSel = i; return true; }
    return false;
  }
  if(i === artZ){ artZ++; return true; }                 // crosses below the art
  if(i > 0){ var t2 = overlays[i]; overlays[i] = overlays[i-1]; overlays[i-1] = t2;
    if(ovSel === i) ovSel = i-1; else if(ovSel === i-1) ovSel = i; return true; }
  return false;
}
export function newOverlay(kind){
  return {kind:kind, text:kind==='text' ? 'HEADLINE' : '', vis:true, img:null, name:'',
          font:'ui-monospace, Menlo, Consolas, monospace',
          x:50, y:50, size:kind==='text' ? 12 : 30, h:kind==='line' ? 1.2 : 20,
          rot:0, weight:700, track:0, op:100, stroke:0,
          skx:0, sky:0, warp:'none', amp:30, freq:2, phase:0, chroma:0,
          col:'#f2ede3', grad:false, blend:false};
}
function ovFontPx(o, W, H){ return o.size/100 * Math.min(W, H) * 1.6; }
// half extents in the layer's own space, before rotation and skew
export function ovExtent(o, W, H){
  if(o.kind === 'image'){
    var iw = o.size/100*W;
    var ar = (o.img && o.img.width) ? (o.img.height/o.img.width) : 1;
    return {hw: iw/2, hh: (o.keepAR === false ? o.h/100*H : iw*ar)/2};
  }
  if(o.kind === 'text'){
    var fs = ovFontPx(o, W, H);
    var lines = String(o.text).split('\n');
    var longest = 0;
    for(var i=0;i<lines.length;i++) longest = Math.max(longest, lines[i].length);
    return {hw: Math.max(fs*0.35, longest*fs*(0.55 + o.track)/2), hh: lines.length*fs*1.1/2};
  }
  if(o.kind === 'line') return {hw: o.size/100*W/2, hh: Math.max(2, o.h/100*H)/2};
  return {hw: o.size/100*W/2, hh: o.h/100*H/2};
}
function ovMatrix(ctx, o, W, H){
  ctx.translate(o.x/100*W, o.y/100*H);
  if(o.rot) ctx.rotate(o.rot*Math.PI/180);
  if(o.skx || o.sky) ctx.transform(1, Math.tan(o.sky*Math.PI/180), Math.tan(o.skx*Math.PI/180), 1, 0, 0);
}
// plate point -> the layer's own space, so hit testing survives rotate and skew
export function ovLocal(o, px, py, W, H){
  var dx = px - o.x/100*W, dy = py - o.y/100*H;
  var r = -o.rot*Math.PI/180, ca = Math.cos(r), sa = Math.sin(r);
  var rx = dx*ca - dy*sa, ry = dx*sa + dy*ca;
  var kx = Math.tan(o.skx*Math.PI/180), ky = Math.tan(o.sky*Math.PI/180);
  var det = 1 - kx*ky;
  if(Math.abs(det) < 1e-6) return {x:rx, y:ry};
  return {x:(rx - kx*ry)/det, y:(ry - ky*rx)/det};
}

/* ---- warps ----
   Displace along the layer's local x axis. Text walks character by character
   so each glyph gets its own offset and tangent; shapes become polylines. */
function warpAt(o, t, span){
  // t is -0.5..0.5 across the layer
  if(o.warp === 'none' || !o.amp) return {dy:0, ang:0};
  var amp = o.amp/100 * span * 0.25;
  var ph = o.phase*Math.PI/180;
  var u = (t + 0.5) * o.freq * Math.PI*2 + ph;
  if(o.warp === 'wave'){
    return {dy: Math.sin(u)*amp, ang: Math.atan2(Math.cos(u)*amp*o.freq*Math.PI*2/span, 1)};
  }
  if(o.warp === 'zigzag'){
    var tri = Math.abs(((u/Math.PI) % 2) - 1)*2 - 1;
    var slope = (((u/Math.PI) % 2) < 1 ? -1 : 1);
    return {dy: tri*amp, ang: Math.atan2(slope*amp*2*o.freq*2/span, 1)};
  }
  if(o.warp === 'arc'){
    var k = o.amp/100 * 2;
    return {dy: (t*t*4 - 1)*0.25*span*k*-1, ang: Math.atan2(-t*2*span*k*0.5/span, 1)};
  }
  return {dy:0, ang:0};
}

/* ---- pixel distortion ----
   The baseline warps above move whole glyphs. These reshape the letterform
   itself, which means rasterising the layer and remapping its pixels. */
var PIXWARP = {liquid:1, slice:1, smear:1};
export function ovNeedsPost(o){ return !!PIXWARP[o.warp] || o.chroma > 0; }
function hash2(x, y){
  var n = (Math.imul(x|0, 374761393) + Math.imul(y|0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) * 2.3283064365386963e-10;
}
function vnoise(x, y){
  var xi = Math.floor(x), yi = Math.floor(y);
  var xf = x - xi, yf = y - yi;
  var u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
  var a = hash2(xi,yi), b = hash2(xi+1,yi), c = hash2(xi,yi+1), d = hash2(xi+1,yi+1);
  return (a*(1-u) + b*u)*(1-v) + (c*(1-u) + d*u)*v;
}
function fbm(x, y){ return vnoise(x,y)*0.65 + vnoise(x*2.13+5.2, y*2.13+1.7)*0.35; }

var pw1 = document.createElement('canvas'), pw1x = pw1.getContext('2d', {willReadFrequently:true});
var pw2 = document.createElement('canvas'), pw2x = pw2.getContext('2d', {willReadFrequently:true});

// horizontal scanline displacement: the torn, hairy edge of a bad print head
function distortSlice(srcCv, o, amp){
  var w = srcCv.width, h = srcCv.height;
  if(pw2.width !== w || pw2.height !== h){ pw2.width = w; pw2.height = h; }
  else pw2x.clearRect(0,0,w,h);
  var ph = o.phase*0.11;
  var band = o.freq*7/Math.max(8, h);
  for(var y=0; y<h; y++){
    var n = fbm(y*band, ph) - 0.5;
    var jit = (hash2(y*1.7, ph*3.1) - 0.5);
    var dx = (n*1.4 + jit*0.6) * amp;
    pw2x.drawImage(srcCv, 0, y, w, 1, dx, y, w, 1);
  }
  return pw2;
}
// directional drag with alpha falloff: ink pulled off the plate
function distortSmear(srcCv, o, len){
  var w = srcCv.width, h = srcCv.height;
  if(pw2.width !== w || pw2.height !== h){ pw2.width = w; pw2.height = h; }
  else pw2x.clearRect(0,0,w,h);
  var a = o.phase*Math.PI/180 + Math.PI/2;
  var cx = Math.cos(a), sy = Math.sin(a);
  var steps = (w*h > 320000) ? 13 : 26;
  for(var i=steps; i>=1; i--){
    var t = i/steps;
    pw2x.globalAlpha = Math.pow(1-t, 1.7) * 0.75;
    pw2x.drawImage(srcCv, cx*len*t, sy*len*t);
  }
  pw2x.globalAlpha = 1;
  pw2x.drawImage(srcCv, 0, 0);
  return pw2;
}
// 2D noise remap plus per-channel offset, both in one pixel pass
// The displacement field is smooth, so it only needs evaluating on a coarse
// lattice and interpolating - that is ~60x fewer noise lookups than per pixel.
var FIELD_STEP = 8;
function buildField(w, h, fq, ph, amp){
  var gw = Math.ceil(w/FIELD_STEP) + 2, gh = Math.ceil(h/FIELD_STEP) + 2;
  var fx = new Float32Array(gw*gh), fy = new Float32Array(gw*gh);
  for(var gy=0; gy<gh; gy++){
    for(var gx=0; gx<gw; gx++){
      var X = gx*FIELD_STEP, Y = gy*FIELD_STEP, i = gy*gw + gx;
      fx[i] = (fbm(X*fq + ph, Y*fq) - 0.5)*2*amp;
      fy[i] = (fbm(X*fq + 31.7, Y*fq + 11.3 + ph) - 0.5)*2*amp;
    }
  }
  return {fx:fx, fy:fy, gw:gw, gh:gh};
}
function distortPixels(srcCv, o, amp, chroma){
  var w = srcCv.width, h = srcCv.height;
  if(!w || !h) return srcCv;
  var sx = srcCv.getContext('2d', {willReadFrequently:true});
  var sd;
  try{ sd = sx.getImageData(0,0,w,h); }catch(e){ return srcCv; }
  var s2 = sd.data;
  var out = sx.createImageData(w, h), d2 = out.data;
  var liquid = (o.warp === 'liquid');
  var fq = o.freq*1.9/Math.max(8, w);
  var ph = o.phase*0.05;
  var ch = chroma|0;
  var F = liquid ? buildField(w, h, fq, ph, amp) : null;
  var gw = F ? F.gw : 0, fx = F ? F.fx : null, fy = F ? F.fy : null;
  var inv = 1/FIELD_STEP;

  // rows the source cannot possibly feed are pure waste, and type leaves plenty
  var rowInk = new Uint8Array(h);
  for(var ry=0; ry<h; ry++){
    var rb = ry*w*4;
    for(var rx=0; rx<w; rx++){
      if(s2[rb + (rx<<2) + 3]){ rowInk[ry] = 1; break; }
    }
  }
  var reach = Math.ceil(Math.abs(amp)) + 1;
  var live = new Uint8Array(h);
  for(var ly=0; ly<h; ly++){
    var lo2 = Math.max(0, ly-reach), hi2 = Math.min(h-1, ly+reach);
    for(var k2=lo2; k2<=hi2; k2++){ if(rowInk[k2]){ live[ly] = 1; break; } }
  }

  for(var y=0; y<h; y++){
    if(!live[y]) continue;
    var gy0 = (y*inv)|0, ty = y*inv - gy0, row = gy0*gw;
    var rowNext = row + gw;
    for(var x=0; x<w; x++){
      var ox = 0, oy = 0;
      if(liquid){
        var gx0 = (x*inv)|0, tx = x*inv - gx0;
        var a0 = row + gx0, b0 = rowNext + gx0;
        var m0 = fx[a0] + (fx[a0+1] - fx[a0])*tx;
        var m1 = fx[b0] + (fx[b0+1] - fx[b0])*tx;
        ox = m0 + (m1 - m0)*ty;
        var n0 = fy[a0] + (fy[a0+1] - fy[a0])*tx;
        var n1 = fy[b0] + (fy[b0+1] - fy[b0])*tx;
        oy = n0 + (n1 - n0)*ty;
      }
      var i2 = (y*w + x) << 2;
      var bx = (x + ox)|0, by = (y + oy)|0;
      if(by < 0 || by >= h){ continue; }
      var base = by*w;
      if(ch > 0){
        var xr = bx - ch, xb = bx + ch;
        var pr = (xr >= 0 && xr < w) ? ((base + xr) << 2) : -1;
        var pg = (bx >= 0 && bx < w) ? ((base + bx) << 2) : -1;
        var pb = (xb >= 0 && xb < w) ? ((base + xb) << 2) : -1;
        d2[i2]   = pr >= 0 ? s2[pr] : 0;
        d2[i2+1] = pg >= 0 ? s2[pg+1] : 0;
        d2[i2+2] = pb >= 0 ? s2[pb+2] : 0;
        var av = 0;
        if(pr >= 0 && s2[pr+3] > av) av = s2[pr+3];
        if(pg >= 0 && s2[pg+3] > av) av = s2[pg+3];
        if(pb >= 0 && s2[pb+3] > av) av = s2[pb+3];
        d2[i2+3] = av;
      } else {
        if(bx < 0 || bx >= w) continue;
        var pp = (base + bx) << 2;
        d2[i2]   = s2[pp];
        d2[i2+1] = s2[pp+1];
        d2[i2+2] = s2[pp+2];
        d2[i2+3] = s2[pp+3];
      }
    }
  }
  sx.putImageData(out, 0, 0);
  return srcCv;
}

function warpedPath(ctx, o, pts, span){
  ctx.beginPath();
  for(var i=0;i<pts.length;i++){
    var w = warpAt(o, pts[i][0]/span, span);
    var X = pts[i][0], Y = pts[i][1] + w.dy;
    if(i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
  }
}
function ellipsePts(hw, hh, n){
  var pts = [];
  for(var i=0;i<=n;i++){
    var a = i/n*Math.PI*2;
    pts.push([Math.cos(a)*hw, Math.sin(a)*hh]);
  }
  return pts;
}
function rectPts(hw, hh, n){
  var pts = [], i;
  for(i=0;i<=n;i++) pts.push([-hw + 2*hw*i/n, -hh]);
  for(i=1;i<=4;i++) pts.push([hw, -hh + 2*hh*i/4]);
  for(i=1;i<=n;i++) pts.push([hw - 2*hw*i/n, hh]);
  for(i=1;i<=4;i++) pts.push([-hw, hh - 2*hh*i/4]);
  return pts;
}
// gradient paint for a layer, matching the plate's own gradient settings
function ovGradPaint(ctx, W, H){
  var stops = gradStops(), ang = S.gradAng*Math.PI/180, g;
  if(S.gradType === 'radial'){
    g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)/1.6);
  } else {
    var ca = Math.cos(ang)*Math.max(W,H)/2, sa = Math.sin(ang)*Math.max(W,H)/2;
    g = ctx.createLinearGradient(W/2-ca, H/2-sa, W/2+ca, H/2+sa);
  }
  for(var i=0;i<stops.length;i++) g.addColorStop(i/(stops.length-1), rgbcss(stops[i]));
  return g;
}
// paints one layer in plate coordinates; the caller decides where it lands
function paintOverlay(ctx, o, W, H, offX, offY){
  var ext = ovExtent(o, W, H);
  ctx.save();
  ctx.translate(-(offX||0), -(offY||0));
  var paint = o.grad ? ovGradPaint(ctx, W, H) : o.col;
  ctx.fillStyle = paint;
  ctx.strokeStyle = paint;
  ovMatrix(ctx, o, W, H);
  var sw = o.stroke/100*Math.min(W,H);
  var outline = sw > 0;
  ctx.lineWidth = Math.max(0.5, sw);
  ctx.lineJoin = 'round';
  var warped = (o.warp === 'wave' || o.warp === 'zigzag' || o.warp === 'arc') && o.amp;

  if(o.kind === 'text'){
    var fs = ovFontPx(o, W, H);
    ctx.font = o.weight+' '+fs.toFixed(1)+'px '+o.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var hasLS = ('letterSpacing' in ctx);
    if(hasLS) ctx.letterSpacing = (o.track*fs).toFixed(2)+'px';
    var lines = String(o.text).split('\n'), lh = fs*1.1;
    for(var li=0; li<lines.length; li++){
      var yy = (li - (lines.length-1)/2)*lh;
      if(!warped){
        if(outline) ctx.strokeText(lines[li], 0, yy); else ctx.fillText(lines[li], 0, yy);
        continue;
      }
      var chars = Array.from(lines[li]);
      var wds = [], total = 0, ci;
      for(ci=0; ci<chars.length; ci++){
        var cwd = ctx.measureText(chars[ci]).width + o.track*fs;
        wds.push(cwd); total += cwd;
      }
      var cursor = -total/2;
      for(ci=0; ci<chars.length; ci++){
        var cx2 = cursor + wds[ci]/2;
        var wv = warpAt(o, cx2/Math.max(1,total), Math.max(1,total));
        ctx.save();
        ctx.translate(cx2, yy + wv.dy);
        if(wv.ang) ctx.rotate(wv.ang);
        if(outline) ctx.strokeText(chars[ci], 0, 0); else ctx.fillText(chars[ci], 0, 0);
        ctx.restore();
        cursor += wds[ci];
      }
    }
    if(hasLS) ctx.letterSpacing = '0px';
  } else if(o.kind === 'line'){
    ctx.lineWidth = Math.max(0.5, o.h/100*H);
    ctx.lineCap = 'butt';
    if(warped){
      var lp = [];
      for(var s2=0; s2<=48; s2++) lp.push([-ext.hw + 2*ext.hw*s2/48, 0]);
      warpedPath(ctx, o, lp, ext.hw*2);
    } else {
      ctx.beginPath(); ctx.moveTo(-ext.hw, 0); ctx.lineTo(ext.hw, 0);
    }
    ctx.stroke();
  } else if(o.kind === 'rect'){
    if(warped){
      warpedPath(ctx, o, rectPts(ext.hw, ext.hh, 40), ext.hw*2);
      ctx.closePath();
      if(outline) ctx.stroke(); else ctx.fill();
    } else if(outline) ctx.strokeRect(-ext.hw, -ext.hh, ext.hw*2, ext.hh*2);
    else ctx.fillRect(-ext.hw, -ext.hh, ext.hw*2, ext.hh*2);
  } else if(o.kind === 'circle'){
    if(warped){
      warpedPath(ctx, o, ellipsePts(ext.hw, ext.hh, 72), ext.hw*2);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, ext.hw, ext.hh, 0, 0, Math.PI*2);
    }
    if(outline) ctx.stroke(); else ctx.fill();
  } else if(o.kind === 'image' && o.img){
    try{ ctx.drawImage(o.img, -ext.hw, -ext.hh, ext.hw*2, ext.hh*2); }catch(e){}
  }
  ctx.restore();
}
// bounding box with room for whatever the distortion will push outwards
function ovBox(o, W, H){
  var ext = ovExtent(o, W, H);
  // skew widens one axis in proportion to the other, then rotation gives the AABB
  var kx = Math.abs(Math.tan(o.skx*Math.PI/180)), ky = Math.abs(Math.tan(o.sky*Math.PI/180));
  var hw = ext.hw + kx*ext.hh, hh = ext.hh + ky*ext.hw;
  var a = o.rot*Math.PI/180, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
  var rw = hw*ca + hh*sa, rh = hw*sa + hh*ca;
  var amp = ovAmpPx(o, W, H);
  var pad = amp + o.chroma + 12;
  var cx = o.x/100*W, cy = o.y/100*H;
  var x0 = Math.floor(cx - rw - pad), y0 = Math.floor(cy - rh - pad);
  var x1 = Math.ceil(cx + rw + pad), y1 = Math.ceil(cy + rh + pad);
  return {x:x0, y:y0, w:Math.max(1, Math.min(x1-x0, 2600)), h:Math.max(1, Math.min(y1-y0, 2600))};
}
function ovAmpPx(o, W, H){
  var ext = ovExtent(o, W, H);
  var minDim = Math.max(4, Math.min(ext.hw, ext.hh)*2);
  var wide = Math.max(4, ext.hw*2);
  if(o.warp === 'liquid') return Math.abs(o.amp)/100*minDim*0.30;
  if(o.warp === 'slice')  return Math.abs(o.amp)/100*wide*0.16;
  if(o.warp === 'smear')  return Math.abs(o.amp)/100*minDim*1.1;
  return 0;
}
// A distorted layer only changes when the layer or the plate changes, so the
// expensive pass is keyed and reused. Screen animation, audio and every other
// slider then cost nothing extra.
function ovCacheKey(o, W, H){
  return [W, H, o.kind, o.text, o.font, o.x, o.y, o.size, o.h, o.rot, o.weight,
          o.track, o.stroke, o.skx, o.sky, o.warp, o.amp, o.freq, o.phase,
          o.chroma, o.col, o.grad ? 1 : 0,
          o.grad ? (S.gradType+'|'+S.gradAng+'|'+S.gc1+'|'+S.gc2+'|'+S.gc3+'|'+S.gradMid) : ''
         ].join('');
}
export function renderDistorted(o, W, H){
  var key = ovCacheKey(o, W, H);
  if(o._ck === key && o._cv) return {cv:o._cv, box:o._box};

  var box = ovBox(o, W, H);
  var cv = o._cv || (o._cv = document.createElement('canvas'));
  var cx = cv.getContext('2d', {willReadFrequently:true});
  if(cv.width !== box.w || cv.height !== box.h){ cv.width = box.w; cv.height = box.h; }
  else cx.clearRect(0, 0, box.w, box.h);
  paintOverlay(cx, o, W, H, box.x, box.y);

  var amp = ovAmpPx(o, W, H);
  if(o.warp === 'slice' && amp){
    var r1 = distortSlice(cv, o, amp);
    cx.clearRect(0,0,box.w,box.h); cx.drawImage(r1, 0, 0);
  } else if(o.warp === 'smear' && amp){
    var r2 = distortSmear(cv, o, amp);
    cx.clearRect(0,0,box.w,box.h); cx.drawImage(r2, 0, 0);
  }
  if(o.warp === 'liquid' || o.chroma > 0) distortPixels(cv, o, amp, o.chroma);

  o._ck = key; o._box = box;
  return {cv:cv, box:box};
}
export function drawOverlays(ctx, W, H, from, to){
  if(!overlays.length) return;
  from = from || 0;
  to = (to === undefined) ? overlays.length : to;
  for(var i=from;i<to;i++){
    var o = overlays[i];
    if(o.vis === false) continue;
    ctx.save();
    ctx.globalAlpha = o.op/100;
    if(o.blend) ctx.globalCompositeOperation = 'multiply';
    if(ovNeedsPost(o)){
      var r = renderDistorted(o, W, H);
      ctx.drawImage(r.cv, r.box.x, r.box.y);
    } else {
      paintOverlay(ctx, o, W, H, 0, 0);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function ovTransformAttr(o, W, H){
  var t = 'translate('+(o.x/100*W).toFixed(2)+' '+(o.y/100*H).toFixed(2)+')';
  if(o.rot) t += ' rotate('+o.rot+')';
  if(o.skx) t += ' skewX('+o.skx+')';
  if(o.sky) t += ' skewY('+o.sky+')';
  return ' transform="'+t+'"';
}
function ptsToPath(o, pts, span, close){
  var d = [];
  for(var i=0;i<pts.length;i++){
    var w = warpAt(o, pts[i][0]/span, span);
    d.push((i?'L':'M') + pts[i][0].toFixed(2) + ' ' + (pts[i][1] + w.dy).toFixed(2));
  }
  if(close) d.push('Z');
  return d.join(' ');
}
export function overlaysSVG(W, H, from, to){
  if(!overlays.length) return '';
  from = from || 0;
  to = (to === undefined) ? overlays.length : to;
  var out = [], i;
  if(overlays.some(function(o){ return o.grad; })){
    var stops = gradStops(), sd = [];
    for(i=0;i<stops.length;i++) sd.push('<stop offset="'+(i/(stops.length-1)*100)+'%" stop-color="'+rgbcss(stops[i])+'"/>');
    out.push('<defs>' + (S.gradType === 'radial'
      ? '<radialGradient id="ovg" cx="50%" cy="50%" r="70%">'+sd.join('')+'</radialGradient>'
      : '<linearGradient id="ovg" gradientTransform="rotate('+S.gradAng+' 0.5 0.5)">'+sd.join('')+'</linearGradient>') + '</defs>');
  }
  for(i=from;i<to;i++){
    var o = overlays[i];
    if(o.vis === false) continue;
    if(ovNeedsPost(o)){
      // reshaped pixels cannot be described as paths, so embed the raster
      var rr = renderDistorted(o, W, H);
      out.push('<image x="'+rr.box.x+'" y="'+rr.box.y+'" width="'+rr.box.w+'" height="'+rr.box.h+
        '" opacity="'+(o.op/100).toFixed(3)+'"'+(o.blend ? ' style="mix-blend-mode:multiply"' : '')+
        ' xlink:href="'+rr.cv.toDataURL()+'"/>');
      continue;
    }
    var ext = ovExtent(o, W, H);
    var paint = o.grad ? 'url(#ovg)' : o.col;
    var sw = o.stroke/100*Math.min(W,H);
    var outline = sw > 0;
    var fill = outline ? 'none' : paint;
    var strokeAttr = outline ? ' stroke="'+paint+'" stroke-width="'+sw.toFixed(2)+'"' : '';
    var tr = ovTransformAttr(o, W, H);
    var op = o.op < 100 ? ' opacity="'+(o.op/100).toFixed(3)+'"' : '';
    var bl = o.blend ? ' style="mix-blend-mode:multiply"' : '';
    var warped = (o.warp !== 'none' && o.amp);
    var body = [];

    if(o.kind === 'text'){
      var fs = ovFontPx(o, W, H);
      var lines = String(o.text).split('\n'), lh = fs*1.1;
      var attrs = 'font-family="'+xmlEsc(o.font)+'" font-size="'+fs.toFixed(2)+
                  '" font-weight="'+o.weight+'" fill="'+fill+'"'+strokeAttr;
      for(var li=0; li<lines.length; li++){
        var yy = (li - (lines.length-1)/2)*lh;
        if(!warped){
          body.push('<text '+attrs+' letter-spacing="'+(o.track*fs).toFixed(2)+
            '" text-anchor="middle" dominant-baseline="central" y="'+yy.toFixed(2)+'">'+
            xmlEsc(lines[li])+'</text>');
          continue;
        }
        // approximate advance, since SVG export has no canvas metrics to hand
        var chars = Array.from(lines[li]);
        var adv = fs*(0.6 + o.track);
        var total = Math.max(1, chars.length*adv);
        var cursor = -total/2;
        for(var ci=0; ci<chars.length; ci++){
          var cx2 = cursor + adv/2;
          var wv = warpAt(o, cx2/total, total);
          body.push('<text '+attrs+' text-anchor="middle" dominant-baseline="central" transform="translate('+
            cx2.toFixed(2)+' '+(yy+wv.dy).toFixed(2)+')'+(wv.ang ? ' rotate('+(wv.ang*180/Math.PI).toFixed(2)+')' : '')+
            '">'+xmlEsc(chars[ci])+'</text>');
          cursor += adv;
        }
      }
    } else if(o.kind === 'line'){
      var lw = Math.max(0.5, o.h/100*H);
      if(warped){
        var lp = [];
        for(var s2=0; s2<=48; s2++) lp.push([-ext.hw + 2*ext.hw*s2/48, 0]);
        body.push('<path d="'+ptsToPath(o, lp, ext.hw*2, false)+'" fill="none" stroke="'+paint+
          '" stroke-width="'+lw.toFixed(2)+'"/>');
      } else {
        body.push('<line x1="'+(-ext.hw).toFixed(2)+'" y1="0" x2="'+ext.hw.toFixed(2)+
          '" y2="0" stroke="'+paint+'" stroke-width="'+lw.toFixed(2)+'"/>');
      }
    } else if(o.kind === 'rect'){
      if(warped){
        body.push('<path d="'+ptsToPath(o, rectPts(ext.hw, ext.hh, 40), ext.hw*2, true)+
          '" fill="'+fill+'"'+strokeAttr+'/>');
      } else {
        body.push('<rect x="'+(-ext.hw).toFixed(2)+'" y="'+(-ext.hh).toFixed(2)+
          '" width="'+(ext.hw*2).toFixed(2)+'" height="'+(ext.hh*2).toFixed(2)+
          '" fill="'+fill+'"'+strokeAttr+'/>');
      }
    } else if(o.kind === 'circle'){
      if(warped){
        body.push('<path d="'+ptsToPath(o, ellipsePts(ext.hw, ext.hh, 72), ext.hw*2, true)+
          '" fill="'+fill+'"'+strokeAttr+'/>');
      } else {
        body.push('<ellipse rx="'+ext.hw.toFixed(2)+'" ry="'+ext.hh.toFixed(2)+
          '" fill="'+fill+'"'+strokeAttr+'/>');
      }
    } else if(o.kind === 'image' && o.img){
      var href = o.img.toDataURL ? o.img.toDataURL() : o.img.src;
      body.push('<image x="'+(-ext.hw).toFixed(2)+'" y="'+(-ext.hh).toFixed(2)+
        '" width="'+(ext.hw*2).toFixed(2)+'" height="'+(ext.hh*2).toFixed(2)+
        '" preserveAspectRatio="none" xlink:href="'+href+'"/>');
    }
    out.push('<g'+tr+op+bl+'>'+body.join('')+'</g>');
  }
  return out.join('\n');
}


/* ---------------- mark size ----------------
   One ramp shared by tiles, glyphs, braille and hatching. Randomise blends
   each mark toward a random point in the same range, so the two ends stay
   meaningful even when tone has stopped driving it. */
export function markScale(li, L){
  var t = (L > 1) ? li/(L-1) : 0;
  var v = S.tmin + (S.tmax - S.tmin)*t;
  if(S.sizeRnd > 0){
    var r = S.tmin + Math.random()*(S.tmax - S.tmin);
    var k = S.sizeRnd/100;
    v = v*(1-k) + r*k;
  }
  return v * dotGainFor(t);
}


/* ---------------- press simulation ---------------- */
// ink spreads into paper most where the dot perimeter is longest, which is
// the midtones - hence the classic bulge rather than a linear lift
function dotGainFor(t){
  if(!S.gain) return 1;
  return 1 + (S.gain/100) * 4*t*(1-t) * 0.9;
}
var grainC = null, grainKey = '';
function grainPattern(ctx){
  var sz = 220, px = Math.max(1, S.grainSize);
  var key = sz+'|'+px.toFixed(1);
  if(!grainC || grainKey !== key){
    grainKey = key;
    grainC = document.createElement('canvas');
    var n = Math.max(8, Math.round(sz/px));
    grainC.width = n; grainC.height = n;
    var gx = grainC.getContext('2d');
    var id = gx.createImageData(n, n), d = id.data;
    for(var i=0;i<d.length;i+=4){
      var v = ((Math.random()+Math.random()+Math.random())/3*255)|0;
      d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
    }
    gx.putImageData(id, 0, 0);
  }
  return ctx.createPattern(grainC, 'repeat');
}
function applyGrain(ctx, W, H){
  if(!S.grain) return;
  var px = Math.max(1, S.grainSize);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = (S.grain/100) * 0.55;
  ctx.fillStyle = grainPattern(ctx);
  ctx.scale(px, px);
  ctx.fillRect(0, 0, W/px + 2, H/px + 2);
  ctx.restore();
}


/* ---------------- process separation ----------------
   Traditional screen angles: each ink gets its own rotation so the dots
   interleave into rosettes rather than stacking up into moire. */
export const SEPS = {
  cmyk: {blend:'multiply', chans:[
    {n:'C', c:'#00a6e2', a:15}, {n:'M', c:'#e5007e', a:75},
    {n:'Y', c:'#ffe600', a:0},  {n:'K', c:'#151515', a:45}]},
  rgb: {blend:'screen', chans:[
    {n:'R', c:'#ff2a1c', a:15}, {n:'G', c:'#2bff62', a:75}, {n:'B', c:'#2b6cff', a:0}]}
};
function channelField(rgb, n, kind, chan){
  var f = new Float32Array(n);
  for(var i=0;i<n;i++){
    var p = i*4, r = rgb[p]/255, g = rgb[p+1]/255, b = rgb[p+2]/255;
    var v;
    if(kind === 'cmyk'){
      var K = 1 - Math.max(r, Math.max(g,b));
      if(chan === 'K') v = K;
      else if(K >= 1) v = 0;
      else v = (((chan === 'C') ? 1-r : (chan === 'M') ? 1-g : 1-b) - K)/(1-K);
    } else {
      v = (chan === 'R') ? r : (chan === 'G') ? g : b;
    }
    f[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return f;
}
// deterministic per-plate slip, the way a press drifts rather than random noise
function misregOffset(idx, cw, ch){
  if(!S.misreg) return {x:0, y:0};
  var a = idx * 2.39996;
  return {x: Math.cos(a)*S.misreg*cw, y: Math.sin(a)*S.misreg*ch};
}


/* ---------------- main render ---------------- */
export function render(target, scaleOverride, forExport){
  var audSaved = audioMods();
  try{ renderInner(target, scaleOverride, forExport); }
  finally{ audioRestore(audSaved); }
}
function renderInner(target, scaleOverride, forExport){
  var canvas = target || out;
  var ctx = canvas.getContext('2d');

  if(!src){
    stats.empty = true;
    canvas.width = 10; canvas.height = 10;
    ctx.clearRect(0,0,10,10);
    stats.grid = '-'; stats.steps = '-';
    stats.cells = '-'; stats.size = '-';
    hooks.onFrame(stats);
    return;
  }
  stats.empty = false;

  var cellPx = (scaleOverride || 1) * S.cellPx;
  var g = gridDims();
  var cols = g.cols, rows = g.rows;
  var cw = cellPx, ch = cellPx / S.aspect;
  var W = Math.max(1, Math.round(cols*cw)), H = Math.max(1, Math.round(rows*ch));

  var L = levelCount();
  var sup = (S.mode==='braille') ? {x:2,y:4} : {x:1,y:1};
  var A = animMods();
  var quad = (S.grid === 'quad' && S.mode !== 'braille');
  var sharedPre = quad ? preData(cols) : null;
  if(quad && !sharedPre) return;
  var LT = quad ? buildQuadLayout(sharedPre, W, H, cw, ch, cols, rows)
                : buildLayout(W, H, cw, ch, cols, rows);

  // a plain upright square lattice can use the cheaper area-averaged downscale
  var data = (LT.plain) ? sampleTo(LT.gcols*sup.x, LT.grows*sup.y)
                        : sampleLayout(LT, W, H, sharedPre);
  if(!data) return;
  applyTone(data.lum, A.sweep);

  var qw = LT.gcols*sup.x, qh = LT.grows*sup.y;
  applyWave(data.lum, qw, qh, A);
  applyShimmer(data.lum, A);
  var dth = LT.quad ? (S.dither === 'fs' || S.dither === 'atkinson' || S.dither === 'jjn' ? 'b4' : S.dither) : S.dither;
  var idx = quantise(data.lum, qw, qh, L, dth, S.damt, S.serp);
  if(S.flipSteps){
    var q = L-1;
    for(var fi=0; fi<idx.length; fi++) idx[fi] = q - idx[fi];
  }

  var ed = null;
  if(S.edge > 0 && S.mode !== 'braille'){
    ed = sobel(data.lum, qw, qh);
  }

  if(canvas.width !== W || canvas.height !== H){ canvas.width = W; canvas.height = H; }
  else ctx.clearRect(0,0,W,H);
  paperFill(ctx, W, H);
  drawOverlays(ctx, W, H, 0, artZ);        // everything beneath the artwork

  // marks go to their own transparent layer when merging, so the blur has
  // nothing but marks to work with and the paper stays untouched
  var mergePx = S.merge * Math.min(cw, ch);
  var bleedPx = S.bleed * Math.min(cw, ch);
  var merging = mergePx > 0.3 || bleedPx > 0.15;
  if(mergePx <= 0.3) mergePx = 0;
  var mt = ctx;
  if(merging){
    if(mrgC.width !== W || mrgC.height !== H){ mrgC.width = W; mrgC.height = H; }
    else rctx.clearRect(0,0,W,H);
    mt = rctx;
  }
  var sep = SEPS[S.sep];
  if(sep && S.mode !== 'braille'){
    for(var ci=0; ci<sep.chans.length; ci++){
      var chn = sep.chans[ci];
      var cang = chn.a * S.sepSpread * Math.PI/180 + LT.ang;
      var CL = buildLayout(W, H, cw, ch, cols, rows, cang);
      var cdata = CL.plain ? sampleTo(CL.gcols, CL.grows) : sampleLayout(CL, W, H);
      if(!cdata) return;
      var field = channelField(cdata.rgb, CL.gcols*CL.grows, S.sep, chn.n);
      applyTone(field, A.sweep);
      applyWave(field, CL.gcols, CL.grows, A);
      applyShimmer(field, A);
      var cidx = quantise(field, CL.gcols, CL.grows, L, S.dither, S.damt, S.serp);
      if(S.flipSteps){ var cq = L-1; for(var q2=0;q2<cidx.length;q2++) cidx[q2] = cq - cidx[q2]; }
      var ced = S.edge > 0 ? sobel(field, CL.gcols, CL.grows) : null;
      var off = misregOffset(ci, cw, ch);
      if(merging) rctx.clearRect(0,0,W,H);
      var dst = merging ? rctx : ctx;
      dst.save();
      dst.translate(off.x, off.y);
      if(!merging) dst.globalCompositeOperation = sep.blend;
      if(S.mode==='tiles') drawTiles(dst,W,H,CL,cidx,cdata,ced,L,A,chn.c);
      else if(S.mode==='hatch') drawHatch(dst,W,H,CL,cidx,cdata,L,chn.c);
      else drawGlyphs(dst,W,H,CL,cidx,cdata,ced,L,sup,chn.c);
      dst.restore();
      if(merging){
        ctx.save();
        ctx.globalCompositeOperation = sep.blend;
        ctx.translate(off.x, off.y);
        if(mergePx) applyMerge(ctx, W, H, mergePx);
        else { ctx.filter = 'blur('+bleedPx.toFixed(2)+'px)'; ctx.drawImage(mrgC,0,0); ctx.filter = 'none'; }
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  } else {
    if(S.mode==='tiles') drawTiles(mt,W,H,LT,idx,data,ed,L,A);
    else if(S.mode==='hatch') drawHatch(mt,W,H,LT,idx,data,L);
    else drawGlyphs(mt,W,H,LT,idx,data,ed,L,sup);
    if(merging){
      if(mergePx) applyMerge(ctx, W, H, mergePx);
      else { ctx.filter = 'blur('+bleedPx.toFixed(2)+'px)'; ctx.drawImage(mrgC,0,0); ctx.filter = 'none'; }
    }
  }
  applyGrain(ctx, W, H);
  drawOverlays(ctx, W, H, artZ, overlays.length);

  if(!target){
    stats.grid = LT.gcols+' x '+LT.grows;
    stats.steps = String(L);
    stats.cells = (LT.gcols*LT.grows).toLocaleString();
    stats.size = W + ' x ' + H + (Math.abs(W-H) <= 1 ? ' (1:1)' : '');
    
    hooks.onFrame(stats);
  }
}


/* ---- glyph / braille drawing ---- */
var EDGE_GLYPHS = ['\u2500','\u2572','\u2502','\u2571']; // - \ | /
function drawGlyphs(ctx,W,H,LT,idx,data,ed,L,sup,ink){
  var cols = LT.gcols, rows = LT.grows;
  var chars = S.mode==='braille' ? null : rampChars();
  var color = ink ? function(){ return ink; } : makeColorFn(L, data.rgb, cols, LT, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  var lines = [], y, x, i;
  var edThresh = 1.02 - S.edge;
  var upright = S.upright;
  var lastFont = '';
  function useFont(size){
    var f = S.fweight+' '+size.toFixed(2)+'px '+S.font;
    if(f !== lastFont){ ctx.font = f; lastFont = f; }
  }

  if(S.mode==='braille'){
    var BITS = [ [0,0,1],[0,1,2],[0,2,4],[1,0,8],[1,1,16],[1,2,32],[0,3,64],[1,3,128] ];
    var brBase = LT.ph[0]*S.fscale;
    for(y=0;y<rows;y++){
      var line = '';
      for(x=0;x<cols;x++){
        var k = y*cols+x, bits = 0;
        for(var b=0;b<BITS.length;b++){
          var sx = x*2 + BITS[b][0], sy = y*4 + BITS[b][1];
          if(idx[sy*(cols*2)+sx] > 0) bits |= BITS[b][2];
        }
        var chc = String.fromCharCode(0x2800 + bits);
        line += chc;
        if(bits){
          var pop = 0, bb = bits;
          while(bb){ pop += bb & 1; bb >>= 1; }
          useFont(brBase * markScale(pop, 9));
          ctx.fillStyle = color(1, (y*4)*(cols*2) + x*2);
          ctx.fillText(chc, LT.px[k], LT.py[k]);
        }
      }
      lines.push(line);
    }
    lastText = lines.join('\n');
    return;
  }

  for(y=0;y<rows;y++){
    var ln = '';
    for(x=0;x<cols;x++){
      i = y*cols+x;
      var li = idx[i];
      var glyph = chars[clamp(li,0,chars.length-1)];
      if(ed && ed.mag[i] > edThresh*0.55){
        var ang = ed.ang[i] + Math.PI/2;
        var bucket = ((Math.round(ang / (Math.PI/4)) % 4) + 4) % 4;
        glyph = EDGE_GLYPHS[bucket];
      }
      ln += glyph;
      if(glyph === ' ') continue;
      var gsz = LT.ph[i]*S.fscale*markScale(li, L);
      if(S.inkVar) gsz *= 1 + (Math.random()-0.5)*(S.inkVar/100)*0.4;
      useFont(gsz);
      ctx.fillStyle = color(li, i);
      ctx.globalAlpha = S.inkVar ? (1 - Math.random()*(S.inkVar/100)*0.35) : 1;
      var rot = upright ? 0 : LT.pr[i];
      if(rot){
        ctx.save();
        ctx.translate(LT.px[i], LT.py[i]);
        ctx.rotate(rot);
        ctx.fillText(glyph, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(glyph, LT.px[i], LT.py[i]);
      }
      ctx.globalAlpha = 1;
    }
    lines.push(ln);
  }
  lastText = lines.join('\n');
}


/* ---- tile ink resolution ---- */
function tintTile(i, img, col){
  var k = i + '|' + col;
  if(tintCache[k]) return tintCache[k];
  var iw = img.width || 256, ih = img.height || 256;
  var s = Math.min(1, 512/Math.max(iw,ih));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(iw*s));
  c.height = Math.max(1, Math.round(ih*s));
  var x = c.getContext('2d');
  x.drawImage(img, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col;
  x.fillRect(0, 0, c.width, c.height);
  tintCache[k] = c;
  return c;
}
// returns {art:[canvas|img|null], kind:['flat'|'source'|'none']}
export function tileSpan(){
  var n = 0;
  for(var i=0;i<8;i++) if(layers[i]) n = i+1;
  return n;
}
// tone step -> tile slot, so a 4-tile set still reads across 7 states
export function slotForLevel(i, L){
  var n = tileSpan();
  if(n <= 1 || L <= 1) return 0;
  if(n === L) return i;
  return Math.round(i/(L-1)*(n-1));
}
export function resolveTiles(L, ink){
  var fg = hex2rgb(S.fg), fg2 = hex2rgb(S.fg2);
  var art = [], kind = [];
  for(var i=0;i<L;i++){
    var slot = slotForLevel(i, L);
    var img = layers[slot];
    if(!img){ art[i] = null; kind[i] = 'none'; continue; }
    var col = null;
    if(ink){ art[i] = tintTile(slot, img, ink); kind[i] = 'flat'; continue; }
    if(S.tileInk === 'tile'){
      col = layerColors[slot] || S.fg;
    } else if(S.tileInk === 'original'){
      col = null;
    } else if(S.colorMode === 'source'){
      art[i] = img; kind[i] = 'source'; continue;
    } else if(S.colorMode === 'grad'){
      art[i] = img; kind[i] = 'grad'; continue;
    } else {
      col = S.colorMode === 'duo' ? rgbcss(mix(fg, fg2, L>1 ? i/(L-1) : 0)) : S.fg;
    }
    art[i] = col ? tintTile(slot, img, col) : img;
    kind[i] = 'flat';
  }
  return {art:art, kind:kind};
}


/* ---- tile drawing ---- */
function drawTiles(ctx,W,H,LT,idx,data,ed,L,A,ink){
  lastText = '';
  if(!layers.some(function(l){ return !!l; })){
    ctx.fillStyle = 'rgba(255,255,255,.30)';
    ctx.font = '500 '+Math.max(11,Math.min(20,W/44)).toFixed(0)+'px ui-monospace, monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('LOAD TILES IN SECTION 07', W/2, H/2);
    return;
  }
  var cols = LT.gcols, rows = LT.grows, n = cols*rows;
  var R = resolveTiles(L, ink);
  var needMask = R.kind.indexOf('source') >= 0 || R.kind.indexOf('grad') >= 0;
  if(needMask){
    if(maskC.width !== W || maskC.height !== H){ maskC.width = W; maskC.height = H; }
    else mctx.clearRect(0,0,W,H);
    if(colC.width !== W || colC.height !== H){ colC.width = W; colC.height = H; }
    else cctx.clearRect(0,0,W,H);
  }
  A = A || {on:false, rot:0, scale:1};
  var edThresh = 1.02 - S.edge;
  var rgb = data.rgb;
  var snap = parseFloat(S.snap) || 0;
  var snapRad = snap ? snap*Math.PI/180 : 0;
  var upright = S.upright;
  // tile scale ramps across the tone steps, shadow to highlight
  var inkVar = S.inkVar/100;
  var animScale = (A.scale || 1);
  var T = animT;
  var LA = layerAnim, anyLA = tilesAnimated();

  for(var y=0;y<rows;y++) for(var x=0;x<cols;x++){
    var i = y*cols+x;
    var li = clamp(idx[i],0,L-1);
    var img = R.art[li];
    if(!img) continue;
    var src2 = (R.kind[li] === 'source' || R.kind[li] === 'grad');
    var isGrad = R.kind[li] === 'grad';
    var dest = src2 ? mctx : ctx;
    var cw = LT.pw[i], ch = LT.ph[i];
    var jx = S.jitter*cw*0.5, jy = S.jitter*ch*0.5;
    var sk = markScale(li, L) * animScale;
    var cx = LT.px[i], cy = LT.py[i];
    var rot = (A.rot || 0) + (upright ? 0 : LT.pr[i]);
    if(anyLA){
      var la = LA[li];
      var ph2 = la.stagger ? (x + y)*la.stagger*0.35 : 0;
      rot += la.angle + la.spin*T + ph2;
      if(la.pulse) sk *= 1 + Math.sin(T*la.pulseSpd + ph2)*la.pulse;
      if(la.orbit){
        cx += Math.cos(T*la.orbitSpd + ph2)*la.orbit*cw;
        cy += Math.sin(T*la.orbitSpd + ph2)*la.orbit*ch;
      }
    }
    if(inkVar) sk *= 1 + (Math.random()-0.5)*2*inkVar*0.5;
    if(sk <= 0) continue;
    var tw = cw*sk, th = ch*sk;
    if(inkVar) dest.globalAlpha = 1 - Math.random()*inkVar*0.35;
    if(jx||jy){ cx += (Math.random()-0.5)*2*jx; cy += (Math.random()-0.5)*2*jy; }
    if(S.rot==='rand') rot += Math.random()*Math.PI*2;
    else if(S.rot==='edge' && ed && ed.mag[i] > edThresh*0.4) rot += ed.ang[i] + Math.PI/2;
    if(snapRad) rot = Math.round(rot/snapRad)*snapRad;
    dest.save();
    dest.translate(cx, cy);
    if(rot) dest.rotate(rot);
    dest.drawImage(img, -tw/2, -th/2, tw, th);
    dest.restore();
    if(inkVar) dest.globalAlpha = 1;
    if(src2){
      var p = i*4;
      cctx.fillStyle = isGrad
        ? rgbcss(gradAt(gradStops(), gradT(cx, cy, W, H)))
        : 'rgb('+rgb[p]+','+rgb[p+1]+','+rgb[p+2]+')';
      cctx.save();
      cctx.translate(cx, cy);
      if(rot) cctx.rotate(rot);
      cctx.fillRect(-cw/2 - jx, -ch/2 - jy, cw + jx*2, ch + jy*2);
      cctx.restore();
    }
  }
  if(needMask){
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(maskC, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(colC, 0, 0);
  }
}


/* ---------------- text plate ---------------- */
export const TXT = {
  text:'Aa', family:'Georgia, serif', custom:'', weight:700, italic:false,
  track:0, lead:1, outline:0, pad:8, align:'center', dark:false
};
export const TXT_DEF = Object.assign({}, TXT);
var SIZE = 260;

function famName(){
  var c = TXT.custom.trim();
  return c ? c : TXT.family;
}
function fontString(){
  return (TXT.italic ? 'italic ' : '') + TXT.weight + ' ' + SIZE + 'px ' + famName();
}
function measureLine(x, line, ls, hasLS){
  if(!ls || hasLS) return x.measureText(line).width;
  var chars = Array.from(line), w = 0;
  for(var i=0;i<chars.length;i++) w += x.measureText(chars[i]).width + ls;
  return Math.max(0, w - ls);
}
function paintLine(x, line, sx, y, ls, hasLS, stroke){
  if(!ls || hasLS){
    if(stroke) x.strokeText(line, sx, y); else x.fillText(line, sx, y);
    return;
  }
  var chars = Array.from(line), cx = sx;
  for(var i=0;i<chars.length;i++){
    if(stroke) x.strokeText(chars[i], cx, y); else x.fillText(chars[i], cx, y);
    cx += x.measureText(chars[i]).width + ls;
  }
}
export function buildTextPlate(){
  var lines = (TXT.text.length ? TXT.text : ' ').split('\n');
  var c = document.createElement('canvas');
  var x = c.getContext('2d');
  x.font = fontString();
  var hasLS = ('letterSpacing' in x);
  var ls = TXT.track * SIZE;
  if(hasLS && ls) x.letterSpacing = ls.toFixed(2)+'px';

  var widths = lines.map(function(l){ return measureLine(x, l, ls, hasLS); });
  var maxW = Math.max(1, Math.max.apply(null, widths));
  var m0 = x.measureText(lines[0] || 'H');
  var mN = x.measureText(lines[lines.length-1] || 'H');
  var asc = m0.actualBoundingBoxAscent || SIZE*0.72;
  var desc = mN.actualBoundingBoxDescent || SIZE*0.22;
  var lead = SIZE * TXT.lead;
  var pad = SIZE * TXT.pad/100;
  var stroke = TXT.outline/100 * SIZE * 0.16;
  var extra = stroke;

  var W = Math.ceil(maxW + pad*2 + extra);
  var H = Math.ceil(asc + desc + lead*(lines.length-1) + pad*2 + extra);
  W = clamp(W, 8, 6000); H = clamp(H, 8, 6000);

  c.width = W; c.height = H;
  x = c.getContext('2d');
  x.fillStyle = TXT.dark ? '#ffffff' : '#000000';
  x.fillRect(0,0,W,H);
  x.font = fontString();
  if(hasLS && ls) x.letterSpacing = ls.toFixed(2)+'px';
  x.textAlign = 'left';
  x.textBaseline = 'alphabetic';
  var ink = TXT.dark ? '#000000' : '#ffffff';
  x.fillStyle = ink; x.strokeStyle = ink;
  x.lineWidth = Math.max(0.5, stroke);
  x.lineJoin = 'round';

  for(var i=0;i<lines.length;i++){
    var w = widths[i], sx;
    if(TXT.align==='left') sx = pad + extra/2;
    else if(TXT.align==='right') sx = W - pad - extra/2 - w;
    else sx = (W - w)/2;
    var y = pad + extra/2 + asc + lead*i;
    paintLine(x, lines[i], sx, y, ls, hasLS, stroke > 0);
  }
  return c;
}
export function refreshTextPlate(){
  if(M3.shape === 'text3d'){
    M3.mesh = null; M3.vx = null;
    if(srcKind === 'model'){ refreshModel(); showTriCountSoon(); }
  }
  if(srcKind !== 'text') return;
  setSource(buildTextPlate(), 'type-' + (TXT.text.replace(/[^a-z0-9]+/gi,'').slice(0,12) || 'plate'));
}


/* ---------------- 3D source: meshes + software rasteriser ---------------- */
export const M3 = {
  shape:'sphere', shade:'lambert', facet:false, wire:false,
  rotX:-0.35, rotY:0.6, spin:0, tumble:0,
  dist:3.2, fov:45, az:0.9, el:0.7, amb:0.12, spec:0.35, res:300, depth:0.34, detail:200,
  scale:1, pulse:0, pulseSpd:1,
  relH:0.55, relRes:110, relSmooth:2, relGamma:1, relInv:false,
  cueLum:60, cueHaze:20, cueFocus:35, cueGround:15, cueCentre:20,
  col:'#d8d4c8', bg:'#000000',
  mesh:null, objMesh:null, canvas:null, ctx:null, img:null, zbuf:null,
  vx:null, vy:null, vz:null, nx:null, ny:null, nz:null
};
export const M3_DEF = Object.assign({}, M3);
var TAU = Math.PI*2;

function normz(v){
  var l = Math.hypot(v[0],v[1],v[2]) || 1;
  return [v[0]/l, v[1]/l, v[2]/l];
}
// parametric surface with normals from finite-difference tangents
function paramMesh(fn, nu, nv){
  var P = [], N = [], F = [], e = 0.0015, i, j;
  for(j=0;j<=nv;j++) for(i=0;i<=nu;i++){
    var u = i/nu, v = j/nv;
    var p = fn(u,v);
    var pu = fn(u+e > 1 ? u-e : u+e, v), pv = fn(u, v+e > 1 ? v-e : v+e);
    var su = (u+e > 1) ? -1 : 1, sv = (v+e > 1) ? -1 : 1;
    var tu = [(pu[0]-p[0])*su, (pu[1]-p[1])*su, (pu[2]-p[2])*su];
    var tv = [(pv[0]-p[0])*sv, (pv[1]-p[1])*sv, (pv[2]-p[2])*sv];
    var n = normz([ tu[1]*tv[2]-tu[2]*tv[1], tu[2]*tv[0]-tu[0]*tv[2], tu[0]*tv[1]-tu[1]*tv[0] ]);
    P.push(p[0],p[1],p[2]); N.push(n[0],n[1],n[2]);
  }
  for(j=0;j<nv;j++) for(i=0;i<nu;i++){
    var a = j*(nu+1)+i, b = a+1, c = a+nu+1, d = c+1;
    F.push(a,c,b, b,c,d);
  }
  return {P:new Float32Array(P), N:new Float32Array(N), F:new Uint32Array(F)};
}
// flat-shaded mesh from raw triangles
function flatMesh(tris){
  var P = [], N = [], F = [];
  for(var t=0;t<tris.length;t++){
    var v = tris[t];
    var ax=v[3]-v[0], ay=v[4]-v[1], az=v[5]-v[2];
    var bx=v[6]-v[0], by=v[7]-v[1], bz=v[8]-v[2];
    var n = normz([ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx]);
    var base = P.length/3;
    for(var k=0;k<3;k++){
      P.push(v[k*3], v[k*3+1], v[k*3+2]);
      N.push(n[0], n[1], n[2]);
    }
    F.push(base, base+1, base+2);
  }
  return {P:new Float32Array(P), N:new Float32Array(N), F:new Uint32Array(F)};
}
function quadTris(a,b,c,d){ return [a.concat(b).concat(c), a.concat(c).concat(d)]; }

export function buildMesh(kind){
  var PI = Math.PI, tris, i, n;
  switch(kind){
    case 'sphere':
      return paramMesh(function(u,v){
        var th = u*TAU, ph = v*PI;
        return [Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th)];
      }, 56, 30);
    case 'torus':
      return paramMesh(function(u,v){
        var a = u*TAU, b = v*TAU, R = 0.72, r = 0.30;
        return [(R+r*Math.cos(b))*Math.cos(a), r*Math.sin(b), (R+r*Math.cos(b))*Math.sin(a)];
      }, 72, 28);
    case 'knot':
      return paramMesh(function(u,v){
        var pq = 2, qq = 3, a = u*TAU, b = v*TAU, r = 0.22;
        var cr = 0.62*(2 + Math.cos(qq*a));
        var cx = cr*Math.cos(pq*a), cy = cr*Math.sin(pq*a), cz = 0.62*Math.sin(qq*a)*1.6;
        var d = 0.001, a2 = a+d;
        var cr2 = 0.62*(2 + Math.cos(qq*a2));
        var tx = cr2*Math.cos(pq*a2)-cx, ty = cr2*Math.sin(pq*a2)-cy, tz = 0.62*Math.sin(qq*a2)*1.6-cz;
        var T = normz([tx,ty,tz]);
        var Nn = normz([T[1]*0 - T[2]*1, T[2]*0 - T[0]*0, T[0]*1 - T[1]*0]);
        var B = normz([T[1]*Nn[2]-T[2]*Nn[1], T[2]*Nn[0]-T[0]*Nn[2], T[0]*Nn[1]-T[1]*Nn[0]]);
        var cb = Math.cos(b)*r, sb = Math.sin(b)*r;
        return [(cx + Nn[0]*cb + B[0]*sb)*0.62,
                (cy + Nn[1]*cb + B[1]*sb)*0.62,
                (cz + Nn[2]*cb + B[2]*sb)*0.62];
      }, 180, 20);
    case 'box':
      var h = 0.62, q = [
        [[-h,-h, h],[ h,-h, h],[ h, h, h],[-h, h, h]],
        [[ h,-h,-h],[-h,-h,-h],[-h, h,-h],[ h, h,-h]],
        [[-h,-h,-h],[-h,-h, h],[-h, h, h],[-h, h,-h]],
        [[ h,-h, h],[ h,-h,-h],[ h, h,-h],[ h, h, h]],
        [[-h, h, h],[ h, h, h],[ h, h,-h],[-h, h,-h]],
        [[-h,-h,-h],[ h,-h,-h],[ h,-h, h],[-h,-h, h]]
      ];
      tris = [];
      for(i=0;i<q.length;i++) tris = tris.concat(quadTris(q[i][0],q[i][1],q[i][2],q[i][3]));
      return flatMesh(tris);
    case 'cylinder':
    case 'cone':
      var seg = 56, top = (kind==='cone') ? 0.0001 : 0.55, bot = 0.55, hh = 0.75;
      tris = [];
      for(i=0;i<seg;i++){
        var a0 = i/seg*TAU, a1 = (i+1)/seg*TAU;
        var t0 = [Math.cos(a0)*top, hh, Math.sin(a0)*top];
        var t1 = [Math.cos(a1)*top, hh, Math.sin(a1)*top];
        var b0 = [Math.cos(a0)*bot, -hh, Math.sin(a0)*bot];
        var b1 = [Math.cos(a1)*bot, -hh, Math.sin(a1)*bot];
        tris = tris.concat(quadTris(b0, b1, t1, t0));
        tris.push([0,-hh,0].concat(b1).concat(b0));
        if(kind!=='cone') tris.push([0,hh,0].concat(t0).concat(t1));
      }
      return flatMesh(tris);
    case 'octa':
      var o = 0.85, vtop = [0,o,0], vbot = [0,-o,0];
      var ring = [[o,0,0],[0,0,o],[-o,0,0],[0,0,-o]];
      tris = [];
      for(i=0;i<4;i++){
        var r0 = ring[i], r1 = ring[(i+1)%4];
        tris.push(vtop.concat(r0).concat(r1));
        tris.push(vbot.concat(r1).concat(r0));
      }
      return flatMesh(tris);
    case 'text3d':
      return buildTextMesh();
    case 'relief':
      return buildReliefMesh();
    case 'obj':
      return M3.objMesh || buildMesh('sphere');
  }
  return buildMesh('sphere');
}

/* OBJ import: positions + faces, smooth normals derived if absent */
function parseOBJ(text){
  var vs = [], vns = [], P = [], N = [], F = [], map = {}, lines = text.split(/\r?\n/);
  for(var li=0; li<lines.length; li++){
    var L = lines[li];
    if(L.charCodeAt(0) === 35) continue;
    var t = L.trim().split(/\s+/);
    if(t[0] === 'v'){ vs.push(+t[1], +t[2], +t[3]); }
    else if(t[0] === 'vn'){ vns.push(+t[1], +t[2], +t[3]); }
    else if(t[0] === 'f'){
      var poly = [];
      for(var k=1;k<t.length;k++){
        var key = t[k];
        if(map[key] === undefined){
          var parts = key.split('/');
          var vi = parseInt(parts[0],10); if(vi < 0) vi = vs.length/3 + vi + 1;
          var ni = parts[2] ? parseInt(parts[2],10) : 0; if(ni < 0) ni = vns.length/3 + ni + 1;
          map[key] = P.length/3;
          P.push(vs[(vi-1)*3], vs[(vi-1)*3+1], vs[(vi-1)*3+2]);
          if(ni) N.push(vns[(ni-1)*3], vns[(ni-1)*3+1], vns[(ni-1)*3+2]);
          else N.push(0,0,0);
        }
        poly.push(map[key]);
      }
      for(var f=1; f<poly.length-1; f++) F.push(poly[0], poly[f], poly[f+1]);
    }
  }
  if(!P.length) return null;
  // derive normals wherever the file supplied none
  if(!vns.length){
    for(var i=0;i<F.length;i+=3){
      var a=F[i]*3, b=F[i+1]*3, c=F[i+2]*3;
      var ax=P[b]-P[a], ay=P[b+1]-P[a+1], az=P[b+2]-P[a+2];
      var bx=P[c]-P[a], by=P[c+1]-P[a+1], bz=P[c+2]-P[a+2];
      var nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx;
      N[a]+=nx; N[a+1]+=ny; N[a+2]+=nz;
      N[b]+=nx; N[b+1]+=ny; N[b+2]+=nz;
      N[c]+=nx; N[c+1]+=ny; N[c+2]+=nz;
    }
    for(var j=0;j<N.length;j+=3){
      var l = Math.hypot(N[j],N[j+1],N[j+2]) || 1;
      N[j]/=l; N[j+1]/=l; N[j+2]/=l;
    }
  }
  // centre on the bounding box and normalise to a unit-ish radius
  var mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
  for(var q=0;q<P.length;q+=3) for(var d=0;d<3;d++){
    if(P[q+d]<mn[d]) mn[d]=P[q+d];
    if(P[q+d]>mx[d]) mx[d]=P[q+d];
  }
  var cxx=(mn[0]+mx[0])/2, cyy=(mn[1]+mx[1])/2, czz=(mn[2]+mx[2])/2;
  var span = Math.max(mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]) || 1;
  var sc = 1.5/span;
  for(var w=0;w<P.length;w+=3){
    P[w]=(P[w]-cxx)*sc; P[w+1]=(P[w+1]-cyy)*sc; P[w+2]=(P[w+2]-czz)*sc;
  }
  return {P:new Float32Array(P), N:new Float32Array(N), F:new Uint32Array(F)};
}


/* ---------------- guessed depth from a flat image ----------------
   No network here, so no learned monocular depth. Instead: five classical
   single-image cues, each of which is a real heuristic with a real failure
   mode, mixed by the user against a live preview.  */
export let reliefSrc = null;

function boxBlur(a, w, h, r, passes){
  if(r < 1) return a;
  var tmp = new Float32Array(a.length);
  for(var pss=0; pss<(passes||1); pss++){
    for(var y=0;y<h;y++){
      var acc = 0, n = 0;
      for(var x=0;x<w;x++){
        var i = y*w+x;
        acc = 0; n = 0;
        for(var k=-r;k<=r;k++){
          var xx = x+k; if(xx<0||xx>=w) continue;
          acc += a[y*w+xx]; n++;
        }
        tmp[i] = acc/n;
      }
    }
    for(var x2=0;x2<w;x2++){
      for(var y2=0;y2<h;y2++){
        var acc2 = 0, n2 = 0;
        for(var k2=-r;k2<=r;k2++){
          var yy = y2+k2; if(yy<0||yy>=h) continue;
          acc2 += tmp[yy*w+x2]; n2++;
        }
        a[y2*w+x2] = acc2/n2;
      }
    }
  }
  return a;
}
// stretch to 0..1 on robust bounds, so one hot pixel can't flatten everything
function norm01(a){
  var mn = Infinity, mx = -Infinity;
  for(var i=0;i<a.length;i+=3){
    if(a[i]<mn) mn=a[i];
    if(a[i]>mx) mx=a[i];
  }
  var sp = mx-mn;
  if(sp < 1e-6){ for(var j=0;j<a.length;j++) a[j] = 0.5; return a; }
  for(var k=0;k<a.length;k++) a[k] = clamp((a[k]-mn)/sp, 0, 1);
  return a;
}
export function computeDepthField(img, gw, gh){
  var sw = gw*2, sh = gh*2;
  var c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  var x = c.getContext('2d', {willReadFrequently:true});
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  try{ x.drawImage(img, 0, 0, sw, sh); }catch(e){ return null; }
  var d;
  try{ d = x.getImageData(0,0,sw,sh).data; }catch(e){ return null; }

  var n = sw*sh;
  var lum = new Float32Array(n), minc = new Float32Array(n), foc = new Float32Array(n);
  for(var i=0,p=0;i<n;i++,p+=4){
    var r = d[p]/255, g = d[p+1]/255, b = d[p+2]/255;
    lum[i] = 0.2126*r + 0.7152*g + 0.0722*b;
    minc[i] = Math.min(r, Math.min(g, b));
  }
  // dark-channel prior: haze lifts every channel, so distant regions have a high floor
  var dch = new Float32Array(n);
  for(var y=0;y<sh;y++) for(var xx=0;xx<sw;xx++){
    var m = 1;
    for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
      var yy = clamp(y+dy,0,sh-1), x2 = clamp(xx+dx,0,sw-1);
      var v = minc[yy*sw+x2]; if(v < m) m = v;
    }
    dch[y*sw+xx] = m;
  }
  // depth from defocus: laplacian energy, spread out so it describes regions not edges
  for(var y2=0;y2<sh;y2++) for(var x3=0;x3<sw;x3++){
    var i2 = y2*sw+x3;
    var c0 = lum[i2];
    var L = lum[y2*sw+clamp(x3-1,0,sw-1)], R = lum[y2*sw+clamp(x3+1,0,sw-1)];
    var U = lum[clamp(y2-1,0,sh-1)*sw+x3], D = lum[clamp(y2+1,0,sh-1)*sw+x3];
    foc[i2] = Math.abs(4*c0 - L - R - U - D);
  }
  boxBlur(foc, sw, sh, Math.max(2, Math.round(sw/40)), 2);

  norm01(lum); norm01(dch); norm01(foc);

  var wl = M3.cueLum, wh = M3.cueHaze, wf = M3.cueFocus, wg = M3.cueGround, wc = M3.cueCentre;
  var tot = wl+wh+wf+wg+wc;
  if(tot <= 0){ wl = 1; tot = 1; }
  var out = new Float32Array(n);
  for(var y3=0;y3<sh;y3++) for(var x4=0;x4<sw;x4++){
    var i3 = y3*sw+x4;
    var groundNear = y3/(sh-1);                       // lower in frame reads as closer
    var cx = (x4/(sw-1)-0.5)*2, cy = (y3/(sh-1)-0.5)*2;
    var centreNear = 1 - Math.min(1, Math.sqrt(cx*cx+cy*cy)/1.4142);
    out[i3] = (wl*lum[i3] + wh*(1-dch[i3]) + wf*foc[i3] + wg*groundNear + wc*centreNear)/tot;
  }
  // down to mesh resolution
  var dep = new Float32Array(gw*gh);
  for(var gy=0; gy<gh; gy++) for(var gx=0; gx<gw; gx++){
    var a = out[(gy*2)*sw + gx*2] + out[(gy*2)*sw + gx*2+1] +
            out[(gy*2+1)*sw + gx*2] + out[(gy*2+1)*sw + gx*2+1];
    dep[gy*gw+gx] = a/4;
  }
  if(M3.relSmooth > 0) boxBlur(dep, gw, gh, 1, M3.relSmooth);
  norm01(dep);
  for(var q=0;q<dep.length;q++){
    var v2 = dep[q];
    if(M3.relGamma !== 1) v2 = Math.pow(v2, M3.relGamma);
    if(M3.relInv) v2 = 1 - v2;
    dep[q] = v2;
  }
  return {d:dep, w:gw, h:gh};
}
function buildReliefMesh(){
  var img = reliefSrc || lastImage;
  if(!img) return buildMesh('sphere');
  var sd = dimsOf(img);
  var gw = clamp(M3.relRes|0, 8, 240);
  var gh = clamp(Math.round(gw * sd.h / sd.w), 4, 320);
  var field = computeDepthField(img, gw, gh);
  if(!field) return buildMesh('sphere');
  M3.depth = field;
  var dep = field.d;

  var ar = gw/gh, W = 1.7, H = 1.7;
  if(ar > 1) H = 1.7/ar; else W = 1.7*ar;
  var hgt = M3.relH;
  var nv = gw*gh;
  var P = new Float32Array(nv*3), N = new Float32Array(nv*3);
  for(var y=0;y<gh;y++) for(var x=0;x<gw;x++){
    var i = y*gw+x, a = i*3;
    P[a]   = (x/(gw-1) - 0.5)*W;
    P[a+1] = (0.5 - y/(gh-1))*H;
    P[a+2] = -(dep[i] - 0.5)*hgt;      // camera looks down +z, so nearer is more negative
  }
  var dx2 = W/(gw-1), dy2 = H/(gh-1);
  for(var y4=0;y4<gh;y4++) for(var x5=0;x5<gw;x5++){
    var i4 = y4*gw+x5, a2 = i4*3;
    var hl = dep[y4*gw+clamp(x5-1,0,gw-1)], hr = dep[y4*gw+clamp(x5+1,0,gw-1)];
    var hu = dep[clamp(y4-1,0,gh-1)*gw+x5], hd = dep[clamp(y4+1,0,gh-1)*gw+x5];
    var nx = -hgt*(hr-hl)/(2*dx2);
    var ny =  hgt*(hd-hu)/(2*dy2);
    var nz = -1;
    var l = Math.sqrt(nx*nx + ny*ny + 1) || 1;
    N[a2] = nx/l; N[a2+1] = ny/l; N[a2+2] = nz/l;
  }
  var F = new Uint32Array((gw-1)*(gh-1)*6), fi = 0;
  for(var y5=0;y5<gh-1;y5++) for(var x6=0;x6<gw-1;x6++){
    var t = y5*gw+x6;
    F[fi++] = t; F[fi++] = t+gw; F[fi++] = t+1;
    F[fi++] = t+1; F[fi++] = t+gw; F[fi++] = t+gw+1;
  }
  drawDepthPreview(field);
  return {P:P, N:N, F:F};
}
function drawDepthPreview(field){ hooks.onDepth(field); }

/* extruded 3D type: glyph mask -> run-merged spans -> quads.
   Avoids outline triangulation entirely, so counters and holes just work. */
function pushQuad(P,N,F,a,b,c,d,nx,ny,nz){
  var base = P.length/3;
  P.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2], d[0],d[1],d[2]);
  for(var k=0;k<4;k++) N.push(nx,ny,nz);
  F.push(base, base+1, base+2, base, base+2, base+3);
}
function buildTextMesh(){
  var plate = buildTextPlate();
  var det = Math.max(40, M3.detail|0);
  var w = Math.max(2, Math.min(plate.width, det));
  var h = Math.max(2, Math.round(w * plate.height / plate.width));
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var x = c.getContext('2d', {willReadFrequently:true});
  x.imageSmoothingEnabled = true;
  x.drawImage(plate, 0, 0, w, h);
  var px = x.getImageData(0,0,w,h).data;

  var inside = new Uint8Array(w*h);
  var dark = TXT.dark;
  for(var i=0, p=0; i<w*h; i++, p+=4){
    var lum = (0.2126*px[p] + 0.7152*px[p+1] + 0.0722*px[p+2])/255;
    inside[i] = (dark ? (lum < 0.5) : (lum > 0.5)) ? 1 : 0;
  }
  function at(ix,iy){
    if(ix<0||iy<0||ix>=w||iy>=h) return 0;
    return inside[iy*w+ix];
  }

  var span = 1.7 / Math.max(w,h);
  var ox = w*span/2, oy = h*span/2, d = M3.depth/2;
  function X(ix){ return ix*span - ox; }
  function Y(iy){ return oy - iy*span; }

  var P = [], N = [], F = [], ix, iy, run;

  // front and back caps, horizontal runs merged
  for(iy=0; iy<h; iy++){
    ix = 0;
    while(ix < w){
      if(!at(ix,iy)){ ix++; continue; }
      run = ix;
      while(run < w && at(run,iy)) run++;
      var x0 = X(ix), x1 = X(run), y0 = Y(iy), y1 = Y(iy+1);
      pushQuad(P,N,F, [x0,y0,d],[x1,y0,d],[x1,y1,d],[x0,y1,d], 0,0,1);
      pushQuad(P,N,F, [x0,y0,-d],[x0,y1,-d],[x1,y1,-d],[x1,y0,-d], 0,0,-1);
      ix = run;
    }
  }
  // left and right walls, vertical runs merged
  for(ix=0; ix<w; ix++){
    for(var side=0; side<2; side++){
      var dx = side ? 1 : -1, nxs = side ? 1 : -1;
      var wx = X(side ? ix+1 : ix);
      iy = 0;
      while(iy < h){
        if(!(at(ix,iy) && !at(ix+dx,iy))){ iy++; continue; }
        run = iy;
        while(run < h && at(ix,run) && !at(ix+dx,run)) run++;
        pushQuad(P,N,F, [wx,Y(iy),d],[wx,Y(run),d],[wx,Y(run),-d],[wx,Y(iy),-d], nxs,0,0);
        iy = run;
      }
    }
  }
  // top and bottom walls, horizontal runs merged
  for(iy=0; iy<h; iy++){
    for(var s2=0; s2<2; s2++){
      var dy = s2 ? 1 : -1, nys = s2 ? -1 : 1;
      var wy = Y(s2 ? iy+1 : iy);
      ix = 0;
      while(ix < w){
        if(!(at(ix,iy) && !at(ix,iy+dy))){ ix++; continue; }
        run = ix;
        while(run < w && at(run,iy) && !at(run,iy+dy)) run++;
        pushQuad(P,N,F, [X(ix),wy,d],[X(run),wy,d],[X(run),wy,-d],[X(ix),wy,-d], 0,nys,0);
        ix = run;
      }
    }
  }
  if(!F.length){
    return flatMesh([[-0.4,-0.4,0, 0.4,-0.4,0, 0,0.4,0]]);
  }
  return {P:new Float32Array(P), N:new Float32Array(N), F:new Uint32Array(F)};
}

/* z-buffered triangle rasteriser, two-sided shading */
function ensureModelBuffers(W,H){
  if(!M3.canvas){
    M3.canvas = document.createElement('canvas');
    M3.ctx = M3.canvas.getContext('2d', {willReadFrequently:true});
  }
  if(M3.canvas.width !== W || M3.canvas.height !== H){
    M3.canvas.width = W; M3.canvas.height = H;
    M3.img = M3.ctx.createImageData(W,H);
    M3.zbuf = new Float32Array(W*H);
  }
  if(!M3.img) M3.img = M3.ctx.createImageData(W,H);
  if(!M3.zbuf) M3.zbuf = new Float32Array(W*H);
}
export function renderModel(){
  var W = M3.res|0, H = M3.res|0;
  ensureModelBuffers(W,H);
  if(!M3.mesh) M3.mesh = buildMesh(M3.shape);
  var mesh = M3.mesh, P = mesh.P, N = mesh.N, F = mesh.F;
  var data = M3.img.data, z = M3.zbuf;

  var bg = hex2rgb(M3.bg), surf = hex2rgb(M3.col);
  for(var i=0, p=0; i<W*H; i++, p+=4){
    data[p] = bg[0]; data[p+1] = bg[1]; data[p+2] = bg[2]; data[p+3] = 255;
    z[i] = -1e9;
  }

  // rotation
  var cx0 = Math.cos(M3.rotX), sx0 = Math.sin(M3.rotX);
  var cy0 = Math.cos(M3.rotY), sy0 = Math.sin(M3.rotY);
  var nv = P.length/3;
  if(!M3.vx || M3.vx.length !== nv){
    M3.vx = new Float32Array(nv); M3.vy = new Float32Array(nv); M3.vz = new Float32Array(nv);
    M3.nx = new Float32Array(nv); M3.ny = new Float32Array(nv); M3.nz = new Float32Array(nv);
  }
  var vx = M3.vx, vy = M3.vy, vz = M3.vz, nx = M3.nx, ny = M3.ny, nz = M3.nz;
  var f = 1/Math.tan(M3.fov*Math.PI/180/2);
  var hw = W/2, hh = H/2, sc = Math.min(hw,hh);
  var msc = M3.scale * (M3.pulse ? (1 + Math.sin(animT*M3.pulseSpd)*M3.pulse) : 1);
  if(msc < 0.001) msc = 0.001;

  for(var v=0; v<nv; v++){
    var a = v*3;
    var x = P[a]*msc, y = P[a+1]*msc, zz = P[a+2]*msc;
    var x1 = x*cy0 + zz*sy0, z1 = -x*sy0 + zz*cy0;
    var y2 = y*cx0 - z1*sx0, z2 = y*sx0 + z1*cx0;
    var vzv = z2 + M3.dist;
    vz[v] = vzv;
    var s = f/Math.max(0.05, vzv);
    vx[v] = hw + x1*s*sc;
    vy[v] = hh - y2*s*sc;
    var mx = N[a], my = N[a+1], mz = N[a+2];
    var nx1 = mx*cy0 + mz*sy0, nz1 = -mx*sy0 + mz*cy0;
    nx[v] = nx1;
    ny[v] = my*cx0 - nz1*sx0;
    nz[v] = my*sx0 + nz1*cx0;
  }

  var lx = Math.cos(M3.el)*Math.sin(M3.az), ly = Math.sin(M3.el), lz = -Math.cos(M3.el)*Math.cos(M3.az);
  var ll = Math.hypot(lx,ly,lz)||1; lx/=ll; ly/=ll; lz/=ll;
  var mode = M3.shade, facet = M3.facet, amb = M3.amb, spec = M3.spec;
  var wireOnly = (mode === 'wire');

  // depth range for the depth mode
  var zmin = 1e9, zmax = -1e9;
  if(mode === 'depth'){
    for(var d=0; d<nv; d++){ if(vz[d]<zmin) zmin=vz[d]; if(vz[d]>zmax) zmax=vz[d]; }
    if(zmax-zmin < 1e-6) zmax = zmin+1;
  }

  function shade(nX,nY,nZ,vzv){
    var l = Math.sqrt(nX*nX + nY*nY + nZ*nZ) || 1; nX/=l; nY/=l; nZ/=l;
    // camera looks down +z, so a surface facing us has nZ < 0
    if(nZ > 0){ nX=-nX; nY=-nY; nZ=-nZ; }
    var facing = -nZ;                     // 1 square on, 0 edge on
    if(mode === 'normal'){
      return [ (nX*0.5+0.5)*255, (nY*0.5+0.5)*255, (facing*0.5+0.5)*255 ];
    }
    if(mode === 'depth'){
      var t = 1 - (vzv - zmin)/(zmax - zmin);
      t = t<0?0:t>1?1:t;
      return [ surf[0]*t, surf[1]*t, surf[2]*t ];
    }
    if(mode === 'rim'){
      var r = Math.pow(1-facing, 2.2);
      return [ surf[0]*r, surf[1]*r, surf[2]*r ];
    }
    var dif = nX*lx + nY*ly + nZ*lz;
    if(dif < 0) dif = 0;
    var hx = lx, hy = ly, hz = lz-1;      // half vector, view dir is (0,0,-1)
    var hl = Math.sqrt(hx*hx + hy*hy + hz*hz) || 1;
    var sp = (nX*hx + nY*hy + nZ*hz)/hl;
    sp = sp<0 ? 0 : Math.pow(sp, 28)*spec;
    var k = amb + dif*(1-amb);
    return [
      Math.min(255, surf[0]*k + 255*sp),
      Math.min(255, surf[1]*k + 255*sp),
      Math.min(255, surf[2]*k + 255*sp)
    ];
  }

  if(!wireOnly){
    for(var t3=0; t3<F.length; t3+=3){
      var i0 = F[t3], i1 = F[t3+1], i2 = F[t3+2];
      var ax = vx[i0], ay = vy[i0], bx = vx[i1], by = vy[i1], cxp = vx[i2], cy = vy[i2];
      var area = (bx-ax)*(cy-ay) - (by-ay)*(cxp-ax);
      if(area === 0) continue;
      if(vz[i0] <= 0.05 || vz[i1] <= 0.05 || vz[i2] <= 0.05) continue;
      var minX = Math.max(0, Math.floor(Math.min(ax,bx,cxp)));
      var maxX = Math.min(W-1, Math.ceil(Math.max(ax,bx,cxp)));
      var minY = Math.max(0, Math.floor(Math.min(ay,by,cy)));
      var maxY = Math.min(H-1, Math.ceil(Math.max(ay,by,cy)));
      if(minX > maxX || minY > maxY) continue;
      var fn0, fn1, fn2;
      if(facet){
        var e1x = P[i1*3]-P[i0*3], e1y = P[i1*3+1]-P[i0*3+1], e1z = P[i1*3+2]-P[i0*3+2];
        var e2x = P[i2*3]-P[i0*3], e2y = P[i2*3+1]-P[i0*3+1], e2z = P[i2*3+2]-P[i0*3+2];
        var fx = e1y*e2z-e1z*e2y, fy = e1z*e2x-e1x*e2z, fz = e1x*e2y-e1y*e2x;
        var fcx = Math.cos(M3.rotX), fsx = Math.sin(M3.rotX), fcy = Math.cos(M3.rotY), fsy = Math.sin(M3.rotY);
        var g1 = fx*fcy + fz*fsy, g3 = -fx*fsy + fz*fcy;
        fn0 = g1; fn1 = fy*fcx - g3*fsx; fn2 = fy*fsx + g3*fcx;
      }
      var inv = 1/area;
      for(var py=minY; py<=maxY; py++){
        for(var px=minX; px<=maxX; px++){
          var w0 = ((bx-ax)*(py+0.5-ay) - (by-ay)*(px+0.5-ax))*inv;
          var w1 = ((px+0.5-ax)*(cy-ay) - (py+0.5-ay)*(cxp-ax))*inv;
          var w2 = 1 - w0 - w1;
          if(w0 < 0 || w1 < 0 || w2 < 0) continue;
          var zv = vz[i0]*w2 + vz[i1]*w1 + vz[i2]*w0;
          var id = py*W+px;
          if(-zv <= z[id]) continue;
          z[id] = -zv;
          var c;
          if(facet) c = shade(fn0, fn1, fn2, zv);
          else c = shade(
            nx[i0]*w2 + nx[i1]*w1 + nx[i2]*w0,
            ny[i0]*w2 + ny[i1]*w1 + ny[i2]*w0,
            nz[i0]*w2 + nz[i1]*w1 + nz[i2]*w0, zv);
          var o = id*4;
          data[o] = c[0]; data[o+1] = c[1]; data[o+2] = c[2];
        }
      }
    }
  }

  if(M3.wire || wireOnly){
    var wc = wireOnly ? surf : [255,255,255];
    for(var e=0; e<F.length; e+=3){
      var q0 = F[e], q1 = F[e+1], q2 = F[e+2];
      if(vz[q0] <= 0.05 || vz[q1] <= 0.05 || vz[q2] <= 0.05) continue;
      drawLine3(q0,q1,W,H,data,z,wc);
      drawLine3(q1,q2,W,H,data,z,wc);
      drawLine3(q2,q0,W,H,data,z,wc);
    }
  }
  M3.ctx.putImageData(M3.img, 0, 0);
}
// depth-tested line, biased forward so edges survive against their own faces
function drawLine3(a,b,W,H,data,z,col){
  var x0 = M3.vx[a], y0 = M3.vy[a], z0 = M3.vz[a];
  var x1 = M3.vx[b], y1 = M3.vy[b], z1 = M3.vz[b];
  var dx = x1-x0, dy = y1-y0;
  var steps = Math.max(Math.abs(dx), Math.abs(dy))|0;
  if(steps < 1 || steps > 4000) return;
  var sx = dx/steps, sy = dy/steps, sz = (z1-z0)/steps;
  for(var i=0;i<=steps;i++){
    var px = (x0 + sx*i)|0, py = (y0 + sy*i)|0;
    if(px < 0 || py < 0 || px >= W || py >= H) continue;
    var id = py*W+px, zv = -(z0 + sz*i) + 0.004;
    if(zv < z[id]) continue;
    z[id] = zv;
    var o = id*4;
    data[o] = col[0]; data[o+1] = col[1]; data[o+2] = col[2];
  }
}


/* ---------------- image loading ---------------- */
function rasterizeSVG(text, cb){
  var m = text.match(/<svg[^>]*>/i);
  if(m){
    var tag = m[0];
    if(!/\swidth\s*=/.test(tag) || !/\sheight\s*=/.test(tag)){
      var vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
      var w = 512, h = 512;
      if(vb){
        var p = vb[1].trim().split(/[\s,]+/).map(Number);
        if(p.length === 4 && p[2] > 0 && p[3] > 0){
          var s = 512/Math.max(p[2], p[3]);
          w = Math.round(p[2]*s); h = Math.round(p[3]*s);
        }
      }
      var fixed = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '')
                     .replace(/<svg/i, '<svg width="'+w+'" height="'+h+'"');
      text = text.replace(tag, fixed);
    }
  }
  var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  var im = new Image();
  im.onload = function(){
    var iw = im.naturalWidth || im.width || 512;
    var ih = im.naturalHeight || im.height || 512;
    var s = Math.min(1, 512/Math.max(iw,ih));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(iw*s));
    c.height = Math.max(1, Math.round(ih*s));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    cb(c);
  };
  im.onerror = function(){ toast('Could not read that SVG'); };
  im.src = url;
}
export function loadFile(file, cb){
  if(!file) return;
  var isSVG = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
  if(!isSVG && !/^image\//.test(file.type)){ toast('Not an image file'); return; }
  var fr = new FileReader();
  if(isSVG){
    fr.onload = function(){ rasterizeSVG(fr.result, function(c){ cb(c, file.name); }); };
    fr.readAsText(file);
    return;
  }
  fr.onload = function(){
    var im = new Image();
    im.onload = function(){ cb(im, file.name); };
    im.onerror = function(){ toast('Could not read that image'); };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}
export function setSource(im, name){
  src = im; srcName = (name||'plate').replace(/\.[^.]+$/,'');
  if(im !== M3.canvas) reliefSrc = im;
  var sd = dimsOf(im);
  hooks.onSource({ name: srcName, w: sd.w, h: sd.h });
  schedule();
}
export function refreshThumb(){}
export function setImageSource(im, name){
  lastImage = im; lastImageName = name || 'plate';
  if(srcKind !== 'image') setSourceKind('image');
  setSource(im, name);
}

/* test chart */
export function makeTestChart(){
  var c = document.createElement('canvas'); c.width = 900; c.height = 600;
  var x = c.getContext('2d');
  var gr = x.createLinearGradient(0,0,900,600);
  gr.addColorStop(0,'#111'); gr.addColorStop(0.5,'#7a7f86'); gr.addColorStop(1,'#f4f1ea');
  x.fillStyle = gr; x.fillRect(0,0,900,600);
  var rg = x.createRadialGradient(330,250,10,330,250,240);
  rg.addColorStop(0,'#fff'); rg.addColorStop(0.55,'#8e6a4a'); rg.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle = rg; x.beginPath(); x.arc(330,250,240,0,7); x.fill();
  x.fillStyle = '#0d0f12';
  x.beginPath(); x.moveTo(620,520); x.lineTo(790,180); x.lineTo(880,520); x.closePath(); x.fill();
  for(var i=0;i<11;i++){
    var v = Math.round(255*i/10);
    x.fillStyle = 'rgb('+v+','+v+','+v+')';
    x.fillRect(60 + i*62, 520, 62, 60);
  }
  x.strokeStyle = '#f4f1ea'; x.lineWidth = 3;
  for(var k=0;k<9;k++){ x.beginPath(); x.arc(450,300, 30+k*26, 0, 7); x.stroke(); }
  return c;
}

/* characters as tiles - emoji, dingbats, anything the system can draw */
export function splitGraphemes(str){
  if(window.Intl && Intl.Segmenter){
    try{
      var seg = new Intl.Segmenter(undefined, {granularity:'grapheme'});
      var outArr = [];
      var it = seg.segment(str)[Symbol.iterator]();
      for(var r = it.next(); !r.done; r = it.next()){
        if(r.value.segment.trim()) outArr.push(r.value.segment);
      }
      return outArr;
    }catch(e){}
  }
  return Array.from(str).filter(function(c){ return c.trim(); });
}
var EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",' +
                 '"Segoe UI Symbol","Noto Emoji",sans-serif';
export function makeEmojiTiles(str){
  var chars = splitGraphemes(str).slice(0, 8);
  if(!chars.length) return null;
  var N = 192;
  return chars.map(function(ch){
    var cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var x = cv.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    // shrink until the glyph fits, since emoji metrics vary wildly by family
    var size = N*0.84;
    for(var pass=0; pass<6; pass++){
      x.font = size.toFixed(0)+'px '+EMOJI_FONT;
      var m = x.measureText(ch);
      var wdt = m.width;
      var asc = m.actualBoundingBoxAscent || size*0.5;
      var dsc = m.actualBoundingBoxDescent || size*0.2;
      var hgt = asc + dsc;
      if(wdt <= N*0.94 && hgt <= N*0.94) break;
      size *= Math.min(N*0.92/Math.max(1,wdt), N*0.92/Math.max(1,hgt));
    }
    x.font = size.toFixed(0)+'px '+EMOJI_FONT;
    var mm = x.measureText(ch);
    var a2 = mm.actualBoundingBoxAscent || size*0.5;
    var d2 = mm.actualBoundingBoxDescent || size*0.2;
    x.fillStyle = '#ffffff';
    x.fillText(ch, N/2, N/2 + (a2 - d2)/2);
    return cv;
  });
}

/* shape sets: black + white, cut-out and inverted */
export const SHAPE_LABELS = {
  circles:'Circles', squares:'Squares', triangles:'Triangles', diamonds:'Diamonds',
  hexagons:'Hexagons', crosses:'Crosses', arcs:'Arcs', chevrons:'Chevrons',
  dice:'Dice pips', dicecut:'Dice cut', rings:'Concentric rings', dots:'Dot'
};
export const STEP_SETS = {dice:1, dicecut:1, rings:1};
// standard die faces on a 3x3 grid, 0 through 6
export const PIPS = [
  [],
  [[1,1]],
  [[0,0],[2,2]],
  [[0,0],[1,1],[2,2]],
  [[0,0],[2,0],[0,2],[2,2]],
  [[0,0],[2,0],[1,1],[0,2],[2,2]],
  [[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]
];
function makeStepSet(kind){
  var N = 192, out = [], pos = [0.26, 0.5, 0.74];
  for(var i=0;i<7;i++){
    (function(step){
      out.push(featherTile(N, '#ffffff', function(x, P, W){
        if(kind === 'rings'){
          x.lineWidth = N*0.055;
          for(var r=0;r<step;r++){
            x.beginPath();
            x.arc(N/2, N/2, N*(0.075 + r*0.062), 0, Math.PI*2);
            x.stroke();
          }
          return;
        }
        // dicecut runs the faces backwards so ink still climbs toward highlight
        var face = PIPS[kind === 'dicecut' ? (6-step) : step];
        var pr = N*(kind === 'dicecut' ? 0.14 : 0.105);
        if(kind === 'dicecut'){
          x.fillRect(-P,-P,W,W);
          x.globalCompositeOperation = 'destination-out';
        }
        for(var k=0;k<face.length;k++){
          x.beginPath();
          x.arc(pos[face[k][0]]*N, pos[face[k][1]]*N, pr, 0, Math.PI*2);
          x.fill();
        }
      }));
    })(i);
  }
  return out;
}
function polyPath(x, c, R, sides, rot){
  var TAU = Math.PI*2;
  x.beginPath();
  for(var i=0;i<sides;i++){
    var a = rot + i*TAU/sides;
    var px = c + Math.cos(a)*R, py = c + Math.sin(a)*R;
    if(i) x.lineTo(px,py); else x.moveTo(px,py);
  }
  x.closePath(); x.fill();
}
var INNER_K = 0.425;
function shapeHasInner(kind){ return kind !== 'arcs' && kind !== 'chevrons'; }
function drawShape(kind, x, N, k, pad){
  var c = N/2, R = N*0.40*k, TAU = Math.PI*2;
  pad = pad || 0;
  switch(kind){
    case 'circles':
      x.beginPath(); x.arc(c, c, R, 0, TAU); x.fill(); break;
    case 'squares':
      var hs = R*0.886; x.fillRect(c-hs, c-hs, hs*2, hs*2); break;
    case 'triangles':
      polyPath(x, c, R*1.18, 3, -Math.PI/2); break;
    case 'diamonds':
      polyPath(x, c, R*1.16, 4, -Math.PI/2); break;
    case 'hexagons':
      polyPath(x, c, R*1.06, 6, -Math.PI/2); break;
    case 'crosses':
      var t = R*0.58, L = R*1.06;
      x.fillRect(c-t/2, c-L, t, L*2);
      x.fillRect(c-L, c-t/2, L*2, t); break;
    case 'arcs':
      // truchet quarter-rounds: two opposite corners, great under random rotation.
      // Overshoot by the pad so the feather never eats the join between cells.
      var ov = pad / (N/2);
      x.lineWidth = N*0.21; x.lineCap = 'butt';
      x.beginPath(); x.arc(0, 0, N/2, -ov, Math.PI/2 + ov); x.stroke();
      x.beginPath(); x.arc(N, N, N/2, Math.PI - ov, Math.PI*1.5 + ov); x.stroke(); break;
    case 'chevrons':
      x.lineWidth = N*0.17; x.lineJoin = 'miter'; x.lineCap = 'butt';
      for(var j=-1;j<=1;j++){
        var off = j*N*0.30;
        x.beginPath();
        x.moveTo(N*0.14, c + off + N*0.17);
        x.lineTo(c, c + off - N*0.17);
        x.lineTo(N*0.86, c + off + N*0.17);
        x.stroke();
      }
      break;
  }
}
/* Draw into an oversized canvas, blur, then crop back to the tile.
   The padding is what keeps a full-bleed panel's outer edge hard: it is
   drawn past the crop, so the blur at the boundary only ever samples
   solid pixels. Feather the crop directly and adjacent cells show seams. */
function featherTile(N, color, fn){
  var F = N * (S.feather/100);
  var P = Math.ceil(F*3) + 2;
  var W = N + P*2;
  var tmp = document.createElement('canvas');
  tmp.width = tmp.height = W;
  var tx = tmp.getContext('2d');
  tx.translate(P, P);
  tx.fillStyle = color; tx.strokeStyle = color;
  fn(tx, P, W);
  var out = document.createElement('canvas');
  out.width = out.height = N;
  var ox = out.getContext('2d');
  if(F > 0.01) ox.filter = 'blur(' + F.toFixed(2) + 'px)';
  ox.drawImage(tmp, -P, -P);
  ox.filter = 'none';
  return out;
}
export function makeShapeSet(kind){
  var N = 192;
  var inner = shapeHasInner(kind);
  function mk(color, fn){ return featherTile(N, color, fn); }
  // 1 - coloured panel with the shape cut away, small shape kept in the middle
  var a = mk('#000', function(x, P, W){
    x.fillRect(-P,-P,W,W);
    x.globalCompositeOperation = 'destination-out'; drawShape(kind, x, N, 1, P);
    if(inner){ x.globalCompositeOperation = 'source-over'; drawShape(kind, x, N, INNER_K, P); }
  });
  // 2 - white panel, plain cut-out
  var b = mk('#fff', function(x, P, W){
    x.fillRect(-P,-P,W,W);
    x.globalCompositeOperation = 'destination-out'; drawShape(kind, x, N, 1, P);
  });
  // 3 - inverse of 1: the ring form on its own
  var c = mk('#000', function(x, P){
    drawShape(kind, x, N, 1, P);
    if(inner){ x.globalCompositeOperation = 'destination-out'; drawShape(kind, x, N, INNER_K, P); }
  });
  // 4 - same form in white
  var d = mk('#fff', function(x, P){
    drawShape(kind, x, N, 1, P);
    if(inner){ x.globalCompositeOperation = 'destination-out'; drawShape(kind, x, N, INNER_K, P); }
  });
  return [a, b, c, d];
}

/* procedural dot tiles */
export function makeDotTiles(){
  var out = [], n = 8, N = 128, grid = 4;
  for(var k=0;k<n;k++){
    (function(t){
      out.push(featherTile(N, '#fff', function(x){
        var cell = N/grid;
        var lr = Math.min(t*(cell/2)*1.42, (cell/2)*1.45) * 0.9;
        if(lr <= 0) return;
        // draw the grid wrapped 3x3 so dots crossing an edge reappear opposite
        for(var oy=-1; oy<=1; oy++) for(var ox=-1; ox<=1; ox++){
          for(var gy=0; gy<grid; gy++) for(var gx=0; gx<grid; gx++){
            if(t <= (B4[gy%4][gx%4] + 0.5)/16) continue;
            x.beginPath();
            x.arc((gx+0.5)*cell + ox*N, (gy+0.5)*cell + oy*N, lr, 0, Math.PI*2);
            x.fill();
          }
        }
      }));
    })(k/(n-1));
  }
  return out;
}



/* ---- moved out of the old UI wiring: these are engine concerns ---- */
export function layerName(o, i){
  if(o.name) return o.name;
  if(o.kind === 'text') return (String(o.text).split('\n')[0] || 'Text').slice(0, 22);
  if(o.kind === 'image') return o.imgName || 'Image';
  return o.kind.charAt(0).toUpperCase() + o.kind.slice(1) + ' ' + (i+1);
}

export let lastTileSet = null;
export function loadTileSet(kind, keepColours){
  var isDots = (kind === 'dots');
  var set = isDots ? makeDotTiles()
          : STEP_SETS[kind] ? makeStepSet(kind)
          : makeShapeSet(kind);
  var prev = layerColors.slice();
  // any colour already in play is the user's, so switching sets must not discard it
  var hadColours = prev.some(function(c){ return !!c; });
  var reuse = keepColours || hadColours;

  layers = new Array(8).fill(null);
  for(var i=0;i<set.length;i++) layers[i] = set[i];

  if(reuse){
    layerColors = prev;
  } else {
    layerColors = new Array(8).fill(null);
    if(set.length === 4){
      layerColors[0] = '#000000'; layerColors[1] = '#ffffff';
      layerColors[2] = '#000000'; layerColors[3] = '#ffffff';
      S.tileInk = 'tile';
    } else {
      for(var j=0;j<set.length;j++) layerColors[j] = S.fg;
    }
  }
  // a bigger set can outrun the colours carried over
  for(var f=0; f<set.length; f++){
    if(!layerColors[f]) layerColors[f] = (set.length === 4 && f%2) ? '#ffffff' : S.fg;
  }
  if(!keepColours && !S.keepSteps){
    S.steps = set.length;
  }
  lastTileSet = kind;
  invalidateTiles();
  schedule();
  return SHAPE_LABELS[kind] || kind;
}

/* ---- mutation entry points (module bindings are read-only from outside) ---- */
export function setOverlays(v){ overlays = v; }
export function setArtZ(v){ artZ = v; }
export function setOvSel(v){ ovSel = v; }
export function setLayers(v){ layers = v; }
export function setLayerColors(v){ layerColors = v; }
export function setLayerAnim(v){ layerAnim = v; }
export function setAnimT(v){ animT = v; }
export function advanceAnim(dt){ animT += dt; }
export function getState(){ return { overlays, artZ, ovSel, layers, layerColors, layerAnim,
  srcKind, srcName, lastText, animT }; }
export function patchS(p){ Object.assign(S, p); schedule(); }
export function resetAll(){
  Object.assign(S, DEF); Object.assign(TXT, TXT_DEF); Object.assign(M3, M3_DEF);
  overlays = []; artZ = 0; ovSel = -1;
  layers = new Array(8).fill(null);
  layerColors = new Array(8).fill(null);
  layerAnim = []; for(let i=0;i<8;i++) layerAnim.push(blankAnim());
  lastTileSet = null; animT = 0;
  M3.mesh = null; M3.objMesh = null; M3.vx = null;
  invalidateTiles();
  setImageSource(makeTestChart(), 'test-chart');
}
