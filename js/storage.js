/* ============================================================
   2vStudio — storage.js
   Supabase-backed data layer. Real shared database — every
   visitor and every admin session reads/writes the same data.

   NOTE ON SECURITY: the admin/member login here is still a
   client-side password check against a plaintext column in the
   database (not real Supabase Auth). The publishable key below
   is safe to expose in the browser, but because our RLS
   policies currently allow public writes, anyone with this key
   could write directly to the tables, bypassing the site.
   Good enough for a trusted collective; not for a public app.
   ============================================================ */

const SUPABASE_URL = 'https://flgdqbozvvxcukvftlon.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7-_3FYnmJmhJS_xXqshkvw_yOZ4rRdQ';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DB_KEYS = {
  ADMIN: '2v_admin_session',
  MEMBER: '2v_member_session',
};

/* ---------- row <-> app object mapping ---------- */

const EDITOR_COLUMNS = 'id, nickname, role, avatar_color, avatar_image, banner, bio, experience, skills, software, status, socials, username, created_at';

function editorFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    role: row.role,
    avatarColor: row.avatar_color,
    avatarImage: row.avatar_image,
    banner: row.banner,
    bio: row.bio,
    experience: row.experience,
    skills: row.skills || [],
    software: row.software || [],
    status: row.status,
    socials: row.socials || {},
    username: row.username || '',
    // no password field here anymore — never travels to the client
  };
}

function editorToRow(editor) {
  return {
    id: editor.id,
    nickname: editor.nickname,
    role: editor.role,
    avatar_color: editor.avatarColor,
    avatar_image: editor.avatarImage,
    banner: editor.banner,
    bio: editor.bio,
    experience: editor.experience,
    skills: editor.skills || [],
    software: editor.software || [],
    status: editor.status,
    socials: editor.socials || {},
    username: editor.username || null,
    // password is NEVER written here — only via set_editor_password RPC
  };
}

function portfolioFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    editorId: row.editor_id,
    title: row.title,
    category: row.category,
    software: row.software,
    duration: row.duration,
    driveLink: row.drive_link,
    description: row.description,
    featured: row.featured,
    date: row.date,
  };
}

function portfolioToRow(item) {
  return {
    id: item.id,
    editor_id: item.editorId,
    title: item.title,
    category: item.category,
    software: item.software,
    duration: item.duration,
    drive_link: item.driveLink,
    description: item.description,
    featured: item.featured,
    date: item.date,
  };
}

/* ---------- editors ---------- */

const EditorsAPI = {
  async all() {
    const { data, error } = await sb.from('editors').select(EDITOR_COLUMNS).order('created_at', { ascending: true });
    if (error) { console.error('EditorsAPI.all failed', error); return []; }
    return data.map(editorFromRow);
  },
  async get(id) {
    const { data, error } = await sb.from('editors').select(EDITOR_COLUMNS).eq('id', id).maybeSingle();
    if (error) { console.error('EditorsAPI.get failed', error); return null; }
    return editorFromRow(data);
  },
  async findByUsername(username, excludeId) {
    if (!username) return null;
    let query = sb.from('editors').select(EDITOR_COLUMNS).eq('username', username);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) { console.error('EditorsAPI.findByUsername failed', error); return null; }
    return editorFromRow(data);
  },
  async save(editor) {
    if (!editor.id) editor.id = 'ed_' + Date.now().toString(36);
    const row = editorToRow(editor);
    const { data, error } = await sb.from('editors').upsert(row).select(EDITOR_COLUMNS).single();
    if (error) { console.error('EditorsAPI.save failed', error); throw error; }
    return editorFromRow(data);
  },
  async remove(id) {
    const { error } = await sb.from('editors').delete().eq('id', id);
    if (error) { console.error('EditorsAPI.remove failed', error); throw error; }
  },
};
/* ---------- portfolio ---------- */

const PortfolioAPI = {
  async all() {
    const { data, error } = await sb.from('portfolio').select('*').order('created_at', { ascending: true });
    if (error) { console.error('PortfolioAPI.all failed', error); return []; }
    return data.map(portfolioFromRow);
  },
  async get(id) {
    const { data, error } = await sb.from('portfolio').select('*').eq('id', id).maybeSingle();
    if (error) { console.error('PortfolioAPI.get failed', error); return null; }
    return portfolioFromRow(data);
  },
  async byEditor(editorId) {
    const { data, error } = await sb.from('portfolio').select('*').eq('editor_id', editorId).order('created_at', { ascending: true });
    if (error) { console.error('PortfolioAPI.byEditor failed', error); return []; }
    return data.map(portfolioFromRow);
  },
  async featured() {
    const { data, error } = await sb.from('portfolio').select('*').eq('featured', true).order('created_at', { ascending: true });
    if (error) { console.error('PortfolioAPI.featured failed', error); return []; }
    return data.map(portfolioFromRow);
  },
  async save(item) {
    if (!item.id) item.id = 'pf_' + Date.now().toString(36);
    const row = portfolioToRow(item);
    const { data, error } = await sb.from('portfolio').upsert(row).select().single();
    if (error) { console.error('PortfolioAPI.save failed', error); throw error; }
    return portfolioFromRow(data);
  },
  async remove(id) {
    const { error } = await sb.from('portfolio').delete().eq('id', id);
    if (error) { console.error('PortfolioAPI.remove failed', error); throw error; }
  },
};

/* ---------- settings / admin session ---------- */

const SettingsAPI = {
  async get() {
    const { data, error } = await sb.from('settings').select('id, music_enabled').eq('id', 1).maybeSingle();
    if (error || !data) {
      console.error('SettingsAPI.get failed', error);
      return { musicEnabled: true };
    }
    return { musicEnabled: data.music_enabled };
  },
  async save(patch) {
    if ('adminPassword' in patch) {
      const { error } = await sb.rpc('set_admin_password', { p_password: patch.adminPassword });
      if (error) { console.error('set_admin_password failed', error); throw error; }
    }
    if ('musicEnabled' in patch) {
      const { error } = await sb.from('settings').update({ music_enabled: patch.musicEnabled }).eq('id', 1);
      if (error) { console.error('SettingsAPI.save failed', error); throw error; }
    }
    return this.get();
  },
};

const AdminSession = {
  async login(password) {
    const { data, error } = await sb.rpc('verify_admin_password', { p_password: password });
    if (error) { console.error('AdminSession.login failed', error); return false; }
    if (data) sessionStorage.setItem(DB_KEYS.ADMIN, '1');
    return !!data;
  },
  isLoggedIn() { return sessionStorage.getItem(DB_KEYS.ADMIN) === '1'; },
  logout() { sessionStorage.removeItem(DB_KEYS.ADMIN); },
};

const MemberSession = {
  async login(username, password) {
    const { data, error } = await sb.rpc('verify_member_login', { p_username: username, p_password: password });
    if (error) { console.error('MemberSession.login failed', error); return null; }
    const row = Array.isArray(data) ? data[0] : data;
    const editor = editorFromRow(row);
    if (editor) sessionStorage.setItem(DB_KEYS.MEMBER, editor.id);
    return editor;
  },
  isLoggedIn() { return !!sessionStorage.getItem(DB_KEYS.MEMBER); },
  currentEditorId() { return sessionStorage.getItem(DB_KEYS.MEMBER); },
  logout() { sessionStorage.removeItem(DB_KEYS.MEMBER); },
};

/* ---------- Google Drive link helper ---------- */

function toDriveDirect(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (!match) return '';
  return `https://drive.google.com/uc?export=download&id=${match[1]}`;
}

function toDriveEmbed(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (!match) return '';
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

function toDriveThumbnail(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (!match) return '';
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
}

function isValidDriveLink(url) {
  if (!url) return false;
  return /drive\.google\.com\/(file\/d\/[a-zA-Z0-9_-]+|open\?id=[a-zA-Z0-9_-]+)/.test(url);
}