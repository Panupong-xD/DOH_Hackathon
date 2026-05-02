"use client";

import React, { useState } from 'react';
import { CameraState } from '@/types';
import { Video, AlertTriangle, CheckCircle, Info, Loader, Send } from 'lucide-react';

interface SidebarProps {
  nodes: CameraState[];
  onNodeClick: (node: CameraState) => void;
  selectedNodeId: string | null;
}

export default function Sidebar({ nodes, onNodeClick, selectedNodeId }: SidebarProps) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'normal': return 'text-green-500 bg-green-500/10 border-green-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle size={18} className="text-red-500 animate-pulse" />;
      case 'warning': return <AlertTriangle size={18} className="text-yellow-500" />;
      case 'normal': return <CheckCircle size={18} className="text-green-500" />;
      default: return <Info size={18} className="text-gray-500" />;
    }
  };

  const hasConfirmedFloods = nodes.some(n => n.is_confirmed_critical);

  const handleBroadcastAll = async () => {
    if (!hasConfirmedFloods) return;
    setIsBroadcasting(true);
    try {
      const baseUrl = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
        ? 'http://127.0.0.1:8000'
        : 'https://doh-flood-detector.pnbp.store';

      // ดึง ID ของกล้องที่กดยืนยันแล้ว
      const confirmedIds = nodes.filter(n => n.is_confirmed_critical).map(n => n.camera_id);

      const res = await fetch(`${baseUrl}/api/broadcast_all`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmedIds)
      }).catch(() => null);
      
      if (res && res.ok) {
        alert('ส่งประกาศเตือนภัยพร้อมรูปภาพยืนยัน สำเร็จ!');
      } else {
        alert('เกิดข้อผิดพลาดในการส่ง แจ้งเตือน');
      }
    } catch (e) {
      alert('ไม่สามารถเชื่อมต่อ Server ได้');
    }
    setIsBroadcasting(false);
  };

  return (
    <div className="w-80 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 shadow-xl z-10">
      <div className="p-5 border-b border-neutral-800">
        <h1 className="text-xl font-bold tracking-wider text-white flex items-center gap-2">
          <AlertTriangle className="text-blue-500" />
          ระบบแจ้งเตือนน้ำท่วมอัจฉริยะ
        </h1>
        <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest">ศูนย์ควบคุม (Command Center)</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="px-2 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider flex justify-between items-center">
          <span>สถานะกล้อง CCTV</span>
          {nodes.length === 0 && <Loader size={14} className="animate-spin text-neutral-500" />}
        </div>
        
        {nodes.map(node => {
          const statusColors = getStatusColor(node.status);
          const isSelected = selectedNodeId === node.camera_id;
          
          return (
            <div 
              key={node.camera_id}
              onClick={() => onNodeClick(node)}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                isSelected ? 'bg-neutral-800 border-neutral-600 shadow-md' : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <Video size={16} className={`text-neutral-400 ${node.is_processing ? 'text-blue-400 animate-pulse' : ''}`} />
                  <span className="font-semibold text-sm">{node.camera_id}</span>
                </div>
                {getStatusIcon(node.status)}
              </div>
              
              <div className="text-xs text-neutral-400 mb-2 truncate">
                {node.name}
              </div>
              
              <div className={`mt-2 flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium border ${statusColors}`}>
                <span className="uppercase">
                  {node.status === 'critical' ? 'วิกฤต' : node.status === 'warning' ? 'เฝ้าระวัง' : 'ปกติ'}
                  {node.is_confirmed_critical && ' (ยืนยันแล้ว)'}
                </span>
                <span>{node.water_depth.toFixed(1)} cm</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-neutral-800 bg-neutral-950">
        <button
          onClick={handleBroadcastAll}
          disabled={!hasConfirmedFloods || isBroadcasting}
          className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all shadow-lg ${
            !hasConfirmedFloods 
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
              : 'bg-green-600 hover:bg-green-500 text-white active:scale-95'
          }`}
        >
          <Send size={20} className={isBroadcasting ? 'animate-pulse' : ''} />
          {isBroadcasting ? 'กำลังส่ง...' : `📢 ส่งประกาศ Line (${nodes.filter(n => n.is_confirmed_critical).length} จุด)`}
        </button>
      </div>
    </div>
  );
}
