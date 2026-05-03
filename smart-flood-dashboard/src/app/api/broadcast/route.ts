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

    // Get confirmed camera IDs from request body
    const { confirmedIds } = await req.json();
    if (!confirmedIds || !Array.isArray(confirmedIds) || confirmedIds.length === 0) {
      return NextResponse.json({ error: 'No confirmed IDs provided' }, { status: 400 });
    }

    // Proxy the broadcast request to the Python backend
    const backendUrl = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';

    const backendRes = await fetch(`${backendUrl}/api/broadcast_all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirmedIds),
    });

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      return NextResponse.json(
        { error: 'Backend broadcast failed', detail: errorText },
        { status: backendRes.status }
      );
    }

    const result = await backendRes.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API/broadcast] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
