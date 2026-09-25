import React, { useState, useEffect } from 'react';
import GuestUpload from './components/GuestUpload';
import LiveSlideshow from './components/LiveSlideshow';
import AdminModeration from './components/AdminModeration';
import QRCodeModal from './components/QRCodeModal';
import { getWeddingSettings } from './utils/weddingSettings';
import { Presentation, ShieldCheck, ArrowLeft, Lock, KeyRound, X, LogOut, QrCode as QrIcon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('guest'); // 'guest' | 'slideshow' | 'admin'
  const [isWoAuthenticated, setIsWoAuthenticated] = useState(() => {
    return sessionStorage.getItem('namoo_wo_auth') === 'true';
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [weddingInfo, setWeddingInfo] = useState({ 
    title: 'The Wedding of Rahma & Febi', 
    wedding_date: '27 September 2026' 
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    getWeddingSettings().then((res) => {
      if (res) setWeddingInfo(res);
    });

    const handleSettingsChanged = (e) => {
      if (e.detail) setWeddingInfo(e.detail);
    };

    window.addEventListener('namoo_wedding_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('namoo_wedding_settings_changed', handleSettingsChanged);
  }, []);

  // Password yang sah (bisa diset di .env atau default 'namoo123' / '1234')
  const validPassword = import.meta.env.VITE_WO_PASSWORD || 'namoo123';

  const handleOpenWo = () => {
    if (isWoAuthenticated) {
      setActiveTab('admin');
    } else {
      setPasswordInput('');
      setPasswordError('');
      setShowPasswordModal(true);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const trimmed = passwordInput.trim();
    
    // Verifikasi password (hanya butuh password, tanpa username)
    if (trimmed === validPassword || trimmed === '1234' || trimmed === 'namoo123') {
      setIsWoAuthenticated(true);
      sessionStorage.setItem('namoo_wo_auth', 'true');
      setShowPasswordModal(false);
      setActiveTab('admin');
    } else {
      setPasswordError('Password salah. Silakan coba lagi.');
    }
  };

  const handleWoLogout = () => {
    setIsWoAuthenticated(false);
    sessionStorage.removeItem('namoo_wo_auth');
    setActiveTab('guest');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 
        Halaman Tamu (Guest) - Bersih dan elegan sesuai mockup referensi
      */}
      {activeTab === 'guest' ? (
        <div style={{ position: 'relative' }}>
          {/* Akses QR Acara & Kru WO di pojok kanan atas */}
          <div 
            style={{ 
              position: 'absolute', 
              top: '12px', 
              right: '14px', 
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <button
              onClick={() => setShowQrModal(true)}
              style={{
                background: 'rgba(230, 236, 228, 0.75)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(159, 179, 158, 0.5)',
                color: '#2B3A28',
                borderRadius: '9999px',
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: 0.85,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '0.85')}
              title="Tampilkan QR Code Acara"
            >
              <QrIcon size={12} color="#C49A38" />
              <span>QR Acara</span>
            </button>

            <button
              onClick={handleOpenWo}
              style={{
                background: 'rgba(230, 236, 228, 0.75)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(159, 179, 158, 0.5)',
                color: '#2B3A28',
                borderRadius: '9999px',
                padding: '5px 12px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                opacity: 0.85,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '0.85')}
              title="Akses Kru Wedding Organizer"
            >
              <Lock size={12} />
              <span>Kru WO</span>
            </button>
          </div>

          <GuestUpload 
            onNavigateToGallery={() => setActiveTab('slideshow')} 
            weddingInfo={weddingInfo} 
          />
        </div>
      ) : (
        /* Halaman Slideshow Proyektor atau Dashboard Moderasi WO */
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <header 
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'slideshow' ? '#141a12' : '#FAF9F5',
              borderBottom: activeTab === 'slideshow' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0eae0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 40
            }}
          >
            <button
              onClick={() => setActiveTab('guest')}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === 'slideshow' ? '#e2eae0' : '#2B3A28',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)'
              }}
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Halaman Tamu</span>
            </button>

            {/* Tab switch untuk proyektor & admin */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setActiveTab('slideshow')}
                style={{
                  background: activeTab === 'slideshow' ? '#4F634C' : 'transparent',
                  color: activeTab === 'slideshow' ? '#ffffff' : (activeTab === 'admin' ? '#556353' : '#a2b09f'),
                  border: '1px solid rgba(79, 99, 76, 0.4)',
                  padding: '0.4rem 0.95rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Presentation size={14} />
                Live Gallery
              </button>

              <button
                onClick={handleOpenWo}
                style={{
                  background: activeTab === 'admin' ? '#4F634C' : 'transparent',
                  color: activeTab === 'admin' ? '#ffffff' : (activeTab === 'slideshow' ? '#a2b09f' : '#556353'),
                  border: '1px solid rgba(79, 99, 76, 0.4)',
                  padding: '0.4rem 0.95rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <ShieldCheck size={14} />
                Moderasi WO
              </button>

              {/* Tombol Logout/Kunci jika sedang di dashboard Admin */}
              {activeTab === 'admin' && (
                <button
                  onClick={handleWoLogout}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '9999px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Kunci dashboard & keluar"
                >
                  <LogOut size={13} />
                  <span>Kunci</span>
                </button>
              )}
            </div>
          </header>

          <main style={{ flex: 1 }}>
            {activeTab === 'slideshow' && <LiveSlideshow />}
            {activeTab === 'admin' && (
              isWoAuthenticated ? (
                <AdminModeration />
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <p>Memerlukan password untuk mengakses halaman ini.</p>
                  <button onClick={handleOpenWo} className="btn-primary" style={{ marginTop: '1rem' }}>
                    Masukkan Password
                  </button>
                </div>
              )
            )}
          </main>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL INPUT PASSWORD KRU WO (TANPA USERNAME)              */}
      {/* ======================================================== */}
      {showPasswordModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(20, 26, 19, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#FAF9F5',
              borderRadius: '16px',
              border: '1px solid #9fb39e',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.25)',
              maxWidth: '380px',
              width: '100%',
              padding: '2rem 1.6rem',
              position: 'relative',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tombol Tutup */}
            <button
              onClick={() => setShowPasswordModal(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'none',
                border: 'none',
                color: '#606C5D',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            {/* Ikon Gembok */}
            <div 
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: '#e6ece4',
                color: '#2B3A28',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
                border: '1.5px solid #9fb39e'
              }}
            >
              <KeyRound size={26} />
            </div>

            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: '#2B3A28', margin: '0 0 0.3rem 0' }}>
              Akses Kru WO
            </h3>
            <p style={{ color: '#606C5D', fontSize: '0.86rem', margin: '0 0 1.4rem 0', lineHeight: 1.4 }}>
              Masukkan password untuk membuka dashboard moderasi foto.
            </p>

            <form onSubmit={handlePasswordSubmit}>
              <div style={{ marginBottom: '1.2rem', textAlign: 'left' }}>
                <input 
                  type="password"
                  placeholder="Masukkan Password WO"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError('');
                  }}
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#E6ECE4',
                    border: passwordError ? '1.5px solid #dc2626' : '1.5px solid #9FB39E',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    fontSize: '1rem',
                    color: '#2B3A28',
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    letterSpacing: '0.15em'
                  }}
                />

                {passwordError && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.4rem', textAlign: 'center' }}>
                    {passwordError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  type="submit"
                  style={{
                    backgroundColor: '#4F634C',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(43, 58, 40, 0.2)'
                  }}
                >
                  Buka Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#738271',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    padding: '0.3rem'
                  }}
                >
                  Batal
                </button>
              </div>

              <div style={{ fontSize: '0.72rem', color: '#9aa898', marginTop: '1rem' }}>
                Default password: <code>namoo123</code>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code Acara */}
      <QRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        weddingInfo={weddingInfo}
      />

    </div>
  );
}
