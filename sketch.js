let spacing = 60;       // khoảng cách giữa các ion
let numIons = 4;        // số lượng ion mỗi cạnh
let rotationX = 0;      // góc xoay quanh trục X
let rotationY = 0;      // góc xoay quanh trục Y
let zoomFactor = 1.0;   // hệ số thu/phóng

let drawBonds = false;  // cờ bật/tắt vẽ liên kết giữa các nguyên tử
let autoRotate = false; // cờ bật/tắt xoay tự động

let bondButton;         // nút bật/tắt liên kết
let autoRotateButton;   // nút bật/tắt xoay

// Tỉ lệ bán kính Na+:Cl- = 102:181. Đặt bán kính Na+ là 10, tính Cl- theo tỉ lệ.
let radiusNa = 10;
let radiusCl = radiusNa * (181 / 102);

let myFont;

// Kích thước của offscreen graphics cho icon legend
let iconSize = 50;
let iconNaGraphics, iconClGraphics;

function preload() {
  // Tải font Arial.ttf, đảm bảo file Arial.ttf nằm trong cùng thư mục với sketch.js
  // Nếu font này không hỗ trợ tốt các ký tự Unicode hoặc bạn cần hiệu ứng 3D mượt, có thể thay đổi font.
  myFont = loadFont('Arial.ttf');
}

function setup() {
  // Tạo canvas với chế độ WEBGL để hỗ trợ đồ họa 3D
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  textFont(myFont);
  
  // Nút bật/tắt liên kết giữa các nguyên tử
  bondButton = createButton("Bật/Tắt liên kết");
  bondButton.position(10, 10);
  bondButton.mousePressed(toggleBonds);
  
  // Nút bật/tắt xoay tự động
  autoRotateButton = createButton("Bật/Tắt xoay");
  autoRotateButton.position(10, 40);
  autoRotateButton.mousePressed(toggleAutoRotate);
  
  // Tạo offscreen graphics cho icon legend với chế độ WEBGL (để giữ hiệu ứng 3D)
  iconNaGraphics = createGraphics(iconSize, iconSize, WEBGL);
  iconNaGraphics.noStroke();
  iconNaGraphics.textFont(myFont);
  
  iconClGraphics = createGraphics(iconSize, iconSize, WEBGL);
  iconClGraphics.noStroke();
  iconClGraphics.textFont(myFont);
}

function draw() {
  // Vẽ nền màu đen cho canvas chính
  background(0);
  
  // Thiết lập ánh sáng cho cảnh 3D
  ambientLight(60);
  directionalLight(255, 255, 255, 0, -1, -1);
  
  // Áp dụng scale cho toàn cảnh 3D
  scale(zoomFactor);
  
  // Nếu tự động xoay bật, cập nhật góc xoay dựa trên frameCount
  if (autoRotate) {
    rotationX = frameCount * 0.01;
    rotationY = frameCount * 0.01;
  }
  
  // Áp dụng xoay cho cảnh 3D
  rotateX(rotationX);
  rotateY(rotationY);
  
  // Vẽ các ion theo lưới 3D với 3 vòng lặp
  for (let ix = 0; ix < numIons; ix++) {
    for (let iy = 0; iy < numIons; iy++) {
      for (let iz = 0; iz < numIons; iz++) {
        let offset = ((numIons - 1) * spacing) / 2;
        let posX = ix * spacing - offset;
        let posY = iy * spacing - offset;
        let posZ = iz * spacing - offset;
        
        push();
        translate(posX, posY, posZ);
        // Xen kẽ màu: nếu tổng chỉ số chẵn thì vẽ Na+ (màu xanh), nếu lẻ thì vẽ Cl- (màu vàng)
        if ((ix + iy + iz) % 2 === 0) {
          fill(0, 153, 255);
          sphere(radiusNa);
        } else {
          fill(255, 204, 0);
          sphere(radiusCl);
        }
        pop();
      }
    }
  }
  
  // Vẽ các liên kết giữa các ion liền kề nếu cờ drawBonds được bật
  if (drawBonds) {
    stroke(255, 150);
    strokeWeight(2);
    for (let ix = 0; ix < numIons; ix++) {
      for (let iy = 0; iy < numIons; iy++) {
        for (let iz = 0; iz < numIons; iz++) {
          let offset = ((numIons - 1) * spacing) / 2;
          let pos = createVector(ix * spacing - offset, iy * spacing - offset, iz * spacing - offset);
          // Liên kết theo trục X
          if (ix < numIons - 1) {
            let neighborX = createVector((ix + 1) * spacing - offset, iy * spacing - offset, iz * spacing - offset);
            line(pos.x, pos.y, pos.z, neighborX.x, neighborX.y, neighborX.z);
          }
          // Liên kết theo trục Y
          if (iy < numIons - 1) {
            let neighborY = createVector(ix * spacing - offset, (iy + 1) * spacing - offset, iz * spacing - offset);
            line(pos.x, pos.y, pos.z, neighborY.x, neighborY.y, neighborY.z);
          }
          // Liên kết theo trục Z
          if (iz < numIons - 1) {
            let neighborZ = createVector(ix * spacing - offset, iy * spacing - offset, (iz + 1) * spacing - offset);
            line(pos.x, pos.y, pos.z, neighborZ.x, neighborZ.y, neighborZ.z);
          }
        }
      }
    }
    noStroke();
  }
  
  // Cập nhật offscreen graphics cho icon Na+ với hiệu ứng 3D
  iconNaGraphics.push();
  iconNaGraphics.clear();
  iconNaGraphics.resetMatrix();
  iconNaGraphics.ambientLight(60);
  iconNaGraphics.directionalLight(255, 255, 255, 0, -1, -1);
  iconNaGraphics.fill(0, 153, 255);
  // Vẽ sphere với kích thước phù hợp cho icon
  iconNaGraphics.sphere(radiusNa);
  iconNaGraphics.pop();
  
  // Cập nhật offscreen graphics cho icon Cl- với hiệu ứng 3D
  iconClGraphics.push();
  iconClGraphics.clear();
  iconClGraphics.resetMatrix();
  iconClGraphics.ambientLight(60);
  iconClGraphics.directionalLight(255, 255, 255, 0, -1, -1);
  iconClGraphics.fill(255, 204, 0);
  iconClGraphics.sphere(radiusCl);
  iconClGraphics.pop();
  
  // Vẽ phần legend (chú thích) dưới dạng giao diện 2D không bị ảnh hưởng bởi các phép biến đổi 3D
  push();
  resetMatrix();
  // Dịch hệ tọa độ về góc trên bên trái với đệm cố định
  translate(-width / 2 + 10, -height / 2 + 80);
  textSize(16);
  // Đặt canh trái và canh giữa (trục dọc) cho chữ
  textAlign(LEFT, CENTER);
  fill(255);
  
  // Vẽ tiêu đề "Chú thích:" canh trái
  text("Chú thích:", 0, 0);
  
  // Vẽ legend cho ion Na+
  let entry1Y = 5; // vị trí bắt đầu của dòng legend Na+
  image(iconNaGraphics, 0, entry1Y, iconSize, iconSize);
  // Vẽ nhãn Na+ canh trái, đặt ở giữa theo chiều dọc của icon
  text("Na+", iconSize + 5, entry1Y + iconSize / 2);
  
  // Vẽ legend cho ion Cl-
  let entry2Y = entry1Y + iconSize - 10; // khoảng cách giữa các dòng legend
  image(iconClGraphics, 0, entry2Y, iconSize, iconSize);
  text("Cl-", iconSize + 5, entry2Y + iconSize / 2);
  pop();
}

function toggleBonds() {
  drawBonds = !drawBonds;
}

function toggleAutoRotate() {
  autoRotate = !autoRotate;
}

// Cho phép xoay cảnh 3D khi kéo chuột (chỉ khi autoRotate tắt)
function mouseDragged() {
  if (mouseButton === LEFT && !autoRotate) {
    let dx = mouseX - pmouseX;
    let dy = mouseY - pmouseY;
    rotationY += dx * 0.01;
    rotationX += dy * 0.01;
  }
}

// Điều chỉnh zoom bằng con lăn chuột
function mouseWheel(event) {
  zoomFactor *= 1 - event.delta * 0.001;
  zoomFactor = constrain(zoomFactor, 0.2, 5);
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}