const { gh, base, configured, findRun, validJob } = require('./_lib');

module.exports = async (req, res) => {
  const { job } = req.query;
  if (!configured()) return res.status(500).json({ error: 'Server belum dikonfigurasi' });
  if (!validJob(job)) return res.status(400).json({ error: 'Job id tidak valid' });
  try {
    const run = await findRun(job);
    res.setHeader('Cache-Control', 'no-store');
    if (!run) return res.json({ state: 'queued', steps: [] });
    let steps = [];
    const jr = await gh(`${base}/actions/runs/${run.id}/jobs`);
    if (jr.ok) {
      const j = ((await jr.json()).jobs || [])[0];
      steps = ((j && j.steps) || [])
        .filter((s) => !/^(Set up job|Complete job|Post )/.test(s.name))
        .map((s) => ({ name: s.name, status: s.status, conclusion: s.conclusion }));
    }
    const state = run.status !== 'completed' ? (run.status === 'in_progress' ? 'running' : 'queued')
      : run.conclusion === 'success' ? 'done' : 'failed';
    res.json({ state, steps });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
