"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CameraState } from '@/types';
import { Video, AlertTriangle, CheckCircle, Info, Loader, Send, Shield, LogIn, LogOut, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  nodes: CameraState[];
  onNodeClick: (node: CameraState) => void;
  selectedNodeId: string | null;
  isAdmin: boolean;
  onResolve: (nodeId: string) => void;
  getIdToken: () => Promise<string | null>;
}

export default function Sidebar({ nodes, onNodeClick, selectedNodeId, isAdmin, onResolve, getIdToken }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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
    if (!hasConfirmedFloods || !isAdmin) return;
    setIsBroadcasting(true);
    try {
      const token = await getIdToken();
      if (!token) {
        alert('กรุณาล็อกอินใหม่');
        setIsBroadcasting(false);
        return;
      }

      const confirmedIds = nodes.filter(n => n.is_confirmed_critical).map(n => n.camera_id);

      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmedIds }),
      }).catch(() => null);

      if (res && res.ok) {
        alert('ส่งประกาศเตือนภัยพร้อมรูปภาพยืนยัน สำเร็จ!');
      } else {
        alert('เกิดข้อผิดพลาดในการส่ง แจ้งเตือน');
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อ Server ได้');
    }
    setIsBroadcasting(false);
  };

  const handleResolve = async (nodeId: string) => {
    setResolvingId(nodeId);
    await onResolve(nodeId);
    setResolvingId(null);
  };

  return (
    <div className="w-80 h-full glass-panel flex flex-col text-slate-200 shadow-2xl z-10 border-r border-white/5">
      <div className="p-6 border-b border-white/5 bg-gradient-to-b from-blue-500/10 to-transparent">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                <AlertTriangle className="text-blue-400" size={20} />
              </div>
              Flood Detection
            </h1>
            <p className="text-[10px] text-blue-300/60 mt-2 uppercase tracking-[0.2em] font-semibold">Command Center</p>
          </div>

          {/* Auth Button */}
          <div className="flex flex-col items-end gap-1">
            {user ? (
              <>
                {isAdmin && (
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1 font-bold uppercase tracking-wider">
                    <Shield size={10} /> Admin
                  </span>
                )}
                <button
                  onClick={logout}
                  className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1 mt-1"
                  title="ออกจากระบบ"
                >
                  <LogOut size={12} /> ออกจากระบบ
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20 hover:border-blue-500/40"
                title="เข้าสู่ระบบ Admin"
              >
                <LogIn size={12} /> Admin Login
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        <div className="px-1 pb-1 text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
          <span>สถานะกล้อง CCTV</span>
          {nodes.length === 0 && <Loader size={14} className="animate-spin text-blue-400" />}
        </div>

        {nodes.map(node => {
          const statusColors = getStatusColor(node.status);
          const isSelected = selectedNodeId === node.camera_id;

          return (
            <div
              key={node.camera_id}
              onClick={() => onNodeClick(node)}
              className={`p-4 rounded-xl cursor-pointer ${isSelected ? 'glass-card selected' : 'glass-card'
                }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-md ${node.is_processing ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Video size={14} className={node.is_processing ? 'animate-pulse' : ''} />
                  </div>
                  <span className="font-bold text-sm tracking-wide text-slate-200">{node.camera_id}</span>
                </div>
                {getStatusIcon(node.status)}
              </div>

              <div className="text-xs text-slate-400 mb-4 truncate font-medium">
                {node.name}
              </div>

              <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold border ${statusColors} shadow-inner`}>
                <span className="uppercase tracking-wide flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'critical' ? 'bg-red-500' : node.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                  {node.status === 'critical' ? 'วิกฤต' : node.status === 'warning' ? 'เฝ้าระวัง' : 'ปกติ'}
                  {node.is_confirmed_critical && ' (ยืนยันแล้ว)'}
                </span>
                <span className="font-mono text-sm">{node.water_depth.toFixed(1)} cm</span>
              </div>

              {/* Admin-only: Resolve button for confirmed floods */}
              {isAdmin && node.is_confirmed_critical && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResolve(node.camera_id);
                  }}
                  disabled={resolvingId === node.camera_id}
                  className="mt-3 w-full py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {resolvingId === node.camera_id ? (
                    <><Loader size={14} className="animate-spin" /> กำลังดำเนินการ...</>
                  ) : (
                    <><XCircle size={14} /> เคลียร์สถานะน้ำท่วม (Resolve)</>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Admin-only: Broadcast button */}
      {isAdmin && (
        <div className="p-5 border-t border-white/5 bg-slate-900/50 backdrop-blur-md">
          <button
            onClick={handleBroadcastAll}
            disabled={!hasConfirmedFloods || isBroadcasting}
            className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2.5 font-bold transition-all shadow-lg text-sm tracking-wide ${!hasConfirmedFloods
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white active:scale-[0.98] border border-green-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              }`}
          >
            <Send size={18} className={isBroadcasting ? 'animate-pulse' : ''} />
            {isBroadcasting ? 'กำลังส่งข้อมูล...' : `ส่งประกาศเตือนภัย (${nodes.filter(n => n.is_confirmed_critical).length} จุด)`}
          </button>
        </div>
      )}
    </div>
  );
}
