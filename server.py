import cv2
import os
import time
import asyncio
import threading
import requests
import json
from fastapi import FastAPI, BackgroundTasks, Response, Body
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict, List, Any
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
from dotenv import load_dotenv

# โหลดค่าคอนฟิกจากไฟล์ .env
load_dotenv()

# ---------------- DINO MODEL SETUP ----------------
device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")

if device == "cuda":
    gpu_name = torch.cuda.get_device_name(0)
    arch_list = torch.cuda.get_arch_list()
    print(f"🚀 ตรวจพบการ์ดจอ: {gpu_name}")
    
    if "sm_120" not in arch_list and "RTX 50" in gpu_name:
        print("⚠️ คำเตือน: แม้จะลงเวอร์ชันใหม่แล้ว แต่ดูเหมือน PyTorch ชุดนี้จะยังไม่มี Blackwell Kernel")
        print("💡 เพื่อความปลอดภัย ระบบจะสลับไปใช้ CPU ครับ")
        device = "cpu"
    else:
        print("✅ การ์ดจอพร้อมใช้งานสำหรับการประมวลผล AI")

print(f"กำลังใช้หน่วยประมวลผล: {device}")
print("กำลังโหลดโมเดล Grounding DINO...")
processor = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-base")
model = AutoModelForZeroShotObjectDetection.from_pretrained("IDEA-Research/grounding-dino-base").to(device)
print("✅ โหลดโมเดลสำเร็จ!")
# --------------------------------------------------

app = FastAPI(title="Smart Flood AI Backend")

# ล็อกสำหรับการประมวลผล AI ป้องกันหลายเธรดแย่งกันใช้การ์ดจอ (CUDA Error)
ai_lock = threading.Lock()

# ---------------- LINE OA CONFIG ----------------
LINE_OA_TOKEN = os.getenv("LINE_OA_TOKEN")
LINE_OA_USER_ID = os.getenv("LINE_OA_USER_ID") # ใส่ User ID หรือ Group ID
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000") # เปลี่ยนเป็น Cloudflare Tunnel URL

# สร้างโฟลเดอร์สำหรับเก็บภาพ Alert ชั่วคราวให้ LINE ดึงไปโชว์
os.makedirs("captures", exist_ok=True)
app.mount("/captures", StaticFiles(directory="captures"), name="captures")

def send_line_alert(flex_contents: dict, alt_text: str = "แจ้งเตือนน้ำท่วม"):
    if not LINE_OA_TOKEN or "YOUR_LINE" in LINE_OA_TOKEN:
        print("[LINE OA] ไม่ได้ตั้งค่า Token")
        return
        
    is_broadcast = not LINE_OA_USER_ID or "YOUR_LINE" in LINE_OA_USER_ID
    url = "https://api.line.me/v2/bot/message/broadcast" if is_broadcast else "https://api.line.me/v2/bot/message/push"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_OA_TOKEN}"
    }
    
    payload = {
        "messages": [
            {
                "type": "flex",
                "altText": alt_text,
                "contents": flex_contents
            }
        ]
    }
    
    if not is_broadcast:
        payload["to"] = LINE_OA_USER_ID
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)
        if response.status_code >= 400:
            print(f"[LINE OA] ❌ ส่งไม่สำเร็จ! Status: {response.status_code}")
            print(f"[LINE OA] 📋 Error Detail: {response.text}")
        else:
            print(f"[LINE OA] ✅ Flex Message ส่งสำเร็จ! (Status: {response.status_code})")
    except Exception as e:
        print(f"[LINE OA] ⚠️ Network Error: {e}")

# ═══════════════════════════════════════════════════════
# In-memory store for alert images per camera.
# Updated every AI frame when water >= 30cm.
# Written to disk ONLY when Admin clicks [Confirm].
# Key: camera_id, Value: JPEG bytes
# ═══════════════════════════════════════════════════════
alert_snapshots: Dict[str, bytes] = {}


@app.post("/api/confirm")
async def confirm_flood(body: dict = Body(...)):
    """Admin confirmed a flood — save the in-memory alert image to disk now."""
    camera_id = body.get("camera_id")
    if not camera_id or camera_id not in camera_states:
        return {"error": "Invalid camera_id"}

    img_bytes = alert_snapshots.get(camera_id)
    if img_bytes:
        # ดึงระดับน้ำปัจจุบันมา Lock ไว้
        confirmed_depth = camera_states[camera_id].get("water_depth", 0.0)
        
        # ตั้งชื่อไฟล์โดยฝังระดับน้ำลงไปเลย (Clean & Proper)
        filename = f"alert_{camera_id}_{int(time.time())}_depth_{confirmed_depth:.1f}.jpg"
        filepath = os.path.join("captures", filename)
        
        with open(filepath, "wb") as f:
            f.write(img_bytes)
            
        print(f"[Confirm] ✅ บันทึกภาพและระดับน้ำ ({confirmed_depth}cm): {filename}")
        return {"status": "success", "camera_id": camera_id, "filename": filename, "depth": confirmed_depth}
    else:
        print(f"[Confirm] ⚠️ ไม่พบภาพ Alert ในหน่วยความจำสำหรับ {camera_id}")
        return {"status": "success", "camera_id": camera_id, "filename": None}


@app.post("/api/resolve")
async def resolve_flood(body: dict = Body(...)):
    """Admin resolved a flood — clear in-memory snapshot."""
    camera_id = body.get("camera_id")
    if camera_id and camera_id in alert_snapshots:
        del alert_snapshots[camera_id]
        print(f"[Resolve] ✅ เคลียร์สถานะน้ำท่วมสำหรับ {camera_id}")
    return {"status": "success", "camera_id": camera_id}


@app.post("/api/broadcast_all")
async def trigger_broadcast_all(confirmed_ids: list[str] = Body(...)):
    # ส่งทุกจุดที่ Admin กดยืนยันมา (Confirmed) โดยดึงข้อมูลจาก Snapshot ที่บันทึกไว้
    flooded_nodes = [camera_states[cid] for cid in confirmed_ids if cid in camera_states]
    
    if not flooded_nodes:
        return {"error": "ไม่พบข้อมูลกล้องที่คุณเลือก"}
        
    bubbles = []
    
    for node in flooded_nodes:
        # ดึงภาพล่าสุดและแกะระดับน้ำที่ Lock ไว้จากชื่อไฟล์
        node_img_filename = None
        display_depth = node['water_depth'] # Fallback
        
        # ค้นหาไฟล์ภาพที่มีชื่อ pattern _depth_
        files = [f for f in os.listdir("captures") if f.startswith(f"alert_{node['camera_id']}") and "_depth_" in f]
        if files:
            node_img_filename = sorted(files)[-1]
            try:
                # แกะระดับน้ำจากชื่อไฟล์ (เช่น alert_CCTV-01_..._depth_35.5.jpg)
                depth_str = node_img_filename.split("_depth_")[-1].replace(".jpg", "")
                display_depth = float(depth_str)
            except:
                pass
        
        if node_img_filename:
            node_img_url = f"{PUBLIC_BASE_URL}/captures/{node_img_filename}"
        else:
            node_img_url = "https://cdn-icons-png.flaticon.com/512/4201/4201971.png"

        # สร้าง Bubble สำหรับแต่ละจุด
        bubble = {
            "type": "bubble",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {"type": "text", "text": f"🚨 รายงานน้ำท่วม: {node['name']}", "weight": "bold", "color": "#ffffff", "size": "md"}
                ],
                "backgroundColor": "#b91c1c"
            },
            "hero": {
                "type": "image",
                "url": node_img_url,
                "size": "full",
                "aspectRatio": "20:13",
                "aspectMode": "cover",
                "action": {"type": "uri", "uri": node_img_url}
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {"type": "text", "text": "ระดับน้ำขณะตรวจสอบ", "size": "sm", "color": "#64748b", "flex": 3},
                            {"type": "text", "text": f"{display_depth:.1f} cm", "size": "xl", "align": "end", "weight": "bold", "color": "#e11d48", "flex": 3}
                        ]
                    },
                    {"type": "separator", "margin": "md"},
                    {"type": "text", "text": f"รหัสกล้อง: {node['camera_id']}", "size": "xs", "color": "#94a3b8", "margin": "md"}
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "action": {
                            "type": "uri",
                            "label": "🌐 ดูแผนที่สดจุดนี้",
                            "uri": PUBLIC_BASE_URL
                        },
                        "style": "primary",
                        "color": "#1d4ed8",
                        "height": "sm"
                    }
                ]
            }
        }
        bubbles.append(bubble)
    
    # ถ้ามีมากกว่า 1 จุด ให้ส่งเป็น Carousel (เลื่อนซ้ายขวาได้)
    if len(bubbles) > 1:
        flex_payload = {
            "type": "carousel",
            "contents": bubbles
        }
    else:
        flex_payload = bubbles[0]
    
    threading.Thread(target=send_line_alert, args=(flex_payload, "🚨 แจ้งเตือนน้ำท่วมระดับวิกฤต!")).start()
    return {"status": "success", "confirmed_count": len(flooded_nodes)}
# ------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MOCK_CAMERAS = [
    {"camera_id": "CCTV-01", "name": "ถนนรัชดาภิเษก", "location": {"lat": 13.7934, "lng": 100.5741}, "video": "Dataset/sample1.mp4"},
    {"camera_id": "CCTV-02", "name": "แยกลาดพร้าว", "location": {"lat": 13.8062, "lng": 100.5615}, "video": "Dataset/sample2.mp4"},
    {"camera_id": "CCTV-03", "name": "สุขุมวิท 71", "location": {"lat": 13.7226, "lng": 100.5960}, "video": "Dataset/sample3.mp4"},
]

# เก็บสถานะและเฟรมล่าสุดของแต่ละกล้อง
camera_states: Dict[str, Any] = {}
camera_frames: Dict[str, bytes] = {} # สำหรับเก็บภาพ JPEG ล่าสุดเพื่อทำสตรีม
camera_locks: Dict[str, threading.Lock] = {}

def init_camera_states():
    for cam in MOCK_CAMERAS:
        camera_states[cam["camera_id"]] = {
            "camera_id": cam["camera_id"],
            "name": cam["name"],
            "location": cam["location"],
            "status": "normal",
            "water_depth": 0.0,
            "detected_objects": [],
            "screenshot_base64": None, # อาจไม่จำเป็นต้องใช้แล้วถ้ามีสตรีม แต่เก็บไว้เผื่อ alert
            "is_processing": False,
            "latest_boxes": [] # เก็บข้อมูลกล่อง AI ล่าสุด
        }
        camera_locks[cam["camera_id"]] = threading.Lock()

def video_reader_thread(camera: dict):
    """Thread สำหรับอ่านวิดีโอให้ไหลลื่นที่ ~30fps"""
    cam_id = camera["camera_id"]
    video_path = camera["video"]
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[Error] ไม่สามารถเปิดวิดีโอ {video_path} สำหรับ {cam_id}")
        return
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps != fps: fps = 30.0
    delay = 1.0 / fps

    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
            
        # ลบการวาดกรอบออกจาก Live Preview ตามที่ User ต้องการ
        with camera_locks[cam_id]:
            depth_cm = camera_states[cam_id].get("water_depth", 0.0)
            status = camera_states[cam_id].get("status", "normal")
                
        # ย่อขนาดภาพสำหรับ Preview เพื่อไม่ให้กินแบนด์วิดท์มากเกินไปจนโหลดไม่ขึ้น
        h, w = frame.shape[:2]
        if w > 640:
            frame = cv2.resize(frame, (640, int(h * (640 / w))))
            
        # แปะแค่ text ระดับน้ำมุมซ้ายบน
        color = (0, 255, 0)
        if status == "critical": color = (0, 0, 255)
        elif status == "warning": color = (0, 255, 255)
        cv2.putText(frame, f"Water: {depth_cm:.1f} cm", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

        # เข้ารหัสเป็น JPEG เก็บไว้ให้สตรีมมิ่งดึงไปใช้
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        camera_frames[cam_id] = buffer.tobytes()
        
        time.sleep(delay)

def ai_processor_thread(camera: dict):
    """Thread สำหรับรัน DINO เป็นระยะ"""
    cam_id = camera["camera_id"]
    video_path = camera["video"]
    
    cap = cv2.VideoCapture(video_path)
    camera_states[cam_id]["is_processing"] = True
    
    import random
    
    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
            
        # เก็บภาพต้นฉบับไว้ใช้วาดสำหรับ Alert
        alert_frame = frame.copy()
            
        # ประมวลผล DINO
        h, w = frame.shape[:2]
        process_width = 640
        scale = process_width / w
        small_frame = cv2.resize(frame, (process_width, int(h * scale)))
        image_pil = Image.fromarray(cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB))
        
        text_prompt = "wheel. car. water."
        inputs = processor(images=image_pil, text=text_prompt, return_tensors="pt").to(device)
        
        with ai_lock:
            with torch.no_grad():
                outputs = model(**inputs)
            
        results = processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            threshold=0.3,
            text_threshold=0.3,
            target_sizes=[(h, w)]
        )[0]
        
        max_depth = 0.0
        detected = []
        new_boxes = []
        
        cars = []
        wheels = []
        has_water = False
        
        for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
            bx = [int(i) for i in box.tolist()]
            if label not in detected: detected.append(label)
            new_boxes.append((bx[0], bx[1], bx[2], bx[3], label))
            if label == "car":
                cars.append(bx)
                cv2.rectangle(alert_frame, (bx[0], bx[1]), (bx[2], bx[3]), (255, 0, 0), 2)
                cv2.putText(alert_frame, "Car", (bx[0], bx[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            elif label == "wheel":
                wheels.append(bx)
            elif label == "water":
                has_water = True
                cv2.rectangle(alert_frame, (bx[0], bx[1]), (bx[2], bx[3]), (255, 165, 0), 2) # Orange for water box
                cv2.putText(alert_frame, "Water", (bx[0], bx[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 165, 0), 2)
        
        max_depth = 0.0
        car_to_wheels = {i: [] for i in range(len(cars))}
        unmatched_wheels = []
        
        for wbx in wheels:
            center_x = (wbx[0] + wbx[2]) / 2
            center_y = (wbx[1] + wbx[3]) / 2
            matched = False
            for i, cbx in enumerate(cars):
                if cbx[0] <= center_x <= cbx[2] and cbx[1] <= center_y <= cbx[3]:
                    car_to_wheels[i].append(wbx)
                    matched = True
                    break
            if not matched:
                unmatched_wheels.append(wbx)
                
        # ประมวลผลล้อที่จับคู่กับรถได้
        for i, cbx in enumerate(cars):
            c_wheels = car_to_wheels[i]
            valid_wheels = []
            for wbx in c_wheels:
                car_height = cbx[3] - cbx[1]
                if (cbx[3] - wbx[3]) > car_height * 0.15:
                    # ล้อฝั่งนู้น (โดนบัง)
                    cv2.rectangle(alert_frame, (wbx[0], wbx[1]), (wbx[2], wbx[3]), (128, 128, 128), 2)
                    cv2.putText(alert_frame, "Far Wheel", (wbx[0], wbx[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (128, 128, 128), 1)
                else:
                    valid_wheels.append(wbx)
            
            # วาดเส้นระดับน้ำเฉียงตามล้อรถ ถ้ามีล้อที่ใช้ได้ตั้งแต่ 2 ล้อขึ้นไป
            if len(valid_wheels) >= 2:
                valid_wheels.sort(key=lambda w: (w[0]+w[2])/2)
                w_left = valid_wheels[0]
                w_right = valid_wheels[-1]
                pt1 = (int((w_left[0]+w_left[2])/2), w_left[3])
                pt2 = (int((w_right[0]+w_right[2])/2), w_right[3])
                dx = pt2[0] - pt1[0]
                dy = pt2[1] - pt1[1]
                if dx != 0:
                    slope = dy / dx
                    ext_x1 = pt1[0] - 30
                    ext_y1 = int(pt1[1] - 30 * slope)
                    ext_x2 = pt2[0] + 30
                    ext_y2 = int(pt2[1] + 30 * slope)
                    cv2.line(alert_frame, (ext_x1, ext_y1), (ext_x2, ext_y2), (255, 255, 0), 2)
                    
            # คำนวณความลึกและวาดกล่องให้แต่ละล้อ
            for wbx in valid_wheels:
                wheel_height = wbx[3] - wbx[1]
                wheel_width = wbx[2] - wbx[0]
                full_wheel = max(wheel_width, wheel_height)
                depth = 0.0
                if full_wheel > 0 and has_water:
                    submerged_ratio = (full_wheel - wheel_height) / full_wheel
                    if submerged_ratio > 0.15: # เพิ่มเกณฑ์จาก 5% เป็น 15% เพื่อลด false positive จากกล่องที่ไม่แม่นยำ
                        depth = 60 * submerged_ratio
                        max_depth = max(max_depth, depth)
                
                cv2.rectangle(alert_frame, (wbx[0], wbx[1]), (wbx[2], wbx[3]), (0, 255, 0), 2)
                if depth > 0:
                    cv2.putText(alert_frame, f"{depth:.1f} cm", (wbx[0], wbx[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                if len(valid_wheels) < 2:
                    cv2.line(alert_frame, (wbx[0] - 15, wbx[3]), (wbx[2] + 15, wbx[3]), (255, 255, 0), 2)
                    
        # ประมวลผลล้อที่หาคู่ไม่ได้ (อยู่เดี่ยวๆ)
        for wbx in unmatched_wheels:
            wheel_height = wbx[3] - wbx[1]
            wheel_width = wbx[2] - wbx[0]
            full_wheel = max(wheel_width, wheel_height)
            depth = 0.0
            if full_wheel > 0 and has_water:
                submerged_ratio = (full_wheel - wheel_height) / full_wheel
                if submerged_ratio > 0.15: # เพิ่มเกณฑ์เป็น 15% 
                    depth = 60 * submerged_ratio
                    max_depth = max(max_depth, depth)
            
            cv2.rectangle(alert_frame, (wbx[0], wbx[1]), (wbx[2], wbx[3]), (0, 255, 0), 2)
            if depth > 0:
                cv2.putText(alert_frame, f"{depth:.1f} cm", (wbx[0], wbx[1]-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            cv2.line(alert_frame, (wbx[0] - 15, wbx[3]), (wbx[2] + 15, wbx[3]), (255, 255, 0), 2)

        # ป้องกัน False Positive: ถ้า AI ตรวจไม่พบน้ำในภาพเลย ให้ถือว่าความลึกน้ำเป็น 0
        if not has_water:
            max_depth = 0.0

        status = "normal"
        if max_depth >= 30: status = "critical"
        elif max_depth >= 10: status = "warning"
            
        import base64
        # สร้าง Base64 จาก alert_frame ที่มีกล่องแล้ว
        cv2.putText(alert_frame, f"Water: {max_depth:.1f} cm", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        _, buffer = cv2.imencode('.jpg', alert_frame)
        b64_img = base64.b64encode(buffer).decode('utf-8')
        
        with camera_locks[cam_id]:
            camera_states[cam_id].update({
                "water_depth": round(max_depth, 2),
                "status": status,
                "detected_objects": list(set(detected)),
                "latest_boxes": new_boxes,
                "screenshot_base64": f"data:image/jpeg;base64,{b64_img}"
            })
            
        print(f"[AI] {cam_id} อัปเดตความลึก: {max_depth:.1f} cm | สถานะ: {status}")

        # เก็บภาพ Alert ไว้ใน Memory เท่านั้น (ไม่เขียนลง Disk ทุกเฟรม)
        # จะเขียนลง Disk จริงๆ ก็ต่อเมื่อ Admin กด Confirm ผ่าน /api/confirm
        if max_depth >= 30:
            _, img_buffer = cv2.imencode('.jpg', alert_frame)
            alert_snapshots[cam_id] = img_buffer.tobytes()
        
        # ปรับความถี่การประมวลผลให้ไวขึ้น (0.5 วินาทีต่อครั้ง)
        for _ in range(30 // 2): # ข้าม 0.5 วินาที
            cap.grab()
            
        time.sleep(2) # พักก่อนสแกนใหม่ แป๊บเดียวพอเพราะการ์ดจอไหว

@app.on_event("startup")
def startup_event():
    init_camera_states()
    for cam in MOCK_CAMERAS:
        # แยก Thread อ่านวิดีโอ กับ Thread AI ออกจากกัน เพื่อความลื่นไหล
        t_reader = threading.Thread(target=video_reader_thread, args=(cam,), daemon=True)
        t_ai = threading.Thread(target=ai_processor_thread, args=(cam,), daemon=True)
        t_reader.start()
        t_ai.start()

async def video_stream_generator(camera_id: str):
    """ฟังก์ชันผลิตสตรีม MJPEG"""
    while True:
        frame_bytes = camera_frames.get(camera_id)
        if frame_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        await asyncio.sleep(0.03) # ~30fps

@app.get("/api/video/{camera_id}")
async def video_feed(camera_id: str):
    """ส่งออกแบบ MJPEG ให้แท็ก <img> เล่นเป็นวิดีโอได้เลย"""
    return StreamingResponse(video_stream_generator(camera_id), 
                             media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/")
def read_root():
    return {"message": "Smart Flood AI Backend is running"}

@app.get("/api/status")
def get_status():
    with threading.Lock(): # เซฟๆ
        return list(camera_states.values())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
