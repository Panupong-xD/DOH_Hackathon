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

    // Verify admin status
    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Forbidden: Not an admin' }, { status: 403 });
    }

    // Get camera_id to resolve
    const { camera_id } = await req.json();
    if (!camera_id) {
      return NextResponse.json({ error: 'Missing camera_id' }, { status: 400 });
    }

    // Delete the confirmed flood from Firestore
    await adminDb.collection('confirmed_floods').doc(camera_id).delete();

    return NextResponse.json({
      status: 'success',
      message: `Flood zone ${camera_id} resolved`,
      resolved_by: uid,
    });
  } catch (error) {
    console.error('[API/resolve] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
