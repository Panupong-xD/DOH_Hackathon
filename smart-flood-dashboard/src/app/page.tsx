"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Map from '@/components/Map';
import Alert from '@/components/Alert';
import { CameraState } from '@/types';

export default function Dashboard() {
  const [nodes, setNodes] = useState<CameraState[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Frontend state for confirmed/rejected
  const [confirmedNodes, setConfirmedNodes] = useState<Set<string>>(new Set());
  const [rejectedNodes, setRejectedNodes] = useState<Set<string>>(new Set());

  // Fetch data from FastAPI Backend
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const baseUrl = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
          ? 'http://127.0.0.1:8000'
          : 'https://doh-flood-detector.pnbp.store';

        const res = await fetch(`${baseUrl}/api/status`).catch(() => null);

        if (res && res.ok) {
          const data: CameraState[] = await res.json();
          const mergedData = data.map(node => ({
            ...node,
            is_confirmed_critical: confirmedNodes.has(node.camera_id),
            is_rejected: rejectedNodes.has(node.camera_id)
          }));
          setNodes(mergedData);
        }
      } catch (err) {
        console.error("Dashboard logic error", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [confirmedNodes, rejectedNodes]);

  // แจ้งเตือนเฉพาะจุดที่วิกฤตจริงๆ (30cm ขึ้นไป) และยังไม่ได้จัดการ
  const pendingAlertNode = nodes.find(
    n => n.water_depth >= 30 &&
      !n.is_confirmed_critical &&
      !n.is_rejected
  );

  const handleConfirm = (nodeId: string) => {
    setConfirmedNodes(prev => {
      const newSet = new Set(prev);
      newSet.add(nodeId);
      return newSet;
    });
  };

  const handleReject = (nodeId: string) => {
    setRejectedNodes(prev => {
      const newSet = new Set(prev);
      newSet.add(nodeId);
      return newSet;
    });
  };

  const handleNodeSelect = (node: CameraState | null) => {
    setSelectedNodeId(node ? node.camera_id : null);
  };

  return (
    <main className="flex h-screen w-screen bg-black overflow-hidden font-sans">
      {pendingAlertNode && (
        <Alert
          node={pendingAlertNode}
          onConfirm={handleConfirm}
          onReject={handleReject}
        />
      )}

      <Sidebar
        nodes={nodes}
        onNodeClick={handleNodeSelect}
        selectedNodeId={selectedNodeId}
      />

      <div className="flex-1 relative">
        <Map
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
        />
      </div>
    </main>
  );
}
