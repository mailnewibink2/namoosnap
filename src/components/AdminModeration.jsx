import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { 
  ShieldCheck, 
  Check, 
  Trash2, 
  RefreshCw, 
  Clock, 
  Search, 
  Eye, 
  X, 
  AlertCircle,
  CheckCheck,
  Filter,
  Image as ImageIcon,
  QrCode as QrIcon,
  Palette,
  Sparkles
} from 'lucide-react';

import { getWeddingSettings, saveWeddingSettings, parseWeddingTitle } from '../utils/weddingSettings';
import QRCodeModal from './QRCodeModal';

export default function AdminModeration() {
  const [photos, setPhotos] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'all', 'pending', 'approved'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [notification, setNotification] = useState({ text: '', type: '' });
  
  // Pengaturan Nama Pengantin, Tanggal Acara & Warna Background Frame
  const [weddingInfo, setWeddingInfo] = useState({ 
    title: 'The Wedding of Rahma & Febi', 
    wedding_date: '27 September 2026',
    frame_theme: 'green'
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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

  const handleQuickThemeChange = async (newTheme) => {
    const updated = { ...weddingInfo, frame_theme: newTheme };
    setWeddingInfo(updated);
    try {
      await saveWeddingSettings(updated);
      const name = 
        newTheme === 'green' ? 'Forest Green (#2e4c25)' :
        newTheme === 'cream' ? 'Classic Cream (#FAF8F4)' :
        'Royal Blue (#162746)';
      showToast(`🎨 Tema background frame diubah ke: ${name}!`);
    } catch (err) {
      showToast('Gagal mengubah tema: ' + err.message, 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      await saveWeddingSettings(weddingInfo);
      setShowSettingsModal(false);
      showToast('Pengaturan nama pengantin & tanggal berhasil disimpan!');
    } catch (err) {
      showToast('Gagal menyimpan pengaturan: ' + err.message, 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 1. Ambil semua data foto dari Supabase
  const fetchAllPhotos = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .neq('guest_name', '__NAMOO_SYSTEM_CONFIG__')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error mengambil foto untuk moderasi:', error.message);
        return;
      }

      setPhotos(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. Realtime listener agar dashboard WO otomatis update bila ada tamu upload foto
  useEffect(() => {
    fetchAllPhotos();

    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('admin-moderation-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          if (newRecord?.guest_name === '__NAMOO_SYSTEM_CONFIG__' || oldRecord?.guest_name === '__NAMOO_SYSTEM_CONFIG__') {
            return;
          }

          if (eventType === 'INSERT') {
            setPhotos((prev) => [newRecord, ...prev]);
            showToast(`📸 Foto baru masuk dari ${newRecord.guest_name}!`, 'info');
          } else if (eventType === 'UPDATE') {
            setPhotos((prev) =>
              prev.map((item) => (item.id === newRecord.id ? newRecord : item))
            );
          } else if (eventType === 'DELETE') {
            setPhotos((prev) => prev.filter((item) => item.id !== oldRecord.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllPhotos]);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification({ text: '', type: '' }), 4000);
  };

  // 3. Aksi Moderasi: Approve / Tayangkan ke Proyektor
  const handleApprove = async (photoId, newStatus = true) => {
    try {
      setActionLoadingId(photoId);
      const { error } = await supabase
        .from('photos')
        .update({ is_approved: newStatus })
        .eq('id', photoId);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, is_approved: newStatus } : p))
      );

      showToast(newStatus ? 'Foto berhasil disetujui & ditayangkan!' : 'Penayangan foto dibatalkan.');
    } catch (err) {
      console.error('Error approve:', err);
      showToast('Gagal mengubah status foto: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 4. Aksi Moderasi: Hapus Foto
  const handleDelete = async (photo) => {
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus foto dari "${photo.guest_name}"?`
    );
    if (!confirmDelete) return;

    try {
      setActionLoadingId(photo.id);

      // Hapus data dari tabel photos
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);

      if (dbError) throw dbError;

      // Opsional: Coba hapus juga file fisik di Supabase storage jika URL cocok
      try {
        if (photo.image_url && photo.image_url.includes('wedding-photos/')) {
          const parts = photo.image_url.split('wedding-photos/');
          if (parts[1]) {
            const storagePath = decodeURIComponent(parts[1].split('?')[0]);
            await supabase.storage.from('wedding-photos').remove([storagePath]);
          }
        }
      } catch (storageErr) {
        console.warn('Storage cleanup notice:', storageErr);
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      showToast('Foto berhasil dihapus.');
    } catch (err) {
      console.error('Error delete:', err);
      showToast('Gagal menghapus foto: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 5. Approve Semua Foto Pending Sekaligus
  const handleApproveAllPending = async () => {
    const pendingPhotos = photos.filter((p) => !p.is_approved);
    if (pendingPhotos.length === 0) return;

    const confirmAll = window.confirm(
      `Setujui ${pendingPhotos.length} foto yang sedang menunggu sekaligus?`
    );
    if (!confirmAll) return;

    try {
      setIsLoading(true);
      const pendingIds = pendingPhotos.map((p) => p.id);
      const { error } = await supabase
        .from('photos')
        .update({ is_approved: true })
        .in('id', pendingIds);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((p) => (pendingIds.includes(p.id) ? { ...p, is_approved: true } : p))
      );
      showToast(`Berhasil menyetujui ${pendingIds.length} foto!`);
    } catch (err) {
      showToast('Gagal menyetujui semua foto: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter & Search Logika
  const filteredPhotos = photos.filter((photo) => {
    const matchFilter = 
      filter === 'all' ? true :
      filter === 'pending' ? !photo.is_approved :
      filter === 'approved' ? photo.is_approved : true;

    const query = searchQuery.toLowerCase();
    const matchSearch = 
      !query ||
      photo.guest_name?.toLowerCase().includes(query) ||
      photo.message?.toLowerCase().includes(query);

    return matchFilter && matchSearch;
  });

  const pendingCount = photos.filter((p) => !p.is_approved).length;
  const approvedCount = photos.filter((p) => p.is_approved).length;

  return (
    <div style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1.2rem' }}>
      {/* Toast Notification */}
      {notification.text && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 100,
            background: notification.type === 'error' ? '#dc2626' : 'var(--color-sage-700)',
            color: '#fff',
            padding: '0.8rem 1.4rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontWeight: 500,
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <Check size={18} />
          {notification.text}
        </div>
      )}

      {/* Header Dashboard Moderasi */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.8rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <ShieldCheck size={22} color="var(--color-sage-700)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-sage-700)' }}>
              Wedding Organizer Crew
            </span>
          </div>
          <h1 style={{ fontSize: '2.1rem', color: 'var(--color-sage-800)', margin: 0 }}>
            Moderasi Foto Masuk
          </h1>
          <p style={{ color: 'var(--color-charcoal-500)', fontSize: '0.9rem' }}>
            Filter dan tayangkan foto kiriman tamu agar proyektor tetap aman, sopan, dan berkesan.
          </p>
        </div>

        {/* Action Button: Settings, QR Code, Refresh & Approve All */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowQrModal(true)} 
            className="btn-secondary"
            style={{ 
              borderColor: 'var(--color-sage-600)', 
              color: 'var(--color-sage-900)',
              backgroundColor: '#FAF9F5',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Buka & Cetak QR Code Meja Acara"
          >
            <QrIcon size={16} color="#C49A38" />
            <span>QR Code Acara</span>
          </button>

          <button 
            onClick={() => setShowSettingsModal(true)} 
            className="btn-secondary"
            style={{ borderColor: 'var(--color-gold-400)', color: 'var(--color-sage-800)' }}
            title="Atur Nama Pengantin & Tanggal"
          >
            💍 Atur Nama Wedding
          </button>

          <button 
            onClick={fetchAllPhotos} 
            className="btn-secondary"
            title="Muat Ulang Data"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {pendingCount > 0 && (
            <button 
              onClick={handleApproveAllPending} 
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
            >
              <CheckCheck size={16} />
              Tayangkan Semua ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Pilihan 3 Tema Warna Frame Photobooth Langsung di Halaman Moderasi */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1.5px solid var(--color-cream-dark)',
          boxShadow: 'var(--shadow-sm)',
          padding: '1rem 1.4rem',
          marginBottom: '1.6rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: '#FAF9F5',
            border: '1px solid #d8e0d6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-sage-700)'
          }}>
            <Palette size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--color-sage-800)' }}>
                Warna Background Frame Tamu
              </span>
              <span style={{ 
                fontSize: '0.72rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                padding: '2px 8px', 
                borderRadius: '12px', 
                backgroundColor: '#E6ECE4', 
                color: '#2B3A28' 
              }}>
                3 Pilihan Tema
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--color-charcoal-500)' }}>
              Pilih warna frame foto polaroid tamu. Warna teks otomatis menyesuaikan agar kontras & terbaca jelas.
            </p>
          </div>
        </div>

        {/* 3 Tombol Pilihan Tema Warna */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 1. Forest Green */}
          <button
            type="button"
            onClick={() => handleQuickThemeChange('green')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.6rem 1.05rem',
              borderRadius: '9px',
              backgroundColor: '#2e4c25',
              color: '#ffffff',
              border: (weddingInfo.frame_theme || 'green') === 'green' ? '2.5px solid #ffde7a' : '1.5px solid rgba(0,0,0,0.15)',
              fontWeight: 600,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: (weddingInfo.frame_theme || 'green') === 'green' ? '0 0 0 2px #2e4c25, 0 4px 12px rgba(46,76,37,0.4)' : '0 1px 3px rgba(0,0,0,0.08)',
              transform: (weddingInfo.frame_theme || 'green') === 'green' ? 'scale(1.03)' : 'scale(1)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: '#2e4c25', border: '2px solid #ffffff' }} />
            <span>Hijau (#2e4c25)</span>
            {(weddingInfo.frame_theme || 'green') === 'green' && (
              <span style={{ backgroundColor: '#ffde7a', color: '#2e4c25', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                ✓
              </span>
            )}
          </button>

          {/* 2. Classic Cream */}
          <button
            type="button"
            onClick={() => handleQuickThemeChange('cream')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.6rem 1.05rem',
              borderRadius: '9px',
              backgroundColor: '#FAF8F4',
              color: '#283625',
              border: weddingInfo.frame_theme === 'cream' ? '2.5px solid #C49A38' : '1.5px solid #c7d2c4',
              fontWeight: 600,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: weddingInfo.frame_theme === 'cream' ? '0 0 0 2px #C49A38, 0 4px 12px rgba(196,154,56,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
              transform: weddingInfo.frame_theme === 'cream' ? 'scale(1.03)' : 'scale(1)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: '#FAF8F4', border: '2px solid #283625' }} />
            <span>Cream (#FAF8F4)</span>
            {weddingInfo.frame_theme === 'cream' && (
              <span style={{ backgroundColor: '#C49A38', color: '#ffffff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                ✓
              </span>
            )}
          </button>

          {/* 3. Royal Blue */}
          <button
            type="button"
            onClick={() => handleQuickThemeChange('royal_blue')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.6rem 1.05rem',
              borderRadius: '9px',
              backgroundColor: '#162746',
              color: '#ffffff',
              border: weddingInfo.frame_theme === 'royal_blue' ? '2.5px solid #60a5fa' : '1.5px solid rgba(0,0,0,0.15)',
              fontWeight: 600,
              fontSize: '0.86rem',
              cursor: 'pointer',
              boxShadow: weddingInfo.frame_theme === 'royal_blue' ? '0 0 0 2px #162746, 0 4px 12px rgba(22,39,70,0.45)' : '0 1px 3px rgba(0,0,0,0.08)',
              transform: weddingInfo.frame_theme === 'royal_blue' ? 'scale(1.03)' : 'scale(1)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: '#162746', border: '2px solid #ffffff' }} />
            <span>Royal Blue (#162746)</span>
            {weddingInfo.frame_theme === 'royal_blue' && (
              <span style={{ backgroundColor: '#60a5fa', color: '#162746', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                ✓
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          marginBottom: '1.6rem'
        }}
      >
        <div className="wedding-card" style={{ padding: '1.2rem 1.4rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-500)', fontWeight: 600 }}>Total Foto Masuk</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-sage-800)', marginTop: '0.2rem' }}>
            {photos.length}
          </div>
        </div>

        <div 
          className="wedding-card" 
          style={{ 
            padding: '1.2rem 1.4rem', 
            borderLeft: '4px solid #f59e0b',
            cursor: 'pointer'
          }}
          onClick={() => setFilter('pending')}
        >
          <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>Menunggu Moderasi</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#b45309', marginTop: '0.2rem' }}>
            {pendingCount}
          </div>
        </div>

        <div 
          className="wedding-card" 
          style={{ 
            padding: '1.2rem 1.4rem', 
            borderLeft: '4px solid #10b981',
            cursor: 'pointer'
          }}
          onClick={() => setFilter('approved')}
        >
          <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>Sudah Ditayangkan</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#047857', marginTop: '0.2rem' }}>
            {approvedCount}
          </div>
        </div>
      </div>

      {/* Controls: Filter & Search Bar */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          background: '#ffffff',
          padding: '0.8rem 1.2rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-cream-dark)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => setFilter('pending')}
            className={`nav-pill-btn ${filter === 'pending' ? 'active' : ''}`}
            style={{ fontWeight: 600 }}
          >
            Menunggu ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`nav-pill-btn ${filter === 'approved' ? 'active' : ''}`}
            style={{ fontWeight: 600 }}
          >
            Ditayangkan ({approvedCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`nav-pill-btn ${filter === 'all' ? 'active' : ''}`}
            style={{ fontWeight: 600 }}
          >
            Semua ({photos.length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-charcoal-300)' }} />
          <input 
            type="text"
            placeholder="Cari nama tamu / pesan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '32px', paddingTop: '0.45rem', paddingBottom: '0.45rem', fontSize: '0.88rem' }}
          />
        </div>
      </div>

      {/* Grid Foto Moderasi */}
      {filteredPhotos.length === 0 ? (
        <div 
          className="wedding-card" 
          style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--color-charcoal-500)' }}
        >
          <ImageIcon size={44} style={{ color: 'var(--color-sage-400)', margin: '0 auto 0.8rem auto' }} />
          <h3 style={{ fontSize: '1.3rem', color: 'var(--color-sage-800)', marginBottom: '0.4rem' }}>
            Tidak Ada Foto
          </h3>
          <p style={{ fontSize: '0.9rem' }}>
            {filter === 'pending' 
              ? 'Hebat! Semua foto masuk sudah dimoderasi dan ditayangkan.' 
              : 'Belum ada foto yang sesuai dengan kriteria filter saat ini.'}
          </p>
        </div>
      ) : (
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.4rem'
          }}
        >
          {filteredPhotos.map((photo) => (
            <div 
              key={photo.id}
              className="wedding-card"
              style={{
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                border: photo.is_approved ? '1px solid #bbf7d0' : '1px solid #fde68a',
              }}
            >
              {/* Thumbnail Container */}
              <div 
                style={{ 
                  position: 'relative', 
                  height: '220px', 
                  backgroundColor: '#1f241d',
                  cursor: 'pointer',
                  overflow: 'hidden'
                }}
                onClick={() => setSelectedPhoto(photo)}
              >
                <img 
                  src={photo.image_url} 
                  alt={photo.guest_name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.3s ease',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />

                {/* Status Badge Over Image */}
                <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                  {photo.is_approved ? (
                    <span className="badge badge-approved">
                      <Check size={12} /> Tayang
                    </span>
                  ) : (
                    <span className="badge badge-pending">
                      <Clock size={12} /> Menunggu
                    </span>
                  )}
                </div>

                <div 
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                  }}
                  title="Lihat ukuran penuh"
                >
                  <Eye size={14} />
                </div>
              </div>

              {/* Photo Meta & Message */}
              <div style={{ padding: '1.1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--color-sage-800)', fontWeight: 700 }}>
                    {photo.guest_name}
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-charcoal-300)' }}>
                    {new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p 
                  style={{ 
                    fontSize: '0.88rem', 
                    color: 'var(--color-charcoal-700)', 
                    fontStyle: 'italic',
                    marginBottom: '1.2rem',
                    flex: 1,
                    lineHeight: 1.4
                  }}
                >
                  "{photo.message || '—'}"
                </p>

                {/* Tombol Aksi Moderasi */}
                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.8rem', borderTop: '1px solid var(--color-cream-dark)' }}>
                  {photo.is_approved ? (
                    <button
                      onClick={() => handleApprove(photo.id, false)}
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem' }}
                      disabled={actionLoadingId === photo.id}
                    >
                      Batal Tayang
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(photo.id, true)}
                      className="btn-success"
                      style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem' }}
                      disabled={actionLoadingId === photo.id}
                    >
                      <Check size={15} />
                      Tayangkan
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(photo)}
                    className="btn-danger"
                    style={{ padding: '0.5rem 0.8rem' }}
                    title="Hapus Foto"
                    disabled={actionLoadingId === photo.id}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Lightbox untuk Melihat Foto Penuh */}
      {selectedPhoto && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '900px',
              width: '100%',
              background: '#1a1f18',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 20
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', maxHeight: '70vh', backgroundColor: '#000' }}>
              <img 
                src={selectedPhoto.image_url} 
                alt={selectedPhoto.guest_name} 
                style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>

            <div style={{ padding: '1.5rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: 0, color: 'var(--color-cream-base)' }}>
                  {selectedPhoto.guest_name}
                </h3>
                <p style={{ margin: '0.3rem 0 0 0', color: '#c5d2c0', fontStyle: 'italic', fontSize: '0.95rem' }}>
                  "{selectedPhoto.message || 'Tidak ada pesan'}"
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                {!selectedPhoto.is_approved ? (
                  <button 
                    onClick={() => {
                      handleApprove(selectedPhoto.id, true);
                      setSelectedPhoto(null);
                    }}
                    className="btn-success"
                  >
                    <Check size={16} /> Tayangkan Sekarang
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      handleApprove(selectedPhoto.id, false);
                      setSelectedPhoto(null);
                    }}
                    className="btn-secondary"
                  >
                    Batal Tayang
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Pengantin & Tanggal Pernikahan */}
      {showSettingsModal && (
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
          onClick={() => setShowSettingsModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#FAF9F5',
              borderRadius: '16px',
              border: '1px solid #9fb39e',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.25)',
              maxWidth: '440px',
              width: '100%',
              padding: '2rem 1.6rem',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSettingsModal(false)}
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

            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', color: '#2B3A28', margin: '0 0 0.4rem 0' }}>
              💍 Atur Nama Pengantin
            </h3>
            <p style={{ color: '#606C5D', fontSize: '0.86rem', margin: '0 0 1.4rem 0', lineHeight: 1.4 }}>
              Teks ini akan otomatis tercetak sebagai watermark / tanda kenangan di setiap foto tamu.
            </p>

            <form onSubmit={handleSaveSettings}>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#2B3A28', marginBottom: '0.35rem' }}>
                  Judul Acara / Nama Pengantin:
                </label>
                <input 
                  type="text"
                  placeholder="Contoh: The Wedding of Rahma & Febi"
                  value={weddingInfo.title}
                  onChange={(e) => setWeddingInfo({ ...weddingInfo, title: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#E6ECE4',
                    border: '1.5px solid #9FB39E',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.92rem',
                    color: '#2B3A28',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.4rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#2B3A28', marginBottom: '0.35rem' }}>
                  Tanggal Acara:
                </label>
                <input 
                  type="text"
                  placeholder="Contoh: 27 September 2026"
                  value={weddingInfo.wedding_date}
                  onChange={(e) => setWeddingInfo({ ...weddingInfo, wedding_date: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#E6ECE4',
                    border: '1.5px solid #9FB39E',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    fontSize: '0.92rem',
                    color: '#2B3A28',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Pilihan 3 Warna Background Frame */}
              <div style={{ marginBottom: '1.4rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#2B3A28', marginBottom: '0.45rem' }}>
                  Warna Background Frame Photobooth:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'green', name: 'Forest Green', hex: '#2e4c25', textColor: '#ffffff' },
                    { id: 'cream', name: 'Classic Cream', hex: '#FAF8F4', textColor: '#283625', border: '1px solid #c7d2c4' },
                    { id: 'royal_blue', name: 'Royal Blue', hex: '#162746', textColor: '#ffffff' },
                  ].map((t) => {
                    const isSelected = (weddingInfo.frame_theme || 'green') === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setWeddingInfo({ ...weddingInfo, frame_theme: t.id })}
                        style={{
                          cursor: 'pointer',
                          borderRadius: '10px',
                          border: isSelected ? '2.5px solid #C49A38' : (t.border || '2px solid transparent'),
                          padding: '10px 6px',
                          backgroundColor: t.hex,
                          color: t.textColor,
                          textAlign: 'center',
                          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.28)' : '0 1px 3px rgba(0,0,0,0.06)',
                          transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          position: 'relative',
                        }}
                      >
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: '#C49A38',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '10px',
                            fontWeight: 'bold',
                          }}>
                            ✓
                          </div>
                        )}
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: t.hex,
                          border: t.id === 'cream' ? '1.5px solid #9fb39e' : '2px solid rgba(255,255,255,0.7)',
                          margin: '0 auto 6px auto',
                        }} />
                        <div style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 600 }}>
                          {t.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Box Menyesuaikan Warna Background & Teks Otomatis */}
              {(() => {
                const currentTheme = weddingInfo.frame_theme || 'green';
                const isCream = currentTheme === 'cream';
                const isBlue = currentTheme === 'royal_blue';
                const previewBg = isCream ? '#FAF8F4' : isBlue ? '#162746' : '#2e4c25';
                const prefixColor = isCream ? '#556353' : isBlue ? '#D6E3F8' : '#E8EFE5';
                const coupleColor = isCream ? '#283625' : '#FFFFFF';
                const dateColor = isCream ? '#C49A38' : isBlue ? '#E8D8A6' : '#F4EFE6';
                const borderStyle = isCream ? '1.5px solid #d8e0d6' : '1.5px solid rgba(255,255,255,0.15)';
                const tagColor = isCream ? '#C49A38' : '#FFDE7A';
                const parsed = parseWeddingTitle(weddingInfo.title);

                return (
                  <div 
                    style={{
                      backgroundColor: previewBg,
                      border: borderStyle,
                      borderRadius: '12px',
                      padding: '1.2rem 1rem',
                      textAlign: 'center',
                      marginBottom: '1.4rem',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: tagColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Pratinjau Watermark ({isCream ? 'Classic Cream' : isBlue ? 'Royal Blue' : 'Forest Green'}):
                    </div>
                    <div style={{ fontSize: '0.8rem', color: prefixColor, marginTop: '8px', fontStyle: 'italic', fontFamily: 'var(--font-serif)' }}>
                      {parsed.prefix || 'The Wedding of'}
                    </div>
                    <div style={{ fontFamily: '"Alex Brush", var(--font-serif)', fontSize: '1.75rem', color: coupleColor, margin: '2px 0' }}>
                      {parsed.couple || 'Rahma & Febi'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: dateColor, fontWeight: 500 }}>
                      {weddingInfo.wedding_date || '27 September 2026'}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="btn-primary"
                  style={{ flex: 1.5 }}
                >
                  {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code & Cetak Kartu Meja */}
      <QRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        weddingInfo={weddingInfo}
      />
    </div>
  );
}
