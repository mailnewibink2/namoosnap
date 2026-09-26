import { supabase, isSupabaseConfigured } from '../supabaseClient';

const DEFAULT_SETTINGS = {
  title: 'The Wedding of Bride & Groom',
  wedding_date: '28 Oktober 2026',
  frame_theme: 'green', // 'green' | 'cream' | 'royal_blue'
};

const LOCAL_STORAGE_KEY = 'namoo_wedding_settings';

export async function getWeddingSettings() {
  // Coba ambil dari localStorage dulu untuk kecepatan
  let cached = null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage read error:', e);
  }

  if (!isSupabaseConfigured) {
    return cached || DEFAULT_SETTINGS;
  }

  try {
    // 1. Coba ambil dari tabel wedding_settings
    const { data, error } = await supabase
      .from('wedding_settings')
      .select('title, wedding_date, frame_theme')
      .eq('id', 'current')
      .single();

    if (!error && data) {
      let title = data.title || DEFAULT_SETTINGS.title;
      let weddingDate = data.wedding_date || DEFAULT_SETTINGS.wedding_date;
      let frameTheme = data.frame_theme || DEFAULT_SETTINGS.frame_theme;

      const result = { title, wedding_date: weddingDate, frame_theme: frameTheme };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result));
      } catch (e) {}
      return result;
    }

    // 2. Fallback: jika tabel wedding_settings belum dibuat, ambil dari baris sistem config di tabel photos
    const { data: configPhotos } = await supabase
      .from('photos')
      .select('message')
      .eq('guest_name', '__NAMOO_SYSTEM_CONFIG__')
      .order('created_at', { ascending: false })
      .limit(1);

    if (configPhotos && configPhotos.length > 0 && configPhotos[0].message) {
      try {
        const parsed = JSON.parse(configPhotos[0].message);
        let title = parsed.title || DEFAULT_SETTINGS.title;
        let weddingDate = parsed.wedding_date || DEFAULT_SETTINGS.wedding_date;
        let frameTheme = parsed.frame_theme || DEFAULT_SETTINGS.frame_theme;
        if (title.includes('Sarah')) {
          title = DEFAULT_SETTINGS.title;
          weddingDate = DEFAULT_SETTINGS.wedding_date;
        }
        const result = { title, wedding_date: weddingDate, frame_theme: frameTheme };
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result));
        } catch (e) {}
        return result;
      } catch (parseErr) {
        console.warn('Config photo parse error:', parseErr);
      }
    }

    return cached || DEFAULT_SETTINGS;
  } catch (err) {
    console.warn('Could not fetch wedding settings from DB:', err);
    return cached || DEFAULT_SETTINGS;
  }
}

export async function saveWeddingSettings(newSettings) {
  const payload = {
    title: newSettings.title || DEFAULT_SETTINGS.title,
    wedding_date: newSettings.wedding_date || DEFAULT_SETTINGS.wedding_date,
    frame_theme: newSettings.frame_theme || DEFAULT_SETTINGS.frame_theme || 'green',
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('namoo_wedding_settings_changed', { detail: payload }));
  } catch (e) {}

  if (!isSupabaseConfigured) {
    return payload;
  }

  // 1. Simpan ke tabel wedding_settings jika ada
  try {
    const { error: upsertErr } = await supabase
      .from('wedding_settings')
      .upsert({
        id: 'current',
        ...payload,
        updated_at: new Date().toISOString(),
      });

    // Fallback jika kolom frame_theme belum ada di tabel Supabase
    if (upsertErr && (upsertErr.message?.includes('frame_theme') || upsertErr.code === '42703')) {
      await supabase
        .from('wedding_settings')
        .upsert({
          id: 'current',
          title: payload.title,
          wedding_date: payload.wedding_date,
          updated_at: new Date().toISOString(),
        });
    }
  } catch (err) {
    console.warn('DB upsert notice on wedding_settings:', err);
  }

  // 2. Selalu simpan juga ke baris config di tabel photos agar sinkron antar-perangkat 100% instan
  try {
    const { data: existing } = await supabase
      .from('photos')
      .select('id')
      .eq('guest_name', '__NAMOO_SYSTEM_CONFIG__')
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from('photos').update({
        message: JSON.stringify(payload),
        is_approved: false
      }).eq('id', existing[0].id);
    } else {
      await supabase.from('photos').insert({
        guest_name: '__NAMOO_SYSTEM_CONFIG__',
        message: JSON.stringify(payload),
        image_url: 'https://placeholder.com/system-config',
        is_approved: false
      });
    }
  } catch (photoErr) {
    console.warn('Config photo backup error:', photoErr);
  }

  return payload;
}

export function parseWeddingTitle(title) {
  if (!title) return { prefix: 'The Wedding of', couple: 'Bride & Groom' };
  const str = title.trim();
  const lower = str.toLowerCase();

  if (lower.startsWith('the wedding of ')) {
    return {
      prefix: 'The Wedding of',
      couple: str.slice(15).trim(),
    };
  }
  if (lower.startsWith('wedding of ')) {
    return {
      prefix: 'The Wedding of',
      couple: str.slice(11).trim(),
    };
  }
  return {
    prefix: 'The Wedding of',
    couple: str,
  };
}
