import assert from 'assert';

const API = process.env.API_BASE_URL || 'http://localhost:4000';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function createAgent() {
  const res = await fetch(`${API}/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'E2E Agent', email: `e2e-agent+${Date.now()}@example.com`, password: 'password' }) });
  const json = await res.json();
  return json.id;
}

async function createPilgrim(agentId) {
  const res = await fetch(`${API}/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'E2E Pilgrim', email: `e2e-pilgrim+${Date.now()}@example.com`, password: 'password', role: 'pilgrim', passportNumber: 'E2E123', agentId }) });
  const json = await res.json();
  return json.id || json;
}

async function postDocument(pilgrimId) {
  // post a document entry (we bypass file upload for E2E simplicity)
  const payload = { pilgrimId, name: 'E2E Passport', status: 'Uploaded', date: new Date().toISOString(), fileUrl: '/uploads/e2e-test.txt' };
  const res = await fetch(`${API}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

async function pollForDocumentForPilgrim(pilgrimId, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(`${API}/documents?pilgrimId=${pilgrimId}`);
    if (res.ok) {
      const docs = await res.json();
      if ((docs || []).some(d => d.name === 'E2E Passport')) return true;
    }
    await wait(500);
  }
  return false;
}

async function pollForDocumentForAgent(agentId, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(`${API}/documents?agentId=${agentId}`);
    if (res.ok) {
      const docs = await res.json();
      if ((docs || []).some(d => d.name === 'E2E Passport')) return true;
    }
    await wait(500);
  }
  return false;
}

async function pollForDocumentForAdmin(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const res = await fetch(`${API}/documents`);
    if (res.ok) {
      const docs = await res.json();
      if ((docs || []).some(d => d.name === 'E2E Passport')) return true;
    }
    await wait(500);
  }
  return false;
}

(async () => {
  console.log('E2E: Creating agent...');
  const agentId = await createAgent();
  console.log('E2E: Agent created', agentId);
  console.log('E2E: Creating pilgrim...');
  const pilgrimRes = await createPilgrim(agentId);
  const pilgrimId = pilgrimRes.id || pilgrimRes;
  console.log('E2E: Pilgrim created', pilgrimId);
  console.log('E2E: Posting document...');
  const ok = await postDocument(pilgrimId);
  assert.ok(ok, 'POST /documents failed');
  console.log('E2E: Document posted, polling pilgrim documents...');
  const pFound = await pollForDocumentForPilgrim(pilgrimId);
  assert.ok(pFound, 'Document not visible via pilgrim endpoint');
  console.log('E2E: Pilgrim sees document. Polling agent documents...');
  const aFound = await pollForDocumentForAgent(agentId);
  assert.ok(aFound, 'Document not visible via agent endpoint');
  console.log('E2E: Agent sees document. Polling admin documents...');
  const adminFound = await pollForDocumentForAdmin();
  assert.ok(adminFound, 'Document not visible via admin endpoint');
  console.log('E2E: SUCCESS - document replicated to pilgrim, agent, and admin views');
  process.exit(0);
})().catch(err => { console.error('E2E FAILURE', err); process.exit(2); });
