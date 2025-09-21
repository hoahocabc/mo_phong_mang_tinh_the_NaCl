// sketch.js - Tối ưu để chạy mượt hơn trên smartphone
// Sửa lỗi: tránh gọi sphereDetail khi hàm không tồn tại (ReferenceError)
// Sửa cảnh báo p5.js về tên reserved function "mag" (đổi tên biến thành distMag)

let spacing = 60;
let numIons = 4;
let rotationX = 0;
let rotationY = 0;
let zoomFactor = 1.0;

// auto-rotate flags and speeds
let drawBonds = false;
let autoRotate = false;
let showLabels = true;
let autoRotateSpeedX = 0.0; // radians per frame (pitch)
let autoRotateSpeedY = 0.0; // radians per frame (yaw)

// base auto-rotate target speeds (when enabled)
const BASE_AUTO_SPEED_X = 0.01;
const BASE_AUTO_SPEED_Y = 0.01;

// safety limits and smoothing params
const MAX_AUTO_SPEED = 0.08;
const MAX_MANUAL_INCREMENT = 0.15;
const MANUAL_SENS = 0.01;
const AUTO_LERP = 0.02;
const DRAG_LERP = 0.5;

let lang = 'vi';
let langSelect, bondButton, autoRotateButton, labelToggleButton;
let canvas;
let headerDiv, footerDiv;

let radiusNa = 10;
let radiusCl = radiusNa * (181 / 102);

let myFont = null;
let fontLoaded = false;
let ions = [];
let bonds = []; // precomputed bonds (pairs of positions) to avoid heavy per-frame work

let BUTTON_W = 130;
const BUTTON_H = 34;
const BUTTON_SPACING = 10;

// Performance tuning
const IS_MOBILE = (typeof navigator !== 'undefined') && /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
let SPHERE_DETAIL = IS_MOBILE ? 6 : 12; // lower polygon count on mobile
let LABEL_GFX_SIZE = IS_MOBILE ? { w: 160, h: 80 } : { w: 256, h: 128 };
let LABEL_PLANE_SIZE = IS_MOBILE ? 20 : 28;
let TARGET_FPS = IS_MOBILE ? 40 : 60;
let PIXEL_DENSITY_TARGET = IS_MOBILE ? 1 : Math.min(2, (window.devicePixelRatio || 1));

function setup() {
  pixelDensity(PIXEL_DENSITY_TARGET);
  canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  canvas.style('display', 'block');

  frameRate(TARGET_FPS);

  // Try to load a custom font asynchronously (safe). No console.log on success.
  let fontPath = 'https://assets.editor.p5js.org/6809a48b6c699fd6d22a7d6d/3a9355cc-1dcb-44ce-8034-4e68ba3b8af2.ttf?v=1758200715842';
  loadFont(fontPath,
    (f) => { myFont = f; fontLoaded = true; /* no log */ },
    (err) => { myFont = null; fontLoaded = false; console.warn('Could not load custom font, falling back to default.'); }
  );

  // UI
  let x = 10;
  let y = 10;

  langSelect = createSelect();
  langSelect.option('Tiếng Việt', 'vi');
  langSelect.option('English', 'en');
  langSelect.selected(lang);
  styleControlSelect(langSelect);
  langSelect.position(x, y);
  langSelect.changed(() => { lang = langSelect.value(); updateUIText(); });

  y += BUTTON_H + BUTTON_SPACING;
  bondButton = createButton('');
  styleControlBtn(bondButton);
  bondButton.position(x, y);
  bondButton.mousePressed(() => { drawBonds = !drawBonds; updateUIText(); });

  y += BUTTON_H + BUTTON_SPACING;
  autoRotateButton = createButton('');
  styleControlBtn(autoRotateButton);
  autoRotateButton.position(x, y);
  autoRotateButton.mousePressed(() => {
    autoRotate = !autoRotate;
    if (autoRotate && abs(autoRotateSpeedX) < 1e-6 && abs(autoRotateSpeedY) < 1e-6) {
      autoRotateSpeedX = BASE_AUTO_SPEED_X;
      autoRotateSpeedY = BASE_AUTO_SPEED_Y;
    }
    updateUIText();
  });

  y += BUTTON_H + BUTTON_SPACING;
  labelToggleButton = createButton('');
  styleControlBtn(labelToggleButton);
  labelToggleButton.position(x, y);
  labelToggleButton.mousePressed(() => { showLabels = !showLabels; updateUIText(); });

  headerDiv = createDiv('');
  headerDiv.elt.style.position = 'fixed';
  headerDiv.elt.style.left = '50%';
  headerDiv.elt.style.transform = 'translateX(-50%)';
  headerDiv.elt.style.top = '8px';
  headerDiv.elt.style.zIndex = '100010';
  headerDiv.elt.style.pointerEvents = 'none';
  headerDiv.style('color', '#ffffff');
  headerDiv.style('font-size', '16px');
  headerDiv.style('font-weight', '700');
  headerDiv.style('letter-spacing', '1px');

  footerDiv = createDiv('');
  footerDiv.elt.style.position = 'fixed';
  footerDiv.elt.style.left = '50%';
  footerDiv.elt.style.transform = 'translateX(-50%)';
  footerDiv.elt.style.bottom = '8px';
  footerDiv.elt.style.zIndex = '100010';
  footerDiv.elt.style.pointerEvents = 'none';
  footerDiv.style('color', '#ffffff');
  footerDiv.style('font-size', '13px');
  footerDiv.style('font-weight', '600');

  // Do NOT call sphereDetail here unguarded - some p5 environments may not expose it as a global yet.
  // We'll set sphereDetail each frame (guarded) in draw().

  initIons();
  updateUIText();

  // Enable depth test once (avoid per-frame cost)
  let gl = (this && this._renderer && this._renderer.drawingContext) ? this._renderer.drawingContext : drawingContext;
  if (gl && gl.enable) {
    try { gl.enable(gl.DEPTH_TEST); } catch (e) {}
  }
}

function initIons() {
  ions = [];
  bonds = [];
  let offset = ((numIons - 1) * spacing) / 2;

  // Use smaller label gfx on mobile to save memory
  let gfxW = LABEL_GFX_SIZE.w;
  let gfxH = LABEL_GFX_SIZE.h;

  // First build ions and label textures
  for (let ix = 0; ix < numIons; ix++) {
    for (let iy = 0; iy < numIons; iy++) {
      for (let iz = 0; iz < numIons; iz++) {
        let px = ix * spacing - offset;
        let py = iy * spacing - offset;
        let pz = iz * spacing - offset;
        let type = ((ix + iy + iz) % 2 === 0) ? "Na" : "Cl";

        // Create a small graphics for labels (reduced on mobile)
        let w = gfxW, h = gfxH;
        let g = createGraphics(w, h);
        g.pixelDensity(1);
        g.clear();
        g.noStroke();

        let labelColor = (type === 'Na') ? '#ffffff' : '#001f3f';
        g.fill(labelColor);
        g.textStyle(BOLD);
        if (fontLoaded && myFont) g.textFont(myFont);

        if (type === "Cl") {
          let base = "Cl", sup = "⁻";
          let baseSize = Math.round(w * 0.25);
          let supSize = Math.round(w * 0.14);
          g.textAlign(LEFT, CENTER);
          g.textSize(baseSize);
          let baseW = g.textWidth(base);
          g.textSize(supSize);
          let supW = g.textWidth(sup);
          let totalW = baseW + supW;
          let startX = (w - totalW) / 2;
          let centerY = h / 2 + baseSize * 0.06;
          g.textSize(baseSize); g.text(base, startX, centerY);
          g.textSize(supSize); g.text(sup, startX + baseW, centerY - baseSize * 0.36);
        } else {
          let base = "Na", sup = "⁺";
          let baseSize = Math.round(w * 0.17);
          let supSize = Math.round(w * 0.10);
          g.textAlign(LEFT, CENTER);
          g.textSize(baseSize);
          let baseW = g.textWidth(base);
          g.textSize(supSize);
          let supW = g.textWidth(sup);
          let totalW = baseW + supW;
          let startX = (w - totalW) / 2;
          let centerY = h / 2 + baseSize * 0.06;
          g.textSize(baseSize); g.text(base, startX, centerY);
          g.textSize(supSize); g.text(sup, startX + baseW, centerY - baseSize * 0.36);
        }

        let r = (type === "Na") ? radiusNa : radiusCl;
        ions.push({
          center: createVector(px, py, pz),
          type: type,
          gfx: g,
          w: w, h: h,
          radius: r,
          labelOffset: 4,
          planeSize: LABEL_PLANE_SIZE
        });
      }
    }
  }

  // Precompute bonds (pairs of positions) once to avoid per-frame allocations
  for (let ix = 0; ix < numIons; ix++) {
    for (let iy = 0; iy < numIons; iy++) {
      for (let iz = 0; iz < numIons; iz++) {
        let x0 = ix * spacing - offset;
        let y0 = iy * spacing - offset;
        let z0 = iz * spacing - offset;
        if (ix < numIons - 1) {
          bonds.push({
            ax: x0, ay: y0, az: z0,
            bx: (ix + 1) * spacing - offset, by: y0, bz: z0
          });
        }
        if (iy < numIons - 1) {
          bonds.push({
            ax: x0, ay: y0, az: z0,
            bx: x0, by: (iy + 1) * spacing - offset, bz: z0
          });
        }
        if (iz < numIons - 1) {
          bonds.push({
            ax: x0, ay: y0, az: z0,
            bx: x0, by: y0, bz: (iz + 1) * spacing - offset
          });
        }
      }
    }
  }
}

function styleControlBtn(btn) {
  btn.elt.style.width = BUTTON_W + 'px';
  btn.elt.style.height = BUTTON_H + 'px';
  btn.elt.style.padding = '0';
  btn.elt.style.background = '#ffffff';
  btn.elt.style.color = '#000000';
  btn.elt.style.border = '1px solid rgba(0,0,0,0.12)';
  btn.elt.style.borderRadius = '6px';
  btn.elt.style.cursor = 'pointer';
  btn.elt.style.fontSize = '13px';
  btn.elt.style.fontWeight = '600';
  btn.elt.style.textAlign = 'center';
  btn.elt.style.transition = 'transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease';
  btn.elt.style.boxSizing = 'border-box';
  btn.mouseOver(() => {
    btn.elt.style.background = '#f0f0f0';
    btn.elt.style.transform = 'translateY(-2px)';
    btn.elt.style.boxShadow = '0 6px 14px rgba(0,0,0,0.12)';
  });
  btn.mouseOut(() => {
    btn.elt.style.background = '#ffffff';
    btn.elt.style.transform = 'translateY(0)';
    btn.elt.style.boxShadow = 'none';
  });
}

function styleControlSelect(sel) {
  sel.elt.style.width = BUTTON_W + 'px';
  sel.elt.style.height = BUTTON_H + 'px';
  sel.elt.style.padding = '4px 8px';
  sel.elt.style.background = '#ffffff';
  sel.elt.style.color = '#000000';
  sel.elt.style.border = '1px solid rgba(0,0,0,0.12)';
  sel.elt.style.borderRadius = '6px';
  sel.elt.style.cursor = 'pointer';
  sel.elt.style.fontSize = '13px';
  sel.elt.style.fontWeight = '600';
  sel.elt.style.transition = 'transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease';
  sel.elt.style.boxSizing = 'border-box';
  sel.elt.addEventListener('mouseover', () => {
    sel.elt.style.background = '#f0f0f0';
    sel.elt.style.transform = 'translateY(-2px)';
    sel.elt.style.boxShadow = '0 6px 14px rgba(0,0,0,0.12)';
  });
  sel.elt.addEventListener('mouseout', () => {
    sel.elt.style.background = '#ffffff';
    sel.elt.style.transform = 'translateY(0)';
    sel.elt.style.boxShadow = 'none';
  });
}

function updateUIText() {
  if (lang === 'vi') {
    bondButton.html(drawBonds ? 'Tắt liên kết' : 'Bật liên kết');
    autoRotateButton.html(autoRotate ? 'Tắt xoay' : 'Bật xoay');
    labelToggleButton.html(showLabels ? 'Tắt nhãn' : 'Bật nhãn');
    headerDiv.html('MÔ PHỎNG MẠNG TINH THỂ NaCl');
    footerDiv.html('© HÓA HỌC ABC');
  } else {
    bondButton.html(drawBonds ? 'Hide Bonds' : 'Show Bonds');
    autoRotateButton.html(autoRotate ? 'Stop Rotate' : 'Auto Rotate');
    labelToggleButton.html(showLabels ? 'Hide Labels' : 'Show Labels');
    headerDiv.html('NaCl CRYSTAL LATTICE SIMULATION');
    footerDiv.html('© HÓA HỌC ABC');
  }
}

// rotate vector by Y then X (useful to compute camera world pos matching rotateY then rotateX)
function rotateVectorByYX(v, ay, ax) {
  // rotate around Y by ay
  let cosy = cos(ay), siny = sin(ay);
  let x1 = v.x * cosy + v.z * siny;
  let z1 = -v.x * siny + v.z * cosy;
  let y1 = v.y;
  // rotate around X by ax
  let cosx = cos(ax), sinx = sin(ax);
  let y2 = y1 * cosx - z1 * sinx;
  let z2 = y1 * sinx + z1 * cosx;
  return createVector(x1, y2, z2);
}

function draw() {
  // Clear background
  background(0);

  // Lights (we reduce directional intensity on mobile to save render cost)
  ambientLight(140);
  if (IS_MOBILE) {
    directionalLight(230, 230, 230, -0.5, -1, -0.5);
  } else {
    directionalLight(255, 255, 255, -0.5, -1, -0.5);
  }

  // scale (zoom)
  scale(zoomFactor);

  // apply auto-rotate speeds if enabled
  if (autoRotate) {
    rotationX += autoRotateSpeedX;
    rotationY += autoRotateSpeedY;

    // gently drift auto speeds toward base to avoid sudden jumps
    autoRotateSpeedX = lerp(autoRotateSpeedX, BASE_AUTO_SPEED_X, AUTO_LERP);
    autoRotateSpeedY = lerp(autoRotateSpeedY, BASE_AUTO_SPEED_Y, AUTO_LERP);

    autoRotateSpeedX = constrain(autoRotateSpeedX, -MAX_AUTO_SPEED, MAX_AUTO_SPEED);
    autoRotateSpeedY = constrain(autoRotateSpeedY, -MAX_AUTO_SPEED, MAX_AUTO_SPEED);
  }

  // Apply scene rotation: Y (yaw) first, then X (pitch)
  rotateY(rotationY);
  rotateX(rotationX);

  // Ensure sphereDetail is applied if available (guard to avoid ReferenceError)
  // Some p5 environments may not expose sphereDetail as a global; guard before calling.
  let sdFunc = (typeof sphereDetail === 'function') ? sphereDetail :
               (typeof this !== 'undefined' && typeof this.sphereDetail === 'function') ? this.sphereDetail :
               null;
  if (sdFunc) {
    try { sdFunc(SPHERE_DETAIL); } catch (e) { /* ignore if still not supported */ }
  }

  // draw spheres (cache length)
  let n = ions.length;

  for (let i = 0; i < n; i++) {
    let ion = ions[i];
    push();
    translate(ion.center.x, ion.center.y, ion.center.z);
    if (ion.type === "Na") fill(0, 153, 255); else fill(255, 204, 0);
    noStroke();
    sphere(ion.radius);
    pop();
  }

  // Draw bonds if enabled - use precomputed bonds array
  if (drawBonds) {
    stroke(255, 150);
    strokeWeight(2);
    for (let i = 0, m = bonds.length; i < m; i++) {
      let b = bonds[i];
      line(b.ax, b.ay, b.az, b.bx, b.by, b.bz);
    }
    noStroke();
  }

  // Compute approximate camera world position given rotateY then rotateX
  let fov = PI / 3;
  let cameraZ = (height / 2) / tan(fov / 2);
  let camCamSpace = createVector(0, 0, cameraZ);
  // inverse transforms: rotate by -rotationY around Y then -rotationX around X
  let camWorld = rotateVectorByYX(camCamSpace, -rotationY, -rotationX);

  // Draw labels (billboard): undo scene rotation in reverse order (X then Y)
  if (showLabels) {
    for (let i = 0; i < n; i++) {
      let ion = ions[i];

      // compute dir = camWorld - ion.center (use local names and avoid using reserved "mag")
      let dirx = camWorld.x - ion.center.x;
      let diry = camWorld.y - ion.center.y;
      let dirz = camWorld.z - ion.center.z;
      let distMag = Math.sqrt(dirx * dirx + diry * diry + dirz * dirz);
      if (distMag === 0) {
        dirx = 0; diry = 0; dirz = 1; distMag = 1;
      }
      // normalize
      dirx /= distMag; diry /= distMag; dirz /= distMag;

      let labelPosX = ion.center.x + dirx * (ion.radius + ion.labelOffset);
      let labelPosY = ion.center.y + diry * (ion.radius + ion.labelOffset);
      let labelPosZ = ion.center.z + dirz * (ion.radius + ion.labelOffset);

      push();
      translate(labelPosX, labelPosY, labelPosZ);
      // undo scene rotation: rotateX(-rotationX) then rotateY(-rotationY)
      rotateX(-rotationX);
      rotateY(-rotationY);

      textureMode(NORMAL);
      noStroke();
      tint(255, 255);
      texture(ion.gfx);
      let s = ion.planeSize;
      plane(s * (ion.w / ion.h), s);
      pop();
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  PIXEL_DENSITY_TARGET = IS_MOBILE ? 1 : Math.min(2, (window.devicePixelRatio || 1));
  pixelDensity(PIXEL_DENSITY_TARGET);
}

// mouseDragged: always rotate in same direction as mouse movement (right -> rotate right, down -> rotate down)
function mouseDragged() {
  // ignore drags that originate from UI DOM elements (let DOM handle them)
  if (mouseX < BUTTON_W + 20 && mouseY < windowHeight - 20) {
    return;
  }

  if (mouseButton === LEFT) {
    let dx = mouseX - pmouseX;
    let dy = mouseY - pmouseY;

    // Slightly adjust manual sensitivity on mobile to be smoother
    let sens = IS_MOBILE ? MANUAL_SENS * 0.9 : MANUAL_SENS;

    let incY = dx * sens; // yaw change; positive dx => positive yaw
    let incX = dy * sens; // pitch change; positive dy => positive pitch
    incY = constrain(incY, -MAX_MANUAL_INCREMENT, MAX_MANUAL_INCREMENT);
    incX = constrain(incX, -MAX_MANUAL_INCREMENT, MAX_MANUAL_INCREMENT);

    // apply immediate manual rotation
    rotationY += incY;
    rotationX += incX;

    if (autoRotate) {
      // smoothly blend auto speed toward manual drag direction
      autoRotateSpeedX = lerp(autoRotateSpeedX, incX, DRAG_LERP);
      autoRotateSpeedY = lerp(autoRotateSpeedY, incY, DRAG_LERP);
      autoRotateSpeedX = constrain(autoRotateSpeedX, -MAX_AUTO_SPEED, MAX_AUTO_SPEED);
      autoRotateSpeedY = constrain(autoRotateSpeedY, -MAX_AUTO_SPEED, MAX_AUTO_SPEED);
    }
  }
}

function mouseWheel(event) {
  zoomFactor *= 1 - event.delta * 0.001;
  zoomFactor = constrain(zoomFactor, 0.2, 5);
  return false;
}