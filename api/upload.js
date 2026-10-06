const { configured, putFile, validJob } = require('./_lib');

const KIND = {
  icon: { ext: ['png', 'jpg', 'jpeg', 'webp'], max: 1 * 1024 * 1024 },
  media: { ext: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'], max: 4 * 1024 * 1024 },
  html: { ext: ['html', 'zip'], max: 4 * 1024 * 1024 },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  if (!configured()) return res.status(500).json({ error: 'Server belum dikonfigurasi (GH_TOKEN, GH_OWNER, GH_REPO)' });
  const { job, kind, ext } = req.query;
  const k = KIND[kind];
  if (!validJob(job) || !k || !k.ext.includes(String(ext).toLowerCase()))
    return res.status(400).json({ error: 'Parameter upload tidak valid' });
  try {
    const buf = Buffer.isBuffer(req.body) && req.body.length ? req.body : await readBody(req);
    if (!buf.length) return res.status(400).json({ error: 'File kosong' });
    if (buf.length > k.max) return res.status(413).json({ error: `File ${kind} terlalu besar (maks ${k.max / 1048576} MB)` });
    const name = `${kind}.${String(ext).toLowerCase()}`;
    await putFile(`jobs/${job}/${name}`, buf, `upload ${name} ${job}`);
    res.json({ ok: true, file: name });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
