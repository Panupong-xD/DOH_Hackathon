"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CameraState } from '@/types';
import { Car, AlertTriangle, Maximize2, X } from 'lucide-react';

interface CCTVPopupProps {
  node: CameraState;
}

export default function CCTVPopup({ node }: CCTVPopupProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getStatusColorHex = (status: string) => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#eab308';
      default: return '#22c55e';
    }
  };

  const getBaseUrl = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://127.0.0.1:8000';
    }
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
  };

  const videoStreamUrl = `${getBaseUrl()}/api/video/${node.camera_id}`;

  return (
    <>
      <div className="w-80 bg-neutral-900 text-neutral-200 rounded-lg overflow-hidden flex flex-col shadow-2xl border border-neutral-700">
        <div className="bg-neutral-950 p-2 border-b border-neutral-800 flex justify-between items-center">
          <span className="font-bold text-sm tracking-wide">{node.camera_id}</span>
          <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${node.status === 'critical' ? 'bg-red-500/20 text-red-500' :
              node.status === 'warning' ? 'bg-yellow-500/20 text-yellow-500' :
                'bg-green-500/20 text-green-500'
            }`}>
            {node.status === 'critical' ? 'วิกฤต' : node.status === 'warning' ? 'เฝ้าระวัง' : 'ปกติ'}
            {node.is_confirmed_critical && ' (ยืนยัน)'}
          </span>
        </div>

        {/* Real-time Video Stream */}
        <div className="relative w-full h-40 bg-black group overflow-hidden">
          <img
            src={videoStreamUrl}
            alt="Live Stream"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="ขยายเต็มหน้าจอ"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        <div className="p-3 bg-neutral-900">
          <div className="flex justify-between items-end mb-2">
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">ระดับน้ำ (Water Level)</div>
              <div className="text-2xl font-bold font-mono">
                {node.water_depth.toFixed(1)}<span className="text-sm text-neutral-500">cm</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">AI ตรวจพบ</div>
              <div className="flex gap-1 justify-end">
                {node.detected_objects.includes('car') && <Car size={14} className="text-blue-400" title="Car" />}
                {node.detected_objects.includes('wheel') && <div className="w-3 h-3 rounded-full border-2 border-green-400" title="Wheel" />}
                {node.detected_objects.length === 0 && <span className="text-xs text-neutral-500">-</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Dashboard View - Uses Portal to escape Maps container */}
      {isFullscreen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black w-screen h-screen">
          <div className="bg-neutral-950 p-4 border-b border-neutral-800 flex justify-between items-center z-10 shadow-lg">
            <div className="flex items-center gap-4">
              <span className="font-bold text-white text-2xl">{node.name} ({node.camera_id})</span>
              <span className="flex items-center gap-2 text-red-500 font-bold uppercase animate-pulse border border-red-500/30 px-3 py-1 rounded bg-red-500/10">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div> LIVE FEED
              </span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="text-neutral-400 hover:text-white hover:bg-red-500/20 hover:text-red-500 transition-colors p-2 bg-neutral-900 rounded-lg flex items-center gap-2"
            >
              <X size={24} /> ปิดหน้าต่าง (Close)
            </button>
          </div>

          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Left Side: Video Feed */}
            <div className="flex-[3] bg-black p-6 flex items-center justify-center relative">
              <img
                src={videoStreamUrl}
                alt="Live Stream Fullscreen"
                className="w-full h-full object-contain border border-neutral-800 rounded-xl shadow-2xl"
              />
              <div className="absolute top-10 left-10 text-white/50 font-mono text-sm">
                AI Inference Running @ Edge Node
              </div>
            </div>

            {/* Right Side: Dashboard Panel */}
            <div className="flex-[1] min-w-[350px] max-w-[450px] bg-neutral-950 border-l border-neutral-800 p-8 flex flex-col gap-8 overflow-y-auto">
              <div className="text-2xl font-bold text-white border-b border-neutral-700 pb-4 flex items-center gap-3">
                <AlertTriangle size={28} className={node.status === 'critical' ? 'text-red-500' : 'text-blue-500'} />
                Real-time Telemetry
              </div>

              <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                <div className="text-neutral-400 text-sm uppercase font-bold tracking-wider mb-2">Current Status</div>
                <div className={`text-2xl font-bold uppercase ${node.status === 'critical' ? 'text-red-500' :
                    node.status === 'warning' ? 'text-yellow-500' :
                      'text-green-500'
                  }`}>
                  {node.status}
                </div>
              </div>

              <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                <div className="text-neutral-400 text-sm uppercase font-bold tracking-wider mb-2">Water Depth (ระดับน้ำ)</div>
                <div className="text-5xl font-mono font-bold text-white flex items-baseline gap-2">
                  {node.water_depth.toFixed(1)} <span className="text-xl text-neutral-500">cm</span>
                </div>
                {node.water_depth >= 30 && (
                  <div className="mt-3 text-sm text-red-400 bg-red-950/50 p-2 rounded border border-red-900">
                    ⚠️ ระดับน้ำเกินเกณฑ์วิกฤต (30 cm)
                  </div>
                )}
              </div>

              <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                <div className="text-neutral-400 text-sm uppercase font-bold tracking-wider mb-4">AI Detection Matrix</div>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center bg-neutral-950 p-3 rounded">
                    <span className="text-white flex items-center gap-2"><Car size={20} className="text-blue-400" /> Vehicles</span>
                    <span className="font-bold">{node.detected_objects.includes('car') ? 'Detected' : 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-neutral-950 p-3 rounded">
                    <span className="text-white flex items-center gap-2"><div className="w-5 h-5 rounded-full border-[3px] border-green-400" /> Wheels</span>
                    <span className="font-bold">{node.detected_objects.includes('wheel') ? 'Detected' : 'None'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-neutral-800 text-xs text-neutral-500 font-mono text-center">
                System Version: 0.1-alpha<br />
                Lat: {node.location.lat.toFixed(4)} | Lng: {node.location.lng.toFixed(4)}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
