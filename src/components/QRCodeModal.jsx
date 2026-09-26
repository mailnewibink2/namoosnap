import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { parseWeddingTitle } from '../utils/weddingSettings';
import { 
  X, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  QrCode as QrIcon,
  Layers,
  Heart
} from 'lucide-react';

export default function QRCodeModal({ isOpen, onClose, weddingInfo }) {
  const defaultUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://namoosnap.vercel.app';

  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('card'); // 'card' | 'qr-only'
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const printAreaRef = useRef(null);

  // Generate QR code saat targetUrl berubah
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(targetUrl, {
      width: 1000,
      margin: 2,
      color: {
        dark: '#283625', // Forest green elegan
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      });
  }, [targetUrl, isOpen]);

  if (!isOpen) return null;

  // Salin link ke clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Unduh QR Code murni (PNG)
  const handleDownloadQrOnly = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-code-${(weddingInfo?.title || 'wedding').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cetak kartu meja langsung via printer browser
  const handlePrint = () => {
    window.print();
  };

  // Render & Unduh Kartu Meja Siap Cetak sebagai Gambar Resolusi Tinggi (1200 x 1800 px - rasio 2:3 A6/4x6)
  const handleDownloadCardImage = async () => {
    if (!qrDataUrl) return;

    try {
      setIsGeneratingImage(true);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const width = 1200;
      const height = 1800;
      canvas.width = width;
      canvas.height = height;

      // 1. Background Warm Wedding Ivory
      ctx.fillStyle = '#FAF9F5';
      ctx.fillRect(0, 0, width, height);

      // 2. Border Garis Ganda Elegan
      ctx.strokeStyle = '#dfb76c';
      ctx.lineWidth = 4;
      ctx.strokeRect(50, 50, width - 100, height - 100);

      ctx.strokeStyle = '#2B3A28';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(62, 62, width - 124, height - 124);

      // 3. Ornamen Sudut
      ctx.fillStyle = '#C49A38';
      const drawCornerAccent = (x, y) => {
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      };
      drawCornerAccent(62, 62);
      drawCornerAccent(width - 62, 62);
      drawCornerAccent(62, height - 62);
      drawCornerAccent(width - 62, height - 62);

      // Set default text alignment selalu CENTER
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      // 4. Logo / Header Namoo Snap (Menggunakan Logo Gambar Digital Photo Booth)
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = '/namoo-logo.png?v=4';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
      });

      if (logoImg.complete && logoImg.naturalWidth > 0) {
        const logoTargetWidth = 230;
        const logoTargetHeight = (logoImg.naturalHeight / logoImg.naturalWidth) * logoTargetWidth;
        ctx.drawImage(logoImg, (width - logoTargetWidth) / 2, 75, logoTargetWidth, logoTargetHeight);
      } else {
        ctx.fillStyle = '#2B3A28';
        ctx.font = 'bold 36px "Playfair Display", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('NAMOO SNAP', width / 2, 160);

        ctx.fillStyle = '#C49A38';
        ctx.font = '600 22px "Inter", sans-serif';
        ctx.fillText('DIGITAL PHOTO BOOTH', width / 2, 205);
      }

      // 5. Nama Pengantin & Tanggal (Format 3 Baris Sesuai Home)
      const { prefix, couple } = parseWeddingTitle(weddingInfo?.title);

      // Baris 1: The Wedding of
      ctx.textAlign = 'center';
      ctx.fillStyle = '#768772';
      ctx.font = 'italic 34px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(prefix, width / 2, 315);

      // Baris 2: Nama Pasangan (Auto-scaling agar tidak pernah terpotong)
      ctx.fillStyle = '#283625';
      let coupleFontSize = 58;
      ctx.font = `600 ${coupleFontSize}px "Cormorant Garamond", Georgia, serif`;
      while (ctx.measureText(couple).width > 860 && coupleFontSize > 28) {
        coupleFontSize -= 2;
        ctx.font = `600 ${coupleFontSize}px "Cormorant Garamond", Georgia, serif`;
      }
      ctx.fillText(couple, width / 2, 375);

      // Baris 3: Tanggal Pernikahan
      ctx.fillStyle = '#C49A38';
      ctx.font = '600 24px "Plus Jakarta Sans", "Inter", sans-serif';
      ctx.fillText(weddingInfo?.wedding_date || '', width / 2, 425);

      // 6. Subheader Ajakan Scan
      ctx.fillStyle = '#2B3A28';
      ctx.font = '600 32px "Cormorant Garamond", Georgia, serif';
      ctx.fillText('Abadikan & Bagikan Momen Anda', width / 2, 500);

      ctx.fillStyle = '#556353';
      ctx.font = 'normal 22px "Plus Jakarta Sans", "Inter", sans-serif';
      ctx.fillText('Scan QR Code menggunakan kamera HP Anda', width / 2, 545);

      // 7. Kotak Frame QR Code
      const qrBoxSize = 580;
      const qrBoxX = (width - qrBoxSize) / 2;
      const qrBoxY = 605;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(40, 54, 37, 0.12)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 10;
      ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
      ctx.shadowColor = 'transparent'; // reset shadow

      ctx.strokeStyle = '#dfb76c';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

      // Gambar QR Image
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.src = qrDataUrl;
      await new Promise((resolve) => {
        qrImg.onload = resolve;
      });

      const qrPadding = 25;
      ctx.drawImage(
        qrImg, 
        qrBoxX + qrPadding, 
        qrBoxY + qrPadding, 
        qrBoxSize - (qrPadding * 2), 
        qrBoxSize - (qrPadding * 2)
      );

      // 8. Tiga Langkah Mudah (Box Container Rapi di Tengah)
      const infoBoxWidth = 840;
      const infoBoxHeight = 220;
      const infoBoxX = (width - infoBoxWidth) / 2;
      const infoBoxY = 1235;

      ctx.fillStyle = '#EBF0E9';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, 16);
        ctx.fill();
        ctx.strokeStyle = '#d0ddd0';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillRect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight);
      }

      // Judul Box 3 Langkah
      ctx.textAlign = 'center';
      ctx.fillStyle = '#283625';
      ctx.font = 'bold 24px "Inter", sans-serif';
      ctx.fillText('✨ 3 LANGKAH MUDAH BERBAGI FOTO ✨', width / 2, infoBoxY + 45);

      // Item Langkah (Rata kiri dengan margin presisi di dalam box)
      ctx.textAlign = 'left';
      const textStartX = infoBoxX + 60;
      ctx.fillStyle = '#394837';
      ctx.font = '500 22px "Inter", sans-serif';
      ctx.fillText('1. Scan QR Code di atas menggunakan kamera HP Anda', textStartX, infoBoxY + 95);
      ctx.fillText('2. Ambil foto seru (1, 2, atau 4 grid) & pilih filter favorit', textStartX, infoBoxY + 138);
      ctx.fillText('3. Kirim, dan foto Anda langsung tayang di layar proyektor!', textStartX, infoBoxY + 180);

      // 9. Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#C49A38';
      ctx.font = 'italic 23px "Playfair Display", Georgia, serif';
      ctx.fillText('✨ Terima kasih telah merayakan hari bahagia kami ✨', width / 2, 1665);

      // Download Kanvas
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `kartu-meja-qr-${(weddingInfo?.title || 'wedding').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Error saat membuat gambar kartu meja:', err);
      alert('Gagal mendownload gambar kartu meja: ' + err.message);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 28, 19, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.2rem',
        zIndex: 9999,
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FAF9F5',
          borderRadius: '24px',
          maxWidth: '540px',
          width: '100%',
          padding: '1.8rem 1.6rem',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
          border: '1.5px solid #dbe4d9',
          boxSizing: 'border-box',
          position: 'relative',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Tutup */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: '#E6ECE4',
            border: 'none',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#344231',
            transition: 'background-color 0.2s',
          }}
        >
          <X size={18} />
        </button>

        {/* Header Modal */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
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
              margin: '0 auto 0.6rem auto',
              border: '1px solid #c9d8c7',
            }}
          >
            <QrIcon size={26} color="#2E3E2B" />
          </div>

          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.45rem',
              color: '#283625',
              marginBottom: '0.25rem',
              fontWeight: 600,
            }}
          >
            QR Code Acara Pernikahan
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#556353', margin: 0 }}>
            Tamu cukup scan QR Code ini untuk langsung membuka kamera & berbagi foto.
          </p>
        </div>

        {/* Tab Switcher: Kartu Meja vs QR Saja */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            backgroundColor: '#E6ECE4',
            padding: '4px',
            borderRadius: '12px',
            marginBottom: '1.2rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 0',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'card' ? 700 : 500,
              backgroundColor: activeTab === 'card' ? '#2E3E2B' : 'transparent',
              color: activeTab === 'card' ? '#ffffff' : '#455243',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <Layers size={15} />
            <span>Kartu Meja (Siap Cetak)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr-only')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 0',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'qr-only' ? 700 : 500,
              backgroundColor: activeTab === 'qr-only' ? '#2E3E2B' : 'transparent',
              color: activeTab === 'qr-only' ? '#ffffff' : '#455243',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <QrIcon size={15} />
            <span>QR Code Saja</span>
          </button>
        </div>

        {/* Konten Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* TAB 1: KARTU MEJA PERNIKAHAN (PRINTABLE TENT CARD) */}
          {activeTab === 'card' && (
            <div>
              {/* Card Container yang akan dicetak */}
              <div
                id="namoo-printable-card"
                ref={printAreaRef}
                style={{
                  backgroundColor: '#FAF9F5',
                  border: '2px solid #dfb76c',
                  borderRadius: '16px',
                  padding: '1.4rem 1.2rem',
                  textAlign: 'center',
                  boxShadow: '0 8px 24px rgba(40, 54, 37, 0.08)',
                  position: 'relative',
                  marginBottom: '1.2rem',
                }}
              >
                {/* Header Card dengan Logo Gambar */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.45rem' }}>
                  <img 
                    src="/namoo-logo.png?v=4" 
                    alt="Namoo Snap - Digital Photo Booth"
                    style={{
                      width: '95px',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </div>
                
                {(() => {
                  const { prefix, couple } = parseWeddingTitle(weddingInfo?.title);
                  return (
                    <div style={{ marginTop: '0.65rem', marginBottom: '0.85rem' }}>
                      <div 
                        style={{ 
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-serif)', 
                          fontStyle: 'italic', 
                          color: '#768772',
                          letterSpacing: '0.06em',
                          lineHeight: 1.2
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
                          letterSpacing: '0.04em'
                        }}
                      >
                        {weddingInfo?.wedding_date || '28 Oktober 2026'}
                      </div>
                    </div>
                  );
                })()}

                {/* Ajakan Singkat */}
                <div 
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '0.98rem',
                    fontWeight: 500,
                    color: '#344231',
                    marginBottom: '0.65rem'
                  }}
                >
                  Scan & Bagikan Foto Momen Bahagiamu!
                </div>

                {/* QR Code Container */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '12px',
                    borderRadius: '14px',
                    display: 'inline-block',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2eae0',
                    margin: '0 auto 0.85rem auto',
                  }}
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Wedding QR Code"
                      style={{
                        width: '180px',
                        height: '180px',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Membuat QR...
                    </div>
                  )}
                </div>

                {/* 3 Langkah Mudah */}
                <div
                  style={{
                    backgroundColor: '#E6ECE4',
                    borderRadius: '10px',
                    padding: '0.65rem 0.8rem',
                    fontSize: '0.76rem',
                    color: '#344231',
                    lineHeight: 1.45,
                    textAlign: 'left',
                    maxWidth: '320px',
                    margin: '0 auto',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '2px', color: '#2B3A28' }}>
                    Cara Berbagi Foto:
                  </div>
                  <div>1. Scan QR pakai kamera HP Anda</div>
                  <div>2. Ambil foto seru dengan filter cantik</div>
                  <div>3. Foto langsung tayang di layar proyektor!</div>
                </div>
              </div>

              {/* Tombol Aksi untuk Kartu Meja */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={handleDownloadCardImage}
                  disabled={isGeneratingImage || !qrDataUrl}
                  style={{
                    backgroundColor: '#2E3E2B',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.75rem 0.9rem',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(46, 62, 43, 0.2)',
                  }}
                >
                  <Download size={16} />
                  <span>{isGeneratingImage ? 'Memproses...' : 'Unduh Gambar (JPG)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#2E3E2B',
                    border: '1.5px solid #2E3E2B',
                    borderRadius: '12px',
                    padding: '0.75rem 0.9rem',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Printer size={16} />
                  <span>Cetak / Print</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: QR CODE SAJA */}
          {activeTab === 'qr-only' && (
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '16px',
                  borderRadius: '16px',
                  display: 'inline-block',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
                  border: '1.5px solid #e2eae0',
                  margin: '0 auto 1.2rem auto',
                }}
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Wedding QR Code"
                    style={{
                      width: '230px',
                      height: '230px',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div style={{ width: '230px', height: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Membuat QR...
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadQrOnly}
                  disabled={!qrDataUrl}
                  style={{
                    backgroundColor: '#2E3E2B',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.75rem 1.6rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(46, 62, 43, 0.2)',
                  }}
                >
                  <Download size={17} />
                  <span>Download QR Code (PNG)</span>
                </button>
              </div>
            </div>
          )}

          {/* Pengaturan Link Target */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              border: '1px solid #d8e2d5',
              marginTop: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#344231' }}>
                Link Tujuan Saat Discan:
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copied ? '#166534' : '#C49A38',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
              </button>
            </div>

            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://..."
              style={{
                width: '100%',
                backgroundColor: '#FAF9F5',
                border: '1px solid #9FB39E',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.82rem',
                fontFamily: 'monospace',
                color: '#283625',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <div style={{ fontSize: '0.7rem', color: '#738271', marginTop: '0.35rem' }}>
              * Otomatis mengarah ke domain aplikasi saat ini. Kru WO dapat mengubah jika menggunakan domain kustom.
            </div>
          </div>

        </div>

      </div>

      {/* Style Khusus untuk Mode Print Browser */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #namoo-printable-card, #namoo-printable-card * {
            visibility: visible;
          }
          #namoo-printable-card {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 80% !important;
            max-width: 480px !important;
            border: 2px solid #C49A38 !important;
            box-shadow: none !important;
            padding: 2.5rem !important;
          }
        }
      `}</style>
    </div>
  );
}
