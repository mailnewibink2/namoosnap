import React, { useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  AlertCircle, 
  Heart, 
  X, 
  Loader2,
  RefreshCw,
  FileCheck
} from 'lucide-react';

export default function GuestUpload({ onNavigateToGallery }) {
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [originalFile, setOriginalFile] = useState(null);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [compressionInfo, setCompressionInfo] = useState(null);
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fileInputCameraRef = useRef(null);
  const fileInputGalleryRef = useRef(null);

  // Kompresi Gambar menggunakan Canvas API (Maks 1200px, Kualitas 0.8)
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const MAX_WIDTH = 1200;
      const QUALITY = 0.8;

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;

        img.onload = () => {
          let targetWidth = img.width;
          let targetHeight = img.height;

          if (targetWidth > MAX_WIDTH) {
            targetHeight = Math.round((targetHeight * MAX_WIDTH) / targetWidth);
            targetWidth = MAX_WIDTH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Gagal mengompres gambar'));
                return;
              }

              const originalSizeKB = (file.size / 1024).toFixed(1);
              const compressedSizeKB = (blob.size / 1024).toFixed(1);
              const savedPercent = Math.round(((file.size - blob.size) / file.size) * 100);

              resolve({
                blob,
                previewUrl: URL.createObjectURL(blob),
                width: targetWidth,
                height: targetHeight,
                originalSizeKB,
                compressedSizeKB,
                savedPercent: savedPercent > 0 ? savedPercent : 0,
              });
            },
            'image/jpeg',
            QUALITY
          );
        };

        img.onerror = () => reject(new Error('Gagal memproses file gambar'));
      };

      reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({
        type: 'error',
        text: 'Harap pilih file gambar (JPG, PNG, WebP).',
      });
      return;
    }

    try {
      setIsCompressing(true);
      setStatusMessage({ type: '', text: '' });
      setOriginalFile(file);

      const result = await compressImage(file);
      setCompressedBlob(result.blob);
      setPreviewUrl(result.previewUrl);
      setCompressionInfo({
        originalSizeKB: result.originalSizeKB,
        compressedSizeKB: result.compressedSizeKB,
        savedPercent: result.savedPercent,
        dimensions: `${result.width} × ${result.height}px`,
      });
    } catch (err) {
      console.error('Error saat kompresi:', err);
      setStatusMessage({
        type: 'error',
        text: 'Terjadi kesalahan saat memproses gambar.',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemovePhoto = (e) => {
    if (e) e.stopPropagation();
    setOriginalFile(null);
    setCompressedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setCompressionInfo(null);
    if (fileInputCameraRef.current) fileInputCameraRef.current.value = '';
    if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!compressedBlob) {
      setStatusMessage({ type: 'error', text: 'Silakan ambil atau pilih foto terlebih dahulu.' });
      return;
    }

    if (!guestName.trim()) {
      setStatusMessage({ type: 'error', text: 'Silakan isi Nama Tamu / Sahabat.' });
      return;
    }

    if (!isSupabaseConfigured) {
      setStatusMessage({
        type: 'error',
        text: 'Konfigurasi Supabase belum lengkap di file .env.',
      });
      return;
    }

    try {
      setIsUploading(true);
      setStatusMessage({ type: '', text: '' });

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const cleanGuestName = guestName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
      const fileName = `${timestamp}_${cleanGuestName}_${randomStr}.jpg`;
      const filePath = `uploads/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('wedding-photos')
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Gagal upload storage: ${storageError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('wedding-photos')
        .getPublicUrl(filePath);

      const publicImageUrl = urlData?.publicUrl;

      if (!publicImageUrl) {
        throw new Error('Gagal mendapatkan public URL gambar dari Supabase.');
      }

      const { error: dbError } = await supabase
        .from('photos')
        .insert([
          {
            guest_name: guestName.trim(),
            message: message.trim() || 'Selamat berbahagia untuk kedua mempelai!',
            image_url: publicImageUrl,
            is_approved: false,
          },
        ]);

      if (dbError) {
        throw new Error(`Gagal menyimpan data foto: ${dbError.message}`);
      }

      setIsSubmitted(true);

      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#4F634C', '#dfb76c', '#FAF9F5', '#2E3E2B', '#ffffff'],
      });

    } catch (err) {
      console.error('Upload error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Terjadi kesalahan saat mengunggah foto.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadAnother = () => {
    handleRemovePhoto();
    setMessage('');
    setIsSubmitted(false);
    setStatusMessage({ type: '', text: '' });
  };

  return (
    <div 
      style={{
        position: 'relative',
        minHeight: '100vh',
        backgroundColor: '#FAF9F5',
        color: '#283625',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2.4rem 1.4rem 6rem 1.4rem',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Ornamen Bunga Mawar & Daun Eucalyptus di Pojok Kiri Bawah */}
      <img 
        src="/roses-corner.jpg" 
        alt="Wedding Floral Ornament"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '180px',
          maxWidth: '45vw',
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
          opacity: 0.95,
          zIndex: 0,
        }}
      />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        
        {/* ======================================================== */}
        {/* LOGO & HEADER SESUAI GAMBAR                              */}
        {/* ======================================================== */}
        <div style={{ textAlign: 'center', marginBottom: '1.6rem' }}>
          {/* Logo Gambar Kustom */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
            <img 
              src="/namoo-logo.png" 
              alt="Namoo Snap - Wedding Photo Share"
              style={{
                width: '138px',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          {/* Subtitle / Headline */}
          <h2 
            style={{ 
              fontFamily: 'var(--font-serif)', 
              fontSize: '1.28rem', 
              fontWeight: 400,
              color: '#344231',
              lineHeight: 1.45,
              maxWidth: '340px',
              margin: '0 auto',
            }}
          >
            Abadikan momen hangat Anda bersama dan bagikan ke layar & Galery Namoo
          </h2>
        </div>

        {/* Notifikasi Peringatan Kredensial jika belum diatur */}
        {!isSupabaseConfigured && (
          <div 
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: '#92400e',
              marginBottom: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>Kredensial Supabase belum lengkap di file <code>.env</code>.</span>
          </div>
        )}

        {/* Alert Feedback Status */}
        {statusMessage.text && (
          <div 
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: statusMessage.type === 'error' ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${statusMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: statusMessage.type === 'error' ? '#dc2626' : '#166534',
              marginBottom: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* TAMPILAN JIKA FOTO SUDAH BERHASIL DIKIRIM */}
        {isSubmitted ? (
          <div 
            style={{
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 6px 24px rgba(40, 54, 37, 0.08)',
              border: '1px solid #e2eae0',
              marginTop: '1rem'
            }}
          >
            <div 
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: '#e6ece4',
                color: '#344231',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.2rem auto'
              }}
            >
              <Heart size={34} fill="#4F634C" color="#4F634C" />
            </div>

            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: '#2B3A28', marginBottom: '0.4rem' }}>
              Terima Kasih, {guestName}!
            </h3>
            <p style={{ color: '#556353', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.8rem' }}>
              Foto dan doa terbaikmu telah terkirim. Tunggu fotomu segera tampil di layar proyektor utama!
            </p>

            <button
              onClick={handleUploadAnother}
              style={{
                backgroundColor: '#4F634C',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                padding: '0.75rem 2rem',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Kirim Foto Lagi
            </button>
          </div>
        ) : (
          /* FORM UPLOAD SESUAI MOCKUP GAMBAR USER */
          <form onSubmit={handleSubmit}>
            
            {/* Input File Tersembunyi */}
            <input 
              ref={fileInputCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isUploading || isCompressing}
            />

            <input 
              ref={fileInputGalleryRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isUploading || isCompressing}
            />

            {/* 1. HERO AMBIL FOTO: LINGKARAN KAMERA BESAR + PILIH DARI GALERI */}
            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '0.5rem',
                marginBottom: '1.8rem',
                position: 'relative'
              }}
            >
              {/* Tombol Kamera Lingkaran Utama */}
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: isCompressing || isUploading ? 'not-allowed' : 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => {
                  if (!isCompressing && !isUploading) {
                    fileInputCameraRef.current?.click();
                  }
                }}
              >
                {/* Outer Ring Circle */}
                <div 
                  style={{
                    width: '185px',
                    height: '185px',
                    borderRadius: '50%',
                    border: '2.5px solid #2B3A28',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FAF9F5',
                    boxShadow: '0 4px 16px rgba(43, 58, 40, 0.1)',
                    transition: 'transform 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* Inner Solid Forest Circle */}
                  <div 
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      backgroundColor: '#2E3E2B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {isCompressing ? (
                      <Loader2 size={46} color="#ffffff" className="animate-spin" />
                    ) : previewUrl ? (
                      /* Foto yang sudah dipilih */
                      <>
                        <img 
                          src={previewUrl} 
                          alt="Preview Foto" 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <div 
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.35)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          <RefreshCw size={22} style={{ marginBottom: '4px' }} />
                          Ganti
                        </div>
                      </>
                    ) : (
                      /* Ikon Kamera Putih Bersih sesuai Gambar */
                      <svg width="86" height="72" viewBox="0 0 100 84" fill="none">
                        <path d="M38 10 H62 L67 20 H33 L38 10Z" fill="#ffffff" />
                        <rect x="10" y="20" width="80" height="54" rx="10" fill="#ffffff" />
                        <circle cx="50" cy="47" r="19" fill="#2E3E2B" />
                        <circle cx="50" cy="47" r="13" fill="#ffffff" />
                        <circle cx="50" cy="47" r="8" fill="#2E3E2B" />
                      </svg>
                    )}
                  </div>

                  {/* Tombol Hapus Foto jika sudah dipilih */}
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        zIndex: 10
                      }}
                      title="Hapus foto ini"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Teks Label "Ambil Foto" */}
                <span 
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.25rem',
                    color: '#2B3A28',
                    marginTop: '0.65rem',
                    fontWeight: 500,
                    letterSpacing: '0.01em'
                  }}
                >
                  Ambil Foto
                </span>
              </div>

              {/* Tombol "Pilih dari Galeri" di Samping Kiri Bawah Sesuai Gambar */}
              <div 
                style={{
                  alignSelf: 'flex-start',
                  marginTop: '-1.4rem',
                  marginLeft: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: isCompressing || isUploading ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  if (!isCompressing && !isUploading) {
                    fileInputGalleryRef.current?.click();
                  }
                }}
              >
                <div 
                  style={{
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2B3A28'
                  }}
                >
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2B3A28" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <span 
                  style={{ 
                    fontSize: '0.78rem', 
                    color: '#2B3A28', 
                    fontWeight: 500,
                    marginTop: '2px'
                  }}
                >
                  Pilih dari Galeri
                </span>
              </div>
            </div>

            {/* 2. FORM INPUT NAMA TAMU / SAHABAT */}
            <div style={{ marginBottom: '1.4rem' }}>
              <label 
                htmlFor="guest-name-input"
                style={{ 
                  display: 'block', 
                  fontSize: '0.92rem', 
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 500,
                  color: '#2B3A28', 
                  marginBottom: '0.45rem' 
                }}
              >
                Nama Tamu / Sahabat <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input 
                id="guest-name-input"
                type="text"
                placeholder="Contoh: Budi & Kel. / Maya (Sahabat SMA)"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                maxLength={60}
                disabled={isUploading}
                style={{
                  width: '100%',
                  backgroundColor: '#E6ECE4',
                  border: '1.5px solid #9FB39E',
                  borderRadius: '8px',
                  padding: '0.72rem 0.95rem',
                  fontSize: '0.92rem',
                  fontFamily: 'var(--font-sans)',
                  color: '#2B3A28',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#4F634C')}
                onBlur={(e) => (e.target.style.borderColor = '#9FB39E')}
              />
            </div>

            {/* 3. FORM INPUT KIRIM UCAPAN & DOA SINGKAT */}
            <div style={{ marginBottom: '1.8rem' }}>
              <label 
                htmlFor="guest-message-input"
                style={{ 
                  display: 'block', 
                  fontSize: '0.92rem', 
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 500,
                  color: '#2B3A28', 
                  marginBottom: '0.45rem' 
                }}
              >
                Kirim Ucapan & Doa Singkat
              </label>
              <textarea 
                id="guest-message-input"
                placeholder="Tuliskan ucapan selamat & doa terbaik untuk kedua mempelai..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                rows={4}
                disabled={isUploading}
                style={{
                  width: '100%',
                  backgroundColor: '#E6ECE4',
                  border: '1.5px solid #9FB39E',
                  borderRadius: '10px',
                  padding: '0.75rem 0.95rem',
                  fontSize: '0.92rem',
                  fontFamily: 'var(--font-sans)',
                  color: '#2B3A28',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#4F634C')}
                onBlur={(e) => (e.target.style.borderColor = '#9FB39E')}
              />
            </div>

            {/* 4. TOMBOL "KIRIM FOTO & DOA" DI TENGAH */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <button
                type="submit"
                disabled={isUploading || isCompressing || !compressedBlob}
                style={{
                  backgroundColor: '#52654F',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.7rem 2.4rem',
                  fontSize: '0.96rem',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  cursor: isUploading || isCompressing || !compressedBlob ? 'not-allowed' : 'pointer',
                  opacity: !compressedBlob ? 0.65 : 1,
                  boxShadow: '0 4px 14px rgba(43, 58, 40, 0.2)',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  minWidth: '180px'
                }}
                onMouseOver={(e) => {
                  if (compressedBlob && !isUploading) e.currentTarget.style.backgroundColor = '#3F523C';
                }}
                onMouseOut={(e) => {
                  if (compressedBlob && !isUploading) e.currentTarget.style.backgroundColor = '#52654F';
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Mengunggah...
                  </>
                ) : (
                  'Kirim Foto & Doa'
                )}
              </button>

              {!compressedBlob && (
                <div style={{ fontSize: '0.74rem', color: '#738271', marginTop: '0.45rem' }}>
                  * Pilih atau ambil foto terlebih dahulu
                </div>
              )}
            </div>

            {/* 5. TOMBOL "LIVE GALERY" DI BAGIAN BAWAH SESUAI GAMBAR */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={onNavigateToGallery}
                style={{
                  border: '1.5px solid #849683',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  padding: '0.45rem 1.4rem',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(43, 58, 40, 0.06)',
                  transition: 'all 0.2s ease',
                  color: '#2B3A28'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f7faf6')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                title="Buka Layar Slideshow Proyektor"
              >
                {/* Ikon Galeri dengan multiple photo frame */}
                <svg width="30" height="20" viewBox="0 0 34 22" fill="none">
                  <rect x="2" y="5" width="13" height="12" rx="2" stroke="#2B3A28" strokeWidth="1.5" />
                  <path d="M4 14 L7 10 L11 15" stroke="#2B3A28" strokeWidth="1.3" />
                  <rect x="10" y="2" width="15" height="15" rx="2" fill="#2E3E2B" stroke="#2B3A28" strokeWidth="1.5" />
                  <path d="M12 14 L16 9 L22 15" stroke="#ffffff" strokeWidth="1.4" />
                  <circle cx="20" cy="6" r="1.5" fill="#ffffff" />
                  <rect x="20" y="6" width="12" height="12" rx="2" stroke="#2B3A28" strokeWidth="1.5" />
                </svg>

                <span 
                  style={{ 
                    fontFamily: 'var(--font-serif)', 
                    fontSize: '0.98rem', 
                    fontWeight: 500,
                    color: '#2B3A28'
                  }}
                >
                  Live Galery
                </span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
