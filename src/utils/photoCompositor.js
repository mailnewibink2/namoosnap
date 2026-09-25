// Utilitas untuk menggabungkan foto photobooth dengan green frame (#2e4c25), ornamen bunga, dan tipografi pernikahan
import { parseWeddingTitle } from './weddingSettings';

let cachedFlowerImage = null;

function loadFlowerImage() {
  if (cachedFlowerImage && cachedFlowerImage.complete) {
    return Promise.resolve(cachedFlowerImage);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedFlowerImage = img;
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = '/flower-decor.png';
  });
}

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

function drawWavyBackgroundLines(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
  ctx.lineWidth = 1.5;

  for (let x = 18; x < width; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    const waveCount = 12;
    const waveHeight = height / waveCount;
    for (let i = 0; i < waveCount; i++) {
      const cy = i * waveHeight + waveHeight / 2;
      const ey = (i + 1) * waveHeight;
      const offset = (i % 2 === 0 ? 5 : -5) * (Math.sin(x * 0.1 + i) > 0 ? 1 : -0.85);
      ctx.quadraticCurveTo(x + offset, cy, x, ey);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawTopWeddingArch(ctx, width, topY, archDepth = 100) {
  const centerX = width / 2;
  const archW = 380;

  ctx.save();

  // Lengkungan atas hijau yang masuk ke area foto
  ctx.fillStyle = '#2e4c25';
  ctx.beginPath();
  ctx.moveTo(centerX - archW / 2, topY);
  ctx.bezierCurveTo(
    centerX - archW / 3, topY + archDepth,
    centerX + archW / 3, topY + archDepth,
    centerX + archW / 2, topY
  );
  ctx.closePath();
  ctx.fill();

  // Garis lengkung halus
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX - archW / 2, topY);
  ctx.bezierCurveTo(
    centerX - archW / 3, topY + archDepth,
    centerX + archW / 3, topY + archDepth,
    centerX + archW / 2, topY
  );
  ctx.stroke();

  // Tulisan "The"
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'italic 22px "Alex Brush", "Playfair Display", cursive, serif';
  ctx.fillText('The', centerX - 14, topY + 28);

  // Simbol hati kecil
  ctx.fillStyle = '#FFDE7A';
  ctx.font = '15px serif';
  ctx.fillText('♥', centerX + 18, topY + 26);

  // Tulisan "Wedding"
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'normal 48px "Alex Brush", "Playfair Display", cursive, serif';
  ctx.fillText('Wedding', centerX, topY + 62);

  // Garis aksen bawah "Wedding"
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX - 46, topY + 77);
  ctx.lineTo(centerX + 46, topY + 77);
  ctx.stroke();

  ctx.restore();
}

export async function composePhotoboothImage({
  images,
  layout = '1',
  filter = 'normal',
  weddingInfo = { title: 'The Wedding of Rahma & Febi', wedding_date: '27 September 2026' },
  guestName = '',
  message = '',
}) {
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

  // Pastikan web font (Alex Brush, Playfair Display, Cormorant Garamond) sudah terload sebelum menggambar teks
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Abaikan jika fonts API gagal
    }
  }

  const flowerImg = await loadFlowerImage();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const CANVAS_WIDTH = 1080;
  const PADDING = 38;
  const GAP = 18;
  const TOP_MARGIN = 58;
  const FOOTER_HEIGHT = 280;

  let canvasHeight = 1080;
  let slotWidth = 0;
  let slotHeight = 0;
  let slots = [];
  let photoBottomY = 0;

  if (layout === '1') {
    slotWidth = CANVAS_WIDTH - PADDING * 2;
    slotHeight = Math.round(slotWidth * 1.25);
    canvasHeight = TOP_MARGIN + slotHeight + FOOTER_HEIGHT + 24;
    slots = [{ x: PADDING, y: TOP_MARGIN, w: slotWidth, h: slotHeight }];
    photoBottomY = TOP_MARGIN + slotHeight;
  } else if (layout === '2') {
    slotWidth = CANVAS_WIDTH - PADDING * 2;
    slotHeight = Math.round(slotWidth * 0.72);
    canvasHeight = TOP_MARGIN + slotHeight * 2 + GAP + FOOTER_HEIGHT + 24;
    slots = [
      { x: PADDING, y: TOP_MARGIN, w: slotWidth, h: slotHeight },
      { x: PADDING, y: TOP_MARGIN + slotHeight + GAP, w: slotWidth, h: slotHeight },
    ];
    photoBottomY = TOP_MARGIN + slotHeight * 2 + GAP;
  } else {
    slotWidth = Math.round((CANVAS_WIDTH - PADDING * 2 - GAP) / 2);
    slotHeight = Math.round(slotWidth * 1.16);
    canvasHeight = TOP_MARGIN + slotHeight * 2 + GAP + FOOTER_HEIGHT + 24;
    slots = [
      { x: PADDING, y: TOP_MARGIN, w: slotWidth, h: slotHeight },
      { x: PADDING + slotWidth + GAP, y: TOP_MARGIN, w: slotWidth, h: slotHeight },
      { x: PADDING, y: TOP_MARGIN + slotHeight + GAP, w: slotWidth, h: slotHeight },
      { x: PADDING + slotWidth + GAP, y: TOP_MARGIN + slotHeight + GAP, w: slotWidth, h: slotHeight },
    ];
    photoBottomY = TOP_MARGIN + slotHeight * 2 + GAP;
  }

  canvas.width = CANVAS_WIDTH;
  canvas.height = canvasHeight;

  // 1. Gambar latar belakang hijau tua (#2e4c25) sesuai permintaan user
  ctx.fillStyle = '#2e4c25';
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // 2. Garis vertikal bergelombang halus (organik mirip referensi)
  drawWavyBackgroundLines(ctx, CANVAS_WIDTH, canvasHeight);

  // 3. Gambar foto ke dalam slot
  slots.forEach((slot, index) => {
    const img = loadedImages[index] || loadedImages[0];
    if (!img) return;

    ctx.save();

    ctx.beginPath();
    const radius = 10;
    ctx.roundRect(slot.x, slot.y, slot.w, slot.h, radius);
    ctx.clip();

    if (filter === 'bw') {
      ctx.filter = 'grayscale(100%) contrast(118%) brightness(104%)';
    } else if (filter === 'classic') {
      ctx.filter = 'sepia(38%) contrast(108%) brightness(102%) saturate(85%)';
    } else {
      ctx.filter = 'none';
    }

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

    // Garis tepi halus pada foto
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, slot.w, slot.h, radius);
    ctx.stroke();
  });

  // 4. Lengkungan atas dengan teks "The Wedding"
  drawTopWeddingArch(ctx, CANVAS_WIDTH, TOP_MARGIN, 100);

  // 5. Lengkungan bawah melengkung lembut ke atas foto
  ctx.save();
  ctx.fillStyle = '#2e4c25';
  ctx.beginPath();
  ctx.moveTo(PADDING - 8, photoBottomY);
  ctx.quadraticCurveTo(CANVAS_WIDTH / 2, photoBottomY - 26, CANVAS_WIDTH - PADDING + 8, photoBottomY);
  ctx.lineTo(CANVAS_WIDTH, canvasHeight);
  ctx.lineTo(0, canvasHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 6. Hiasan Bunga (Peony/Mawar Putih) di Pojok Kiri Bawah
  if (flowerImg) {
    const flowerSize = 230;
    const flowerX = 28;
    const flowerY = photoBottomY - 32;
    ctx.save();
    ctx.drawImage(flowerImg, flowerX, flowerY, flowerSize, flowerSize);
    ctx.restore();
  }

  // 7. Render Teks Footer Pernikahan
  const footerContentTop = photoBottomY + 28;
  const centerX = CANVAS_WIDTH / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cleanName = guestName.trim();
  const cleanMessage = message.trim();
  const { couple } = parseWeddingTitle(weddingInfo.title);

  // Baris 1: Nama Pengantin (Putih Bersih & Cursive Kaligrafi Elegan)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'normal 56px "Alex Brush", "Playfair Display", cursive, serif';
  ctx.fillText(couple, centerX, footerContentTop + 24);

  // Baris 2: Tanggal Pernikahan (Warm Ivory)
  ctx.fillStyle = '#F4EFE6';
  ctx.font = '500 22px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(weddingInfo.wedding_date || '27 September 2026', centerX, footerContentTop + 68);

  if (cleanMessage) {
    // Ucapan Tamu (Warna Emas Hangat #FFDE7A agar kontras dan sangat terbaca)
    ctx.fillStyle = '#FFDE7A';
    ctx.font = 'italic 23px "Playfair Display", Georgia, serif';
    drawWrappedText(ctx, `"${cleanMessage}"`, centerX, footerContentTop + 120, 780, 30, 2);

    // Nama Tamu
    if (cleanName) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '500 21px "Cormorant Garamond", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`-${cleanName}-`, centerX, footerContentTop + 162);
    }
  } else if (cleanName) {
    // Hanya Nama Tamu
    ctx.fillStyle = '#FFDE7A';
    ctx.font = 'italic 22px "Playfair Display", Georgia, serif';
    ctx.fillText('Terima kasih atas doa & kehadirannya', centerX, footerContentTop + 116);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '500 21px "Cormorant Garamond", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`-${cleanName}-`, centerX, footerContentTop + 154);
  } else {
    // State Default Sebelum Tamu Mengetik
    ctx.fillStyle = '#FFDE7A';
    ctx.font = 'italic 21px "Playfair Display", Georgia, serif';
    ctx.fillText('Abadikan Momen Hangat & Penuh Kebahagiaan', centerX, footerContentTop + 124);
  }

  // Branding kecil Namoo Snap di paling bawah
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
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
      0.92
    );
  });
}
