// Helper GitHub API. File berawalan "_" tidak dijadikan endpoint oleh Vercel.
const O = process.env.GH_OWNER, R = process.env.GH_REPO, T = process.env.GH_TOKEN;
const B = process.env.GH_BRANCH || 'main';
const WF = 'build-apk.yml';
const base = `/repos/${O}/${R}`;

const configured = () => !!(O && R && T);

function gh(path, opt = {}) {
  return fetch('https://api.github.com' + path, {
    ...opt,
    headers: {
      Authorization: 'Bearer ' + T,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'necbuild',
      ...(opt.headers || {}),
    },
  });
}

async function putFile(path, buf, msg) {
  const body = JSON.stringify({ message: msg, content: Buffer.from(buf).toString('base64'), branch: B });
  let last = '';
  for (let i = 0; i < 4; i++) {
    const r = await gh(`${base}/contents/${path}`, { method: 'PUT', body });
    if (r.ok) return;
    last = `GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`;
    if (r.status !== 409 && r.status !== 422 && r.status < 500) break;
    await new Promise((s) => setTimeout(s, 600 * (i + 1)));
  }
  throw new Error(last);
}

async function runs() {
  const r = await gh(`${base}/actions/workflows/${WF}/runs?event=workflow_dispatch&per_page=50`);
  if (!r.ok) throw new Error('GitHub ' + r.status + ' saat membaca status build');
  return (await r.json()).workflow_runs || [];
}

async function findRun(job) {
  return (await runs()).find((x) => x.display_title === 'build-' + job) || null;
}

const validJob = (j) => typeof j === 'string' && /^[a-f0-9]{12,32}$/.test(j);

module.exports = { gh, base, B, WF, configured, putFile, runs, findRun, validJob };
