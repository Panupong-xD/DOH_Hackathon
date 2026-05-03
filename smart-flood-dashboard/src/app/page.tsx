"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Map from '@/components/Map';
import Alert from '@/components/Alert';
import { CameraState } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { collection, onSnapshot, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Dashboard() {
  const { user, isAdmin, getIdToken } = useAuth();
  const [nodes, setNodes] = useState<CameraState[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Firestore-backed confirmed floods (real-time sync)
  const [confirmedNodes, setConfirmedNodes] = useState<Set<string>>(new Set());
  // Local-only rejected state (session-specific)
  const [rejectedNodes, setRejectedNodes] = useState<Set<string>>(new Set());

  // Listen to Firestore confirmed_floods collection in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'confirmed_floods'),
      (snapshot) => {
        const confirmed = new Set<string>();
        snapshot.forEach(docSnap => confirmed.add(docSnap.id));
        setConfirmedNodes(confirmed);
      },
      (error) => {
        console.error('Firestore listener error:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch data from FastAPI Backend
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const baseUrl = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
          ? 'http://127.0.0.1:8000'
          : process.env.NEXT_PUBLIC_API_BASE_URL || 'https://doh-flood-detector.pnbp.store';

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
  // Only show alert popup to admins
  const pendingAlertNode = isAdmin
    ? nodes.find(
        n => n.water_depth >= 30 &&
          !n.is_confirmed_critical &&
          !n.is_rejected
      )
    : undefined;

  const handleConfirm = async (nodeId: string) => {
    if (!isAdmin || !user) return;
    try {
      // Write to Firestore - onSnapshot will update confirmedNodes automatically
      await setDoc(doc(db, 'confirmed_floods', nodeId), {
        camera_id: nodeId,
        confirmed_at: serverTimestamp(),
        confirmed_by: user.uid,
      });
    } catch (err) {
      console.error('Error confirming flood:', err);
    }
  };

  const handleReject = (nodeId: string) => {
    setRejectedNodes(prev => {
      const newSet = new Set(prev);
      newSet.add(nodeId);
      return newSet;
    });
  };

  const handleResolve = async (nodeId: string) => {
    if (!isAdmin) return;
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ camera_id: nodeId }),
      });

      if (!res.ok) {
        console.error('Resolve failed:', await res.text());
      }
      // Firestore onSnapshot will automatically update the UI
    } catch (err) {
      console.error('Error resolving flood:', err);
    }
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
        isAdmin={isAdmin}
        onResolve={handleResolve}
        getIdToken={getIdToken}
      />

      <div className="flex-1 relative">
        <Map
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onNodeSelect={handleNodeSelect}
          isAdmin={isAdmin}
          onResolve={handleResolve}
        />
      </div>
    </main>
  );
}
