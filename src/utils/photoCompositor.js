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
    img.src = '/flower-decor.png?v=2';
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

export const FRAME_THEMES = {
  green: {
    id: 'green',
    name: 'Forest Green',
    bg: '#2e4c25',
    wavyColor: 'rgba(255, 255, 255, 0.055)',
    photoBorder: 'rgba(0, 0, 0, 0.25)',
    prefixColor: '#E8EFE5',
    coupleColor: '#FFFFFF',
    dateColor: '#F4EFE6',
    messageColor: '#FFDE7A',
    guestColor: '#FFFFFF',
    brandingColor: 'rgba(255, 255, 255, 0.4)',
  },
  cream: {
    id: 'cream',
    name: 'Classic Cream',
    bg: '#FAF8F4',
    wavyColor: 'rgba(79, 99, 76, 0.08)',
    photoBorder: 'rgba(43, 58, 40, 0.2)',
    prefixColor: '#556353',
    coupleColor: '#283625',
    dateColor: '#C49A38',
    messageColor: '#4A5847',
    guestColor: '#283625',
    brandingColor: 'rgba(43, 58, 40, 0.45)',
  },
  royal_blue: {
    id: 'royal_blue',
    name: 'Royal Blue',
    bg: '#162746',
    wavyColor: 'rgba(255, 255, 255, 0.06)',
    photoBorder: 'rgba(0, 0, 0, 0.3)',
    prefixColor: '#D6E3F8',
    coupleColor: '#FFFFFF',
    dateColor: '#E8D8A6',
    messageColor: '#FFDE7A',
    guestColor: '#FFFFFF',
    brandingColor: 'rgba(255, 255, 255, 0.4)',
  },
};

function drawWavyBackgroundLines(ctx, width, height, strokeColor = 'rgba(255, 255, 255, 0.055)') {
  ctx.save();
  ctx.strokeStyle = strokeColor;
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

export async function composePhotoboothImage({
  images,
  layout = '1',
  filter = 'normal',
  weddingInfo = { title: 'The Wedding of Rahma & Febi', wedding_date: '27 September 2026', frame_theme: 'green' },
  guestName = '',
  message = '',
  theme = '',
}) {
  const selectedThemeKey = theme || weddingInfo?.frame_theme || 'green';
  const activeTheme = FRAME_THEMES[selectedThemeKey] || FRAME_THEMES.green;

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

  // Pastikan web font sudah terload sebelum menggambar teks kanvas
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('50px "Alex Brush"'),
        document.fonts.load('italic 23px "Playfair Display"'),
        document.fonts.load('500 20px "Cormorant Garamond"'),
        document.fonts.ready,
      ]);
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
  const TOP_MARGIN = 38; // Tepi atas foto lurus dengan margin yang proporsional
  const FOOTER_HEIGHT = 295;

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

  // 1. Gambar latar belakang frame sesuai tema aktif (green, cream, atau royal_blue)
  ctx.fillStyle = activeTheme.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // 2. Garis vertikal bergelombang halus (organik)
  drawWavyBackgroundLines(ctx, CANVAS_WIDTH, canvasHeight, activeTheme.wavyColor);

  // Garis batas klasik elegan jika tema Cream
  if (activeTheme.id === 'cream') {
    ctx.strokeStyle = 'rgba(79, 99, 76, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, CANVAS_WIDTH - 32, canvasHeight - 32);
  }

  // 3. Gambar foto ke dalam slot (tepi lurus & sudut rounded bersih, tidak ada yang menutupi)
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
    ctx.strokeStyle = activeTheme.photoBorder;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, slot.w, slot.h, radius);
    ctx.stroke();
  });

  // 4. Hiasan Bunga di Pojok Kiri Bawah
  if (flowerImg) {
    const flowerSize = 250;
    const flowerX = 8;
    const flowerY = canvasHeight - 260;
    ctx.save();
    ctx.drawImage(flowerImg, flowerX, flowerY, flowerSize, flowerSize);
    ctx.restore();
  }

  // 5. Render Teks Footer Pernikahan (Warna Otomatis Menyesuaikan Kontras Tema)
  const footerContentTop = photoBottomY + 22;
  const centerX = CANVAS_WIDTH / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cleanName = guestName.trim();
  const cleanMessage = message.trim();
  const { prefix, couple } = parseWeddingTitle(weddingInfo.title);

  // Baris 1: "The Wedding of" (di bawah foto, di atas Rahma & Febi dengan jarak yang lega)
  ctx.fillStyle = activeTheme.prefixColor;
  ctx.font = '500 19px "Cormorant Garamond", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(prefix || 'The Wedding of', centerX, footerContentTop + 16);

  // Baris 2: Nama Pengantin ("Rahma & Febi" dengan font cursive kaligrafi elegan, tidak tertabrak)
  ctx.fillStyle = activeTheme.coupleColor;
  ctx.font = 'normal 54px "Alex Brush", "Playfair Display", cursive, serif';
  ctx.fillText(couple, centerX, footerContentTop + 68);

  // Baris 3: Tanggal Pernikahan
  ctx.fillStyle = activeTheme.dateColor;
  ctx.font = '500 20px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(weddingInfo.wedding_date || '27 September 2026', centerX, footerContentTop + 114);

  if (cleanMessage) {
    // Ucapan Tamu
    ctx.fillStyle = activeTheme.messageColor;
    ctx.font = 'italic 22px "Playfair Display", Georgia, serif';
    drawWrappedText(ctx, `"${cleanMessage}"`, centerX, footerContentTop + 160, 780, 28, 2);

    // Nama Tamu
    if (cleanName) {
      ctx.fillStyle = activeTheme.guestColor;
      ctx.font = '500 20px "Cormorant Garamond", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`-${cleanName}-`, centerX, footerContentTop + 204);
    }
  } else if (cleanName) {
    // Hanya Nama Tamu
    ctx.fillStyle = activeTheme.messageColor;
    ctx.font = 'italic 21px "Playfair Display", Georgia, serif';
    ctx.fillText('Terima kasih atas doa & kehadirannya', centerX, footerContentTop + 158);

    ctx.fillStyle = activeTheme.guestColor;
    ctx.font = '500 20px "Cormorant Garamond", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`-${cleanName}-`, centerX, footerContentTop + 196);
  } else {
    // State Default Sebelum Tamu Mengetik
    ctx.fillStyle = activeTheme.messageColor;
    ctx.font = 'italic 20px "Playfair Display", Georgia, serif';
    ctx.fillText('Abadikan Momen Hangat & Penuh Kebahagiaan', centerX, footerContentTop + 160);
  }

  // Branding kecil Namoo Snap di paling bawah
  ctx.fillStyle = activeTheme.brandingColor;
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
