"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Mail, Lock, Eye, EyeOff, Shield, Loader } from 'lucide-react';

export default function LoginPage() {
  const { user, isAdmin, loginWithEmail, loginWithGoogle, logout, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in as admin
  React.useEffect(() => {
    if (!loading && user && isAdmin) {
      router.push('/');
    }
  }, [user, isAdmin, loading, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
      router.push('/');
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      switch (firebaseError.code) {
        case 'auth/user-not-found':
          setError('ไม่พบบัญชีนี้ในระบบ');
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
          break;
        case 'auth/too-many-requests':
          setError('มีการพยายามล็อกอินมากเกินไป กรุณารอสักครู่');
          break;
        default:
          setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    }
    setIsSubmitting(false);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code !== 'auth/popup-closed-by-user') {
        setError('เกิดข้อผิดพลาดในการล็อกอินด้วย Google');
      }
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <Loader size={32} className="animate-spin text-blue-400" />
      </div>
    );
  }

  // Show message if logged in but not admin
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4"
        style={{
          backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(30, 58, 138, 0.2), transparent 25%), radial-gradient(circle at 85% 30%, rgba(15, 118, 110, 0.15), transparent 25%)'
        }}
      >
        <div className="glass-panel rounded-2xl p-8 max-w-md w-full text-center">
          <div className="p-4 bg-yellow-500/10 rounded-full w-fit mx-auto mb-4 border border-yellow-500/30">
            <Shield size={40} className="text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">สิทธิ์ไม่เพียงพอ</h2>
          <p className="text-slate-400 text-sm mb-6">
            บัญชี <span className="text-white font-medium">{user.email}</span> ไม่ได้รับสิทธิ์ Admin
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-white/5 font-medium"
            >
              กลับหน้าหลัก
            </button>
            <button
              onClick={async () => {
                await logout();
                window.location.reload();
              }}
              className="flex-1 py-3 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors border border-red-500/30 font-medium"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(30, 58, 138, 0.25), transparent 30%), radial-gradient(circle at 85% 30%, rgba(15, 118, 110, 0.2), transparent 30%), radial-gradient(circle at 50% 80%, rgba(124, 58, 237, 0.15), transparent 25%)'
      }}
    >
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-xl shadow-[0_0_25px_rgba(59,130,246,0.4)] border border-blue-400/30">
              <AlertTriangle className="text-blue-400" size={28} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">
            Flood Detection
          </h1>
          <p className="text-sm text-blue-300/60 uppercase tracking-[0.25em] font-semibold">
            Admin Command Center
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-8">
            <h2 className="text-lg font-bold text-white mb-1">เข้าสู่ระบบ Admin</h2>
            <p className="text-xs text-slate-400 mb-6">ใช้สำหรับเจ้าหน้าที่จัดการระบบเตือนภัยน้ำท่วม</p>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2 block">อีเมล</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full bg-slate-900/60 border border-white/10 text-white pl-12 pr-4 py-3.5 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2 block">รหัสผ่าน</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/60 border border-white/10 text-white pl-12 pr-12 py-3.5 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all placeholder:text-slate-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-[0.98] border border-blue-400/30 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader size={18} className="animate-spin" /> กำลังเข้าสู่ระบบ...</>
                ) : (
                  <><Shield size={18} /> เข้าสู่ระบบ</>
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[#0f172a] text-slate-500 uppercase tracking-widest font-semibold">หรือ</span>
              </div>
            </div>

            <button
              id="login-google"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white font-medium text-sm transition-all border border-white/10 hover:border-white/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              เข้าสู่ระบบด้วย Google
            </button>
          </div>

          <div className="bg-slate-900/40 px-8 py-4 border-t border-white/5">
            <button
              onClick={() => router.push('/')}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium"
            >
              ← กลับไปหน้า Dashboard (โหมดสาธารณะ)
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6 uppercase tracking-[0.2em]">
          Smart Flood Monitoring System v0.1
        </p>
      </div>
    </div>
  );
}
