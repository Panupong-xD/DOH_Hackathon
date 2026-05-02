"use client";

import React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { CameraState } from '@/types'; 

interface AlertProps {
  node: CameraState;
  onConfirm: (nodeId: string) => void;
  onReject: (nodeId: string) => void;
}

export default function Alert({ node, onConfirm, onReject }: AlertProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  if (!node) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 w-[90%] max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-red-600 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={24} className="text-white animate-pulse" />
          <h3 className="font-bold text-white text-lg tracking-wide">
            แจ้งเตือนน้ำท่วมระดับวิกฤต: {node.water_depth.toFixed(1)} cm
          </h3>
        </div>
        
        {/* Content */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-400">สถานที่:</span>
            <span className="font-bold text-white">{node.name} ({node.camera_id})</span>
          </div>
          
          {/* Captured Image */}
          <div 
            className="relative w-full h-48 bg-black rounded border border-neutral-800 overflow-hidden flex items-center justify-center cursor-pointer group"
            onClick={() => setIsFullscreen(true)}
            title="คลิกเพื่อขยายเต็มจอ"
          >
             {node.screenshot_base64 ? (
               <img 
                 src={node.screenshot_base64} 
                 alt="Flood Capture" 
                 className="w-full h-full object-contain transition-transform group-hover:scale-105"
               />
             ) : (
               <div className="text-neutral-500">
                 ไม่พบภาพถ่าย (No image captured)
               </div>
             )}
             <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-mono border border-white/20">
               AI ตรวจพบ: {node.detected_objects.join(', ')}
             </div>
          </div>
          
          <div className="text-sm text-neutral-300">
            กรุณายืนยันความถูกต้องของ AI หากกดยืนยัน ระบบจะสร้างพื้นที่หลีกเลี่ยง (Avoidance Zone) รัศมี 5 กิโลเมตร เพื่อคำนวณเส้นทางใหม่ทันที
          </div>
        </div>
        
        {/* Actions */}
        <div className="bg-neutral-950 p-4 border-t border-neutral-800 flex gap-3">
          <button 
            onClick={() => onReject(node.camera_id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <XCircle size={18} />
            ปฏิเสธ (ไม่ใช่ความจริง)
          </button>
          <button 
            onClick={() => onConfirm(node.camera_id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            <CheckCircle size={18} />
            ยืนยันน้ำท่วม
          </button>
        </div>

      </div>
    </div>

    {/* Fullscreen Alert Image */}
    {isFullscreen && node.screenshot_base64 && (
      <div 
        className="fixed inset-0 z-[200] bg-black/95 flex flex-col cursor-pointer animate-in fade-in duration-200"
        onClick={() => setIsFullscreen(false)}
        title="คลิกเพื่อปิด"
      >
        <div className="absolute top-6 right-6 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors z-10">
          <XCircle size={40} />
        </div>
        <div className="flex-1 w-full h-full flex items-center justify-center p-8">
          <img 
            src={node.screenshot_base64} 
            alt="Flood Capture Fullscreen" 
            className="w-full h-full object-contain" 
          />
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-3 rounded-lg text-xl text-white font-mono border border-white/20 text-center pointer-events-none shadow-2xl backdrop-blur-md">
           AI ตรวจพบ: {node.detected_objects.join(', ')}<br/>
           <span className="text-red-400 font-bold">ความลึกระดับวิกฤต: {node.water_depth.toFixed(1)} cm</span>
        </div>
      </div>
    )}
    </>
  );
}
