// Utilitas untuk menggabungkan 1, 2, atau 4 foto dengan layout grid, filter, dan wedding watermark frame

export async function composePhotoboothImage({
  images, // Array of Image elements or Image URLs
  layout = '1', // '1' | '2' | '4'
  filter = 'normal', // 'normal' | 'bw' | 'classic'
  weddingInfo = { title: 'The Wedding of Sarah & Dimas', wedding_date: '24 September 2026' },
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
  const FOOTER_HEIGHT = 160;

  let canvasHeight = 1080;

  // Tentukan dimensi berdasarkan layout
  let slotWidth = 0;
  let slotHeight = 0;
  let slots = [];

  if (layout === '1') {
    // 1 Foto Tunggal (Format Portrait 4:5 atau 1:1)
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
  ctx.strokeStyle = 'rgba(79, 99, 76, 0.15)';
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

  // 3. Render Wedding Watermark / Sign di Footer Frame
  const footerCenterY = canvasHeight - FOOTER_HEIGHT / 2 - 8;

  // Ikon ornamen pembatas atas footer
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Ornamen tengah
  ctx.fillStyle = '#C49A38'; // Gold accent
  ctx.font = '22px serif';
  ctx.fillText('❦', CANVAS_WIDTH / 2, footerCenterY - 42);

  // Judul Pernikahan (Nama Pengantin)
  ctx.fillStyle = '#2B3A28'; // Deep forest green
  ctx.font = 'bold 36px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(weddingInfo.title || 'The Wedding of Sarah & Dimas', CANVAS_WIDTH / 2, footerCenterY - 6);

  // Tanggal Pernikahan
  ctx.fillStyle = '#6E7C6C'; // Soft sage grey
  ctx.font = '500 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(weddingInfo.wedding_date || '24 September 2026', CANVAS_WIDTH / 2, footerCenterY + 34);

  // Branding kecil Namoo Snap di sudut bawah
  ctx.fillStyle = '#9FB39E';
  ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NAMOO SNAP • DIGITAL PHOTOBOOTH', CANVAS_WIDTH / 2, canvasHeight - 24);

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
