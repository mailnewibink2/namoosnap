import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { getWeddingSettings, parseWeddingTitle } from '../utils/weddingSettings';
import { composePhotoboothImage } from '../utils/photoCompositor';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  AlertCircle, 
  Heart, 
  X, 
  Loader2,
  RefreshCw,
  Download,
  UploadCloud,
  Sparkles,
  Camera,
  Image as ImageIcon
} from 'lucide-react';

export default function GuestUpload({ onNavigateToGallery, weddingInfo: propWeddingInfo }) {
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  
  // Pengaturan Layout Grid & Filter
  const [layout, setLayout] = useState('1'); // '1' | '2' | '4'
  const [filter, setFilter] = useState('normal'); // 'normal' | 'bw' | 'classic'
  const [rawPhotos, setRawPhotos] = useState([]); // Array of { file, previewUrl }
  const [activeSlot, setActiveSlot] = useState(0);

  // Hasil Photobooth Tergabung (Composed Image)
  const [composedBlob, setComposedBlob] = useState(null);
  const [composedUrl, setComposedUrl] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  // Wedding Settings (Judul & Tanggal)
  const [weddingInfo, setWeddingInfo] = useState(() => {
    return propWeddingInfo || {
      title: 'The Wedding of Rahma & Febi',
      wedding_date: '27 September 2026',
    };
  });

  useEffect(() => {
    if (propWeddingInfo && propWeddingInfo.title) {
      setWeddingInfo(propWeddingInfo);
    }
  }, [propWeddingInfo]);

  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showDownloadConfirmModal, setShowDownloadConfirmModal] = useState(false);

  const fileInputCameraRef = useRef(null);
  const fileInputGalleryRef = useRef(null);

  // Muat pengaturan nama pengantin & tanggal serta dengarkan pembaruan real-time
  useEffect(() => {
    getWeddingSettings().then((info) => {
      if (info) setWeddingInfo(info);
    });

    const handleSettingsChanged = (e) => {
      if (e.detail) setWeddingInfo(e.detail);
    };

    window.addEventListener('namoo_wedding_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('namoo_wedding_settings_changed', handleSettingsChanged);
  }, []);

  const totalSlotsNeeded = parseInt(layout, 10);

  // Jalankan komposisi kanvas setiap kali foto, layout, filter, nama tamu, atau doa berubah
  const triggerComposition = useCallback(async (
    photosList, 
    selectedLayout, 
    selectedFilter, 
    info,
    name = guestName,
    msg = message
  ) => {
    const slotsCount = parseInt(selectedLayout, 10);
    if (photosList.length < slotsCount) return;

    try {
      setIsComposing(true);
      const imagesToCompose = photosList.slice(0, slotsCount).map((p) => p.previewUrl);
      const result = await composePhotoboothImage({
        images: imagesToCompose,
        layout: selectedLayout,
        filter: selectedFilter,
        weddingInfo: info,
        guestName: name,
        message: msg,
      });

      setComposedBlob(result.blob);
      setComposedUrl(result.dataUrl);
    } catch (err) {
      console.error('Error saat membuat komposisi photobooth:', err);
    } finally {
      setIsComposing(false);
    }
  }, [guestName, message]);

  // Re-compose otomatis dengan debounce saat nama tamu atau ucapan diketik
  useEffect(() => {
    if (rawPhotos.filter(Boolean).length < totalSlotsNeeded) return;

    const timer = setTimeout(() => {
      triggerComposition(rawPhotos, layout, filter, weddingInfo, guestName, message);
    }, 280);

    return () => clearTimeout(timer);
  }, [guestName, message, layout, filter, weddingInfo, totalSlotsNeeded]);

  // Tangani saat foto diambil dari kamera / galeri
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPhotos = [...rawPhotos];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const targetIdx = files.length > 1 ? i : activeSlot;
      const previewUrl = URL.createObjectURL(file);

      if (targetIdx < totalSlotsNeeded) {
        newPhotos[targetIdx] = { file, previewUrl };
      }
    }

    setRawPhotos(newPhotos);

    // Otomatis pindah ke slot berikutnya jika belum penuh
    const nextSlot = newPhotos.findIndex((p, idx) => !p && idx < totalSlotsNeeded);
    if (nextSlot !== -1) {
      setActiveSlot(nextSlot);
    } else {
      setActiveSlot(0);
      triggerComposition(newPhotos, layout, filter, weddingInfo, guestName, message);
    }

    if (fileInputCameraRef.current) fileInputCameraRef.current.value = '';
    if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = '';
  };

  // Ubah layout grid (1, 2, atau 4 foto)
  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    setActiveSlot(0);
    const slotsCount = parseInt(newLayout, 10);

    // Jika foto yang ada sudah memenuhi slot baru, langsung recompose
    if (rawPhotos.filter(Boolean).length >= slotsCount) {
      triggerComposition(rawPhotos, newLayout, filter, weddingInfo, guestName, message);
    } else {
      setComposedBlob(null);
      setComposedUrl('');
    }
  };

  // Ubah filter (Normal, BW, Classic)
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    if (rawPhotos.filter(Boolean).length >= totalSlotsNeeded) {
      triggerComposition(rawPhotos, layout, newFilter, weddingInfo, guestName, message);
    }
  };

  // Reset semua foto
  const handleResetPhotos = () => {
    rawPhotos.forEach((p) => p?.previewUrl && URL.revokeObjectURL(p.previewUrl));
    if (composedUrl) URL.revokeObjectURL(composedUrl);
    setRawPhotos([]);
    setComposedBlob(null);
    setComposedUrl('');
    setActiveSlot(0);
  };

  // Unduh hasil foto ke perangkat tamu (terintegrasi nama pengantin, nama tamu & ucapan)
  const handleDownload = async () => {
    let finalUrl = composedUrl;

    if (rawPhotos.filter(Boolean).length >= totalSlotsNeeded) {
      try {
        const slotsCount = parseInt(layout, 10);
        const imagesToCompose = rawPhotos.slice(0, slotsCount).map((p) => p.previewUrl);
        const result = await composePhotoboothImage({
          images: imagesToCompose,
          layout,
          filter,
          weddingInfo,
          guestName,
          message,
        });
        finalUrl = result.dataUrl;
        setComposedBlob(result.blob);
        setComposedUrl(result.dataUrl);
      } catch (err) {
        console.error('Download composition update error:', err);
      }
    }

    if (!finalUrl) return;
    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = `namoo-snap-${(guestName || 'tamu').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#4F634C', '#dfb76c', '#FAF9F5'],
    });
  };

  // Buka modal konfirmasi unduh & kirim sebelum upload
  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    if (!composedBlob) {
      setStatusMessage({ type: 'error', text: 'Silakan ambil foto hingga slot terpenuhi terlebih dahulu.' });
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

    // Tampilkan modal pilihan: "Unduh & Kirim" atau "Hanya Kirim"
    setShowDownloadConfirmModal(true);
  };

  // Eksekusi upload foto ke Supabase Storage & Database
  const executeUpload = async () => {
    setShowDownloadConfirmModal(false);

    try {
      setIsUploading(true);
      setStatusMessage({ type: '', text: '' });

      // Pastikan blob final yang diupload mengandung nama tamu & ucapan terbaru
      let uploadBlob = composedBlob;
      if (rawPhotos.filter(Boolean).length >= totalSlotsNeeded) {
        const slotsCount = parseInt(layout, 10);
        const imagesToCompose = rawPhotos.slice(0, slotsCount).map((p) => p.previewUrl);
        const result = await composePhotoboothImage({
          images: imagesToCompose,
          layout,
          filter,
          weddingInfo,
          guestName,
          message,
        });
        uploadBlob = result.blob;
        setComposedBlob(result.blob);
        setComposedUrl(result.dataUrl);
      }

      if (!uploadBlob) {
        throw new Error('Foto belum siap untuk diunggah.');
      }

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const cleanGuestName = guestName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
      const fileName = `${timestamp}_${cleanGuestName}_${randomStr}.jpg`;
      const filePath = `uploads/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('wedding-photos')
        .upload(filePath, uploadBlob, {
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
        particleCount: 100,
        spread: 80,
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

  // Opsi 1: Unduh foto ke memori HP + Lanjut Kirim
  const handleDownloadAndSubmit = () => {
    handleDownload();
    executeUpload();
  };

  // Opsi 2: Hanya Kirim ke proyektor tanpa unduh
  const handleOnlySubmit = () => {
    executeUpload();
  };

  const handleUploadAnother = () => {
    handleResetPhotos();
    setMessage('');
    setIsSubmitted(false);
    setStatusMessage({ type: '', text: '' });
  };

  const isPhotosComplete = rawPhotos.filter(Boolean).length >= totalSlotsNeeded;

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
        {/* LOGO & HEADER                                            */}
        {/* ======================================================== */}
        <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.65rem' }}>
            <img 
              src="/namoo-logo.png?v=4" 
              alt="Namoo Snap - Digital Photo Booth"
              style={{
                width: '135px',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>

          <h2 
            style={{ 
              fontFamily: 'var(--font-serif)', 
              fontSize: '1.25rem', 
              fontWeight: 400,
              color: '#344231',
              lineHeight: 1.45,
              maxWidth: '340px',
              margin: '0 auto',
            }}
          >
            Abadikan momen hangat Anda bersama dan bagikan ke layar & Galery Namoo
          </h2>

          {/* Subtitle Nama Pengantin yang sedang berlangsung (Format 3 Baris Rapi) */}
          {(() => {
            const { prefix, couple } = parseWeddingTitle(weddingInfo.title);
            return (
              <div style={{ marginTop: '0.65rem' }}>
                <div 
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    color: '#768772',
                    letterSpacing: '0.06em',
                    lineHeight: 1.2,
                  }}
                >
                  {prefix}
                </div>
                <div 
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.45rem',
                    fontWeight: 600,
                    color: '#283625',
                    lineHeight: 1.25,
                    margin: '2px 0',
                  }}
                >
                  {couple}
                </div>
                <div 
                  style={{
                    fontSize: '0.82rem',
                    color: '#C49A38',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  {weddingInfo.wedding_date}
                </div>
              </div>
            );
          })()}
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

        {/* ======================================================== */}
        {/* TAMPILAN JIKA FOTO SUDAH BERHASIL DIKIRIM                */}
        {/* ======================================================== */}
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
          /* ======================================================== */
          /* FORM UTAMA DENGAN PILIHAN GRID, FILTER & DOWNLOAD        */
          /* ======================================================== */
          <form onSubmit={handleSubmit}>
            
            {/* Input File Tersembunyi */}
            <input 
              ref={fileInputCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isUploading || isComposing}
            />

            <input 
              ref={fileInputGalleryRef}
              type="file"
              accept="image/*"
              multiple={totalSlotsNeeded > 1}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isUploading || isComposing}
            />

            {/* KONTROL PILIHAN GRID & FILTER (SATU BARIS DI MOBILE & WEB) */}
            <div 
              style={{ 
                display: 'flex', 
                flexWrap: 'nowrap', 
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '10px', 
                marginBottom: '1.2rem',
                width: '100%',
              }}
            >
              {/* 1. KONTROL PILIHAN GRID */}
              <div style={{ flex: '1 1 45%', minWidth: '0' }}>
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    marginBottom: '0.3rem' 
                  }}
                >
                  <span 
                    style={{ 
                      fontSize: '0.86rem', 
                      fontFamily: 'var(--font-serif)',
                      fontWeight: 500,
                      color: '#2B3A28', 
                    }}
                  >
                    Grid
                  </span>
                  {totalSlotsNeeded > 1 && (
                    <span style={{ fontSize: '0.7rem', color: '#C49A38', fontWeight: 600 }}>
                      ({rawPhotos.filter(Boolean).length}/{totalSlotsNeeded})
                    </span>
                  )}
                </div>

                <div 
                  style={{
                    display: 'flex',
                    gap: '2px',
                    backgroundColor: '#E6ECE4',
                    padding: '2.5px',
                    borderRadius: '8px',
                    width: '100%',
                  }}
                >
                  {[
                    { id: '1', label: '1 Foto' },
                    { id: '2', label: '2 Foto' },
                    { id: '4', label: '4 Foto' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleLayoutChange(item.id)}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.24rem 0.25rem',
                        fontSize: '0.72rem',
                        fontWeight: layout === item.id ? 700 : 500,
                        backgroundColor: layout === item.id ? '#2E3E2B' : 'transparent',
                        color: layout === item.id ? '#ffffff' : '#455243',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: layout === item.id ? '0 1px 4px rgba(43,58,40,0.2)' : 'none',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. PILIHAN FILTER (NORMAL, BW, CLASSIC) */}
              <div style={{ flex: '1 1 55%', minWidth: '0' }}>
                <div 
                  style={{ 
                    fontSize: '0.86rem', 
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 500,
                    color: '#2B3A28', 
                    marginBottom: '0.3rem' 
                  }}
                >
                  Filter
                </div>

                <div 
                  style={{
                    display: 'flex',
                    gap: '2px',
                    backgroundColor: '#E6ECE4',
                    padding: '2.5px',
                    borderRadius: '8px',
                    width: '100%',
                  }}
                >
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'bw', label: 'B & W' },
                    { id: 'classic', label: 'Classic' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFilterChange(f.id)}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.24rem 0.25rem',
                        fontSize: '0.72rem',
                        fontWeight: filter === f.id ? 700 : 500,
                        backgroundColor: filter === f.id ? '#2E3E2B' : 'transparent',
                        color: filter === f.id ? '#ffffff' : '#455243',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: filter === f.id ? '0 1px 4px rgba(43,58,40,0.2)' : 'none',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. HERO COMPONENT: AMBIL FOTO / PRATINJAU KANVAS HASIL */}
            {!isPhotosComplete ? (
              /* BELUM SEMUA SLOT TERISI: TAMPILKAN TOMBOL KAMERA SESUAI MOCKUP */
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '0.2rem',
                  marginBottom: '1.6rem',
                  position: 'relative'
                }}
              >
                {/* Tombol Kamera Lingkaran Besar */}
                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: isComposing || isUploading ? 'not-allowed' : 'pointer',
                    userSelect: 'none'
                  }}
                  onClick={() => {
                    if (!isComposing && !isUploading) {
                      fileInputCameraRef.current?.click();
                    }
                  }}
                >
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
                      {isComposing ? (
                        <Loader2 size={46} color="#ffffff" className="animate-spin" />
                      ) : (
                        <svg width="86" height="72" viewBox="0 0 100 84" fill="none">
                          <path d="M38 10 H62 L67 20 H33 L38 10Z" fill="#ffffff" />
                          <rect x="10" y="20" width="80" height="54" rx="10" fill="#ffffff" />
                          <circle cx="50" cy="47" r="19" fill="#2E3E2B" />
                          <circle cx="50" cy="47" r="13" fill="#ffffff" />
                          <circle cx="50" cy="47" r="8" fill="#2E3E2B" />
                        </svg>
                      )}
                    </div>
                  </div>

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
                    {totalSlotsNeeded > 1 
                      ? `Ambil Foto ke-${activeSlot + 1} (${rawPhotos.filter(Boolean).length}/${totalSlotsNeeded})`
                      : 'Ambil Foto'}
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
                    cursor: isComposing || isUploading ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => {
                    if (!isComposing && !isUploading) {
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

                {/* Indikator Slot Thumbnail jika Grid > 1 */}
                {totalSlotsNeeded > 1 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                    {Array.from({ length: totalSlotsNeeded }).map((_, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setActiveSlot(idx)}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          border: activeSlot === idx ? '2.5px solid #C49A38' : '1.5px dashed #9FB39E',
                          backgroundColor: rawPhotos[idx] ? '#ffffff' : '#E6ECE4',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                      >
                        {rawPhotos[idx] ? (
                          <img 
                            src={rawPhotos[idx].previewUrl} 
                            alt="" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#687765', fontWeight: 600 }}>
                            {idx + 1}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* FOTO LENGKAP: TAMPILKAN HASIL PHOTOBOOTH DENGAN FRAME & WATERMARK PENGANTIN */
              <div style={{ marginBottom: '1.6rem' }}>
                <div 
                  style={{
                    backgroundColor: '#2e4c25',
                    borderRadius: '14px',
                    border: '1.5px solid rgba(46, 76, 37, 0.4)',
                    padding: '6px',
                    boxShadow: '0 8px 24px rgba(46, 76, 37, 0.22)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isComposing ? (
                    <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={36} color="#4F634C" className="animate-spin" />
                    </div>
                  ) : (
                    <img 
                      src={composedUrl} 
                      alt="Hasil Photobooth"
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        display: 'block',
                      }}
                    />
                  )}

                  {/* Tombol Reset / Foto Ulang */}
                  <button
                    type="button"
                    onClick={handleResetPhotos}
                    style={{
                      position: 'absolute',
                      top: '14px',
                      right: '14px',
                      backgroundColor: 'rgba(220, 38, 38, 0.85)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)'
                    }}
                    title="Foto Ulang"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Tombol Aksi Bawah Pratinjau: DOWNLOAD & FOTO ULANG */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '0.8rem' }}>
                  <button
                    type="button"
                    onClick={handleDownload}
                    style={{
                      flex: 1,
                      backgroundColor: '#ffffff',
                      border: '1.5px solid #4F634C',
                      color: '#4F634C',
                      borderRadius: '9999px',
                      padding: '0.65rem 1rem',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(79, 99, 76, 0.1)'
                    }}
                  >
                    <Download size={16} />
                    Download Foto
                  </button>

                  <button
                    type="button"
                    onClick={handleResetPhotos}
                    style={{
                      backgroundColor: '#E6ECE4',
                      border: '1px solid #9FB39E',
                      color: '#344231',
                      borderRadius: '9999px',
                      padding: '0.65rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <RefreshCw size={14} />
                    Ulang
                  </button>
                </div>
              </div>
            )}

            {/* 4. FORM INPUT NAMA TAMU / SAHABAT */}
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

            {/* 5. FORM INPUT KIRIM UCAPAN & DOA SINGKAT */}
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

            {/* 6. TOMBOL "KIRIM FOTO & DOA" DI TENGAH */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <button
                type="submit"
                disabled={isUploading || isComposing || !composedBlob}
                style={{
                  backgroundColor: '#52654F',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.75rem 2.4rem',
                  fontSize: '0.96rem',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  cursor: isUploading || isComposing || !composedBlob ? 'not-allowed' : 'pointer',
                  opacity: !composedBlob ? 0.65 : 1,
                  boxShadow: '0 4px 14px rgba(43, 58, 40, 0.2)',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  minWidth: '180px'
                }}
                onMouseOver={(e) => {
                  if (composedBlob && !isUploading) e.currentTarget.style.backgroundColor = '#3F523C';
                }}
                onMouseOut={(e) => {
                  if (composedBlob && !isUploading) e.currentTarget.style.backgroundColor = '#52654F';
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Mengunggah...
                  </>
                ) : (
                  <>
                    <UploadCloud size={18} />
                    Kirim Foto & Doa
                  </>
                )}
              </button>

              {!composedBlob && (
                <div style={{ fontSize: '0.74rem', color: '#738271', marginTop: '0.45rem' }}>
                  * Ambil foto terlebih dahulu ({rawPhotos.filter(Boolean).length}/{totalSlotsNeeded})
                </div>
              )}
            </div>

            {/* 7. TOMBOL "LIVE GALERY" DI BAGIAN BAWAH SESUAI GAMBAR */}
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

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI: UNDUH & KIRIM ATAU HANYA KIRIM        */}
      {/* ======================================================== */}
      {showDownloadConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(20, 28, 19, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.2rem',
            zIndex: 9999,
          }}
          onClick={() => setShowDownloadConfirmModal(false)}
        >
          <div
            style={{
              backgroundColor: '#FAF9F5',
              borderRadius: '22px',
              maxWidth: '360px',
              width: '100%',
              padding: '1.6rem 1.3rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #dbe4d9',
              textAlign: 'center',
              boxSizing: 'border-box',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tombol Tutup Silang di Pojok */}
            <button
              type="button"
              onClick={() => setShowDownloadConfirmModal(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                backgroundColor: '#E6ECE4',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#455243',
              }}
            >
              <X size={16} />
            </button>

            {/* Icon Header */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#E6ECE4',
                color: '#2E3E2B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem auto',
                border: '1px solid #c9d8c7',
              }}
            >
              <Sparkles size={24} color="#C49A38" />
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.3rem',
                color: '#283625',
                marginBottom: '0.35rem',
                fontWeight: 600,
              }}
            >
              Simpan Foto Kenangan?
            </h3>

            <p
              style={{
                fontSize: '0.84rem',
                color: '#556353',
                lineHeight: 1.45,
                margin: '0 auto 1rem auto',
                maxWidth: '290px',
              }}
            >
              Jangan sampai lupa mengunduh foto ini! Pilih <strong>Unduh & Kirim</strong> untuk menyimpannya ke HP Anda sekaligus mengirim ke proyektor.
            </p>

            {/* Pratinjau Miniatur Foto Hasil */}
            {composedUrl && (
              <div
                style={{
                  maxWidth: '140px',
                  maxHeight: '180px',
                  margin: '0 auto 1.15rem auto',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(43, 58, 40, 0.15)',
                  border: '2px solid #ffffff',
                }}
              >
                <img
                  src={composedUrl}
                  alt="Mini Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    backgroundColor: '#FAF8F4',
                  }}
                />
              </div>
            )}

            {/* Pilihan Tombol Aksi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Opsi 1: Unduh & Kirim (Recommended) */}
              <button
                type="button"
                id="btn-download-and-submit"
                onClick={handleDownloadAndSubmit}
                style={{
                  backgroundColor: '#2E3E2B',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.8rem 1rem',
                  fontSize: '0.94rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(46, 62, 43, 0.25)',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d271b')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2E3E2B')}
              >
                <Download size={18} />
                <span>Unduh & Kirim</span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    backgroundColor: '#C49A38',
                    color: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: '999px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginLeft: '2px',
                  }}
                >
                  Saran
                </span>
              </button>

              {/* Opsi 2: Hanya Kirim */}
              <button
                type="button"
                id="btn-only-submit"
                onClick={handleOnlySubmit}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#344231',
                  border: '1.5px solid #9FB39E',
                  borderRadius: '12px',
                  padding: '0.72rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#E6ECE4')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
              >
                <UploadCloud size={17} color="#4F634C" />
                <span>Hanya Kirim</span>
              </button>

              {/* Opsi 3: Batal / Kembali Edit */}
              <button
                type="button"
                onClick={() => setShowDownloadConfirmModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#738271',
                  fontSize: '0.8rem',
                  padding: '0.4rem',
                  cursor: 'pointer',
                  marginTop: '2px',
                }}
              >
                Batal / Periksa Lagi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
