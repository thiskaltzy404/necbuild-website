const { gh, base, configured, findRun, validJob } = require('./_lib');

module.exports = async (req, res) => {
  const { job } = req.query;
  if (!configured()) return res.status(500).send('Server belum dikonfigurasi');
  if (!validJob(job)) return res.status(400).send('Job id tidak valid');
  try {
    const run = await findRun(job);
    if (!run || run.conclusion !== 'success') return res.status(404).send('Build belum selesai atau tidak ditemukan');
    const a = await gh(`${base}/actions/runs/${run.id}/artifacts`);
    const art = ((await a.json()).artifacts || []).find((x) => !x.expired);
    if (!art) return res.status(404).send('File sudah kedaluwarsa (disimpan 7 hari). Silakan build ulang.');
    const z = await gh(`${base}/actions/artifacts/${art.id}/zip`, { redirect: 'manual' });
    const loc = z.headers.get('location');
    if (!loc) return res.status(502).send('Gagal mengambil link unduhan');
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, loc);
  } catch (e) {
    res.status(502).send(e.message);
  }
};
