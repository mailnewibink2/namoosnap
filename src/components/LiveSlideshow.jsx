import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Heart, 
  Image as ImageIcon,
  Clock,
  Radio,
  QrCode as QrIcon
} from 'lucide-react';
import { getWeddingSettings } from '../utils/weddingSettings';
import QRCodeModal from './QRCodeModal';

export default function LiveSlideshow() {
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideInterval, setSlideInterval] = useState(6000); // 6 detik per foto
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newPhotoAlert, setNewPhotoAlert] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [weddingInfo, setWeddingInfo] = useState({ title: '', wedding_date: '' });

  const containerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    getWeddingSettings().then((res) => {
      if (res) setWeddingInfo(res);
    });
  }, []);

  // 1. Ambil data foto yang sudah disetujui (is_approved = true)
  const fetchApprovedPhotos = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error mengambil foto:', error.message);
        return;
      }

      setPhotos(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Setup Supabase Realtime Subscription
  useEffect(() => {
    fetchApprovedPhotos();

    if (!isSupabaseConfigured) return;

    // Dengarkan perubahan real-time pada tabel 'photos'
    const channel = supabase
      .channel('live-slideshow-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT') {
            // Jika foto baru masuk dan langsung approved (atau auto-approved)
            if (newRecord.is_approved) {
              setPhotos((prev) => [newRecord, ...prev]);
              triggerNewPhotoAlert(newRecord);
            }
          } else if (eventType === 'UPDATE') {
            setPhotos((prev) => {
              const exists = prev.some((p) => p.id === newRecord.id);

              if (newRecord.is_approved) {
                if (exists) {
                  return prev.map((p) => (p.id === newRecord.id ? newRecord : p));
                } else {
                  triggerNewPhotoAlert(newRecord);
                  return [newRecord, ...prev];
                }
              } else {
                // Jika status approval dicabut
                return prev.filter((p) => p.id !== newRecord.id);
              }
            });
          } else if (eventType === 'DELETE') {
            setPhotos((prev) => prev.filter((p) => p.id !== oldRecord.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime Slideshow subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchApprovedPhotos]);

  // Notifikasi foto baru muncul di slideshow
  const triggerNewPhotoAlert = (photo) => {
    setNewPhotoAlert(`✨ Foto baru dari ${photo.guest_name}!`);
    setTimeout(() => {
      setNewPhotoAlert(null);
    }, 4500);
  };

  // 3. Rotasi Slideshow Otomatis
  useEffect(() => {
    if (!isPlaying || photos.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, slideInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, photos.length, slideInterval]);

  // Navigasi Manual
  const handleNext = () => {
    if (photos.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const handlePrev = () => {
    if (photos.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  // Toggle Fullscreen Mode untuk Proyektor
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const currentPhoto = photos[currentIndex];

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: isFullscreen ? '100vh' : 'calc(100vh - 80px)',
        backgroundColor: '#1a1f18', // Nuansa dark forest / deep sage elegan untuk proyektor
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Top Bar / Header */}
      <header 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.2rem 2rem',
          background: 'linear-gradient(to bottom, rgba(20,26,18,0.95), transparent)',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div 
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-gold-400), var(--color-sage-600))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 15px rgba(223, 183, 108, 0.4)',
            }}
          >
            <Heart size={20} fill="#ffffff" />
          </div>
          <div>
            <h1 
              style={{ 
                fontFamily: 'var(--font-serif)', 
                fontSize: '1.75rem', 
                margin: 0,
                color: '#fff',
                letterSpacing: '0.02em',
                lineHeight: 1.1
              }}
            >
              Namoo Snap - Live Gallery
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#c5d2c0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Radio size={12} color="#4ade80" className="animate-pulse" />
              Live Slideshow Proyektor • {photos.length} Momen Terabadikan
            </p>
          </div>
        </div>

        {/* Real-time Indicator & Fullscreen toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {newPhotoAlert && (
            <div 
              style={{
                background: 'rgba(223, 183, 108, 0.25)',
                border: '1px solid var(--color-gold-400)',
                color: 'var(--color-gold-400)',
                padding: '0.4rem 0.9rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.82rem',
                fontWeight: 600,
                animation: 'bounce 1s ease infinite',
              }}
            >
              {newPhotoAlert}
            </div>
          )}

          <button
            onClick={() => setShowQrModal(true)}
            style={{
              background: 'rgba(223, 183, 108, 0.2)',
              border: '1px solid var(--color-gold-400)',
              color: 'var(--color-gold-400)',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
            }}
            title="Tampilkan QR Code untuk Tamu"
          >
            <QrIcon size={15} />
            <span>QR Code</span>
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              backdropFilter: 'blur(8px)',
            }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              padding: '0.5rem 0.8rem',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              backdropFilter: 'blur(8px)',
            }}
            title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh (Proyektor)'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Stage Display Foto */}
      <div 
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem 2rem',
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#c5d2c0' }}>
            <Sparkles size={40} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--color-gold-400)' }} />
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>Memuat Galeri Live Pernikahan...</p>
          </div>
        ) : photos.length === 0 ? (
          /* Empty State */
          <div 
            style={{ 
              textAlign: 'center', 
              maxWidth: '480px',
              padding: '2.5rem',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <ImageIcon size={54} color="var(--color-gold-400)" style={{ margin: '0 auto 1rem auto' }} />
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '0.5rem', color: '#f5f0e6' }}>
              Menunggu Momen Pertama
            </h2>
            <p style={{ color: '#a5b5a0', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              Foto yang diunggah para tamu dan telah disetujui oleh Wedding Organizer akan langsung tampil secara otomatis di sini secara real-time.
            </p>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-gold-400)' }}>
              Scan QR Code untuk mulai mengunggah foto Anda!
            </div>
          </div>
        ) : (
          /* Active Slideshow Photo */
          <div 
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              maxHeight: isFullscreen ? '85vh' : '72vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Foto Utama */}
            <img 
              key={currentPhoto?.id}
              src={currentPhoto?.image_url} 
              alt={`Foto dari ${currentPhoto?.guest_name}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                border: '3px solid rgba(255, 255, 255, 0.15)',
                animation: 'fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />

            {/* Floating Glassmorphic Caption Card */}
            <div 
              style={{
                position: 'absolute',
                bottom: '1.8rem',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(23, 29, 21, 0.88)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(223, 183, 108, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.6rem',
                maxWidth: '85%',
                width: '540px',
                textAlign: 'center',
                boxShadow: '0 12px 35px rgba(0,0,0,0.5)',
                zIndex: 20,
              }}
            >
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '0.4rem', 
                  color: 'var(--color-gold-400)',
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontWeight: 600,
                  marginBottom: '0.2rem'
                }}
              >
                <Sparkles size={13} />
                Dari Tamu Terkasih
              </div>
              <h3 
                style={{ 
                  fontFamily: 'var(--font-serif)', 
                  fontSize: '1.5rem', 
                  margin: '0.1rem 0 0.4rem 0',
                  color: '#ffffff'
                }}
              >
                {currentPhoto?.guest_name}
              </h3>
              {currentPhoto?.message && (
                <p 
                  style={{ 
                    fontSize: '0.98rem', 
                    fontStyle: 'italic', 
                    color: '#e4ede1', 
                    margin: 0,
                    lineHeight: 1.4
                  }}
                >
                  "{currentPhoto?.message}"
                </p>
              )}
            </div>

            {/* Navigasi Panah Kiri & Kanan */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '46px',
                    height: '46px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(6px)',
                  }}
                  title="Foto Sebelumnya"
                >
                  <ChevronLeft size={24} />
                </button>

                <button
                  onClick={handleNext}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '46px',
                    height: '46px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(6px)',
                  }}
                  title="Foto Selanjutnya"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {photos.length > 1 && (
        <div 
          style={{
            padding: '0.8rem 1.5rem',
            background: 'rgba(15, 20, 14, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            overflowX: 'auto',
            zIndex: 30,
          }}
        >
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => {
                setCurrentIndex(index);
                setIsPlaying(false);
              }}
              style={{
                border: index === currentIndex ? '2px solid var(--color-gold-400)' : '2px solid transparent',
                borderRadius: '6px',
                padding: 0,
                background: 'none',
                cursor: 'pointer',
                opacity: index === currentIndex ? 1 : 0.45,
                transform: index === currentIndex ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.25s',
                overflow: 'hidden',
                width: '48px',
                height: '48px',
                flexShrink: 0,
              }}
            >
              <img 
                src={photo.image_url} 
                alt="" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Keyframe Styling */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Modal QR Code untuk Proyektor / Tamu */}
      <QRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        weddingInfo={weddingInfo}
      />
    </div>
  );
}
