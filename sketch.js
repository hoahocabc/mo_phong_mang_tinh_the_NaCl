// sketch.js - Đảm bảo kéo chuột luôn xoay cùng hướng di chuyển chuột
// - rotateY trước rồi rotateX
// - tính camera world bằng rotateVectorByYX (Y then X)
// - mouseDragged cập nhật rotationY += dx*sens, rotationX += dy*sens
// - giữ giới hạn/smoothing cho auto-rotate để tránh hỗn loạn

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

let BUTTON_W = 130;
const BUTTON_H = 34;
const BUTTON_SPACING = 10;

function setup() {
  canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  canvas.style('display', 'block');

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

  initIons();
  updateUIText();
}

function initIons() {
  ions = [];
  let offset = ((numIons - 1) * spacing) / 2;
  for (let ix = 0; ix < numIons; ix++) {
    for (let iy = 0; iy < numIons; iy++) {
      for (let iz = 0; iz < numIons; iz++) {
        let px = ix * spacing - offset;
        let py = iy * spacing - offset;
        let pz = iz * spacing - offset;
        let type = ((ix + iy + iz) % 2 === 0) ? "Na" : "Cl";

        let w = 256, h = 128;
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
          let baseSize = 64, supSize = 36;
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
          let baseSize = 44, supSize = 26;
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
          planeSize: 28
        });
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
  background(0);

  ambientLight(140);
  directionalLight(255, 255, 255, -0.5, -1, -0.5);

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

  // Draw spheres
  for (let ion of ions) {
    push();
    translate(ion.center.x, ion.center.y, ion.center.z);
    if (ion.type === "Na") fill(0, 153, 255); else fill(255, 204, 0);
    noStroke();
    sphere(ion.radius);
    pop();
  }

  // Draw bonds if enabled
  if (drawBonds) {
    stroke(255, 150);
    strokeWeight(2);
    let offset = ((numIons - 1) * spacing) / 2;
    for (let ix = 0; ix < numIons; ix++) {
      for (let iy = 0; iy < numIons; iy++) {
        for (let iz = 0; iz < numIons; iz++) {
          let pos = createVector(ix * spacing - offset, iy * spacing - offset, iz * spacing - offset);
          if (ix < numIons - 1) {
            let nx = createVector((ix + 1) * spacing - offset, iy * spacing - offset, iz * spacing - offset);
            line(pos.x, pos.y, pos.z, nx.x, nx.y, nx.z);
          }
          if (iy < numIons - 1) {
            let ny = createVector(ix * spacing - offset, (iy + 1) * spacing - offset, iz * spacing - offset);
            line(pos.x, pos.y, pos.z, ny.x, ny.y, ny.z);
          }
          if (iz < numIons - 1) {
            let nz = createVector(ix * spacing - offset, iy * spacing - offset, (iz + 1) * spacing - offset);
            line(pos.x, pos.y, pos.z, nz.x, nz.y, nz.z);
          }
        }
      }
    }
    noStroke();
  }

  // Compute approximate camera world position given rotateY then rotateX
  let fov = PI / 3;
  let cameraZ = (height / 2) / tan(fov / 2);
  let camCamSpace = createVector(0, 0, cameraZ);
  // inverse transforms: rotate by -rotationY around Y then -rotationX around X
  let camWorld = rotateVectorByYX(camCamSpace, -rotationY, -rotationX);

  // Enable depth test
  let gl = (this && this._renderer && this._renderer.drawingContext) ? this._renderer.drawingContext : drawingContext;
  if (gl && gl.enable) {
    try { gl.enable(gl.DEPTH_TEST); } catch (e) {}
  }

  // Draw labels (billboard): undo scene rotation in reverse order (X then Y)
  if (showLabels) {
    for (let ion of ions) {
      let dir = p5.Vector.sub(camWorld, ion.center);
      if (dir.mag() === 0) dir = createVector(0, 0, 1);
      dir.normalize();
      let labelPos = p5.Vector.add(ion.center, p5.Vector.mult(dir, ion.radius + ion.labelOffset));

      push();
      translate(labelPos.x, labelPos.y, labelPos.z);
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
}

// mouseDragged: always rotate in same direction as mouse movement (right -> rotate right, down -> rotate down)
function mouseDragged() {
  if (mouseButton === LEFT) {
    let dx = mouseX - pmouseX;
    let dy = mouseY - pmouseY;

    let incY = dx * MANUAL_SENS; // yaw change; positive dx => positive yaw
    let incX = dy * MANUAL_SENS; // pitch change; positive dy => positive pitch
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