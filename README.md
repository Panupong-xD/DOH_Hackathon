# 🌊 Smart Flood AI Monitoring & Command Center

ระบบเฝ้าระวังและวิเคราะห์สถานการณ์น้ำท่วมอัจฉริยะด้วย AI (Grounding DINO) พร้อมระบบ Command Center สำหรับบริหารจัดการและแจ้งเตือนผ่าน LINE OA แบบ Real-time

---

## ✨ Key Features (ความสามารถหลัก)

### 🧠 1. AI-Powered Depth Estimation
- **Zero-Shot Detection**: ใช้โมเดล **Grounding DINO** ในการตรวจจับ "รถยนต์ (Car)" และ "ล้อ (Wheel)" ได้ทันทีโดยไม่ต้องเทรนโมเดลใหม่
- **Wheel Submerged Analysis**: วิเคราะห์ระดับความลึกของน้ำจากอัตราส่วนการจมของล้อรถ เพื่อคำนวณความลึกเป็นเซนติเมตร (cm) อย่างแม่นยำ
- **Real-time Overlay**: แสดงกรอบตรวจจับ (Bounding Box) และระดับน้ำบนภาพ CCTV แบบสดๆ

### 🗺️ 2. Intelligent Command Dashboard
- **Interactive Map**: แสดงตำแหน่งกล้อง CCTV ทั้งหมดบน Google Maps พร้อมสถานะสี (เขียว: ปกติ, เหลือง: เฝ้าระวัง, แดง: วิกฤต)
- **Flood-Aware Routing**: ระบบนำทางอัจฉริยะที่ช่วย **คำนวณเส้นทางหลีกเลี่ยงพื้นที่น้ำท่วม** ในรัศมี 5 กม. จากจุดที่ยืนยันว่าวิกฤต
- **Live Streaming**: ดูภาพสดจากกล้องทุกตัวผ่านหน้า Dashboard ด้วยสตรีมแบบ MJPEG ที่ประหยัดทรัพยากร

### 📲 3. Advanced Alert System (LINE Integration)
- **Manual Confirmation**: เจ้าหน้าที่สามารถตรวจสอบและ "ยืนยัน (Confirm)" สถานการณ์ก่อนส่งแจ้งเตือน เพื่อป้องกันความผิดพลาด (False Positive)
- **LINE Flex Message Carousel**: ส่งแจ้งเตือนน้ำท่วมไปยังประชาชนผ่าน LINE OA ในรูปแบบการ์ดที่สวยงาม (Carousel) พร้อมภาพประกอบและระดับน้ำล่าสุด
- **One-Click Broadcast**: ระบบกระจายข่าวสารไปยังผู้ติดตามทุกคนทันทีเมื่อเกิดเหตุวิกฤต

---

## 🛠️ Tech Stack (เทคโนโลยีที่ใช้)

### Backend (AI & API)
- **Python (FastAPI)**: ทำงานเป็น Core Backend สำหรับประมวลผล AI และให้บริการ API
- **PyTorch & Transformers**: สำหรับรันโมเดล Grounding DINO (รองรับ CUDA สำหรับการ์ดจอ RTX)
- **OpenCV**: สำหรับจัดการวิดีโอสตรีมและประมวลผลภาพ
- **Python-dotenv**: สำหรับจัดการความปลอดภัยของ API Keys

### Frontend (Dashboard)
- **Next.js (App Router)**: Framework สำหรับสร้างเว็บแอปพลิเคชันที่รวดเร็วและทันสมัย
- **Tailwind CSS**: สำหรับการออกแบบ UI ที่สวยงามแบบ Premium Dark Mode
- **Google Maps API**: สำหรับระบบแผนที่และคำนวณเส้นทางนำทาง
- **Lucide React**: สำหรับไอคอนประกอบที่ทันสมัย

---

## 🚀 การติดตั้งและเริ่มใช้งาน

### 1. เตรียม Environment
สร้างไฟล์ `.env` ที่ root directory:
```env
LINE_OA_TOKEN=your_token_here
LINE_OA_USER_ID=your_id_here
PUBLIC_BASE_URL=http://localhost:8000
```

สร้างไฟล์ `smart-flood-dashboard/.env.local`:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 2. รัน Backend (Python)
```powershell
# ติดตั้ง dependencies
pip install -r requirements.txt

# รัน Server
python server.py
```

### 3. รัน Frontend (Next.js)
```powershell
cd smart-flood-dashboard
npm install
npm run dev
```

---

## 📂 โครงสร้างโปรเจกต์
- `server.py`: ระบบประมวลผล AI และ API สตรีมมิ่ง
- `smart-flood-dashboard/`: โค้ดหน้า Dashboard ทั้งหมด
  - `src/components/Map.tsx`: ระบบแผนที่และการนำทาง
  - `src/components/Sidebar.tsx`: รายการสถานะกล้องและการควบคุม
  - `src/components/CCTVPopup.tsx`: หน้าต่างดูภาพสด AI
- `captures/`: เก็บภาพ Alert สำหรับส่ง LINE

---

## 👥 ผู้พัฒนา
**Panupong-xD** & **Kulachart**

---