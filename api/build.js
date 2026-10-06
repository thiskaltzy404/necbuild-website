const { gh, base, B, WF, configured, putFile, runs, validJob } = require('./_lib');

const MAX = parseInt(process.env.MAX_CONCURRENT || '3', 10);
const PKG = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const FILE = /^(icon\.(png|jpe?g|webp)|media\.(jpe?g|png|gif|webp|mp4|webm)|html\.(html|zip))$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  if (!configured()) return res.status(500).json({ error: 'Server belum dikonfigurasi (GH_TOKEN, GH_OWNER, GH_REPO)' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const c = b.config || {};
    if (!validJob(b.job)) return res.status(400).json({ error: 'Job id tidak valid' });
    if (!c.name || String(c.name).length > 50) return res.status(400).json({ error: 'Nama aplikasi tidak valid' });
    if (!PKG.test(c.package || '')) return res.status(400).json({ error: 'Package name tidak valid' });
    if (c.source === 'url' && !/^https?:\/\/\S+$/.test(c.url || '')) return res.status(400).json({ error: 'URL tidak valid' });
    if (c.source === 'html' && !(c.files && c.files.html)) return res.status(400).json({ error: 'File HTML belum diunggah' });

    const active = (await runs()).filter((r) => r.status !== 'completed').length;
    if (active >= MAX) return res.status(429).json({ error: 'Server sedang penuh, coba lagi sebentar lagi' });

    const f = {};
    for (const k of ['icon', 'media', 'html']) if (c.files && FILE.test(c.files[k] || '')) f[k] = c.files[k];
    const s = c.splash || {};
    const clean = {
      source: c.source === 'html' ? 'html' : 'url',
      url: String(c.url || ''),
      name: String(c.name),
      package: c.package,
      versionCode: parseInt(c.versionCode, 10),
      versionName: String(c.versionName || '1.0.0'),
      permissions: (Array.isArray(c.permissions) ? c.permissions : []).filter((p) => /^[A-Z][A-Z0-9_]{2,59}$/.test(p)).slice(0, 120),
      header: !!c.header, js: c.js !== false, zoom: !!c.zoom,
      orientation: ['auto', 'p', 'l'].includes(c.orientation) ? c.orientation : 'auto',
      splash: {
        on: s.on !== false, text: String(s.text || c.name).slice(0, 60), type: String(s.type || 'fade'),
        ms: Math.max(500, Math.min(8000, parseInt(s.ms, 10) || 2000)),
        bg: HEX.test(s.bg) ? s.bg : '#0b0d10', fg: HEX.test(s.fg) ? s.fg : '#ffd24d',
        fit: s.fit === 'contain' ? 'contain' : 'cover', showText: s.showText !== false,
      },
      files: f,
    };
    await putFile(`jobs/${b.job}/config.json`, Buffer.from(JSON.stringify(clean)), `job ${b.job}`);
    const d = await gh(`${base}/actions/workflows/${WF}/dispatches`, {
      method: 'POST', body: JSON.stringify({ ref: B, inputs: { job: b.job } }),
    });
    if (d.status !== 204) return res.status(502).json({ error: `Gagal memulai workflow (${d.status}): ${(await d.text()).slice(0, 160)}` });
    res.json({ ok: true, job: b.job });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
