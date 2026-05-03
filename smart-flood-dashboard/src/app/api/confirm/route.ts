import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // Verify Firebase Auth Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string;

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    } catch {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // Verify admin status in Firestore
    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Forbidden: Not an admin' }, { status: 403 });
    }

    const { camera_id } = await req.json();
    if (!camera_id) {
      return NextResponse.json({ error: 'Missing camera_id' }, { status: 400 });
    }

    // Tell the Python backend to save the current in-memory alert image to disk
    const backendUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';
    const backendRes = await fetch(`${backendUrl}/api/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ camera_id }),
    });

    if (!backendRes.ok) {
      console.warn(`[API/confirm] Backend image save failed for ${camera_id}:`, await backendRes.text());
    }

    const result = await backendRes.json();
    return NextResponse.json({ status: 'success', confirmed_by: uid, ...result });
  } catch (error) {
    console.error('[API/confirm] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
