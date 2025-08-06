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

function preload() {
  // Nếu dạng "⁺" và "⁻" không hiển thị đúng,
  // bạn có thể thử sử dụng một font hỗ trợ Unicode tốt hơn, ví dụ "Arial Unicode MS" hoặc "Noto Sans".
  // Đảm bảo file font tương ứng có trong thư mục.
  // Ví dụ: myFont = loadFont('ArialUnicodeMS.ttf');
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
}

function draw() {
  // Nền màn hình là màu đen đậm
  background(0);
  
  // Thiết lập ánh sáng để tạo hiệu ứng 3D rõ ràng
  ambientLight(60);
  directionalLight(255, 255, 255, 0, -1, -1);
  
  // Áp dụng hệ số thu/phóng
  scale(zoomFactor);
  
  // Xoay tự động nếu đã bật, nếu không dùng giá trị xoay được cập nhật bởi chuột
  if (autoRotate) {
    rotationX = frameCount * 0.01;
    rotationY = frameCount * 0.01;
  }
  rotateX(rotationX);
  rotateY(rotationY);
  
  // Vẽ các ion trong lưới 3D, sử dụng 3 vòng lặp cho x, y, z
  for (let ix = 0; ix < numIons; ix++) {
    for (let iy = 0; iy < numIons; iy++) {
      for (let iz = 0; iz < numIons; iz++) {
        let offset = ((numIons - 1) * spacing) / 2;
        // Tọa độ căn giữa
        let posX = ix * spacing - offset;
        let posY = iy * spacing - offset;
        let posZ = iz * spacing - offset;
        
        push();
        translate(posX, posY, posZ);
        // Xen kẽ màu: Nếu tổng chỉ số chẵn -> Na+ (màu xanh), nếu lẻ -> Cl- (màu vàng)
        if ((ix + iy + iz) % 2 === 0) {
          fill(0, 153, 255);   // Na+ màu xanh (giống như trong mạng tinh thể)
          sphere(radiusNa);
        } else {
          fill(255, 204, 0);   // Cl- màu vàng
          sphere(radiusCl);
        }
        pop();
      }
    }
  }
  
  // Vẽ liên kết giữa các ion liền kề nếu đã bật
  if (drawBonds) {
    stroke(255, 150);
    strokeWeight(2);
    
    for (let ix = 0; ix < numIons; ix++) {
      for (let iy = 0; iy < numIons; iy++) {
        for (let iz = 0; iz < numIons; iz++) {
          let offset = ((numIons - 1) * spacing) / 2;
          let pos = createVector(ix * spacing - offset, iy * spacing - offset, iz * spacing - offset);
          
          // Liên kết với hàng xóm ở +x
          if (ix < numIons - 1) {
            let neighborX = createVector((ix + 1) * spacing - offset, iy * spacing - offset, iz * spacing - offset);
            line(pos.x, pos.y, pos.z, neighborX.x, neighborX.y, neighborX.z);
          }
          // Liên kết với hàng xóm ở +y
          if (iy < numIons - 1) {
            let neighborY = createVector(ix * spacing - offset, (iy + 1) * spacing - offset, iz * spacing - offset);
            line(pos.x, pos.y, pos.z, neighborY.x, neighborY.y, neighborY.z);
          }
          // Liên kết với hàng xóm ở +z
          if (iz < numIons - 1) {
            let neighborZ = createVector(ix * spacing - offset, iy * spacing - offset, (iz + 1) * spacing - offset);
            line(pos.x, pos.y, pos.z, neighborZ.x, neighborZ.y, neighborZ.z);
          }
        }
      }
    }
    noStroke();
  }
  
  // Vẽ chú thích cho ion Na+ và Cl- bên cạnh trái canvas và nằm dưới nút "Bật/Tắt xoay"
  push();
  // Reset hệ tọa độ để vẽ giao diện 2D trên canvas
  resetMatrix();
  // Chuyển từ hệ tọa độ của canvas WEBGL (trung tâm) về góc trái trên.
  translate(-width/2 + 10, -height/2 + 70);
  textSize(16);
  textAlign(LEFT, TOP);
  
  // Vẽ tiêu đề chú thích
  fill(255);
  text("Chú thích:", 0, 0);
  
  // Chú thích cho Na+
  push();
  translate(10, 30); // cách tiêu đề 30px
  push();
  translate(10, 10);
  fill(0, 153, 255);
  // Giảm kích thước icon Na+ bằng cách giảm tỉ lệ nhân (sử dụng 1.0)
  sphere(radiusNa * 1.0);
  pop();
  fill(255);
  // Nếu Unicode hiển thị thành ô vuông, hãy thử font hỗ trợ Unicode, hoặc thay thế bằng chuỗi "+", ví dụ: "Na+"
  text("Na+", 40, 3);
  pop();
  
  // Chú thích cho Cl-
  push();
  translate(10, 70); // cách Na+ thêm khoảng 40px
  push();
  translate(10, 10);
  fill(255, 204, 0);
  sphere(radiusCl * 1.0);
  pop();
  fill(255);
  // Nếu Unicode hiển thị sai, hãy thử hiển thị "Cl-" thay vì "Cl⁻"
  text("Cl-", 40, 3);
  pop();
  pop();
}

// Hàm bật/tắt liên kết giữa các nguyên tử
function toggleBonds() {
  drawBonds = !drawBonds;
}

// Hàm bật/tắt xoay tự động
function toggleAutoRotate() {
  autoRotate = !autoRotate;
}

// Cho phép xoay khi bấm giữ chuột trái (chỉ khi autoRotate tắt)
function mouseDragged() {
  if (mouseButton === LEFT && !autoRotate) {
    let dx = mouseX - pmouseX;
    let dy = mouseY - pmouseY;
    rotationY += dx * 0.01;
    rotationX += dy * 0.01;
  }
}

// Lăn chuột để thu/phóng
function mouseWheel(event) {
  zoomFactor *= 1 - event.delta * 0.001;
  zoomFactor = constrain(zoomFactor, 0.2, 5);
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}