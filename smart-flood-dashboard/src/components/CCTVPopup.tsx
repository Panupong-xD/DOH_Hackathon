"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CameraState } from '@/types';
import { Car, AlertTriangle, Maximize2, X } from 'lucide-react';

interface CCTVPopupProps {
  node: CameraState;
  onClose?: () => void;
}

export default function CCTVPopup({ node, onClose }: CCTVPopupProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  const getBaseUrl = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://127.0.0.1:8000';
    }
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      return process.env.NEXT_PUBLIC_API_BASE_URL;
    }
    return 'http://127.0.0.1:8000';
  };

  const videoStreamUrl = `${getBaseUrl()}/api/video/${node.camera_id}`;

  return (
    <>
      <div className="w-80 glass-panel text-slate-200 rounded-xl overflow-hidden flex flex-col shadow-2xl relative border-white/10">
        <div className="bg-slate-900/60 p-3 border-b border-white/5 flex justify-between items-center backdrop-blur-sm">
          <span className="font-bold text-sm tracking-wide text-white">{node.camera_id}</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase px-2.5 py-1 rounded-md font-bold shadow-sm ${node.status === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                node.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}>
              {node.status === 'critical' ? 'วิกฤต' : node.status === 'warning' ? 'เฝ้าระวัง' : 'ปกติ'}
              {node.is_confirmed_critical && ' (ยืนยัน)'}
            </span>
            {onClose && (
              <button onClick={onClose} className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded transition-colors ml-1">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Real-time Video Stream */}
        <div className="relative w-full h-44 bg-black group overflow-hidden border-b border-white/5">
          <img
            src={videoStreamUrl}
            alt="Live Stream"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute bottom-2 right-2 p-2 bg-black/50 hover:bg-blue-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md border border-white/10 shadow-lg"
            title="ขยายเต็มหน้าจอ"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        <div className="p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="flex justify-between items-end mb-1">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">ระดับน้ำ (Water Level)</div>
              <div className="text-3xl font-bold font-mono text-white tracking-tight">
                {node.water_depth.toFixed(1)}<span className="text-sm text-slate-500 ml-1">cm</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">AI ตรวจพบ</div>
              <div className="flex gap-1.5 justify-end">
                {node.detected_objects.includes('car') && <div className="bg-blue-500/20 p-1.5 rounded text-blue-400"><Car size={14} /></div>}
                {node.detected_objects.includes('wheel') && <div className="bg-green-500/20 p-1.5 rounded flex items-center justify-center"><div className="w-3 h-3 rounded-full border-2 border-green-400" title="Wheel" /></div>}
                {node.detected_objects.length === 0 && <span className="text-xs text-slate-500 font-mono">-</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Dashboard View - Uses Portal to escape Maps container */}
      {isFullscreen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#020617]/95 backdrop-blur-2xl w-screen h-screen">
          <div className="glass-panel p-4 border-b border-white/5 flex justify-between items-center z-10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-5">
              <span className="font-black text-white text-3xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{node.name} <span className="text-xl text-slate-500 font-mono font-normal">({node.camera_id})</span></span>
              <span className="flex items-center gap-2.5 text-red-400 font-bold uppercase animate-pulse border border-red-500/30 px-3 py-1.5 rounded-lg bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div> LIVE FEED
              </span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors px-4 py-2 bg-slate-800/50 rounded-xl flex items-center gap-2 border border-white/5 shadow-sm"
            >
              <X size={20} /> ปิดหน้าต่าง (Close)
            </button>
          </div>

          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* Left Side: Video Feed */}
            <div className="flex-[3] bg-black/50 p-8 flex items-center justify-center relative">
              <div className="w-full h-full relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                <img
                  src={videoStreamUrl}
                  alt="Live Stream Fullscreen"
                  className="w-full h-full object-contain bg-black"
                />
                <div className="absolute top-6 left-6 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded border border-white/10 text-white/70 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  Edge AI Inference Active
                </div>
              </div>
            </div>

            {/* Right Side: Dashboard Panel */}
            <div className="flex-[1] min-w-[380px] max-w-[480px] glass-panel border-l border-white/5 p-8 flex flex-col gap-6 overflow-y-auto">
              <div className="text-2xl font-black text-white pb-2 flex items-center gap-3">
                <AlertTriangle size={26} className={node.status === 'critical' ? 'text-red-500 glowing-text-red' : 'text-blue-500 glowing-text-blue'} />
                Real-time Telemetry
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-3">Current Status</div>
                <div className={`text-3xl font-black uppercase tracking-tight ${node.status === 'critical' ? 'text-red-500 glowing-text-red' :
                    node.status === 'warning' ? 'text-yellow-400' :
                      'text-green-400'
                  }`}>
                  {node.status}
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-3">Water Depth (ระดับน้ำ)</div>
                <div className="text-6xl font-mono font-black text-white flex items-baseline gap-2 tracking-tighter">
                  {node.water_depth.toFixed(1)} <span className="text-2xl text-slate-500 font-sans tracking-normal font-bold">cm</span>
                </div>
                {node.water_depth >= 30 && (
                  <div className="mt-5 text-sm font-bold text-red-400 bg-red-950/40 p-3 rounded-lg border border-red-500/30 flex items-center gap-2">
                    <AlertTriangle size={16} /> ระดับน้ำเกินเกณฑ์วิกฤต (30 cm)
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-6">
                <div className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-5">AI Detection Matrix</div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <span className="text-slate-200 font-semibold flex items-center gap-3"><Car size={20} className="text-blue-400" /> Vehicles</span>
                    <span className={`font-bold px-3 py-1 rounded text-sm ${node.detected_objects.includes('car') ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                      {node.detected_objects.includes('car') ? 'Detected' : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <span className="text-slate-200 font-semibold flex items-center gap-3"><div className="w-5 h-5 rounded-full border-[3px] border-green-400" /> Wheels</span>
                    <span className={`font-bold px-3 py-1 rounded text-sm ${node.detected_objects.includes('wheel') ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                      {node.detected_objects.includes('wheel') ? 'Detected' : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8 text-[10px] text-slate-500 font-mono text-center tracking-widest uppercase opacity-60">
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
