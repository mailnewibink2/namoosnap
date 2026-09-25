-- ========================================================
-- NAMOO SNAP - SUPABASE DATABASE & STORAGE SETUP (Idempotent)
-- ========================================================
-- Skrip ini aman dijalankan berulang kali tanpa menghasilkan error "already exists".

-- 1. Buat Tabel photos
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_name TEXT NOT NULL,
    message TEXT,
    image_url TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks untuk performa query
CREATE INDEX IF NOT EXISTS idx_photos_approved ON public.photos(is_approved, created_at DESC);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Drop policy lama jika sudah ada agar tidak bentrok
DROP POLICY IF EXISTS "Allow public insert to photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public select photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public update photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public delete photos" ON public.photos;

-- Buat ulang Policy
CREATE POLICY "Allow public insert to photos" 
ON public.photos FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Allow public select photos" 
ON public.photos FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Allow public update photos" 
ON public.photos FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete photos" 
ON public.photos FOR DELETE 
TO public 
USING (true);

-- 3. Aktifkan Supabase Realtime untuk tabel photos (Cek agar tidak error jika sudah ada)
DO $$
BEGIN
  -- Pastikan publikasi supabase_realtime ada
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Tambahkan tabel photos ke publikasi jika belum terdaftar
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'photos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
  END IF;
END $$;

-- 4. Konfigurasi Storage Bucket 'wedding-photos'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('wedding-photos', 'wedding-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop policy storage lama jika ada
DROP POLICY IF EXISTS "Public photos are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload photos to wedding-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete photos from wedding-photos" ON storage.objects;

-- Buat ulang policy storage
CREATE POLICY "Public photos are viewable by everyone" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'wedding-photos');

CREATE POLICY "Anyone can upload photos to wedding-photos" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'wedding-photos');

CREATE POLICY "Anyone can delete photos from wedding-photos" 
ON storage.objects FOR DELETE 
TO public 
USING (bucket_id = 'wedding-photos');

-- 5. Tabel wedding_settings (Untuk Nama Pengantin & Tanggal yang diatur oleh Kru WO)
CREATE TABLE IF NOT EXISTS public.wedding_settings (
    id TEXT PRIMARY KEY DEFAULT 'current',
    title TEXT DEFAULT 'The Wedding of Rahma & Febi',
    wedding_date TEXT DEFAULT '27 September 2026',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.wedding_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read wedding_settings" ON public.wedding_settings;
DROP POLICY IF EXISTS "Public can insert wedding_settings" ON public.wedding_settings;
DROP POLICY IF EXISTS "Public can update wedding_settings" ON public.wedding_settings;

CREATE POLICY "Public can read wedding_settings" 
ON public.wedding_settings FOR SELECT TO public USING (true);

CREATE POLICY "Public can insert wedding_settings" 
ON public.wedding_settings FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can update wedding_settings" 
ON public.wedding_settings FOR UPDATE TO public USING (true) WITH CHECK (true);

INSERT INTO public.wedding_settings (id, title, wedding_date)
VALUES ('current', 'The Wedding of Rahma & Febi', '27 September 2026')
ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    wedding_date = EXCLUDED.wedding_date;
