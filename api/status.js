const { gh, base, configured, findRun, validJob } = require('./_lib');

async function failTail(jobId) {
  try {
    const r = await gh(`${base}/actions/jobs/${jobId}/logs`, { redirect: 'manual' });
    const loc = r.headers.get('location');
    if (!loc) return '';
    const t = await (await fetch(loc)).text();
    const L = t.split('\n').map((x) => x.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, '').replace(/\x1b\[[0-9;]*m/g, '').trimEnd());
    let i = L.findIndex((x) => x.startsWith('##[error]'));
    if (i < 0) i = L.length - 1;
    return L.slice(Math.max(0, i - 70), i + 1).filter((x) => x.trim()).join('\n').slice(-5000);
  } catch (e) {
    return '';
  }
}

module.exports = async (req, res) => {
  const { job } = req.query;
  if (!configured()) return res.status(500).json({ error: 'Server belum dikonfigurasi' });
  if (!validJob(job)) return res.status(400).json({ error: 'Job id tidak valid' });
  try {
    const run = await findRun(job);
    res.setHeader('Cache-Control', 'no-store');
    if (!run) return res.json({ state: 'queued', steps: [] });
    let steps = [], jobId = null;
    const jr = await gh(`${base}/actions/runs/${run.id}/jobs`);
    if (jr.ok) {
      const j = ((await jr.json()).jobs || [])[0];
      jobId = j && j.id;
      steps = ((j && j.steps) || [])
        .filter((s) => !/^(Set up job|Complete job|Post )/.test(s.name))
        .map((s) => ({ name: s.name, status: s.status, conclusion: s.conclusion }));
    }
    const state = run.status !== 'completed' ? (run.status === 'in_progress' ? 'running' : 'queued')
      : run.conclusion === 'success' ? 'done' : 'failed';
    res.json({ state, steps, tail: state === 'failed' && jobId ? await failTail(jobId) : '' });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
