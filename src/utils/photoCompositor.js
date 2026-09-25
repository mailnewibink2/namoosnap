// Utilitas untuk menggabungkan 1, 2, atau 4 foto dengan layout grid, filter, dan wedding watermark frame terintegrasi
import { parseWeddingTitle } from './weddingSettings';

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  if (!text) return;
  const words = text.split(' ');
  let line = '';
  const lines = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
      if (lines.length >= maxLines - 1) {
        const remaining = words.slice(n).join(' ');
        if (ctx.measureText(remaining).width > maxWidth) {
          line = remaining.slice(0, Math.floor(remaining.length * 0.7)) + '...';
        } else {
          line = remaining;
        }
        break;
      }
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = y - totalHeight / 2;

  lines.forEach((l, i) => {
    ctx.fillText(l, x, startY + i * lineHeight);
  });
}

export async function composePhotoboothImage({
  images, // Array of Image elements or Image URLs
  layout = '1', // '1' | '2' | '4'
  filter = 'normal', // 'normal' | 'bw' | 'classic'
  weddingInfo = { title: 'The Wedding of Rahma & Febi', wedding_date: '27 September 2026' },
  guestName = '',
  message = '',
}) {
  // Load semua image jika masih berupa URL/Blob
  const loadedImages = await Promise.all(
    images.map((src) => {
      return new Promise((resolve, reject) => {
        if (src instanceof HTMLImageElement && src.complete) {
          resolve(src);
          return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Gagal memuat gambar'));
        img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
      });
    })
  );

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Konfigurasi ukuran kanvas photobooth (lebar standar 1080px)
  const CANVAS_WIDTH = 1080;
  const PADDING = 44;
  const GAP = 28;
  const FOOTER_HEIGHT = 240; // Ruang proporsional untuk nama tamu, ucapan, dan format 3-baris wedding

  let canvasHeight = 1080;

  // Tentukan dimensi berdasarkan layout
  let slotWidth = 0;
  let slotHeight = 0;
  let slots = [];

  if (layout === '1') {
    // 1 Foto Tunggal (Format Portrait)
    slotWidth = CANVAS_WIDTH - PADDING * 2;
    slotHeight = Math.round(slotWidth * 1.05);
    canvasHeight = PADDING + slotHeight + FOOTER_HEIGHT + PADDING;

    slots = [{ x: PADDING, y: PADDING, w: slotWidth, h: slotHeight }];
  } else if (layout === '2') {
    // 2 Foto Vertikal (Photobooth Strip 2 Foto)
    slotWidth = CANVAS_WIDTH - PADDING * 2;
    slotHeight = Math.round(slotWidth * 0.68);
    canvasHeight = PADDING + slotHeight * 2 + GAP + FOOTER_HEIGHT + PADDING;

    slots = [
      { x: PADDING, y: PADDING, w: slotWidth, h: slotHeight },
      { x: PADDING, y: PADDING + slotHeight + GAP, w: slotWidth, h: slotHeight },
    ];
  } else {
    // 4 Foto (2x2 Grid Photobooth Klasik)
    slotWidth = Math.round((CANVAS_WIDTH - PADDING * 2 - GAP) / 2);
    slotHeight = Math.round(slotWidth * 1.05);
    canvasHeight = PADDING + slotHeight * 2 + GAP + FOOTER_HEIGHT + PADDING;

    slots = [
      { x: PADDING, y: PADDING, w: slotWidth, h: slotHeight },
      { x: PADDING + slotWidth + GAP, y: PADDING, w: slotWidth, h: slotHeight },
      { x: PADDING, y: PADDING + slotHeight + GAP, w: slotWidth, h: slotHeight },
      { x: PADDING + slotWidth + GAP, y: PADDING + slotHeight + GAP, w: slotWidth, h: slotHeight },
    ];
  }

  canvas.width = CANVAS_WIDTH;
  canvas.height = canvasHeight;

  // 1. Gambar latar belakang frame (Soft warm ivory / off-white photobooth border)
  ctx.fillStyle = '#FAF8F4';
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // Garis tepi tipis elegan di sekeliling frame
  ctx.strokeStyle = 'rgba(79, 99, 76, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, CANVAS_WIDTH - 32, canvasHeight - 32);

  // 2. Gambar setiap foto ke dalam slot dengan object-fit cover dan filter
  slots.forEach((slot, index) => {
    const img = loadedImages[index] || loadedImages[0];
    if (!img) return;

    ctx.save();

    // Buat clipping mask rounded corner untuk setiap foto
    ctx.beginPath();
    const radius = 12;
    ctx.roundRect(slot.x, slot.y, slot.w, slot.h, radius);
    ctx.clip();

    // Terapkan filter jika ada
    if (filter === 'bw') {
      ctx.filter = 'grayscale(100%) contrast(118%) brightness(104%)';
    } else if (filter === 'classic') {
      ctx.filter = 'sepia(38%) contrast(108%) brightness(102%) saturate(85%)';
    } else {
      ctx.filter = 'none';
    }

    // Object-fit 'cover' matematika
    const imgRatio = img.width / img.height;
    const slotRatio = slot.w / slot.h;
    let sWidth, sHeight, sx, sy;

    if (imgRatio > slotRatio) {
      sHeight = img.height;
      sWidth = img.height * slotRatio;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = img.width;
      sHeight = img.width / slotRatio;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, slot.x, slot.y, slot.w, slot.h);

    ctx.restore();

    // Border halus di sekitar slot foto
    ctx.strokeStyle = 'rgba(43, 58, 40, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, slot.w, slot.h, radius);
    ctx.stroke();
  });

  // 3. Render Footer Frame
  // Sesuai permintaan user:
  // Format di foto: Nama Tamu & Ucapan di atas, lalu di bawahnya:
  // (Baris 1) The Wedding of
  // (Baris 2) Rahma & Febi
  // (Baris 3) Tanggal Acara
  const footerTop = canvasHeight - PADDING - FOOTER_HEIGHT;
  const centerX = CANVAS_WIDTH / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cleanName = guestName.trim();
  const cleanMessage = message.trim();
  const { prefix, couple } = parseWeddingTitle(weddingInfo.title);

  if (cleanName || cleanMessage) {
    // === SKENARIO 1: NAMA TAMU & UCAPAN ADA DI ATAS ===
    if (cleanName && cleanMessage) {
      // Ada Nama Tamu & Ucapan
      ctx.fillStyle = '#2B3A28';
      ctx.font = 'bold 26px "Playfair Display", Georgia, serif';
      ctx.fillText(`Dari: ${cleanName}`, centerX, footerTop + 26);

      ctx.fillStyle = '#556353';
      ctx.font = 'italic 20px "Playfair Display", Georgia, serif';
      drawWrappedText(ctx, `"${cleanMessage}"`, centerX, footerTop + 58, 920, 26, 2);
    } else if (cleanName) {
      // Hanya ada Nama Tamu
      ctx.fillStyle = '#2B3A28';
      ctx.font = 'bold 28px "Playfair Display", Georgia, serif';
      ctx.fillText(`Dari: ${cleanName}`, centerX, footerTop + 42);
    } else {
      // Hanya ada Ucapan
      ctx.fillStyle = '#556353';
      ctx.font = 'italic 22px "Playfair Display", Georgia, serif';
      drawWrappedText(ctx, `"${cleanMessage}"`, centerX, footerTop + 42, 920, 26, 2);
    }

    // Garis Pembatas Halus dengan Ornamen Tengah
    const dividerY = footerTop + 98;
    ctx.strokeStyle = 'rgba(196, 154, 56, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 170, dividerY);
    ctx.lineTo(centerX - 18, dividerY);
    ctx.moveTo(centerX + 18, dividerY);
    ctx.lineTo(centerX + 170, dividerY);
    ctx.stroke();

    ctx.fillStyle = '#C49A38';
    ctx.font = '13px serif';
    ctx.fillText('❦', centerX, dividerY);

    // === FORMAT 3 BARIS DI BAWAH NAMA DAN UCAPAN ===
    // Baris 1: The Wedding of
    ctx.fillStyle = '#768772';
    ctx.font = 'italic 19px "Playfair Display", Georgia, serif';
    ctx.fillText(prefix, centerX, footerTop + 126);

    // Baris 2: Nama Pengantin (Besar & Elegan)
    ctx.fillStyle = '#283625';
    ctx.font = 'bold 31px "Playfair Display", Georgia, serif';
    ctx.fillText(couple, centerX, footerTop + 158);

    // Baris 3: Tanggal Pernikahan
    ctx.fillStyle = '#C49A38';
    ctx.font = '600 17px "Inter", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(weddingInfo.wedding_date || '', centerX, footerTop + 192);

  } else {
    // === SKENARIO 2: BELUM DIISI NAMA (STATE SAAT BARU AMBIL FOTO) ===
    // Tampilkan format 3-baris wedding di tengah dengan elegan
    ctx.fillStyle = '#768772';
    ctx.font = 'italic 20px "Playfair Display", Georgia, serif';
    ctx.fillText(prefix, centerX, footerTop + 46);

    ctx.fillStyle = '#283625';
    ctx.font = 'bold 34px "Playfair Display", Georgia, serif';
    ctx.fillText(couple, centerX, footerTop + 84);

    ctx.fillStyle = '#C49A38';
    ctx.font = '600 18px "Inter", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(weddingInfo.wedding_date || '', centerX, footerTop + 122);

    const dividerY = footerTop + 152;
    ctx.strokeStyle = 'rgba(196, 154, 56, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 160, dividerY);
    ctx.lineTo(centerX - 18, dividerY);
    ctx.moveTo(centerX + 18, dividerY);
    ctx.lineTo(centerX + 160, dividerY);
    ctx.stroke();

    ctx.fillStyle = '#C49A38';
    ctx.font = '13px serif';
    ctx.fillText('❦', centerX, dividerY);

    ctx.fillStyle = '#899986';
    ctx.font = 'italic 17px "Playfair Display", Georgia, serif';
    ctx.fillText('Abadikan Momen Hangat & Penuh Kebahagiaan', centerX, footerTop + 182);
  }

  // Branding kecil Namoo Snap di paling bawah
  ctx.fillStyle = '#A2B3A0';
  ctx.font = '600 11px "Inter", "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NAMOO SNAP • DIGITAL PHOTOBOOTH', centerX, canvasHeight - 16);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal menghasilkan kanvas photobooth'));
          return;
        }
        resolve({
          blob,
          dataUrl: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
        });
      },
      'image/jpeg',
      0.88
    );
  });
}
