import { supabase, isSupabaseConfigured } from '../supabaseClient';

const DEFAULT_SETTINGS = {
  title: 'The Wedding of Sarah & Dimas',
  wedding_date: '24 September 2026',
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
    const { data, error } = await supabase
      .from('wedding_settings')
      .select('title, wedding_date')
      .eq('id', 'current')
      .single();

    if (error || !data) {
      return cached || DEFAULT_SETTINGS;
    }

    const result = {
      title: data.title || DEFAULT_SETTINGS.title,
      wedding_date: data.wedding_date || DEFAULT_SETTINGS.wedding_date,
    };

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result));
    } catch (e) {}

    return result;
  } catch (err) {
    console.warn('Could not fetch wedding_settings from DB:', err);
    return cached || DEFAULT_SETTINGS;
  }
}

export async function saveWeddingSettings(newSettings) {
  const payload = {
    title: newSettings.title || DEFAULT_SETTINGS.title,
    wedding_date: newSettings.wedding_date || DEFAULT_SETTINGS.wedding_date,
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}

  if (!isSupabaseConfigured) {
    return payload;
  }

  try {
    const { error } = await supabase
      .from('wedding_settings')
      .upsert({
        id: 'current',
        ...payload,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('DB upsert error on wedding_settings:', error.message);
    }
  } catch (err) {
    console.warn('DB save exception:', err);
  }

  return payload;
}

export function parseWeddingTitle(title) {
  if (!title) return { prefix: 'The Wedding of', couple: 'Sarah & Dimas' };
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
