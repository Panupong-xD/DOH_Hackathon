"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Map from '@/components/Map';
import Alert from '@/components/Alert';
import { CameraState } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Dashboard() {
  const { user, isAdmin, getIdToken } = useAuth();
  const [nodes, setNodes] = useState<CameraState[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // SOURCE OF TRUTH: Firestore "confirmed_floods" collection
  // All clients (admin + guest) subscribe via onSnapshot.
  // Red circles are derived ONLY from this set → survives page refresh.
  // ═══════════════════════════════════════════════════════════════
  const [confirmedNodes, setConfirmedNodes] = useState<Set<string>>(new Set());
  const confirmedNodesRef = useRef<Set<string>>(new Set());

  // ═══════════════════════════════════════════════════════════════
  // ALERT SUPPRESSION (session-only, per-camera)
  // After admin clicks [Reject], we temporarily suppress the alert
  // for that camera. But we DON'T add it permanently — the next
  // polling cycle will show the alert again because we only suppress
  // for the *current* render cycle via a simple "dismiss once" flag.
  //
  // After admin clicks [Confirm], the camera enters confirmedNodes
  // which naturally suppresses the alert modal.
  //
  // After admin clicks [Resolve], the camera is removed from
  // confirmedNodes AND from dismissedAlerts, fully re-arming alerts.
  // ═══════════════════════════════════════════════════════════════
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Listen to Firestore confirmed_floods in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'confirmed_floods'),
      (snapshot) => {
        const confirmed = new Set<string>();
        snapshot.forEach(docSnap => confirmed.add(docSnap.id));
        confirmedNodesRef.current = confirmed;
        setConfirmedNodes(confirmed);
      },
      (error) => {
        console.error('Firestore listener error:', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Auto-clear dismissals when water drops below 30cm (re-arm for next flood)
  const autoClearDismissals = useCallback((data: CameraState[]) => {
    setDismissedAlerts(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const cameraId of prev) {
        const node = data.find(n => n.camera_id === cameraId);
        if (node && node.water_depth < 30) {
          next.delete(cameraId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // Poll backend every 3 seconds for AI data
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const baseUrl = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
          ? 'http://127.0.0.1:8000'
          : process.env.NEXT_PUBLIC_API_BASE_URL || 'https://doh-flood-detector.pnbp.store';

        const res = await fetch(`${baseUrl}/api/status`).catch(() => null);

        if (res && res.ok) {
          const data: CameraState[] = await res.json();

          // Re-arm dismissed alerts when water level drops
          autoClearDismissals(data);

          // Merge backend data with Firestore confirmed state
          const mergedData = data.map(node => ({
            ...node,
            is_confirmed_critical: confirmedNodesRef.current.has(node.camera_id),
          }));
          setNodes(mergedData);
        }
      } catch (err) {
        console.error("Dashboard logic error", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [autoClearDismissals]);

  // ═══════════════════════════════════════════════════════════════
  // ALERT STATE MACHINE
  // Show alert only when ALL conditions are true:
  //   1. water_depth >= 30cm (PENDING_ALERT trigger)
  //   2. NOT already confirmed (CONFIRMED_DANGER suppresses alert)
  //   3. NOT temporarily dismissed (Reject just dismisses once)
  //   4. User is admin
  // ═══════════════════════════════════════════════════════════════
  const pendingAlertNode = isAdmin
    ? nodes.find(
        n => n.water_depth >= 30 &&
          !n.is_confirmed_critical &&
          !dismissedAlerts.has(n.camera_id)
      )
    : undefined;

  // ─── CONFIRM ───
  // 1. Tell backend to save the in-memory image to disk (for LINE OA)
  // 2. Write to Firestore → onSnapshot → red circle appears for ALL users
  const handleConfirm = async (nodeId: string) => {
    if (!isAdmin || !user) return;
    try {
      const token = await getIdToken();

      // Tell Python backend to save the alert image to disk
      if (token) {
        await fetch('/api/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ camera_id: nodeId }),
        }).catch(err => console.warn('Confirm API error (non-fatal):', err));
      }

      // Write to Firestore → all clients see the red circle
      await setDoc(doc(db, 'confirmed_floods', nodeId), {
        camera_id: nodeId,
        confirmed_at: serverTimestamp(),
        confirmed_by: user.uid,
      });

      // Remove from dismissed (in case it was dismissed before confirming)
      setDismissedAlerts(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    } catch (err) {
      console.error('Error confirming flood:', err);
    }
  };

  // ─── REJECT ───
  // Just dismiss the modal for THIS render cycle.
  // The alert will re-trigger on the next polling cycle if water is still >= 30cm.
  const handleReject = (nodeId: string) => {
    setDismissedAlerts(prev => {
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  };

  // ─── RESOLVE ───
  // 1. Delete from Firestore → red circle vanishes for ALL users
  // 2. Clear dismissal → re-arm alert if water rises again
  // 3. Tell backend to clean up in-memory snapshot
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
        return;
      }

      // Clear dismissal → alert is fully re-armed
      setDismissedAlerts(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
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
