# VPS Control Center - README

## Giới Thiệu
Tool quản lý VPS từ xa qua giao diện web. Không cần mở CMD, mọi thao tác đều thực hiện qua trình duyệt.

## CẤU TRÚC FILE
```
vps-manager/
├── index.html        ← Giao diện chính (upload lên GitHub Pages)
├── style.css         ← CSS giao diện
├── app.js            ← JavaScript frontend
├── vps-manager.js    ← Backend (upload lên VPS)
└── README.md         ← Hướng dẫn này
```

---

## BƯỚC 1: CÀI ĐẶT TRÊN VPS

### 1.1. Copy file backend lên VPS
```bash
# Tạo thư mục riêng cho manager
mkdir -p /root/vps-manager
cd /root/vps-manager
```

### 1.2. Dán nội dung file vps-manager.js
```bash
nano vps-manager.js
# Dán nội dung từ file vps-manager.js vào đây
# Nhớ sửa dòng SECRET_ADMIN_TOKEN thành token của sếp!
```

> ⚠️ **QUAN TRỌNG:** Đổi `SECRET_ADMIN_TOKEN` trong file `vps-manager.js` thành một chuỗi bí mật của riêng sếp!

### 1.3. Cài thư viện
```bash
npm install express cors
```

### 1.4. Chạy bằng PM2
```bash
pm2 start vps-manager.js --name vps-manager
pm2 save
```

### 1.5. Mở firewall cổng 4000
```bash
ufw allow 4000
```

---

## BƯỚC 2: DEPLOY GIAO DIỆN LÊN GITHUB PAGES

### 2.1. Tạo Repository mới trên GitHub
- Vào GitHub.com → New Repository
- Đặt tên: `vps-control-center` (hoặc tên tùy ý)
- Để chế độ **Public** (để dùng GitHub Pages miễn phí)

### 2.2. Upload 3 file lên GitHub
Upload các file sau vào repo:
- `index.html`
- `style.css`  
- `app.js`

### 2.3. Bật GitHub Pages
- Vào **Settings** của repo → **Pages**
- Source: **Deploy from a branch** → Branch: **main** → **Save**
- Sau vài phút, link tool của sếp sẽ là: `https://[username].github.io/vps-control-center/`

---

## BƯỚC 3: KẾT NỐI VÀ SỬ DỤNG

1. Mở link GitHub Pages trên trình duyệt
2. Nhấn nút **"⚙️ Cài Đặt Kết Nối"** (góc dưới sidebar)
3. Điền thông tin:
   - **IP VPS:** `103.82.195.87` (IP VPS của sếp)
   - **Cổng:** `4000`
   - **Token:** (chuỗi sếp đã đặt trong `SECRET_ADMIN_TOKEN`)
4. Nhấn **"Test Kết Nối"** → Nếu thành công thấy ✅
5. Nhấn **"Lưu & Kết Nối"**

---

## TÍNH NĂNG

| Tính năng | Mô tả |
|-----------|-------|
| 📊 Dashboard | Xem CPU, RAM, Disk, Uptime theo thời gian thực |
| 🔄 PM2 Manager | Restart/Stop/Start/Delete tiến trình PM2 |
| 📋 Live Logs | Xem log PM2 trực tiếp, cập nhật mỗi 3 giây |
| 💻 Code Editor | Đọc/ghi file code trực tiếp từ web |
| 📦 Packages | Cài npm packages, xem danh sách thư viện |
| 🖥️ Terminal | Chạy lệnh Linux tùy ý từ web |

---

## BẢO MẬT

- Token bảo mật ngăn truy cập trái phép
- Lệnh nguy hiểm (`rm -rf /`, `shutdown`...) bị chặn tự động
- File chỉ được đọc/ghi trong thư mục `/root` và `/home`
- Backup tự động file cũ trước khi ghi đè
