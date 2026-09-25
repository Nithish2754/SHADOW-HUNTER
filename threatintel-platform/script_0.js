
  let isAdmin = true;
  let crawlActive = false;

  document.addEventListener('DOMContentLoaded', () => {
    if (isAdmin) document.getElementById('tab-users').classList.add('visible');
    fetchStats();
    hdInit();
    loadSessions();
    pollCrawlStatus();
    setInterval(() => { fetchStats(); if (crawlActive) loadSessions(); }, 15000);
    setInterval(pollCrawlStatus, 5000);
  });

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso.includes('T') ? (iso.endsWith('Z') ? iso : iso + 'Z') : iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    } catch(e) { return iso; }
  }
  function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show ' + type;
    setTimeout(() => t.className = '', 3000);
  }

  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(tab, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('panel-' + tab).classList.add('active');
    btn.classList.add('active');
    if (tab === 'keywords') { loadKeywords(); }
    if (tab === 'seeds') { loadSeeds(); }
    if (tab === 'users' && isAdmin) loadUsers();
    if (tab === 'investigations') loadInvestigations();
    if (tab === 'iplookup') loadIPInvestigations();
                    if (tab === 'dns') loadDNSInvestigations();
    if (tab === 'webcheck') document.querySelector('#panel-webcheck iframe').src = '/webcheck/';
    if (tab === 'reports') { loadReportPreview(); if (isAdmin) loadSubscribers(); }
    if (tab === 'settings') loadSettings();
        if (tab === 'home') hdInit();
    if (tab === 'iocfeed') iocLoadAll();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  async function fetchStats() {
    try {
      const data = await (await fetch('/api/stats')).json();
      document.getElementById('statSessions').textContent = (data.total_sessions||0).toLocaleString();
      document.getElementById('statPages').textContent = (data.total_pages||0).toLocaleString();
      document.getElementById('statHits').textContent = (data.total_hits||0).toLocaleString();
      const el = document.getElementById('topKeywords');
      if (!data.top_keywords?.length) {
        el.innerHTML = '<span style="color:var(--muted);font-size:.84rem;padding:4px">No hits yet.</span>';
      } else {
        el.innerHTML = data.top_keywords.map(k =>
          `<div class="kw-pill" onclick="filterSession('${esc(k.keyword)}')">${esc(k.keyword)}<span class="count">${k.count}</span></div>`
        ).join('');
      }
    } catch(e) { document.getElementById('statusDot').style.background='var(--red)'; }
  }

  // ── Crawl status ───────────────────────────────────────────────────────────
  async function pollCrawlStatus() {
    try {
      const data = await (await fetch('/api/crawl/status')).json();
      crawlActive = data.active;
      const card = document.getElementById('crawlCard');
      const dot = document.getElementById('crawlDot');
      const title = document.getElementById('crawlTitle');
      const sub = document.getElementById('crawlSub');
      const liveStats = document.getElementById('crawlLiveStats');
      const btn = document.getElementById('crawlBtn');

      if (data.active && data.session) {
        card.className = 'crawl-card active';
        dot.className = 'crawl-dot pulse';
        title.textContent = 'Crawl in progress';
        sub.innerHTML = `Session #${data.session.id} — started ${fmtTime(data.session.started_at)}`;
        liveStats.style.display = 'flex';
        document.getElementById('livePagesVal').textContent = (data.session.pages_crawled||0).toLocaleString();
        document.getElementById('liveHitsVal').textContent = (data.session.hits_found||0).toLocaleString();
        btn.className = 'btn-crawl running';
        btn.textContent = '⏹ Running…';
        btn.disabled = true;
        document.getElementById('crawlStopBtn').style.display = 'inline-block';
      } else {
        card.className = 'crawl-card';
        dot.className = 'crawl-dot';
        title.textContent = 'No active crawl';
        sub.innerHTML = 'Click ▶ Start Crawl to begin scanning';
        liveStats.style.display = 'none';
        btn.className = 'btn-crawl';
        btn.textContent = '▶ Start Crawl';
        btn.disabled = false;
        document.getElementById('crawlStopBtn').style.display = 'none';
      }
    } catch(e) {}
  }

  async function toggleCrawl() {
    const btn = document.getElementById('crawlBtn');
    const isRunning = btn.classList.contains('running');

    if (isRunning) {
      // Stop crawl
      btn.disabled = true;
      btn.textContent = '⏳ Stopping…';
      try {
        const res = await fetch('/api/crawl/stop', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          toast('Stop signal sent — crawl will halt after current page.');
        } else {
          toast(data.error || 'Failed to stop crawl', 'error');
        }
      } catch(e) {
        toast('Network error', 'error');
      } finally {
        btn.disabled = false;
      }
    } else {
      // Start crawl
      btn.disabled = true;
      btn.textContent = '⏳ Starting…';
      try {
        const res = await fetch('/api/crawl/start', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          toast('Crawl started.');
          btn.className = 'btn-crawl running';
          btn.textContent = '⏹ Stop Crawl';
          pollStatus();
        } else {
          toast(data.error || 'Failed to start crawl', 'error');
          btn.textContent = '▶ Start Crawl';
        }
      } catch(e) {
        toast('Network error', 'error');
        btn.textContent = '▶ Start Crawl';
      } finally {
        btn.disabled = false;
      }
    }
  }

  function toggleTheme() {
    const light = document.body.classList.toggle('light');
    document.getElementById('themeBtn').textContent = light ? '🌑' : '🌙';
    localStorage.setItem('theme', light ? 'light' : 'dark');
  }
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
    const b = document.getElementById('themeBtn');
    if (b) b.textContent = '🌑';
  }

  // ── Sessions ───────────────────────────────────────────────────────────────
  let expandedSessions = new Set();

  async function loadSessions() {
    const el = document.getElementById('sessionsContainer');
    try {
      const sessions = await (await fetch('/api/sessions')).json();
      if (!sessions.length) {
        el.innerHTML = '<div class="empty"><div class="icon">📋</div><p>No crawl sessions yet. Click ▶ Start Crawl above to begin.</p></div>';
        return;
      }
      el.innerHTML = `<table>
        <thead><tr><th>Session</th><th>Started</th><th>Duration</th><th>Pages</th><th>Hits</th><th>Status</th></tr></thead>
        <tbody id="sessionRows">${sessions.map(s => buildSessionRow(s)).join('')}</tbody>
      </table>`;
      // Re-expand previously expanded sessions
      expandedSessions.forEach(id => expandSession(id, false));
    } catch(e) {
      el.innerHTML = '<div class="empty" style="color:var(--red)">Error loading sessions.</div>';
    }
  }

  function buildSessionRow(s) {
    const started = fmtTime(s.started_at);
    const statusClass = `status-${s.status || 'completed'}`;
    let duration = '—';
    if (s.started_at && s.ended_at) {
      const secs = Math.round((new Date(s.ended_at.endsWith('Z')?s.ended_at:s.ended_at+'Z') - new Date(s.started_at.endsWith('Z')?s.started_at:s.started_at+'Z')) / 1000);
      duration = secs < 60 ? `${secs}s` : `${Math.floor(secs/60)}m ${secs%60}s`;
    } else if (s.status === 'running') {
      duration = 'Running…';
    }
    return `
      <tr class="session-row" onclick="expandSession(${s.id}, true)" id="sess-${s.id}">
        <td style="font-family:var(--mono);font-size:.8rem;color:var(--muted)">#${s.id}</td>
        <td class="time-cell">${started}</td>
        <td class="time-cell">${duration}</td>
        <td><strong>${(s.pages_crawled||0).toLocaleString()}</strong></td>
        <td><strong style="color:${s.hits_found>0?'var(--accent)':'var(--muted)'}">${(s.hits_found||0).toLocaleString()}</strong></td>
        <td><span class="status-badge ${statusClass}">${s.status||'completed'}</span></td>
      </tr>
      <tr class="session-detail" id="sess-detail-${s.id}">
        <td colspan="6"><div class="session-detail-inner" id="sess-inner-${s.id}">Loading…</div></td>
      </tr>`;
  }

  async function expandSession(id, toggle) {
    const detailRow = document.getElementById(`sess-detail-${id}`);
    if (!detailRow) return;
    const isOpen = detailRow.style.display === 'table-row';
    if (toggle && isOpen) {
      detailRow.style.display = 'none';
      expandedSessions.delete(id);
      return;
    }
    detailRow.style.display = 'table-row';
    expandedSessions.add(id);
    const inner = document.getElementById(`sess-inner-${id}`);
    inner.innerHTML = 'Loading hits…';
    try {
      const hits = await (await fetch(`/api/sessions/${id}/hits`)).json();
      if (!hits.length) { inner.innerHTML = '<p style="color:var(--muted);font-size:.83rem;padding:8px 0">No keyword hits in this session.</p>'; return; }
      inner.innerHTML = `<table style="margin:8px 0">
        <thead><tr><th>Keyword</th><th>Category</th><th>URL</th><th>Context</th><th>Found At</th></tr></thead>
        <tbody>${hits.map(h => `<tr>
          <td><span class="keyword-tag">${esc(h.keyword)}</span></td>
          <td><span class="cat-tag">${esc(h.category)}</span></td>
          <td class="url-cell">${esc(h.url)}</td>
          <td class="ctx-cell">${esc((h.context||'').slice(0,200))}</td>
          <td class="time-cell">${fmtTime(h.found_at)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    } catch(e) { inner.innerHTML = '<p style="color:var(--red)">Error loading hits.</p>'; }
  }

  function filterSession(kw) { /* future: filter sessions by keyword */ }

  // ── Keywords ───────────────────────────────────────────────────────────────
  async function loadKeywords() {
    const el = document.getElementById('keywordsList');
    try {
      const data = await (await fetch('/api/keywords')).json();
      const cats = data.categories || {};
      if (!Object.keys(cats).length) {
        el.innerHTML = '<div class="empty"><div class="icon">🔑</div><p>No keywords yet.</p></div>';
        return;
      }
      el.innerHTML = Object.entries(cats).map(([cat, kws]) => `
        <div class="kw-category" data-cat="${esc(cat).toLowerCase()}" style="margin-bottom:18px">
          <div class="section-title">${esc(cat)}</div>
          <table><thead><tr><th>Keyword</th><th style="width:80px">Action</th></tr></thead>
          <tbody>${(kws||[]).map(kw => `<tr class="kw-row" data-kw="${esc(kw).toLowerCase()}">
            <td><span class="keyword-tag">${esc(kw)}</span></td>
            <td><button class="btn btn-danger" onclick="deleteKeyword('${esc(kw).replace(/'/g,"\\'")}','${esc(cat).replace(/'/g,"\\'")}')">Remove</button></td>
          </tr>`).join('')}</tbody></table>
        </div>`).join('');
    } catch(e) { el.innerHTML = '<div class="empty" style="color:var(--red)">Error.</div>'; }
  }

  async function addKeyword() {
    const kw = document.getElementById('newKeyword').value.trim();
    const cat = document.getElementById('newCategory').value;
    if (!kw) { toast('Enter a keyword first', 'error'); return; }
    const projectId = document.getElementById('genProjectSelect')?.value || _getKwProjectId();
    if (projectId) {
      const res = await fetch(`/api/projects/${projectId}/keywords`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({keyword:kw,category:cat}) });
      const data = await res.json();
      if (data.ok) { document.getElementById('newKeyword').value=''; toast(`Keyword added to project!`); }
      else toast(data.error||'Error', 'error');
    } else {
      const res = await fetch('/api/keywords', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({keyword:kw,category:cat}) });
      const data = await res.json();
      if (data.ok) { document.getElementById('newKeyword').value=''; toast('Keyword added!'); loadKeywords(); }
      else toast(data.error||'Error', 'error');
    }
  }

  async function deleteKeyword(kw, cat) {
    const res = await fetch('/api/keywords', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({keyword:kw,category:cat}) });
    const data = await res.json();
    if (data.ok) { toast('Removed'); loadKeywords(); }
    else toast(data.error||'Error','error');
  }

  // ── Project scope helpers ──────────────────────────────────────────────────
  function _getKwProjectId() {
    const cb = document.getElementById('kwProjectScope');
    const sel = document.getElementById('kwProjectSelect');
    return (cb && cb.checked && sel && sel.value) ? sel.value : null;
  }

  function toggleKwProjectScope() {
    const cb = document.getElementById('kwProjectScope');
    const sel = document.getElementById('kwProjectSelect');
    sel.style.display = cb.checked ? '' : 'none';
    if (cb.checked) _populateKwProjectDropdown();
  }

  async function _populateKwProjectDropdown() {
    const sel = document.getElementById('kwProjectSelect');
    try {
      const data = await (await fetch('/api/projects')).json();
      const projects = data.projects || [];
      if (!projects.length) {
        sel.innerHTML = '<option value="">No projects yet</option>';
        return;
      }
      sel.innerHTML = projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    } catch(e) { sel.innerHTML = '<option value="">Error loading projects</option>'; }
  }

  // ── Seeds ──────────────────────────────────────────────────────────────────
  async function loadSeeds() {
    const el = document.getElementById('seedsList');
    try {
      const data = await (await fetch('/api/seeds')).json();
      if (!data.seeds?.length) { el.innerHTML = '<div class="empty"><div class="icon">🌱</div><p>No seeds yet.</p></div>'; return; }
      el.innerHTML = data.seeds.map(s => `
        <div class="seed-item">
          <span>${esc(s)}</span>
          <button class="btn btn-danger" onclick="deleteSeed('${esc(s).replace(/'/g,"\\'")}')">Remove</button>
        </div>`).join('');
    } catch(e) { el.innerHTML = '<div class="empty" style="color:var(--red)">Error.</div>'; }
  }

  async function addSeed() {
    const url = document.getElementById('newSeed').value.trim();
    if (!url) { toast('Enter a URL', 'error'); return; }
    const res = await fetch('/api/seeds', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
    const data = await res.json();
    if (data.ok) { document.getElementById('newSeed').value=''; toast('Seed added!'); loadSeeds(); }
    else toast(data.error||'Error','error');
  }

  async function deleteSeed(url) {
    const res = await fetch('/api/seeds', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
    const data = await res.json();
    if (data.ok) { toast('Removed'); loadSeeds(); }
    else toast(data.error||'Error','error');
  }

  // ── Seeds sub-tab switching ────────────────────────────────────────────────
  function switchSeedsTab(tab, btn) {
    document.querySelectorAll('.seeds-sub-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.seeds-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('seeds-panel-' + tab).style.display = '';
    btn.classList.add('active');
    if (tab === 'clearnet') loadClearnetSeeds();
          }

  // ── Clearnet Seeds ─────────────────────────────────────────────────────────
  async function loadClearnetSeeds() {
    const el = document.getElementById('clearnetSeedsList');
    try {
      const data = await (await fetch('/api/seeds/clearnet')).json();
      if (!data.seeds?.length) { el.innerHTML = '<div class="empty"><div class="icon">&#x1F310;</div><p>No clearnet seeds yet.</p></div>'; return; }
      el.innerHTML = data.seeds.map(s => `
        <div class="seed-item">
          <span>${esc(s)}</span>
          <button class="btn btn-danger" onclick="deleteClearnetSeed('${esc(s).replace(/'/g,"\\'")}')">Remove</button>
        </div>`).join('');
    } catch(e) { el.innerHTML = '<div class="empty" style="color:var(--red)">Error.</div>'; }
  }

  async function addClearnetSeed() {
    const url = document.getElementById('newClearnetSeed').value.trim();
    if (!url) { toast('Enter a URL', 'error'); return; }
    const res = await fetch('/api/seeds/clearnet', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
    const data = await res.json();
    if (data.ok) { document.getElementById('newClearnetSeed').value=''; toast('Clearnet seed added!'); loadClearnetSeeds(); }
    else toast(data.error||'Error','error');
  }

  async function deleteClearnetSeed(url) {
    const res = await fetch('/api/seeds/clearnet', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
    const data = await res.json();
    if (data.ok) { toast('Removed'); loadClearnetSeeds(); }
    else toast(data.error||'Error','error');
  }

  // ── Paste Sources ──────────────────────────────────────────────────────────
  async function loadPasteSources() {
    const el = document.getElementById('pasteSourcesList');
    try {
      const data = await (await fetch('/api/seeds/paste')).json();
      if (!data.sources?.length) { el.innerHTML = '<div class="empty"><div class="icon">&#x1F4CB;</div><p>No paste sources yet.</p></div>'; return; }
      el.innerHTML = data.sources.map(s => `
        <div class="seed-item">
          <span>${esc(s)}</span>
          <button class="btn btn-danger" onclick="deletePasteSource('${esc(s).replace(/'/g,"\\'")}')">Remove</button>
        </div>`).join('');
    } catch(e) { el.innerHTML = '<div class="empty" style="color:var(--red)">Error.</div>'; }
  }

  async function addPasteSource() {
    const url = document.getElementById('newPasteSource').value.trim();
    if (!url) { toast('Enter a URL', 'error'); return; }
    const res = await fetch('/api/seeds/paste', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
    const data = await res.json();
    if (data.ok) { document.getElementById('newPasteSource').value=''; toast('Paste source added!'); loadPasteSources(); }
    else toast(data.error||'Error','error');
  }

  async function deletePasteSource(url) {
    const res = await fetch('/api/seeds/paste', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url}) });
    const data = await res.json();
    if (data.ok) { toast('Removed'); loadPasteSources(); }
    else toast(data.error||'Error','error');
  }

  // ── Bulk seed add ──────────────────────────────────────────────────────────
  async function bulkAddSeeds(type) {
    const textareaId = type === 'onion' ? 'bulkOnionSeeds' : type === 'clearnet' ? 'bulkClearnetSeeds' : 'bulkPasteSources';
    const endpoint = type === 'onion' ? '/api/seeds' : type === 'clearnet' ? '/api/seeds/clearnet' : '/api/seeds/paste';
    const raw = document.getElementById(textareaId).value.trim();
    if (!raw) { toast('Paste some URLs first', 'error'); return; }
    const urls = raw.split('\n').map(l => l.trim()).filter(l => l && l.startsWith('http'));
    if (!urls.length) { toast('No valid URLs found (must start with http)', 'error'); return; }
    const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({urls}) });
    const data = await res.json();
    if (data.ok) {
      document.getElementById(textareaId).value = '';
      toast(`Added ${data.added} URL${data.added !== 1 ? 's' : ''}!`);
      if (type === 'onion') loadSeeds();
      else if (type === 'clearnet') loadClearnetSeeds();
      else loadPasteSources();
    } else toast(data.error||'Error','error');
  }

  // ── Keyword export ─────────────────────────────────────────────────────────
  function exportKeywords() {
    window.location.href = '/api/keywords/export';
  }

  // ── Keyword import ─────────────────────────────────────────────────────────
  async function importKeywords(input) {
    const file = input.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/keywords/import', { method:'POST', body: form });
    const data = await res.json();
    input.value = '';
    if (data.ok) { toast(`Imported ${data.added} keyword${data.added !== 1 ? 's' : ''}!`); loadKeywords(); }
    else toast(data.error||'Import failed','error');
  }

  // ── Keyword generator ──────────────────────────────────────────────────────
  function toggleGenerator() {
    const panel = document.getElementById('generatorPanel');
    const chevron = document.getElementById('generatorChevron');
    const open = panel.style.display === 'none';
    panel.style.display = open ? '' : 'none';
    chevron.textContent = open ? '▲' : '▼';
  }

  async function _populateGenProjectDropdown() {
    try {
      const pd = await (await fetch('/api/projects')).json();
      const sel = document.getElementById('genProjectSelect');
      if (!sel) return;
      const projects = Array.isArray(pd) ? pd : (pd.projects || []);
      sel.innerHTML = '<option value="">+ Add to Project (optional)</option>' +
        projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    } catch(e) {}
  }

  async function generateKeywords() {
    await _populateGenProjectDropdown();
    const name = document.getElementById('genName').value.trim();
    const domain = document.getElementById('genDomain').value.trim();
    const industry = document.getElementById('genIndustry').value.trim();
    const context = document.getElementById('genContext').value.trim();
    if (!name && !domain) { toast('Enter at least a name or domain', 'error'); return; }

    const btn = document.getElementById('genBtn');
    btn.textContent = '⏳ Generating…';
    btn.disabled = true;

    try {
      const res = await fetch('/api/keywords/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name, domain, industry, context})
      });
      const data = await res.json();
      if (!data.ok) { toast(data.error||'Error','error'); return; }

      const results = data.keywords;
      const catColors = {brand_monitoring:'var(--cyan)',credentials:'var(--red)',infrastructure:'var(--accent)',threat_intel:'#f0a',custom:'var(--muted)'};
      let total = 0;
      let html = '<div style="margin-bottom:12px;display:flex;align-items:center;gap:12px"><span style="color:var(--muted);font-size:.82rem">Click to select/deselect · </span><button class="btn btn-secondary" style="font-size:.75rem;padding:4px 10px" onclick="selectAllGenKw(true)">Select All</button><button class="btn btn-secondary" style="font-size:.75rem;padding:4px 10px" onclick="selectAllGenKw(false)">None</button><button class="btn btn-primary" style="font-size:.75rem;padding:4px 10px;margin-left:auto" onclick="addSelectedGenKws()">+ Add Selected to Keywords</button></div>';

      for (const [cat, kws] of Object.entries(results)) {
        total += kws.length;
        html += `<div style="margin-bottom:14px">
          <div style="font-size:.72rem;color:${catColors[cat]||'var(--muted)'};font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${esc(cat)} (${kws.length})</div>
          <div>`;
        for (const kw of kws) {
          html += `<span class="gen-kw-item selected" onclick="toggleGenKw(this)" data-kw="${esc(kw)}" data-cat="${esc(cat)}"><input type="checkbox" checked onclick="event.stopPropagation()"> ${esc(kw)}</span>`;
        }
        html += '</div></div>';
      }
      html += `<div style="color:var(--muted);font-size:.78rem;margin-top:8px">Generated ${total} keywords across ${Object.keys(results).length} categories</div>`;
      document.getElementById('genResults').innerHTML = html;
      // sync checkboxes inside spans
      document.querySelectorAll('.gen-kw-item input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', function() {
          this.closest('.gen-kw-item').classList.toggle('selected', this.checked);
        });
      });
    } catch(e) { toast('Error generating keywords','error'); }
    finally { btn.textContent = '⚡ Generate Keywords'; btn.disabled = false; }
  }

  function toggleGenKw(el) {
    el.classList.toggle('selected');
    el.querySelector('input[type=checkbox]').checked = el.classList.contains('selected');
  }

  function selectAllGenKw(val) {
    document.querySelectorAll('.gen-kw-item').forEach(el => {
      el.classList.toggle('selected', val);
      el.querySelector('input[type=checkbox]').checked = val;
    });
  }

  async function addSelectedGenKws() {
    const items = [...document.querySelectorAll('.gen-kw-item.selected')];
    if (!items.length) { toast('No keywords selected','error'); return; }
    const keywords = items.map(el => ({ keyword: el.dataset.kw, category: el.dataset.cat }));
    const projectId = _getKwProjectId();
    if (projectId) {
      // Add to project one by one (project keywords API doesn't have bulk endpoint)
      let added = 0;
      for (const kw of keywords) {
        const res = await fetch(`/api/projects/${projectId}/keywords`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(kw) });
        const data = await res.json();
        if (data.ok) added++;
      }
      toast(`Added ${added} keyword${added!==1?'s':''} to project!`);
    } else {
      const res = await fetch('/api/keywords/bulk', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({keywords})
      });
      const data = await res.json();
      if (data.ok) { toast(`Added ${data.added} keyword${data.added!==1?'s':''}!`); loadKeywords(); }
      else toast(data.error||'Error adding keywords','error');
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async function loadUsers() {
    const el = document.getElementById('usersList');
    try {
      const users = await (await fetch('/api/users')).json();
      if (!users.length) { el.innerHTML = '<div class="empty"><p>No users.</p></div>'; return; }
      el.innerHTML = `<table>
        <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>2FA</th><th>Last Login</th><th></th></tr></thead>
        <tbody>${users.map(u => `<tr>
          <td><strong>${esc(u.username)}</strong></td>
          <td style="color:var(--muted)">${esc(u.email||'—')}</td>
          <td>${u.is_admin?'<span class="badge-admin">Admin</span>':'<span class="badge-user">User</span>'}</td>
          <td>${u.totp_enabled?'<span class="badge-2fa">✓</span>':'<span style="color:var(--muted);font-size:.79rem">Off</span>'}</td>
          <td class="time-cell">${fmtTime(u.last_login)}</td>
          <td><button class="btn btn-danger" onclick="deleteUser(${u.id},'${esc(u.username)}')">Remove</button></td>
        </tr>`).join('')}</tbody></table>`;
    } catch(e) { el.innerHTML = '<div class="empty" style="color:var(--red)">Error.</div>'; }
  }

  async function createUser() {
    const username = document.getElementById('newUsername').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const is_admin = document.getElementById('newUserRole').value === '1';
    if (!username || !password) { toast('Username and password required', 'error'); return; }
    const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username,email,password,is_admin}) });
    const data = await res.json();
    if (data.ok) { document.getElementById('newUsername').value=''; document.getElementById('newEmail').value=''; document.getElementById('newUserPassword').value=''; toast('User created!'); loadUsers(); }
    else toast(data.error||'Error','error');
  }

  async function deleteUser(id, username) {
    if (!confirm(`Remove "${username}"?`)) return;
    const res = await fetch(`/api/users/${id}`, { method:'DELETE' });
    const data = await res.json();
    if (data.ok) { toast('Removed'); loadUsers(); }
    else toast(data.error||'Error','error');
  }

  // ── API helper ─────────────────────────────────────────────────────────────
  async function apiFetch(url, method='GET', body=null) {
    try {
      const opts = { method, headers: {'Content-Type':'application/json'} };
      if (body) opts.body = JSON.stringify(body);
      const r = await fetch(url, opts);
      return await r.json();
    } catch(e) { console.error('apiFetch error', url, e); return null; }
  }

  // ── Reports ────────────────────────────────────────────────────────────────
  let reportSessions = [];

  async function loadReportPreview() {
    try {
      const [stats, sessions] = await Promise.all([
        (await fetch('/api/stats')).json(),
        (await fetch('/api/sessions')).json(),
      ]);
      reportSessions = sessions;
      document.getElementById('reportStats').innerHTML =
        `<strong>${stats.total_hits}</strong> keyword hits across <strong>${stats.total_sessions}</strong> sessions · <strong>${stats.total_pages}</strong> pages crawled`;
      // Populate session dropdown
      const sel = document.getElementById('reportScope');
      sel.innerHTML = '<option value="all">All sessions (full history)</option>';
      sessions.forEach(s => {
        const started = fmtTime(s.started_at);
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `Session #${s.id} — ${started} (${s.hits_found} hits, ${s.pages_crawled} pages)`;
        sel.appendChild(opt);
      });
    } catch(e) {}
  }

  function updateReportPreview() {
    const val = document.getElementById('reportScope').value;
    if (val === 'all') {
      document.getElementById('reportHitsLabel').textContent = 'Latest 200 hits';
      document.getElementById('reportSessionsLabel').textContent = 'All sessions';
    } else {
      const s = reportSessions.find(x => x.id == val);
      if (s) {
        document.getElementById('reportHitsLabel').textContent = `${s.hits_found} hits from this session`;
        document.getElementById('reportSessionsLabel').textContent = `Session #${s.id} only`;
      }
    }
  }

  function downloadReport() {
    const btn = document.querySelector('.btn-report');
    btn.textContent = '⏳ Generating…';
    btn.disabled = true;
    const scope = document.getElementById('reportScope').value;
    const url = scope === 'all' ? '/api/report/pdf' : `/api/report/pdf?session_id=${scope}`;
    window.location.href = url;
    setTimeout(() => { btn.textContent = '⬇ Download PDF Report'; btn.disabled = false; }, 3000);
  }

  // ── Settings ───────────────────────────────────────────────────────────────
  async function loadSettings() {
    try {
      const profile = await (await fetch('/api/settings/profile')).json();
      document.getElementById('profileInfo').innerHTML = `
        <div style="display:grid;gap:9px">
          ${[['Username',profile.username],['Email',profile.email||'—'],['Role',profile.is_admin?'<span class="badge-admin">Admin</span>':'<span class="badge-user">User</span>'],['OAuth',profile.oauth_provider||'None'],['Last login',fmtTime(profile.last_login)],['Member since',fmtTime(profile.created_at)]].map(([l,v])=>`
          <div style="display:flex;justify-content:space-between;font-size:.84rem"><span style="color:var(--muted)">${l}</span><span>${v}</span></div>`).join('')}
        </div>`;
      const totpEl = document.getElementById('totpStatus');
      if (profile.totp_enabled) {
        totpEl.innerHTML = `<p style="color:var(--green);font-size:.84rem;margin-bottom:14px">✓ 2FA is enabled.</p>
          <div class="form-group" style="margin-bottom:10px"><label>TOTP code or password to disable</label><input type="text" id="disableTotpCode" style="width:100%"/></div>
          <button class="btn btn-danger" onclick="disableTotp()">Disable 2FA</button>`;
      } else {
        totpEl.innerHTML = `<p style="color:var(--muted);font-size:.84rem;margin-bottom:14px">2FA is not enabled.</p>
          <a href="/totp/setup" class="btn btn-primary">Set Up 2FA</a>`;
      }
    } catch(e) {}
  }

  async function changePassword() {
    const body = { current_password: document.getElementById('currentPw').value, new_password: document.getElementById('newPw').value, confirm_password: document.getElementById('confirmPw').value };
    const res = await fetch('/api/settings/password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) { document.getElementById('currentPw').value=''; document.getElementById('newPw').value=''; document.getElementById('confirmPw').value=''; toast('Password updated!'); }
    else toast(data.error||'Error','error');
  }

  async function disableTotp() {
    const val = document.getElementById('disableTotpCode').value.trim();
    const body = val.length===6 && /^\d+$/.test(val) ? {totp_code:val} : {password:val};
    const res = await fetch('/api/settings/totp/disable', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) { toast('2FA disabled'); loadSettings(); }
    else toast(data.error||'Invalid code','error');
  }

  // ── Investigations ─────────────────────────────────────────────────────────
  let targetCount = 0;

  function addTarget(type) {
    targetCount++;
    const id = `target-${targetCount}`;
    const labels = { email: '📧 Email', name: '👤 Name', keyword: '🔑 Keyword' };
    const placeholders = { email: 'user@example.com', name: 'John Doe', keyword: 'company name' };
    const colors = { email: 'var(--accent)', name: 'var(--green)', keyword: 'var(--purple)' };
    const div = document.createElement('div');
    div.id = id;
    div.style.cssText = 'display:flex;align-items:center;gap:8px';
    div.innerHTML = `
      <span style="font-size:.75rem;font-weight:600;color:${colors[type]};width:62px;flex-shrink:0">${labels[type]}</span>
      <input type="text" data-type="${type}" style="flex:1;max-width:360px" placeholder="${placeholders[type]}"/>
      <button class="btn btn-danger" onclick="document.getElementById('${id}').remove()" style="padding:4px 10px">✕</button>`;
    document.getElementById('invTargets').appendChild(div);
    div.querySelector('input').focus();
  }



  let _allKeywords = [];

  function filterKeywords() {
    const q = (document.getElementById('keywordSearch')?.value || '').toLowerCase();
    if (!document.querySelector('#keywordsList .kw-row')) { loadKeywords(); return; }
    if (!q) {
      document.querySelectorAll('#keywordsList .kw-row').forEach(r => r.style.display = '');
      document.querySelectorAll('#keywordsList .kw-category').forEach(c => c.style.display = '');
      return;
    }
    document.querySelectorAll('#keywordsList .kw-category').forEach(cat => {
      let anyVisible = false;
      cat.querySelectorAll('.kw-row').forEach(row => {
        const match = (row.dataset.kw || '').includes(q) || (cat.dataset.cat || '').includes(q);
        row.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });
      cat.style.display = anyVisible ? '' : 'none';
    });
  }
  async function stopCrawl() {
    if (!confirm('Send stop signal? The crawl will finish the current page then halt.')) return;
    const btn = document.getElementById('crawlStopBtn');
    btn.textContent = '⏳ Stopping…';
    btn.disabled = true;
    try {
      const res = await fetch('/api/crawl/stop', { method: 'POST' });
      const data = await res.json();
      if (data.ok) toast('Stop signal sent — crawl will halt shortly.');
      else toast(data.error || 'Error', 'error');
    } catch(e) {
      toast('Network error', 'error');
    } finally {
      btn.textContent = '■ Stop Crawl';
      btn.disabled = false;
    }
  }
  async function runInvestigation() {
    const name = document.getElementById('invName').value.trim();
    if (!name) { toast('Enter an investigation name', 'error'); return; }

    const inputs = document.querySelectorAll('#invTargets input');
    const targets = [];
    inputs.forEach(inp => {
      const val = inp.value.trim();
      if (val) targets.push({ value: val, type: inp.dataset.type });
    });

    if (!targets.length) { toast('Add at least one target', 'error'); return; }

    const btn = document.getElementById('invRunBtn');
    btn.textContent = '⏳ Running…';
    btn.disabled = true;

    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targets })
      });
      const data = await res.json();
      if (data.ok) {
        toast(`Investigation complete! ID #${data.id}`);
        document.getElementById('invName').value = '';
        document.getElementById('invTargets').innerHTML = '';
        targetCount = 0;
        loadInvestigations();
      } else {
        toast(data.error || 'Error running investigation', 'error');
      }
    } catch(e) {
      toast('Network error', 'error');
    } finally {
      btn.textContent = '▶ Run Investigation';
      btn.disabled = false;
    }
  }

  async function loadInvestigations() {
    const el = document.getElementById('investigationsList');
    try {
      const invs = await (await fetch('/api/investigations')).json();
      if (!invs.length) {
        el.innerHTML = '<div class="empty"><div class="icon">🔍</div><p>No investigations yet. Create one above.</p></div>';
        return;
      }
      el.innerHTML = `<table>
        <thead><tr><th>Name</th><th>Targets</th><th>Status</th><th>Created</th><th></th></tr></thead>
        <tbody>${invs.map(inv => `
          <tr class="session-row" onclick="expandInvestigation(${inv.id})" id="inv-${inv.id}">
            <td><strong>${esc(inv.name)}</strong></td>
            <td style="color:var(--muted)">${inv.target_count} target${inv.target_count !== 1 ? 's' : ''}</td>
            <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
            <td class="time-cell">${fmtTime(inv.created_at)}</td>
            <td><button class="btn btn-danger" onclick="event.stopPropagation();deleteInvestigation(${inv.id})" style="padding:3px 10px">✕</button></td>
          </tr>
          <tr class="session-detail" id="inv-detail-${inv.id}">
            <td colspan="5"><div class="session-detail-inner" id="inv-inner-${inv.id}"></div></td>
          </tr>`).join('')}
        </tbody></table>`;
    } catch(e) {
      el.innerHTML = '<div class="empty" style="color:var(--red)">Error loading investigations.</div>';
    }
  }

  async function expandInvestigation(id) {
    const detail = document.getElementById(`inv-detail-${id}`);
    if (!detail) return;
    const isOpen = detail.style.display === 'table-row';
    if (isOpen) { detail.style.display = 'none'; return; }
    detail.style.display = 'table-row';
    const inner = document.getElementById(`inv-inner-${id}`);
    inner.innerHTML = 'Loading…';
    try {
      const data = await (await fetch(`/api/investigations/${id}`)).json();
      if (!data.targets?.length) { inner.innerHTML = '<p style="color:var(--muted);padding:10px">No targets found.</p>'; return; }
      inner.innerHTML = data.targets.map(t => buildTargetCard(t)).join('');
    } catch(e) {
      inner.innerHTML = '<p style="color:var(--red)">Error loading results.</p>';
    }
  }

  function buildTargetCard(t) {
    const typeColors = { email: 'var(--accent)', name: 'var(--green)', keyword: 'var(--purple)' };
    const typeIcons = { email: '📧', name: '👤', keyword: '🔑' };
    let html = `<div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin:10px 0;background:var(--bg)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:1.1rem">${typeIcons[t.target_type] || '🎯'}</span>
        <strong style="color:${typeColors[t.target_type] || 'var(--text)'}">${esc(t.value)}</strong>
        <span style="font-size:.72rem;color:var(--muted)">${t.target_type}</span>
        ${t.error ? `<span style="color:var(--yellow);font-size:.75rem">⚠ ${esc(t.error)}</span>` : ''}
      </div>`;

    // Breaches
    if (t.target_type === 'email') {
      if (t.breaches?.length) {
        html += `<div style="margin-bottom:12px">
          <div style="color:var(--red);font-weight:600;font-size:.82rem;margin-bottom:8px">⚠ Found in ${t.breaches.length} breach(es)</div>
          ${t.breaches.map(b => `
            <div style="background:rgba(248,81,73,.06);border:1px solid rgba(248,81,73,.2);border-radius:6px;padding:10px;margin-bottom:6px">
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <strong style="color:var(--red)">${esc(b.breach_name)}</strong>
                <span style="color:var(--muted);font-size:.75rem">${esc(b.breach_date)}</span>
              </div>
              <div style="font-size:.75rem;color:var(--muted);margin-bottom:5px">${esc(b.description?.replace(/<[^>]+>/g,'').slice(0,200) || '')}</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">
                ${(b.data_classes||[]).map(dc => `<span style="background:rgba(248,81,73,.1);color:var(--red);border-radius:3px;padding:1px 6px;font-size:.7rem">${esc(dc)}</span>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;
      } else if (!t.error) {
        html += `<div style="color:var(--green);font-size:.82rem;margin-bottom:12px">✓ No breaches found in HIBP</div>`;
      }
    }

    // Dark web hits
    if (t.darkweb_hits?.length) {
      html += `<div>
        <div style="color:var(--orange);font-weight:600;font-size:.82rem;margin-bottom:8px">🕸 Found in ${t.darkweb_hits.length} dark web hit(s)</div>
        ${t.darkweb_hits.slice(0,5).map(h => `
          <div style="background:rgba(240,136,62,.06);border:1px solid rgba(240,136,62,.2);border-radius:6px;padding:10px;margin-bottom:6px">
            <div style="font-family:var(--mono);font-size:.75rem;color:var(--accent);margin-bottom:4px">${esc(h.url)}</div>
            <div style="font-size:.75rem;color:var(--muted);font-family:var(--mono)">${esc((h.context||'').slice(0,200))}</div>
            <div style="font-size:.7rem;color:var(--muted);margin-top:4px">${esc(h.found_at||'')}</div>
          </div>`).join('')}
        ${t.darkweb_hits.length > 5 ? `<p style="color:var(--muted);font-size:.75rem">…and ${t.darkweb_hits.length - 5} more</p>` : ''}
      </div>`;
    } else {
      html += `<div style="color:var(--muted);font-size:.82rem">No matches in dark web database</div>`;
    }

    html += '</div>';
    return html;
  }

  async function deleteInvestigation(id) {
    if (!confirm('Delete this investigation?')) return;
    const res = await fetch(`/api/investigations/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) { toast('Deleted'); loadInvestigations(); }
    else toast(data.error || 'Error', 'error');
  }


  // ── IP Lookup ──────────────────────────────────────────────────────────────

  async function runIPLookup() {
    const ip = document.getElementById('ipInput').value.trim();
    if (!ip) { toast('Enter an IP address', 'error'); return; }
    const btn = document.getElementById('ipLookupBtn');
    const resultEl = document.getElementById('ipLookupResult');
    btn.textContent = '⏳ Investigating…';
    btn.disabled = true;
    resultEl.style.display = 'none';

    try {
      const res = await fetch('/api/ip-investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      const data = await res.json();
      if (!data.ok) { toast(data.error || 'Error', 'error'); return; }

      // Fetch full results and show inline
      const full = await (await fetch(`/api/ip-investigations/${data.id}`)).json();
      resultEl.style.display = 'block';
      resultEl.innerHTML = buildIPReport(full);
      loadIPInvestigations();
      toast(`Lookup complete for ${ip}`);
    } catch(e) {
      toast('Network error', 'error');
    } finally {
      btn.textContent = '🔍 Investigate';
      btn.disabled = false;
    }
  }

  async function loadIPInvestigations() {
    const el = document.getElementById('ipInvestigationsList');
    try {
      const items = await (await fetch('/api/ip-investigations')).json();
      if (!items.length) {
        el.innerHTML = '<div class="empty"><div class="icon">🌐</div><p>No IP lookups yet.</p></div>';
        return;
      }
      el.innerHTML = `<table>
        <thead><tr><th>IP Address</th><th>Country</th><th>ISP/AS Owner</th><th>Abuse Score</th><th>VT Malicious</th><th>Looked Up</th><th></th></tr></thead>
        <tbody>${items.map(i => {
          const score = i.abuse_score ?? '—';
          const scoreColor = i.abuse_score >= 80 ? 'var(--red)' : i.abuse_score >= 30 ? 'var(--yellow)' : 'var(--green)';
          const vtColor = i.vt_malicious > 5 ? 'var(--red)' : i.vt_malicious > 0 ? 'var(--yellow)' : 'var(--green)';
          return `<tr class="session-row" onclick="expandIPInvestigation(${i.id})" id="ipinv-${i.id}">
            <td style="font-family:var(--mono);font-weight:600">${esc(i.ip)}</td>
            <td>${esc(i.country || '—')}</td>
            <td style="color:var(--muted);font-size:.8rem">${esc(i.isp || '—')}</td>
            <td><strong style="color:${scoreColor}">${score}%</strong></td>
            <td><strong style="color:${vtColor}">${i.vt_malicious ?? '—'}</strong></td>
            <td class="time-cell">${fmtTime(i.created_at)}</td>
            <td><button class="btn btn-danger" onclick="event.stopPropagation();deleteIPInv(${i.id})" style="padding:3px 10px">✕</button></td>
          </tr>
          <tr class="session-detail" id="ipinv-detail-${i.id}">
            <td colspan="7"><div class="session-detail-inner" id="ipinv-inner-${i.id}"></div></td>
          </tr>`;
        }).join('')}</tbody></table>`;
    } catch(e) {
      el.innerHTML = '<div class="empty" style="color:var(--red)">Error loading.</div>';
    }
  }

  async function expandIPInvestigation(id) {
    const detail = document.getElementById(`ipinv-detail-${id}`);
    if (!detail) return;
    if (detail.style.display === 'table-row') { detail.style.display = 'none'; return; }
    detail.style.display = 'table-row';
    const inner = document.getElementById(`ipinv-inner-${id}`);
    inner.innerHTML = 'Loading…';
    try {
      const data = await (await fetch(`/api/ip-investigations/${id}`)).json();
      inner.innerHTML = buildIPReport(data);
    } catch(e) { inner.innerHTML = '<p style="color:var(--red)">Error.</p>'; }
  }

  function buildIPReport(data) {
    const a = data.abuseipdb || {};
    const v = data.virustotal || {};
    const aError = a.error;
    const vError = v.error;

    let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:12px 0">`;

    // ── AbuseIPDB Panel ──
    html += `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:1.1rem">🛡</span>
        <strong style="font-size:.9rem">AbuseIPDB</strong>
        ${aError ? `<span style="color:var(--red);font-size:.75rem">⚠ ${esc(aError)}</span>` : ''}
      </div>`;

    if (!aError && a.ip) {
      const score = a.abuse_confidence_score ?? 0;
      const scoreColor = score >= 80 ? 'var(--red)' : score >= 30 ? 'var(--yellow)' : 'var(--green)';
      html += `
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:2.8rem;font-weight:800;color:${scoreColor}">${score}%</div>
          <div style="color:var(--muted);font-size:.75rem">Abuse Confidence Score</div>
        </div>
        ${ipRow('IP', a.ip)}
        ${ipRow('Country', (a.country_name || '') + (a.country_code ? ` (${a.country_code})` : ''))}
        ${ipRow('ISP', a.isp)}
        ${ipRow('Domain', a.domain)}
        ${ipRow('Usage Type', a.usage_type)}
        ${ipRow('Tor Exit Node', a.is_tor ? '⚠ YES' : 'No', a.is_tor ? 'color:var(--red)' : '')}
        ${ipRow('Total Reports', a.total_reports + (a.num_distinct_users ? ` (${a.num_distinct_users} reporters)` : ''))}
        ${ipRow('Last Reported', a.last_reported_at ? fmtTime(a.last_reported_at) : 'Never')}
        ${a.hostnames?.length ? ipRow('Hostnames', a.hostnames.slice(0,3).join(', ')) : ''}`;

      if (a.reports?.length) {
        html += `<div style="margin-top:12px">
          <div style="font-size:.75rem;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:8px">Recent Reports</div>
          ${a.reports.slice(0,5).map(r => `
            <div style="background:var(--surface2);border-radius:5px;padding:8px;margin-bottom:5px;font-size:.76rem">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="color:var(--red)">${(r.categories||[]).join(', ') || 'Unknown'}</span>
                <span style="color:var(--muted)">${r.reporter_country || ''}</span>
              </div>
              ${r.comment ? `<div style="color:var(--muted);font-family:var(--mono)">${esc(r.comment.slice(0,150))}</div>` : ''}
            </div>`).join('')}
        </div>`;
      }
    }
    html += `</div>`;

    // ── VirusTotal Panel ──
    html += `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <span style="font-size:1.1rem">🦠</span>
        <strong style="font-size:.9rem">VirusTotal</strong>
        ${vError ? `<span style="color:var(--red);font-size:.75rem">⚠ ${esc(vError)}</span>` : ''}
      </div>`;

    if (!vError && v.ip) {
      const stats = v.analysis_stats || {};
      const mal = stats.malicious || 0;
      const sus = stats.suspicious || 0;
      const total = v.total_engines || 0;
      const malColor = mal > 5 ? 'var(--red)' : mal > 0 ? 'var(--yellow)' : 'var(--green)';
      html += `
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:2.8rem;font-weight:800;color:${malColor}">${mal}/${total}</div>
          <div style="color:var(--muted);font-size:.75rem">Malicious Detections</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:2px">
            ${sus} suspicious · ${stats.harmless||0} harmless · ${stats.undetected||0} undetected
          </div>
        </div>
        ${ipRow('ASN', v.asn ? `AS${v.asn} — ${v.as_owner||''}` : '—')}
        ${ipRow('Country', v.country || '—')}
        ${ipRow('Continent', v.continent || '—')}
        ${ipRow('Network', v.network || '—')}
        ${ipRow('Registry', v.regional_internet_registry || '—')}
        ${ipRow('Reputation', v.reputation !== undefined ? String(v.reputation) : '—')}
        ${ipRow('JARM', v.jarm ? v.jarm.slice(0,24)+'…' : '—')}
        ${v.tags?.length ? ipRow('Tags', v.tags.join(', ')) : ''}
        ${ipRow('Last Analysis', v.last_analysis_date ? fmtTime(v.last_analysis_date) : '—')}`;

      if (v.malicious_engines?.length) {
        html += `<div style="margin-top:12px">
          <div style="font-size:.75rem;font-weight:600;color:var(--red);text-transform:uppercase;margin-bottom:8px">Flagged by ${v.malicious_engines.length} engine(s)</div>
          ${v.malicious_engines.slice(0,8).map(e => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:.76rem">
              <span>${esc(e.engine)}</span>
              <span style="color:${e.category==='malicious'?'var(--red)':'var(--yellow)'}">${esc(e.result||e.category)}</span>
            </div>`).join('')}
        </div>`;
      }

      if (v.ssl_certificate) {
        const ssl = v.ssl_certificate;
        html += `<div style="margin-top:12px">
          <div style="font-size:.75rem;font-weight:600;color:var(--muted);text-transform:uppercase;margin-bottom:8px">SSL Certificate</div>
          ${ssl.subject_cn ? ipRow('Subject CN', ssl.subject_cn) : ''}
          ${ssl.issuer_org ? ipRow('Issuer', ssl.issuer_org) : ''}
          ${ssl.valid_from ? ipRow('Valid', ssl.valid_from + ' → ' + (ssl.valid_to||'?')) : ''}
        </div>`;
      }
    }
    html += `</div></div>`;

    // ── Resolutions ──
    if (v.resolutions?.length) {
      html += `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:4px">
        <div style="font-size:.8rem;font-weight:600;margin-bottom:10px">📡 Historical DNS Resolutions (${v.resolutions.length})</div>
        <table style="font-size:.78rem">
          <thead><tr><th>Hostname</th><th>Date</th></tr></thead>
          <tbody>${v.resolutions.slice(0,15).map(r => `<tr>
            <td style="font-family:var(--mono);color:var(--accent)">${esc(r.hostname||'—')}</td>
            <td class="time-cell">${r.date ? fmtTime(new Date(r.date*1000).toISOString()) : '—'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }

    // ── Communicating files ──
    if (v.communicating_files?.length) {
      html += `<div style="background:var(--bg);border:1px solid rgba(248,81,73,.25);border-radius:8px;padding:14px;margin-top:8px">
        <div style="font-size:.8rem;font-weight:600;color:var(--red);margin-bottom:10px">⚠ Malware communicating with this IP (${v.communicating_files.length} samples)</div>
        <table style="font-size:.76rem">
          <thead><tr><th>Name</th><th>Type</th><th>SHA256</th><th>Malicious</th></tr></thead>
          <tbody>${v.communicating_files.map(f => `<tr>
            <td style="color:var(--red)">${esc(f.name||'unknown')}</td>
            <td style="color:var(--muted)">${esc(f.type||'—')}</td>
            <td style="font-family:var(--mono);font-size:.7rem;color:var(--muted)">${(f.sha256||'').slice(0,16)}…</td>
            <td style="color:${f.malicious>0?'var(--red)':'var(--muted)'}">${f.malicious||0}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }

    // ── WHOIS ──
    if (v.whois) {
      html += `<details style="margin-top:8px">
        <summary style="cursor:pointer;font-size:.8rem;color:var(--muted);padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px">📋 WHOIS Data</summary>
        <pre style="background:var(--bg);border:1px solid var(--border);border-radius:0 0 6px 6px;padding:12px;font-size:.72rem;color:var(--muted);overflow-x:auto;max-height:300px;overflow-y:auto">${esc(v.whois)}</pre>
      </details>`;
    }

    return html;
  }

  function ipRow(label, value, style = '') {
    if (!value || value === '—' || value === 'undefined') return '';
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:.8rem">
      <span style="color:var(--muted)">${label}</span>
      <span style="text-align:right;max-width:60%;word-break:break-all;${style}">${esc(String(value))}</span>
    </div>`;
  }

  async function deleteIPInv(id) {
    if (!confirm('Delete this IP lookup?')) return;
    await fetch(`/api/ip-investigations/${id}`, { method: 'DELETE' });
    toast('Deleted');
    loadIPInvestigations();
  }

  // ── Digest / Mailing List ─────────────────────────────────────────────────
  async function loadSubscribers() {
    const el = document.getElementById('subscribersList');
    if (!el || !isAdmin) return;
    try {
      const data = await (await fetch('/api/digest/subscribers')).json();
      const subs = data.subscribers || [];
      if (!subs.length) {
        el.innerHTML = '<p style="color:var(--muted);font-size:.83rem">No subscribers yet. Add the first one above.</p>';
        return;
      }
      el.innerHTML = subs.map(s => `
        <div class="subscriber-row">
          <span style="font-family:var(--mono)">${esc(s)}</span>
          <button class="btn btn-secondary" style="font-size:.72rem;padding:3px 10px;color:var(--red);border-color:rgba(248,81,73,.3)" onclick="removeSubscriber('${esc(s)}')">Remove</button>
        </div>
      `).join('');
    } catch(e) { /* not admin */ }
  }

  async function addSubscriber() {
    const email = document.getElementById('newSubscriberEmail').value.trim();
    if (!email) return;
    const res = await fetch('/api/digest/subscribers', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email}) });
    const d = await res.json();
    if (d.ok) { toast('Subscriber added'); document.getElementById('newSubscriberEmail').value = ''; loadSubscribers(); }
    else toast(d.error || 'Error', 'error');
  }

  async function removeSubscriber(email) {
    if (!confirm(`Remove ${email} from digest list?`)) return;
    await fetch('/api/digest/subscribers', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email}) });
    toast('Removed');
    loadSubscribers();
  }

  async function sendDigestNow() {
    const btn = document.getElementById('digestSendBtn');
    btn.textContent = '⏳ Sending…';
    btn.disabled = true;
    try {
      const res = await fetch('/api/digest/send', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
      const d = await res.json();
      if (d.ok) toast(`✅ Sent to ${d.sent}/${d.total} subscribers`);
      else toast(d.error || `Failed — ${d.errors?.join(', ')}`, 'error');
    } catch(e) {
      toast('Network error', 'error');
    } finally {
      btn.textContent = '▶ Send Now';
      btn.disabled = false;
    }
  }

  async function downloadDigest() {
    window.location.href = '/api/digest/preview';
  }

  // ── DNS Crawler ───────────────────────────────────────────────────────────
  let dnsPolling = null;


  // ── DNS / Infrastructure Recon ──────────────────────────────────────────────
  let _dnsCurrent = null;
  let _dnsView = 'graph';
  let _graphNodes = [], _graphEdges = [];
  let _gDrag = null, _gDragOff = {x:0,y:0}, _gPan = {x:0,y:0}, _gPanStart = null, _gScale = 1, _gHover = null;

  async function loadDNSInvestigations() { showDNSHistory(); }

  async function showDNSHistory() {
    _dnsCurrent = null;
    document.getElementById('dnsViewToggles').style.display = 'none';
    const el = document.getElementById('dnsContent');
    el.innerHTML = '<div class="dns-running" style="padding:20px"><div class="dns-spinner"></div> Loading…</div>';
    try {
      const data = await (await fetch('/api/dns/investigations')).json();
      if (!data.length) {
        el.innerHTML = '<div class="empty" style="padding:60px 0"><div class="icon">🌐</div><p>No investigations yet. Enter a domain above.</p></div>';
        return;
      }
      el.innerHTML = '<div style="padding:14px 20px">' + data.map(r => `
        <div onclick="loadDNSResult(${r.id})" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:8px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="flex:1">
            <div style="font-weight:700;font-family:var(--mono);font-size:.9rem">${esc(r.domain)}</div>
            <div style="font-size:.73rem;color:var(--muted);margin-top:3px">${fmtTime(r.created_at)} &nbsp;·&nbsp; ${r.subdomain_count ?? '?'} subdomains &nbsp;·&nbsp; ${r.resolved_count ?? '?'} resolved</div>
          </div>
          ${r.zone_transfer_success ? '<span class="rc rc-crit">⚠ ZONE XFR</span>' : ''}
          <span class="rc ${r.has_spf?'rc-ok':'rc-warn'}">${r.has_spf?'✓ SPF':'✗ SPF'}</span>
          <span class="rc ${r.has_dmarc?'rc-ok':'rc-warn'}">${r.has_dmarc?'✓ DMARC':'✗ DMARC'}</span>
          <span class="dns-badge-${r.status==='complete'?'ok':r.status==='running'?'warn':'fail'}" style="font-size:.72rem;font-weight:700">${r.status.toUpperCase()}</span>
          <button class="btn btn-secondary" style="font-size:.7rem;padding:3px 8px;color:var(--red)" onclick="event.stopPropagation();deleteDNS(${r.id})">✕</button>
        </div>`).join('') + '</div>';
    } catch(e) {
      el.innerHTML = '<div class="empty"><div class="icon">⚠️</div><p>Failed to load history.</p></div>';
    }
  }

  async function startDNS() {
    const domain = document.getElementById('dnsInput').value.trim();
    if (!domain) return;
    const btn = document.getElementById('dnsBtn');
    btn.disabled = true; btn.textContent = '⏳ Starting…';
    try {
      const res = await fetch('/api/dns/investigate', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain})});
      const d = await res.json();
      if (d.ok) { toast(`DNS recon started for ${domain}`); pollDNS(d.id); }
      else toast(d.error || 'Error', 'error');
    } catch(e) { toast('Network error', 'error'); }
    finally { btn.disabled = false; btn.textContent = '🔍 Investigate'; }
  }

  function pollDNS(id) {
    if (dnsPolling) clearInterval(dnsPolling);
    document.getElementById('dnsViewToggles').style.display = 'none';
    const el = document.getElementById('dnsContent');
    const steps = ['🔍 Querying DNS records (A, MX, NS, TXT, SOA…)','📜 Fetching certificate transparency logs (crt.sh)…','🗺 HackerTarget passive subdomain lookup…','💥 Active subdomain brute-force (wordlist)…','🔄 Attempting zone transfer on all nameservers…','📍 Resolving & geolocating IPs…','✅ Finalising results…'];
    let si = 0;
    el.innerHTML = `<div style="padding:40px 20px;text-align:center">
      <div class="dns-spinner" style="width:36px;height:36px;border-width:3px;margin:0 auto 16px"></div>
      <div style="font-weight:600;font-size:1rem;margin-bottom:6px">Running Infrastructure Recon…</div>
      <div id="dnsStep" style="font-size:.8rem;color:var(--muted);font-family:var(--mono)">${steps[0]}</div>
    </div>`;
    const stepTimer = setInterval(() => {
      const el2 = document.getElementById('dnsStep');
      if (el2 && si < steps.length - 1) el2.textContent = steps[++si];
    }, 2200);
    dnsPolling = setInterval(async () => {
      try {
        const data = await (await fetch(`/api/dns/investigations/${id}`)).json();
        if (data.status === 'complete') {
          clearInterval(dnsPolling); clearInterval(stepTimer);
          try {
            renderDNSResult(data);
          } catch(renderErr) {
            console.error('renderDNSResult failed:', renderErr);
            el.innerHTML = '<div class="empty" style="padding:60px 0"><div class="icon">⚠️</div><p>Render error: ' + renderErr.message + '</p><pre style="font-size:.7rem;color:var(--muted);text-align:left;padding:10px">' + renderErr.stack + '</pre></div>';
          }
        } else if (data.status === 'error') {
          clearInterval(dnsPolling); clearInterval(stepTimer);
          el.innerHTML = `<div class="empty" style="padding:60px 0"><div class="icon">⚠️</div><p>Recon failed: ${esc(data.error||'unknown error')}</p></div>`;
        }
      } catch(e) { console.error('Poll error:', e); clearInterval(dnsPolling); clearInterval(stepTimer); }
    }, 2500);
  }

  async function loadDNSResult(id) {
    const el = document.getElementById('dnsContent');
    el.innerHTML = '<div class="dns-running" style="padding:20px"><div class="dns-spinner"></div> Loading…</div>';
    try {
      const data = await (await fetch(`/api/dns/investigations/${id}`)).json();
      if (data.status === 'running') { pollDNS(id); return; }
      renderDNSResult(data);
    } catch(e) { el.innerHTML = '<div class="empty"><div class="icon">⚠️</div><p>Failed to load.</p></div>'; }
  }

  function renderDNSResult(data) {
    _dnsCurrent = data;
    _dnsView = 'graph';
    _gScale = 1; _gPan = {x:0,y:0};

    const el = document.getElementById('dnsContent');
    const toggles = document.getElementById('dnsViewToggles');
    toggles.style.display = 'flex';
    document.querySelectorAll('.dns-view-btn').forEach(b => b.classList.remove('active'));
    toggles.querySelectorAll('.dns-view-btn')[0].classList.add('active');

    const r = data.result || {};
    const dns = r.dns_records || {};
    const zt = r.zone_transfer || {};
    const email = r.email_security || {};
    const resolved = r.subdomains_resolved || [];
    const passive = r.subdomains_passive || [];
    const bruteforce = r.subdomains_bruteforce || [];
    const ipGeo = r.ip_geo || {};
    const ptr = r.ptr_records || {};
    const ztSuccess = Object.values(zt).some(v => v && v.success);
    const mainIPs = (dns.A||[]).concat(dns.AAAA||[]);
    const portScan = r.port_scan || {};
    const dirEnum = r.dir_enum || {};
    const services = r.services || {};
    const hasScanData = Object.keys(portScan).length > 0;

    // All unique subdomains with source tags
    const allSubMap = {};
    for (const s of resolved) allSubMap[s.subdomain] = {...s, sources: new Set(['passive'])};
    for (const s of bruteforce) {
      if (allSubMap[s.subdomain]) allSubMap[s.subdomain].sources.add('brute');
      else allSubMap[s.subdomain] = {...s, sources: new Set(['brute'])};
    }
    for (const c of passive) {
      if (allSubMap[c.subdomain]) allSubMap[c.subdomain].sources.add('cert');
    }
    const allSubs = Object.values(allSubMap);

    let html = '<div id="dnsResultWrap">';

    // ── Stat strip ──
    html += `<div class="dns-stat-strip">
      <div class="dns-stat-chip"><div class="sv">${allSubs.length}</div><div class="sl">Subdomains</div></div>
      <div class="dns-stat-chip"><div class="sv">${resolved.length}</div><div class="sl">Resolved</div></div>
      <div class="dns-stat-chip"><div class="sv">${bruteforce.length}</div><div class="sl">Brute-forced</div></div>
      <div class="dns-stat-chip"><div class="sv">${passive.length}</div><div class="sl">crt.sh Certs</div></div>
      <div class="dns-stat-chip"><div class="sv">${mainIPs.length}</div><div class="sl">IPs</div></div>
      <div class="dns-stat-chip ${ztSuccess?'sdanger':'sok'}"><div class="sv">${ztSuccess?'⚠':'✓'}</div><div class="sl">Zone XFR</div></div>
      <div class="dns-stat-chip ${email.spf_valid?'sok':'sdanger'}"><div class="sv">${email.spf_valid?'✓':'✗'}</div><div class="sl">SPF</div></div>
      <div class="dns-stat-chip ${email.dmarc_valid?'sok':'sdanger'}"><div class="sv">${email.dmarc_valid?'✓':'✗'}</div><div class="sl">DMARC</div></div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <code style="font-size:.9rem;font-weight:700;color:var(--accent)">${esc(data.domain)}</code>
        <span style="font-size:.73rem;color:var(--muted)">${fmtTime(data.created_at)}</span>
        <button class="btn btn-secondary" style="font-size:.75rem;padding:4px 10px" id="portScanBtn" onclick="triggerPortScan(${data.id})">${hasScanData ? '↺ Re-Scan Ports/Dirs' : '🔌 Scan Ports & Dirs'}</button>
        <button class="btn btn-secondary" style="font-size:.75rem;padding:4px 10px" id="ddEnrichBtn" onclick="triggerDNSDumpsterEnrich(${data.id})">🔍 Enrich w/ DNSDumpster</button>
        <button class="btn btn-primary" style="font-size:.75rem;padding:4px 10px" onclick="exportDNSpdf(${data.id},'${esc(data.domain)}')">⬇ PDF</button>
        <button class="btn btn-secondary" style="font-size:.75rem;padding:4px 10px" onclick="showDNSHistory()">← Back</button>
      </div>
    </div>`;

    // ── Zone transfer alert ──
    if (ztSuccess) {
      const ns = Object.entries(zt).filter(([,v])=>v.success).map(([k])=>k).join(', ');
      html += `<div style="margin:10px 20px;padding:10px 14px;background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.35);border-radius:7px;color:var(--red);font-size:.82rem;font-weight:600">
        🚨 CRITICAL: Zone transfer succeeded on <code>${esc(ns)}</code> — full DNS zone exposed to unauthenticated requests.
      </div>`;
    }

    // ── View panels ──
    html += buildAllViews(data.domain, dns, allSubs, resolved, passive, bruteforce, ptr, ipGeo, zt, ztSuccess, email, portScan, dirEnum, mainIPs, services);
    html += '</div>';
    el.innerHTML = html;
    requestAnimationFrame(() => {
      drawGraph(data.domain, dns, resolved, bruteforce, ipGeo);
      initInfraMap();
    });
  }

  function buildAllViews(domain, dns, allSubs, resolved, passive, bruteforce, ptr, ipGeo, zt, ztSuccess, email, portScan, dirEnum, mainIPs, services) {
    let h = '';
    h += `<div id="dv-graph" class="dns-view-panel active">${buildInfraPanel(domain, dns, resolved, bruteforce, ipGeo, services, mainIPs)}${buildGraphPanel(domain, dns, resolved, bruteforce, ipGeo)}</div>`;
    h += `<div id="dv-subdomains" class="dns-view-panel">${buildSubdomainsPanel(allSubs, resolved, passive, bruteforce, zt, ztSuccess)}</div>`;
    h += `<div id="dv-ports" class="dns-view-panel">${buildPortsPanel(portScan, mainIPs, domain)}</div>`;
    h += `<div id="dv-dirs" class="dns-view-panel">${buildDirsPanel(dirEnum, domain)}</div>`;
    h += `<div id="dv-email" class="dns-view-panel">${buildEmailPanel(email, dns)}</div>`;
    h += `<div id="dv-records" class="dns-view-panel">${buildRecordsPanel(dns, ptr, ipGeo, zt, ztSuccess)}</div>`;
    h += `<div id="dv-certs" class="dns-view-panel">${buildCertHistoryPanel(domain, passive)}</div>`;
    return h;
  }


  // ── DNSDumpster-style Infrastructure Panel ──────────────────────────────────
  function buildInfraPanel(domain, dns, resolved, bruteforce, ipGeo, services, mainIPs) {

    // ── Aggregate geo data ──
    const allGeo = [];
    for (const sub of resolved) {
      for (const g of (sub.geo || [])) { if (g && g.countryCode) allGeo.push(g); }
    }
    for (const [ip, g] of Object.entries(ipGeo||{})) { if (g && g.countryCode) allGeo.push(g); }

    // Country counts
    const countryCounts = {};
    const countryNames = {};
    for (const g of allGeo) {
      countryCounts[g.countryCode] = (countryCounts[g.countryCode]||0) + 1;
      countryNames[g.countryCode] = g.country;
    }

    // ASN / org counts
    const orgCounts = {};
    for (const g of allGeo) {
      const org = g.org || g.isp || '';
      if (org) orgCounts[org] = (orgCounts[org]||0) + 1;
    }
    const topOrgs = Object.entries(orgCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const maxOrg = topOrgs[0]?.[1] || 1;

    // Service / server counts
    const svcCounts = {};
    for (const [host, s] of Object.entries(services||{})) {
      const srv = s.server || 'unknown';
      if (srv && srv !== 'unknown') svcCounts[srv] = (svcCounts[srv]||0) + 1;
    }
    const topSvcs = Object.entries(svcCounts).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const totalSvcs = topSvcs.reduce((s,[,v])=>s+v, 0) || 1;

    // ── jsvectormap data ──
    const activeCountries = Object.keys(countryCounts);
    const maxCount = Math.max(...Object.values(countryCounts), 1);

    // [lat, lng] centroids for jsvectormap markers
    const markerLatLng = {
      'US':[38,-97],'CA':[56,-106],'MX':[23,-102],'BR':[-10,-55],'AR':[-34,-64],
      'CO':[4,-74],'CL':[-30,-71],'PE':[-10,-76],'VE':[8,-66],'EC':[-2,-78],
      'GB':[55,-3],'IE':[53,-8],'FR':[46,2],'DE':[51,10],'NL':[52,5],
      'BE':[50,4],'ES':[40,-4],'PT':[39,-8],'IT':[42,12],'CH':[47,8],
      'AT':[47,14],'PL':[52,20],'CZ':[50,15],'SK':[49,19],'HU':[47,19],
      'RO':[46,25],'BG':[43,25],'GR':[39,22],'HR':[45,16],'UA':[49,32],
      'SE':[62,15],'NO':[62,10],'FI':[64,26],'DK':[56,10],'LT':[56,24],
      'LV':[57,25],'EE':[59,25],'BY':[53,28],'MD':[47,29],'RS':[44,21],
      'RU':[62,105],'TR':[39,35],'IL':[31,35],'SA':[24,45],'AE':[24,54],
      'IR':[32,53],'IQ':[33,44],'SY':[35,38],'JO':[31,36],'KW':[29,48],
      'EG':[27,30],'LY':[27,17],'TN':[34,9],'DZ':[28,3],'MA':[32,-6],
      'NG':[10,8],'KE':[-1,38],'ZA':[-29,25],'ET':[9,40],'GH':[8,-1],
      'TZ':[-6,35],'MZ':[-18,35],'AO':[-12,18],'SD':[15,32],'CM':[4,12],
      'IN':[21,78],'PK':[30,70],'BD':[24,90],'LK':[7,81],'NP':[28,84],
      'CN':[35,105],'JP':[36,138],'KR':[36,128],'TW':[23,121],'HK':[22,114],
      'SG':[1,104],'MY':[4,110],'TH':[15,101],'VN':[16,108],'PH':[12,122],
      'ID':[-5,120],'MM':[17,96],'KH':[13,105],'MN':[47,105],'KZ':[48,68],
      'AU':[-25,134],'NZ':[-41,174],
    };

    const jvmMarkers = activeCountries
      .filter(cc => markerLatLng[cc])
      .map(cc => ({
        name: `${countryNames[cc]||cc}: ${countryCounts[cc]} IP(s)`,
        coords: markerLatLng[cc],
        style: { fill: '#4a90d9' }
      }));

    const jvmSelectedRegions = activeCountries
      .map(cc => cc.toLowerCase())
      .filter(cc => cc.length === 2);

    const flagRow = activeCountries.slice(0,8).map(cc =>
      cc.split('').map(c=>String.fromCodePoint(c.charCodeAt(0)+127397)).join('')
    ).join(' ');

    // Store for initInfraMap() called after DOM injection
    window._jvmMarkers = jvmMarkers;
    window._jvmRegions = jvmSelectedRegions;

    // ── ASN bars ──
    const asnBars = topOrgs.map(([org, cnt]) => `
      <div class="asn-bar-row">
        <div class="asn-bar-label" title="${esc(org)}">${esc(org.replace(/^AS\d+\s*/,'').slice(0,22))}</div>
        <div class="asn-bar-track"><div class="asn-bar-fill" style="width:${Math.round(cnt/maxOrg*100)}%"></div></div>
        <div class="asn-bar-count">${cnt}</div>
      </div>`).join('');

    // ── Services donut SVG ──
    const svcColors = ['#58a6ff','#3fb950','#bc8cff','#f85149','#d29922','#8b949e'];
    let donutSvg = '';
    if (topSvcs.length) {
      const R=36, r=22, cx=42, cy=42;
      let startAngle = -Math.PI/2;
      const slices = topSvcs.map(([name,cnt],i) => {
        const angle = (cnt/totalSvcs)*Math.PI*2;
        const x1=cx+R*Math.cos(startAngle), y1=cy+R*Math.sin(startAngle);
        startAngle += angle;
        const x2=cx+R*Math.cos(startAngle), y2=cy+R*Math.sin(startAngle);
        const xi1=cx+r*Math.cos(startAngle-angle), yi1=cy+r*Math.sin(startAngle-angle);
        const xi2=cx+r*Math.cos(startAngle), yi2=cy+r*Math.sin(startAngle);
        const large = angle > Math.PI ? 1 : 0;
        return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${r},${r} 0 ${large},0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z" fill="${svcColors[i%svcColors.length]}"><title>${name}: ${cnt}</title></path>`;
      });
      donutSvg = `<svg width="84" height="84" class="svc-donut"><g>${slices.join('')}</g></svg>`;
    }

    const svcRows = topSvcs.map(([name,cnt],i) =>
      `<div class="svc-row"><span class="svc-name" style="color:${svcColors[i%svcColors.length]}">${esc(name)}</span><span class="svc-cnt">${cnt}</span></div>`
    ).join('');

    // ── A Records table ──
    const aRecords = dns.A || [];
    const subsByIP = {};
    for (const sub of resolved) {
      for (const ip of (sub.ips||[])) {
        if (!subsByIP[ip]) subsByIP[ip] = [];
        subsByIP[ip].push(sub.subdomain);
      }
    }

    // All unique hosts with their IPs
    const hostRows = resolved.map(sub => {
      const ips = sub.ips || [];
      const geo = (sub.geo||[])[0] || {};
      const svcData = services[sub.subdomain] || {};
      const techBadges = [...new Set([
        svcData.server && svcData.server !== 'unknown' ? svcData.server : '',
        ...(svcData.tech||[])
      ])].filter(Boolean).map(t => `<span class="svc-badge">${esc(t)}</span>`).join('');
      const status = svcData.status_code ? `<span style="font-size:.68rem;color:var(--muted)">${svcData.status_code}</span>` : '';
      const title = svcData.title ? `<div style="font-size:.67rem;color:var(--muted);margin-top:2px">${esc(svcData.title.slice(0,50))}</div>` : '';
      const asn = geo.as || '';
      const asnShort = asn.replace(/^AS\d+\s*/,'').slice(0,20);
      const flag = geo.countryCode ? geo.countryCode.split('').map(c=>String.fromCodePoint(c.charCodeAt(0)+127397)).join('') : '';
      return `<tr>
        <td style="font-family:var(--mono);font-size:.76rem">${esc(sub.subdomain)}</td>
        <td style="font-family:var(--mono);font-size:.74rem;color:var(--accent)">${ips.map(ip=>`<div>${esc(ip)}</div>`).join('')}</td>
        <td style="font-size:.72rem">${flag} ${esc(geo.city||'')} ${esc(geo.countryCode||'')}<div style="font-size:.67rem;color:var(--muted)">${esc(asnShort)}</div></td>
        <td>${techBadges}${title}${status}</td>
      </tr>`;
    }).join('');

    return `
    <div style="border-bottom:1px solid var(--border)">
      <!-- Full-width map -->
      <div style="padding:14px 16px 0">
        <div class="infra-card-title">🌍 System Locations</div>
        <div class="world-map-wrap">
          <div id="infra-world-map"></div>
          <div style="margin-top:6px;font-size:1rem;letter-spacing:2px">${flagRow}</div>
        </div>
      </div>
      <!-- 2-col: Hosting + Services -->
      <div class="infra-overview" style="grid-template-columns:1fr 1fr;padding-top:12px">
        <div class="infra-card">
          <div class="infra-card-title">🏢 Hosting / Networks</div>
          ${topOrgs.length ? asnBars : '<div style="color:var(--muted);font-size:.8rem">No ASN data</div>'}
        </div>
        <div class="infra-card">
          <div class="infra-card-title">⚙️ Services / Banners</div>
          ${topSvcs.length
            ? `<div class="svc-donut-wrap">${donutSvg}<div class="svc-list">${svcRows}</div></div>`
            : '<div style="color:var(--muted);font-size:.8rem">No service data yet — run a new investigation to probe HTTP banners</div>'}
        </div>
      </div>
      <div class="infra-a-records">
        <div style="font-size:.78rem;font-weight:700;margin-bottom:8px;color:var(--text)">A Records — Subdomains from Dataset</div>
        <table class="infra-a-tbl">
          <thead><tr><th>Host</th><th>IP</th><th>ASN / Location</th><th>Services / Banners</th></tr></thead>
          <tbody>${hostRows || '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px">No resolved subdomains</td></tr>'}</tbody>
        </table>
      </div>
      <hr class="graph-divider">
    </div>`;
  }

    // ── Graph View ──────────────────────────────────────────────────────────────
  function initInfraMap() {
    const el = document.getElementById('infra-world-map');
    if (!el) return;
    if (typeof jsVectorMap === 'undefined') {
      // Load jsvectormap JS then world map data, then init
      const s1 = document.createElement('script');
      s1.src = 'https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/js/jsvectormap.min.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/maps/world.js';
        s2.onload = () => _renderJvMap(el);
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    } else {
      _renderJvMap(el);
    }
  }

  function _renderJvMap(el) {
    // Destroy previous instance if any
    if (el._jvmInstance) { try { el._jvmInstance.destroy(); } catch(e){} }
    el.innerHTML = '';
    try {
      el._jvmInstance = new jsVectorMap({
        map: 'world',
        selector: '#infra-world-map',
        zoomButtons: true,
        zoomOnScroll: false,
        backgroundColor: '#0d1117',
        regionStyle: {
          initial: { fill: '#1c2d3a', stroke: '#2a3f52', strokeWidth: 0.5 },
          hover:   { fill: '#2a4a62', fillOpacity: 1 },
          selected:{ fill: '#4a90d9' },
          selectedHover: { fill: '#58a6ff' }
        },
        markerStyle: {
          initial: { fill: '#58a6ff', stroke: '#0d1117', strokeWidth: 1, r: 6 },
          hover:   { fill: '#79c0ff', r: 8 }
        },
        selectedRegions: window._jvmRegions || [],
        markers: window._jvmMarkers || [],
        onMarkerTooltipShow(e, tooltip, index) {
          tooltip.text(tooltip.text(), true);
        }
      });
    } catch(err) {
      console.warn('jsVectorMap init failed:', err);
      el.innerHTML = '<div style="color:#58a6ff;font-size:.8rem;padding:8px">Map unavailable</div>';
    }
  }

  function buildGraphPanel(domain, dns, resolved, bruteforce, ipGeo) {
    return `<div style="margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-weight:600;font-size:.85rem">Subdomain Infrastructure Graph</span>
        <span style="font-size:.75rem;color:var(--muted)">${resolved.length} resolved · ${bruteforce.length} brute-forced · Drag nodes · Scroll to zoom</span>
        <button class="btn btn-secondary" style="font-size:.72rem;padding:3px 8px;margin-left:auto" onclick="if(_dnsCurrent)drawGraph(_dnsCurrent.domain,_dnsCurrent.result.dns_records||{},_dnsCurrent.result.subdomains_resolved||[],_dnsCurrent.result.subdomains_bruteforce||[],_dnsCurrent.result.ip_geo||{})">↺ Reset</button>
      </div>
      <canvas id="dnsGraphCanvas" height="500"></canvas>
      <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;font-size:.74rem;color:var(--muted)">
        <span>🔴 Root domain</span><span>🔵 Passive subdomain</span><span>🟣 Brute-forced</span><span>🟢 IP address</span>
      </div>`;
  }

  function drawGraph(domain, dns, resolved, bruteforce, ipGeo) {
    const canvas = document.getElementById('dnsGraphCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    const W = canvas.width, H = canvas.height;
    _gScale = 1; _gPan = {x:0,y:0};

    const nodes = [], edges = [];
    const cx = W/2, cy = H/2;
    nodes.push({id:'root', label:domain, x:cx, y:cy, r:18, color:'#f85149', type:'root'});

    // Place resolved (passive) nodes
    const rings = [110, 185, 255, 315];
    const allSubs = [...resolved.map(s=>({...s,src:'passive'})), ...bruteforce.filter(b=>!resolved.find(r=>r.subdomain===b.subdomain)).map(s=>({...s,src:'brute'}))];
    const byLen = {};
    for (const s of allSubs.slice(0,80)) {
      const depth = (s.subdomain.replace('.'+domain,'').match(/\./g)||[]).length + 1;
      if (!byLen[depth]) byLen[depth] = [];
      byLen[depth].push(s);
    }
    const depths = Object.keys(byLen).map(Number).sort();
    let nid = 0;
    for (const depth of depths) {
      const ring = byLen[depth];
      const rr = rings[Math.min(depth-1, rings.length-1)];
      ring.forEach((s,i) => {
        const angle = (2*Math.PI*i/ring.length) - Math.PI/2;
        const nx = cx + rr*Math.cos(angle) + (Math.random()-.5)*15;
        const ny = cy + rr*Math.sin(angle) + (Math.random()-.5)*15;
        const hasIP = s.ips && s.ips.length;
        const nId = 'n'+nid++;
        const color = s.src==='brute' ? '#bc8cff' : '#58a6ff';
        nodes.push({id:nId, label:s.subdomain.replace('.'+domain,''), x:nx, y:ny, r:hasIP?9:6, color, type:'sub', sub:s.subdomain, ips:s.ips||[], src:s.src});
        edges.push({from:'root', to:nId});
        if (hasIP && nodes.length < 100) {
          for (const ip of s.ips.slice(0,2)) {
            const ex = nodes.find(n=>n.type==='ip'&&n.label===ip);
            if (!ex) {
              const ia = angle+(Math.random()-.5)*.6;
              const ir = rr+32;
              const ipId = 'ip'+ip.replace(/[.:]/g,'_');
              nodes.push({id:ipId, label:ip, x:cx+ir*Math.cos(ia), y:cy+ir*Math.sin(ia), r:5, color:'#3fb950', type:'ip', geo:ipGeo[ip]||{}});
              edges.push({from:nId, to:ipId});
            } else {
              edges.push({from:nId, to:ex.id});
            }
          }
        }
      });
    }
    _graphNodes = nodes; _graphEdges = edges;

    function render() {
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = document.body.classList.contains('light') ? '#f6f8fa' : '#0d1117';
      ctx.fillRect(0,0,W,H);
      ctx.save();
      ctx.translate(_gPan.x, _gPan.y);
      ctx.scale(_gScale, _gScale);
      for (const e of edges) {
        const f = nodes.find(n=>n.id===e.from), t = nodes.find(n=>n.id===e.to);
        if (!f||!t) continue;
        ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(t.x,t.y);
        ctx.strokeStyle = t.type==='ip' ? 'rgba(63,185,80,.2)' : t.color+'33';
        ctx.lineWidth = .8; ctx.stroke();
      }
      for (const n of nodes) {
        const hov = _gHover===n.id;
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r+(hov?3:0),0,Math.PI*2);
        ctx.fillStyle = n.color+(hov?'':'bb'); ctx.fill();
        if (hov||n.type==='root') { ctx.strokeStyle=n.color; ctx.lineWidth=2; ctx.stroke(); }
        if (n.type==='root'||hov||(n.type==='sub'&&n.r>=8)) {
          ctx.fillStyle = document.body.classList.contains('light') ? '#1f2328' : '#e6edf3';
          ctx.font = n.type==='root'?'bold 10px monospace':'9px monospace';
          ctx.textAlign='center';
          const lbl = n.label.length>20?n.label.slice(0,18)+'…':n.label;
          ctx.fillText(lbl, n.x, n.y+n.r+11);
        }
      }
      ctx.restore();
      ctx.fillStyle='#8b949e'; ctx.font='10px sans-serif'; ctx.textAlign='left';
      ctx.fillText(`${nodes.filter(n=>n.type!=='root'&&n.type!=='ip').length} subdomains · ${nodes.filter(n=>n.type==='ip').length} IPs`, 8, H-8);
    }
    render();

    canvas.onmousedown = e => {
      const rect=canvas.getBoundingClientRect();
      const mx=(e.clientX-rect.left-_gPan.x)/_gScale, my=(e.clientY-rect.top-_gPan.y)/_gScale;
      const hit=nodes.find(n=>Math.hypot(n.x-mx,n.y-my)<n.r+5);
      if (hit&&hit.type!=='root') { _gDrag=hit; _gDragOff={x:mx-hit.x,y:my-hit.y}; }
      else { _gPanStart={x:e.clientX-_gPan.x, y:e.clientY-_gPan.y}; }
    };
    canvas.onmousemove = e => {
      const rect=canvas.getBoundingClientRect();
      const mx=(e.clientX-rect.left-_gPan.x)/_gScale, my=(e.clientY-rect.top-_gPan.y)/_gScale;
      if (_gDrag) { _gDrag.x=mx-_gDragOff.x; _gDrag.y=my-_gDragOff.y; render(); return; }
      if (_gPanStart) { _gPan.x=e.clientX-_gPanStart.x; _gPan.y=e.clientY-_gPanStart.y; render(); return; }
      const prev=_gHover, hit=nodes.find(n=>Math.hypot(n.x-mx,n.y-my)<n.r+5);
      _gHover=hit?hit.id:null;
      if (_gHover!==prev) render();
      canvas.style.cursor=hit?'pointer':'grab';
    };
    canvas.onmouseup=()=>{ _gDrag=null; _gPanStart=null; };
    canvas.onmouseleave=()=>{ _gDrag=null; _gPanStart=null; };
    canvas.onwheel=e=>{ e.preventDefault(); _gScale=Math.max(.25,Math.min(4,_gScale*(e.deltaY>0?.88:1.12))); render(); };
  }

  // ── Subdomains View ─────────────────────────────────────────────────────────
  function buildSubdomainsPanel(allSubs, resolved, passive, bruteforce, zt, ztSuccess) {
    let h = `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <span class="rc rc-info">${allSubs.length} total subdomains</span>
      <span class="rc rc-ok">${resolved.length} passive (crt.sh + HackerTarget)</span>
      <span style="background:rgba(188,140,255,.1);color:var(--purple);border:1px solid rgba(188,140,255,.25)" class="rc">${bruteforce.length} active brute-forced</span>
      <span class="rc rc-info">${passive.length} certificate SANs</span>
    </div>`;
    if (!allSubs.length) return h + '<div class="empty" style="padding:32px 0"><div class="icon">🔎</div><p>No subdomains found</p></div>';

    h += `<table class="sub-tbl"><thead><tr><th>Subdomain</th><th>IP(s)</th><th>Location</th><th>Source</th></tr></thead><tbody>`;
    for (const s of allSubs.sort((a,b)=>a.subdomain.localeCompare(b.subdomain))) {
      const ips = (s.ips||[]).join(', ');
      const srcs = [...(s.sources||new Set(['passive']))];
      const srcBadges = srcs.map(src => {
        if (src==='brute') return `<span class="sub-src sub-src-brute">brute-force</span>`;
        if (src==='cert') return `<span class="sub-src sub-src-cert">crt.sh</span>`;
        return `<span class="sub-src sub-src-passive">passive</span>`;
      }).join(' ');
      h += `<tr><td style="font-family:var(--mono);font-size:.79rem">${esc(s.subdomain)}</td>
        <td style="font-family:var(--mono);font-size:.76rem;color:var(--accent)">${esc(ips)||'—'}</td>
        <td style="font-size:.74rem;color:var(--muted)">${geoStr(s.geo)}</td>
        <td>${srcBadges}</td></tr>`;
    }
    h += '</tbody></table>';

    if (ztSuccess) {
      for (const [ns, info] of Object.entries(zt)) {
        if (!info.success) continue;
        const rows = (info.records||[]).slice(0,100).map(rec =>
          `<tr><td style="font-family:var(--mono);font-size:.74rem">${esc(rec.name)}</td><td><span class="rc rc-info" style="font-size:.65rem">${esc(rec.type)}</span></td><td style="font-family:var(--mono);font-size:.72rem">${esc(rec.value)}</td></tr>`
        ).join('');
        h += infraSec(`🚨 Zone Transfer — ${esc(ns)} (${info.record_count} records leaked)`,
          `<p style="color:var(--red);font-size:.8rem;font-weight:600;margin-bottom:8px">Restrict AXFR to authorised nameservers immediately.</p>
           <table class="sub-tbl"><thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`);
      }
    }
    return h;
  }

  // ── Ports View ──────────────────────────────────────────────────────────────
  function buildPortsPanel(portScan, mainIPs, domain) {
    const hasData = Object.keys(portScan).length > 0;
    if (!hasData) {
      return `<div style="text-align:center;padding:40px 20px">
        <div style="font-size:2rem;margin-bottom:12px">🔌</div>
        <div style="font-weight:600;margin-bottom:6px">Port scan not yet run</div>
        <div style="color:var(--muted);font-size:.83rem;margin-bottom:16px">Click the button below to actively scan all resolved IPs for open ports.</div>
        <button class="btn btn-primary" onclick="triggerPortScan(${_dnsCurrent?.id})">🔌 Run Port Scan</button>
        <div style="margin-top:10px;font-size:.75rem;color:var(--muted)">Scans ${mainIPs.length} IPs across 30 common ports</div>
      </div>`;
    }

    let h = '';
    for (const [ip, ports] of Object.entries(portScan)) {
      const open = ports.filter(p=>p.status==='open');
      const filtered = ports.filter(p=>p.status==='filtered');
      h += `<div class="is" style="margin-bottom:12px">
        <div class="is-hdr" onclick="toggleIS(this)">
          <span class="is-title">
            <code style="color:var(--accent)">${esc(ip)}</code>
            <span class="rc rc-ok">${open.length} open</span>
            ${filtered.length?`<span class="rc rc-warn">${filtered.length} filtered</span>`:''}
          </span>
          <span style="color:var(--muted);font-size:.8rem">▾</span>
        </div>
        <div class="is-body">
          <div class="port-heatmap">
            ${ports.map(p=>`<div class="port-cell ${p.status}" title="${p.service} (${p.status})">
              <div class="pn">${p.port}</div>
              <div class="ps">${p.service}</div>
            </div>`).join('')}
          </div>
          ${open.length?`<div style="margin-top:10px"><span style="font-size:.77rem;font-weight:600;color:var(--green)">Open ports: </span><span style="font-family:var(--mono);font-size:.77rem">${open.map(p=>`${p.port}/${p.service}`).join(', ')}</span></div>`:''}
        </div>
      </div>`;
    }
    return h;
  }

  // ── Directories View ────────────────────────────────────────────────────────
  function buildDirsPanel(dirEnum, domain) {
    const hasData = Object.keys(dirEnum).length > 0 && Object.values(dirEnum).some(a=>a.length>0);
    if (!hasData) {
      return `<div style="text-align:center;padding:40px 20px">
        <div style="font-size:2rem;margin-bottom:12px">📂</div>
        <div style="font-weight:600;margin-bottom:6px">Directory enumeration not yet run</div>
        <div style="color:var(--muted);font-size:.83rem;margin-bottom:16px">Probes ${domain} and its IPs for exposed paths using a 70-entry wordlist.</div>
        <button class="btn btn-primary" onclick="triggerPortScan(${_dnsCurrent?.id})">📂 Run Dir Enum</button>
      </div>`;
    }
    let h = '';
    for (const [target, paths] of Object.entries(dirEnum)) {
      if (!paths.length) continue;
      const interesting = paths.filter(p=>[200,201,301,302,401,403,500].includes(p.status_code));
      const rows = interesting.map(p => {
        const sc = p.status_code;
        const cls = sc===200?'status-200':sc>=300&&sc<400?`status-${sc}`:sc===401||sc===403?`status-${sc}`:'status-500';
        return `<tr>
          <td><span class="${cls}">${sc}</span></td>
          <td style="font-family:var(--mono);font-size:.78rem">${esc(p.path)}</td>
          <td style="font-size:.74rem;color:var(--muted)">${p.content_length ? p.content_length+' bytes' : '—'}</td>
          <td style="font-size:.74rem;color:var(--accent);font-family:var(--mono)">${p.redirect_to?esc(p.redirect_to):'—'}</td>
        </tr>`;
      }).join('');
      h += infraSec(`📂 ${esc(target)} — ${interesting.length} paths found`,
        `<table class="dir-table"><thead><tr><th>Status</th><th>Path</th><th>Size</th><th>Redirect</th></tr></thead><tbody>${rows}</tbody></table>`);
    }
    return h;
  }

  // ── Email Security View ─────────────────────────────────────────────────────
  function buildEmailPanel(email, dns) {
    const issues = email.issues || [];
    let score = 100;
    if (!email.spf_valid) score -= 35;
    if (!email.dmarc_valid) score -= 35;
    if (!(email.dkim_selectors_found||[]).length) score -= 20;
    if (email.dmarc?.includes('p=none')) score -= 10;
    const scoreColor = score>=80?'var(--green)':score>=50?'var(--yellow)':'var(--red)';
    const scoreLabel = score>=80?'Good':score>=50?'Moderate Risk':'High Risk';

    let h = `<div style="display:flex;align-items:center;gap:20px;margin-bottom:16px;padding:14px 18px;background:var(--surface);border:1px solid var(--border);border-radius:8px;">
      <div style="text-align:center;min-width:60px">
        <div style="font-size:2.4rem;font-weight:900;color:${scoreColor};line-height:1">${score}</div>
        <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Score</div>
        <div style="font-size:.76rem;color:${scoreColor};font-weight:600;margin-top:2px">${scoreLabel}</div>
      </div>
      <div style="flex:1">${issues.length?issues.map(i=>`<div style="padding:3px 0;color:var(--yellow);font-size:.8rem">⚠ ${esc(i)}</div>`).join(''):'<div style="color:var(--green);font-size:.83rem">✓ No issues detected</div>'}</div>
    </div>
    <div class="esec-grid">
      <div class="esec-card ${email.spf_valid?'pass':'fail'}">
        <div class="esec-title">${email.spf_valid?'✅':'❌'} SPF</div>
        ${email.spf?`<div class="esec-val">${esc(email.spf)}</div>`:'<div style="color:var(--red);font-size:.8rem">Missing — spoofing risk</div>'}
      </div>
      <div class="esec-card ${email.dmarc_valid?(email.dmarc?.includes('p=none')?'warn':'pass'):'fail'}">
        <div class="esec-title">${email.dmarc_valid?(email.dmarc?.includes('p=none')?'⚠️':'✅'):'❌'} DMARC</div>
        ${email.dmarc?`<div class="esec-val">${esc(email.dmarc)}</div>`:'<div style="color:var(--red);font-size:.8rem">Missing — no enforcement</div>'}
      </div>
      <div class="esec-card ${(email.dkim_selectors_found||[]).length?'pass':'fail'}">
        <div class="esec-title">${(email.dkim_selectors_found||[]).length?'✅':'❌'} DKIM</div>
        ${(email.dkim_selectors_found||[]).length
          ?`<div class="esec-val">${email.dkim_selectors_found.map(s=>`<code style="background:rgba(255,255,255,.07);padding:1px 5px;border-radius:3px">${esc(s)}</code>`).join(' ')}</div>`
          :'<div style="color:var(--muted);font-size:.8rem">No selectors found</div>'}
      </div>
    </div>`;

    const txts = dns.TXT||[];
    if (txts.length) h += infraSec('📝 TXT Records', txts.map(t=>`<div style="font-family:var(--mono);font-size:.73rem;padding:3px 0;border-bottom:1px solid var(--border);word-break:break-all;color:var(--muted)">${esc(t)}</div>`).join(''));
    return h;
  }

  // ── DNS Records View ────────────────────────────────────────────────────────
  function buildRecordsPanel(dns, ptr, ipGeo, zt, ztSuccess) {
    const recTypes = ['A','AAAA','MX','NS','TXT','CNAME','SOA','CAA'];
    let rows = '';
    for (const type of recTypes) {
      if (!dns[type]) continue;
      for (const val of dns[type]) {
        const geo = (type==='A'||type==='AAAA') ? ipGeo[val] : null;
        const g = geo ? `<span style="font-size:.7rem;color:var(--muted)">${[geo.city,geo.countryCode].filter(Boolean).join(' ')} ${geo.org||''}</span>` : '';
        const p = ptr[val] ? `<span style="color:var(--muted);font-size:.7rem"> → ${esc(ptr[val])}</span>` : '';
        rows += `<tr><td><span class="rc rc-info" style="font-size:.65rem">${type}</span></td><td style="font-family:var(--mono);font-size:.78rem">${esc(val)}${p}</td><td>${g}</td></tr>`;
      }
    }
    return rows
      ? `<table class="sub-tbl"><thead><tr><th>Type</th><th>Value</th><th>Location / Org</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p style="color:var(--muted)">No records</p>';
  }

  // ── Port scan trigger ───────────────────────────────────────────────────────
  async function triggerPortScan(invId) {
    if (!invId) return;
    const btn = document.getElementById('portScanBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Scanning…'; }
    toast('Port scan & directory enumeration started — this may take 30–60 seconds');
    try {
      const res = await fetch(`/api/dns/investigations/${invId}/scan`, {method:'POST'});
      const d = await res.json();
      if (!d.ok) { toast(d.error||'Error', 'error'); if(btn){btn.disabled=false;btn.textContent='🔌 Scan Ports & Dirs';} return; }
      // Poll for results
      const poll = setInterval(async () => {
        try {
          const r = await (await fetch(`/api/dns/investigations/${invId}/scan/status`)).json();
          if (r.ready) {
            clearInterval(poll);
            toast('Port scan complete!');
            loadDNSResult(invId);
          }
        } catch(e) { clearInterval(poll); }
      }, 3000);
    } catch(e) { toast('Network error', 'error'); if(btn){btn.disabled=false;btn.textContent='🔌 Scan Ports & Dirs';} }
  }

  // ── DNSDumpster enrichment ──────────────────────────────────────────────────
  async function triggerDNSDumpsterEnrich(invId) {
    if (!invId) return;
    const btn = document.getElementById('ddEnrichBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Enriching…'; }
    toast('Fetching DNSDumpster data — merging into results…');
    try {
      const res = await fetch(`/api/dns/investigations/${invId}/enrich`, {method:'POST'});
      const d = await res.json();
      if (d.error) {
        toast(d.error, 'error');
        if (btn) { btn.disabled = false; btn.textContent = '🔍 Enrich w/ DNSDumpster'; }
        return;
      }
      toast(`✅ DNSDumpster: +${d.new_subdomains} new subdomains (${d.total_subdomains} total)`);
      if (btn) { btn.disabled = false; btn.textContent = '✅ DNSDumpster Enriched'; btn.style.borderColor='var(--green)'; btn.style.color='var(--green)'; }
      // Store enriched data and refresh the infra panel in-place
      if (_dnsCurrent) {
        _dnsCurrent.result = _dnsCurrent.result || {};
        _dnsCurrent.result.dnsdumpster = d.dnsdumpster_data;
        _dnsCurrent.result.subdomains_resolved = d.total_subdomains;
        _dnsCurrent.result.dnsdumpster_enriched = true;
        // Refresh infra map stat
        const chip = document.querySelector('.dns-stat-chip .sv');
        // Reload full result to get merged data
        loadDNSResult(invId);
      }
    } catch(e) {
      toast('Network error during enrichment', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Enrich w/ DNSDumpster'; }
    }
  }

  // ── Certificate History Panel ───────────────────────────────────────────────
  function buildCertHistoryPanel(domain, passiveCerts) {
    // Placeholder shown before lazy-load completes
    // passiveCerts is the crt.sh data from the initial scan (subdomain-only)
    const cached = passiveCerts.length;
    return `<div id="certPanelInner">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:.9rem">🔒 Certificate Transparency History</span>
        <span style="font-size:.75rem;color:var(--muted)">${cached} certs from initial scan</span>
        <button class="btn btn-secondary" style="font-size:.73rem;padding:3px 9px;margin-left:auto" onclick="if(_dnsCurrent)loadCertHistory(_dnsCurrent.domain,document.getElementById('dv-certs'),true)">↺ Refresh</button>
      </div>
      <div id="certPanelContent">
        <div class="dns-running" style="padding:30px;text-align:center"><div class="dns-spinner"></div><div style="margin-top:8px;color:var(--muted);font-size:.8rem">Loading from crt.sh…</div></div>
      </div>
    </div>`;
  }

  async function loadCertHistory(domain, panel, force) {
    const content = document.getElementById('certPanelContent');
    if (!content) return;
    if (!force && content._loaded) return;
    content.innerHTML = '<div class="dns-running" style="padding:30px;text-align:center"><div class="dns-spinner"></div><div style="margin-top:8px;color:var(--muted);font-size:.8rem">Fetching full certificate history from crt.sh…</div></div>';

    try {
      const res = await fetch(`/api/dns/certs/${encodeURIComponent(domain)}`);
      const data = await res.json();
      if (data.error) { content.innerHTML = `<div style="color:var(--red);padding:16px">${esc(data.error)}</div>`; return; }
      content._loaded = true;
      content.innerHTML = renderCertPanel(data);
    } catch(e) {
      content.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load cert history: ${esc(String(e))}</div>`;
    }
  }

  function renderCertPanel(data) {
    const { total, expired, expiring_soon, active, unique_sans, all_sans, issuers, certs } = data;

    // ── Stat cards ──
    let html = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">
      <div class="dns-stat-chip"><div class="sv">${total}</div><div class="sl">Total Certs</div></div>
      <div class="dns-stat-chip sok"><div class="sv">${active}</div><div class="sl">Active</div></div>
      <div class="dns-stat-chip ${expired?'sdanger':'sok'}"><div class="sv">${expired}</div><div class="sl">Expired</div></div>
      <div class="dns-stat-chip ${expiring_soon?'sdanger':''}"><div class="sv">${expiring_soon}</div><div class="sl">Expiring ≤30d</div></div>
      <div class="dns-stat-chip"><div class="sv">${unique_sans}</div><div class="sl">Unique SANs</div></div>
    </div>`;

    // ── Issuer breakdown ──
    if (Object.keys(issuers).length) {
      const maxIss = Math.max(...Object.values(issuers));
      html += `<div class="infra-card" style="margin-bottom:16px">
        <div class="infra-card-title">🏢 Issuers</div>
        ${Object.entries(issuers).map(([name, cnt]) => `
          <div class="asn-bar-row">
            <div class="asn-bar-label" title="${esc(name)}">${esc(name.slice(0,32))}</div>
            <div class="asn-bar-track"><div class="asn-bar-fill" style="width:${Math.round(cnt/maxIss*100)}%"></div></div>
            <div class="asn-bar-count">${cnt}</div>
          </div>`).join('')}
      </div>`;
    }

    // ── Timeline bar chart (ASCII-style, SVG) ──
    const byYear = {};
    for (const c of certs) {
      if (!c.not_before) continue;
      const yr = c.not_before.slice(0,4);
      byYear[yr] = (byYear[yr]||0) + 1;
    }
    const years = Object.keys(byYear).sort();
    if (years.length > 1) {
      const maxY = Math.max(...Object.values(byYear));
      const barW = Math.max(20, Math.min(48, Math.floor(560 / years.length)));
      const svgH = 80;
      const bars = years.map((yr, i) => {
        const cnt = byYear[yr];
        const bh = Math.max(3, Math.round((cnt/maxY) * (svgH-22)));
        const x = i * (barW + 4);
        const y = svgH - 18 - bh;
        return `<g>
          <rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="#58a6ff" rx="2" opacity=".8"/>
          <text x="${x+barW/2}" y="${svgH-4}" text-anchor="middle" font-size="8" fill="#8b949e">${yr.slice(2)}</text>
          <title>${yr}: ${cnt} cert${cnt!==1?'s':''}</title>
        </g>`;
      }).join('');
      html += `<div class="infra-card" style="margin-bottom:16px">
        <div class="infra-card-title">📅 Issuance Timeline</div>
        <svg viewBox="0 0 ${years.length*(barW+4)} ${svgH}" style="width:100%;max-width:640px;height:${svgH}px;display:block">${bars}</svg>
      </div>`;
    }

    // ── SAN discovery (unique subdomains from certs) ──
    if (all_sans.length) {
      const wildcards = all_sans.filter(s => s.startsWith('*'));
      const normal = all_sans.filter(s => !s.startsWith('*'));
      html += `<div class="infra-card" style="margin-bottom:16px">
        <div class="infra-card-title" style="display:flex;align-items:center;gap:8px">
          🌐 SAN Names — ${unique_sans} unique hosts/domains
          <button class="btn btn-secondary" style="font-size:.68rem;padding:2px 7px;margin-left:auto" onclick="copyCertSANs()">⎘ Copy All</button>
        </div>
        <div id="certSANlist" style="max-height:240px;overflow-y:auto;margin-top:8px">
          ${wildcards.length ? `<div style="font-size:.7rem;color:var(--muted);margin-bottom:4px">Wildcards</div>${wildcards.map(s=>`<div style="font-family:var(--mono);font-size:.74rem;padding:2px 0;border-bottom:1px solid var(--border);color:#d29922">⚡ ${esc(s)}</div>`).join('')}` : ''}
          <div style="font-size:.7rem;color:var(--muted);margin:6px 0 4px">Hosts (${normal.length})</div>
          ${normal.map(s=>`<div style="font-family:var(--mono);font-size:.74rem;padding:2px 0;border-bottom:1px solid var(--border)">${esc(s)}</div>`).join('')}
        </div>
      </div>`;
    }

    // ── Certificate table ──
    const pageSize = 50;
    const pageCerts = certs.slice(0, pageSize);
    html += `<div class="infra-card">
      <div class="infra-card-title">📜 Certificates (${total} total, showing ${pageCerts.length})</div>
      <div style="overflow-x:auto">
      <table class="infra-a-tbl" style="min-width:700px">
        <thead><tr>
          <th>Issued</th><th>Expires</th><th>Status</th><th>Issuer</th><th>SANs</th><th>ID</th>
        </tr></thead>
        <tbody>
          ${pageCerts.map(c => {
            const status = c.is_expired
              ? `<span style="color:var(--red);font-size:.72rem">Expired</span>`
              : c.expiring_soon
                ? `<span style="color:#d29922;font-size:.72rem">⚠ ${c.days_remaining}d left</span>`
                : `<span style="color:var(--green);font-size:.72rem">Active</span>`;
            const issuer = esc((c.issuer_cn || c.issuer_org || '').slice(0, 36));
            const sanPreview = c.sans.slice(0,3).map(s=>esc(s)).join('<br>') + (c.san_count>3?`<br><span style="color:var(--muted);font-size:.68rem">+${c.san_count-3} more</span>`:'');
            return `<tr>
              <td style="font-size:.74rem;white-space:nowrap">${(c.not_before||'').slice(0,10)}</td>
              <td style="font-size:.74rem;white-space:nowrap">${(c.not_after||'').slice(0,10)}</td>
              <td>${status}</td>
              <td style="font-size:.74rem">${issuer}</td>
              <td style="font-family:var(--mono);font-size:.71rem;max-width:260px">${sanPreview}</td>
              <td><a href="https://crt.sh/?id=${c.id}" target="_blank" style="font-size:.7rem;color:var(--accent)">#${c.id}</a></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
      ${certs.length > pageSize ? `<div style="font-size:.75rem;color:var(--muted);margin-top:8px;text-align:center">Showing ${pageSize} of ${certs.length} — <a href="https://crt.sh/?q=%.${esc(data.domain)}" target="_blank" style="color:var(--accent)">view all on crt.sh ↗</a></div>` : ''}
    </div>`;

    return html;
  }

  function copyCertSANs() {
    const el = document.getElementById('certSANlist');
    if (!el) return;
    const text = [...el.querySelectorAll('div[style*="mono"]')].map(d=>d.textContent.replace(/^⚡\s*/,'')).join('\n');
    navigator.clipboard.writeText(text).then(()=>toast('Copied SANs to clipboard')).catch(()=>toast('Copy failed','error'));
  }

  // ── View switcher ───────────────────────────────────────────────────────────
  function dnsSetView(view, btn) {
    _dnsView = view;
    document.querySelectorAll('.dns-view-panel').forEach(p => p.style.display = 'none');
    const panel = document.getElementById('dv-'+view);
    if (panel) panel.style.display = 'block';
    document.querySelectorAll('.dns-view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (view === 'graph' && _dnsCurrent) {
      requestAnimationFrame(()=>drawGraph(_dnsCurrent.domain,_dnsCurrent.result.dns_records||{},_dnsCurrent.result.subdomains_resolved||[],_dnsCurrent.result.subdomains_bruteforce||[],_dnsCurrent.result.ip_geo||{}));
    }
    if (view === 'certs' && _dnsCurrent && !panel._certsLoaded) {
      panel._certsLoaded = true;
      loadCertHistory(_dnsCurrent.domain, panel);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function geoStr(geoArr) {
    if (!geoArr) return '';
    const arr = Array.isArray(geoArr) ? geoArr : [geoArr];
    return arr.filter(g=>g&&g.country).map(g=>[g.city,g.countryCode].filter(Boolean).join(' ')).join(' / ');
  }

  function infraSec(title, body) {
    const id = 'is'+Math.random().toString(36).slice(2,8);
    return `<div class="is"><div class="is-hdr" onclick="toggleIS(this)"><span class="is-title">${title}</span><span style="color:var(--muted);font-size:.8rem" id="arr${id}">▾</span></div><div class="is-body" id="${id}">${body}</div></div>`;
  }
  function toggleIS(hdr) {
    const body = hdr.nextElementSibling;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    hdr.querySelector('span:last-child').textContent = open ? '▸' : '▾';
  }

  // keep compat aliases
  function dnsSection(t,b) { return infraSec(t,b); }
  function toggleDNSSection(id) { const el=document.getElementById(id); if(el){const open=el.style.display!=='none';el.style.display=open?'none':'block';} }

  function exportDNSpdf(id, domain) {
    toast(`Generating PDF for ${domain}…`);
    window.location.href = `/api/dns/investigations/${id}/pdf`;
  }

  async function deleteDNS(id) {
    if (!confirm('Delete this DNS investigation?')) return;
    await fetch(`/api/dns/investigations/${id}`, {method:'DELETE'});
    toast('Deleted');
    showDNSHistory();
  }

    // ── OSINT Toolkit ─────────────────────────────────────────────────────────

  function osintSwitchTool(tool, btn) {
    document.querySelectorAll('.osint-tool-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.osint-sub-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('osint-' + tool).classList.add('active');
    btn.classList.add('active');
    if (tool === 'resources') osintRenderResources();
  }

  function osintLoading(id, msg) {
    document.getElementById(id).innerHTML = `<div style="color:var(--muted);font-size:.82rem;padding:12px 0;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:14px;height:14px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></span>${msg}</div>`;
  }
  function osintError(id, msg) {
    document.getElementById(id).innerHTML = `<div style="color:#f85149;font-size:.82rem;background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.2);border-radius:6px;padding:10px 14px">⚠️ ${esc(msg)}</div>`;
  }
  function osintKV(pairs) {
    const rows = pairs.filter(([,v])=>v!=null&&v!==''&&v!==false);
    if (!rows.length) return '';
    return `<div class="osint-kv">${rows.map(([k,v])=>`<span class="osint-kv-key">${k}</span><span class="osint-kv-val">${esc(String(v))}</span>`).join('')}</div>`;
  }

  // ── GitHub ──
  async function osintGithubSearch() {
    const u = document.getElementById('osint-github-input').value.trim();
    if (!u) return;
    const el = document.getElementById('osint-github-results');
    osintLoading(el.id, `Looking up @${u} on GitHub…`);
    try {
      const r = await fetch(`/api/osint/github/${encodeURIComponent(u)}`);
      const p = await r.json();
      if (p.error || p.message === 'Not Found') throw new Error(p.message || p.error || 'User not found');
      const emails = [...new Set([p.email, ...(p._extracted_emails||[])].filter(Boolean))];
      el.innerHTML = `
        <div class="osint-result-card">
          <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px">
            <img src="${esc(p.avatar_url||'')}" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--border)" onerror="this.style.display='none'"/>
            <div>
              <div style="font-size:1rem;font-weight:700;color:var(--text)">${esc(p.name||p.login)}</div>
              <div style="color:var(--muted);font-size:.78rem">@${esc(p.login)}</div>
              ${p.bio ? `<div style="font-size:.8rem;color:var(--text);margin-top:4px">${esc(p.bio)}</div>` : ''}
            </div>
          </div>
          ${osintKV([
            ['User ID', p.id],
            ['Company', p.company],
            ['Location', p.location],
            ['Email(s)', emails.join(', ') || null],
            ['Blog / URL', p.blog],
            ['Twitter', p.twitter_username ? '@'+p.twitter_username : null],
            ['Public Repos', p.public_repos],
            ['Followers', p.followers?.toLocaleString()],
            ['Following', p.following?.toLocaleString()],
            ['Account Created', p.created_at ? new Date(p.created_at).toLocaleDateString() : null],
            ['Last Active', p.updated_at ? new Date(p.updated_at).toLocaleDateString() : null],
            ['Hireable', p.hireable === true ? 'Yes' : p.hireable === false ? 'No' : null],
          ])}
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            <a href="${esc(p.html_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size:.78rem;padding:5px 12px">🔗 GitHub Profile</a>
            ${emails.length ? `<a href="mailto:${esc(emails[0])}" class="osint-found-badge">📧 ${esc(emails[0])}</a>` : ''}
          </div>
        </div>`;
    } catch(e) { osintError(el.id, e.message); }
  }

  // ── Reddit ──
  async function osintRedditSearch() {
    const u = document.getElementById('osint-reddit-input').value.trim().replace(/^u\//,'');
    if (!u) return;
    const el = document.getElementById('osint-reddit-results');
    osintLoading(el.id, `Looking up u/${u} on Reddit…`);
    try {
      const r = await fetch(`/api/osint/reddit/${encodeURIComponent(u)}`);
      const json = await r.json();
      if (json.error || !json.data) throw new Error(json.message || 'User not found or suspended');
      const p = json.data;
      const created = p.created_utc ? new Date(p.created_utc * 1000) : null;
      const ageStr = created ? `${Math.floor((Date.now()/1000 - p.created_utc) / 86400 / 365)} years, joined ${created.toLocaleDateString()}` : null;
      el.innerHTML = `
        <div class="osint-result-card">
          <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px">
            ${p.icon_img ? `<img src="${esc(p.icon_img.split('?')[0])}" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--border)" onerror="this.style.display='none'"/>` : '<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,69,0,.2);display:flex;align-items:center;justify-content:center;font-size:1.5rem">🟠</div>'}
            <div>
              <div style="font-size:1rem;font-weight:700;color:var(--text)">u/${esc(p.name)}</div>
              ${p.subreddit?.public_description ? `<div style="font-size:.8rem;color:var(--muted);margin-top:4px">${esc(p.subreddit.public_description.slice(0,120))}</div>` : ''}
            </div>
          </div>
          ${osintKV([
            ['Reddit ID', 't2_' + p.id],
            ['Account Age', ageStr],
            ['Total Karma', ((p.link_karma||0) + (p.comment_karma||0)).toLocaleString()],
            ['Post Karma', (p.link_karma||0).toLocaleString()],
            ['Comment Karma', (p.comment_karma||0).toLocaleString()],
            ['Verified Email', p.has_verified_email ? 'Yes' : 'No'],
            ['Reddit Premium', p.is_gold ? 'Yes' : 'No'],
            ['Moderator', p.is_mod ? 'Yes' : 'No'],
            ['Employee', p.is_employee ? 'Yes' : 'No'],
            ['NSFW Profile', p.over_18 ? 'Yes' : 'No'],
            ['Subscribers', p.subreddit?.subscribers?.toLocaleString() || null],
          ])}
          <div style="margin-top:10px">
            <a href="https://reddit.com/user/${esc(u)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size:.78rem;padding:5px 12px">🔗 Reddit Profile</a>
          </div>
        </div>`;
    } catch(e) { osintError(el.id, e.message); }
  }

  // ── Discord ──
  async function osintDiscordSearch() {
    const uid = document.getElementById('osint-discord-input').value.trim();
    if (!uid || !/^\d+$/.test(uid)) { osintError('osint-discord-results', 'Enter a valid numeric Discord User ID'); return; }
    const el = document.getElementById('osint-discord-results');
    osintLoading(el.id, `Fetching Discord user ${uid}…`);
    try {
      const r = await fetch(`/api/osint/discord/${encodeURIComponent(uid)}`);
      const p = await r.json();
      if (p.error) throw new Error(p.error);
      const avatar = p.avatar?.link;
      // Discord snowflake → timestamp
      const snowTs = new Date(Number(BigInt(uid) >> 22n) + 1420070400000);
      el.innerHTML = `
        <div class="osint-result-card">
          <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px">
            ${avatar ? `<img src="${esc(avatar)}" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--border)" onerror="this.style.display='none'"/>` : '<div style="width:64px;height:64px;border-radius:50%;background:rgba(88,101,242,.2);display:flex;align-items:center;justify-content:center;font-size:1.5rem">💬</div>'}
            <div>
              <div style="font-size:1rem;font-weight:700;color:var(--text)">${esc(p.global_name || p.username || uid)}</div>
              ${p.username ? `<div style="color:var(--muted);font-size:.78rem">@${esc(p.username)}</div>` : ''}
            </div>
          </div>
          ${osintKV([
            ['User ID', p.id],
            ['Username', p.username],
            ['Display Name', p.global_name],
            ['Account Created (Snowflake)', snowTs.toLocaleString()],
            ['Bot', p.bot ? 'Yes' : 'No'],
            ['System Account', p.system ? 'Yes' : 'No'],
            ['Badges', (p.badges||[]).join(', ') || 'None'],
            ['Accent Color', p.accent_color || null],
            ['Banner', p.banner?.link || null],
          ])}
        </div>`;
    } catch(e) { osintError(el.id, e.message); }
  }

  // ── TikTok ──
  async function osintTikTokSearch() {
    const u = document.getElementById('osint-tiktok-input').value.trim().replace(/^@/,'');
    if (!u) return;
    const el = document.getElementById('osint-tiktok-results');
    osintLoading(el.id, `Looking up @${u} on TikTok…`);
    try {
      const r = await fetch(`/api/osint/tiktok/${encodeURIComponent(u)}`);
      const json = await r.json();
      const p = json?.userInfo?.user;
      const stats = json?.userInfo?.stats;
      if (!p) throw new Error('User not found or TikTok blocked the request — try again shortly');
      const created = p.createTime ? new Date(p.createTime * 1000) : null;
      el.innerHTML = `
        <div class="osint-result-card">
          <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px">
            ${p.avatarMedium ? `<img src="${esc(p.avatarMedium)}" style="width:64px;height:64px;border-radius:50%;border:2px solid var(--border)" onerror="this.style.display='none'"/>` : '<div style="width:64px;height:64px;border-radius:50%;background:rgba(254,44,85,.15);display:flex;align-items:center;justify-content:center;font-size:1.5rem">🎵</div>'}
            <div>
              <div style="font-size:1rem;font-weight:700;color:var(--text)">@${esc(p.uniqueId)}</div>
              <div style="color:var(--muted);font-size:.78rem">${esc(p.nickname||'')}</div>
              ${p.signature ? `<div style="font-size:.8rem;color:var(--text);margin-top:4px">${esc(p.signature.slice(0,120))}</div>` : ''}
            </div>
          </div>
          ${osintKV([
            ['User ID', p.id],
            ['Unique ID', p.uniqueId],
            ['Nickname', p.nickname],
            ['Followers', stats?.followerCount?.toLocaleString()],
            ['Following', stats?.followingCount?.toLocaleString()],
            ['Total Likes', stats?.heartCount?.toLocaleString()],
            ['Videos', stats?.videoCount?.toLocaleString()],
            ['Verified', p.verified ? '✓ Yes' : 'No'],
            ['Private', p.privateAccount ? 'Yes' : 'No'],
            ['Region', p.region],
            ['Language', p.language],
            ['Created', created ? created.toLocaleDateString() : null],
          ])}
          <div style="margin-top:10px">
            <a href="https://tiktok.com/@${esc(u)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size:.78rem;padding:5px 12px">🔗 TikTok Profile</a>
          </div>
        </div>`;
    } catch(e) {
      osintError(el.id, e.message);
      document.getElementById('osint-tiktok-results').innerHTML += `<div style="margin-top:8px;font-size:.78rem;color:var(--muted)">Also try: <a href="https://tiktok.com/@${esc(u)}" target="_blank" style="color:var(--accent)">TikTok Profile</a></div>`;
    }
  }

  // ── Domain WHOIS ──
  async function osintDomainSearch() {
    const domain = document.getElementById('osint-domain-input').value.trim().replace(/^https?:\/\//,'').split('/')[0].toLowerCase();
    if (!domain) return;
    const el = document.getElementById('osint-domain-results');
    osintLoading(el.id, `Looking up ${domain}…`);
    try {
      const r = await fetch(`/api/osint/domain/${encodeURIComponent(domain)}`);
      const data = await r.json();

      let whoisHtml = '';
      if (data.rdap && data.rdap_status < 400) {
        const w = data.rdap;
        const registrar = w.entities?.find(e => (e.roles||[]).includes('registrar'));
        const regName = registrar?.vcardArray?.[1]?.find(v=>v[0]==='fn')?.[3];
        const ns = w.nameservers?.map(n=>n.ldhName).join(', ');
        const reg = w.events?.find(e=>e.eventAction==='registration')?.eventDate;
        const exp = w.events?.find(e=>e.eventAction==='expiration')?.eventDate;
        const upd = w.events?.find(e=>e.eventAction==='last changed')?.eventDate;
        whoisHtml = `<div class="osint-result-card" style="margin-bottom:10px">
          <h3 style="font-size:.85rem;font-weight:700;margin:0 0 8px">📋 WHOIS / RDAP</h3>
          ${osintKV([
            ['Domain', w.ldhName || domain],
            ['Registrar', regName || null],
            ['Status', (w.status||[]).slice(0,3).join(', ') || null],
            ['Name Servers', ns || null],
            ['Registered', reg ? new Date(reg).toLocaleDateString() : null],
            ['Expires', exp ? new Date(exp).toLocaleDateString() : null],
            ['Updated', upd ? new Date(upd).toLocaleDateString() : null],
          ])}
        </div>`;
      } else {
        whoisHtml = `<div style="color:var(--muted);font-size:.8rem;margin-bottom:10px">RDAP lookup returned no data — domain may not exist or RDAP not supported</div>`;
      }

      let crtHtml = '';
      if (data.crtsh?.length) {
        const names = data.crtsh.slice(0, 60);
        crtHtml = `<div class="osint-result-card" style="margin-bottom:10px">
          <h3 style="font-size:.85rem;font-weight:700;margin:0 0 8px">🔐 Certificate Transparency — ${names.length}${data.crtsh.length > 60 ? '+' : ''} unique names</h3>
          <div style="display:flex;flex-wrap:wrap;gap:5px;max-height:180px;overflow-y:auto">
            ${names.map(d=>`<span style="font-family:var(--mono);font-size:.72rem;background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:2px 7px">${esc(d)}</span>`).join('')}
          </div>
        </div>`;
      }

      el.innerHTML = whoisHtml + crtHtml + `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
        ${[
          ['Shodan', `https://www.shodan.io/search?query=${domain}`],
          ['VirusTotal', `https://www.virustotal.com/gui/domain/${domain}`],
          ['URLScan.io', `https://urlscan.io/search/#domain:${domain}`],
          ['SecurityTrails', `https://securitytrails.com/domain/${domain}/dns`],
          ['DNSDumpster', `https://dnsdumpster.com/`],
        ].map(([n,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="osint-found-badge">🔗 ${esc(n)}</a>`).join('')}
      </div>`;
    } catch(e) { osintError(el.id, e.message); }
  }

  // ── Google Account ──
  async function osintGoogleSearch() {
    const email = document.getElementById('osint-google-input').value.trim();
    if (!email) return;
    const el = document.getElementById('osint-google-results');
    // Compute SHA-256 for Gravatar
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase().trim()));
    const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    el.innerHTML = `<div class="osint-result-card">
      <h3 style="font-size:.85rem;font-weight:700;margin:0 0 10px">🔍 Google / Email Intel: ${esc(email)}</h3>
      <p style="font-size:.78rem;color:var(--muted);margin:0 0 12px">Google's People API requires OAuth — these server-accessible tools will give the best results:</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${[
          ['Epieos', `https://epieos.com/?q=${encodeURIComponent(email)}&type=email`],
          ['HaveIBeenPwned', `https://haveibeenpwned.com/account/${encodeURIComponent(email)}`],
          ['Hunter.io Verify', `https://hunter.io/email-verifier/${encodeURIComponent(email)}`],
          ['EmailRep.io', `https://emailrep.io/${encodeURIComponent(email)}`],
          ['Gravatar', `https://en.gravatar.com/${hash}`],
          ['Intelligence X', `https://intelx.io/?s=${encodeURIComponent(email)}`],
          ['Holehe (CLI)', `https://github.com/megadose/holehe`],
          ['GHunt (CLI)', `https://github.com/mxrch/GHunt`],
        ].map(([n,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="osint-found-badge">🔗 ${esc(n)}</a>`).join('')}
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--surface);border-radius:6px;font-size:.75rem;color:var(--muted)">
        💡 For full Google account OSINT, run <code>ghunt email ${esc(email)}</code> on your GHunt server or use Epieos which does this automatically.
      </div>
    </div>`;
  }

  // ── Email OSINT ──
  async function osintEmailSearch() {
    const email = document.getElementById('osint-email-input').value.trim();
    if (!email) return;
    const el = document.getElementById('osint-email-results');
    el.innerHTML = `<div class="osint-result-card">
      <h3 style="font-size:.85rem;font-weight:700;margin:0 0 10px">📧 Email Investigation: ${esc(email)}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${[
          ['HaveIBeenPwned', `https://haveibeenpwned.com/account/${encodeURIComponent(email)}`],
          ['Epieos', `https://epieos.com/?q=${encodeURIComponent(email)}&type=email`],
          ['EmailRep.io', `https://emailrep.io/${encodeURIComponent(email)}`],
          ['Intelligence X', `https://intelx.io/?s=${encodeURIComponent(email)}`],
          ['Hunter.io', `https://hunter.io/email-verifier/${encodeURIComponent(email)}`],
          ['Dehashed', `https://dehashed.com/search?query=${encodeURIComponent(email)}`],
          ['Snusbase', `https://snusbase.com/`],
          ['Holehe (CLI)', `https://github.com/megadose/holehe`],
        ].map(([n,u])=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="osint-found-badge">🔗 ${esc(n)}</a>`).join('')}
      </div>
    </div>`;
  }

  // ── Username (server-side via proxy) ──
  async function osintUsernameSearch() {
    const u = document.getElementById('osint-username-input').value.trim();
    if (!u) return;
    const resEl = document.getElementById('osint-username-results');
    const foundEl = document.getElementById('osint-username-found');
    const btn = document.getElementById('osintUsernameBtn');
    btn.disabled = true; btn.textContent = '⏳ Scanning…';
    resEl.style.display = 'block';
    foundEl.innerHTML = '<div style="color:var(--muted);font-size:.8rem;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite"></span>Running server-side checks across 200 platforms…</div>';
    document.getElementById('osint-username-progress-fill').style.width = '30%';
    document.getElementById('osint-username-progress-text').textContent = 'Searching…';
    try {
      const r = await fetch(`/api/osint/username/${encodeURIComponent(u)}`);
      const data = await r.json();
      document.getElementById('osint-username-progress-fill').style.width = '100%';
      if (data.error) throw new Error(data.error);
      const found = data.found || [];
      document.getElementById('osint-username-progress-text').textContent = `${found.length} found across ${data.checked} platforms`;
      if (found.length === 0) {
        foundEl.innerHTML = '<div style="color:var(--muted);font-size:.8rem;padding:8px 0">No accounts found across checked platforms.</div>';
      } else {
        foundEl.innerHTML = found.map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" class="osint-found-badge">✓ ${esc(f.name)}</a>`).join('');
      }
    } catch(e) {
      foundEl.innerHTML = `<div style="color:#f85149;font-size:.82rem">${esc(e.message)}</div>`;
    }
    btn.disabled = false; btn.textContent = '🔍 Search';
  }

  // ── OSINT Resources ──
  function osintRenderResources() {
    const resources = [
      { title: 'Shodan', url: 'https://shodan.io', cat: 'Network', desc: 'Search engine for internet-connected devices' },
      { title: 'Censys', url: 'https://censys.io', cat: 'Network', desc: 'Internet-wide scanning and certificate data' },
      { title: 'VirusTotal', url: 'https://virustotal.com', cat: 'Malware', desc: 'File, URL, IP, and domain analysis' },
      { title: 'URLScan.io', url: 'https://urlscan.io', cat: 'Web', desc: 'Website scanning and screenshot service' },
      { title: 'Intelligence X', url: 'https://intelx.io', cat: 'Search', desc: 'Dark web and paste search engine' },
      { title: 'Epieos', url: 'https://epieos.com', cat: 'Email', desc: 'Reverse email lookup via Google/social' },
      { title: 'HaveIBeenPwned', url: 'https://haveibeenpwned.com', cat: 'Breach', desc: 'Check emails in data breaches' },
      { title: 'SpiderFoot', url: 'https://www.spiderfoot.net', cat: 'Automation', desc: 'Automated OSINT reconnaissance' },
      { title: 'SecurityTrails', url: 'https://securitytrails.com', cat: 'DNS', desc: 'Historical DNS and domain data' },
      { title: 'Wayback Machine', url: 'https://web.archive.org', cat: 'Archive', desc: 'Archived versions of websites' },
      { title: 'OSINT Framework', url: 'https://osintframework.com', cat: 'Reference', desc: 'Comprehensive OSINT tools map' },
      { title: 'Maltego', url: 'https://maltego.com', cat: 'Graphing', desc: 'Link analysis and data mining' },
      { title: 'GrayhatWarfare', url: 'https://buckets.grayhatwarfare.com', cat: 'Cloud', desc: 'Public cloud bucket search' },
      { title: 'Dehashed', url: 'https://dehashed.com', cat: 'Breach', desc: 'Search hacked databases' },
      { title: 'GHunt', url: 'https://github.com/mxrch/GHunt', cat: 'Google', desc: 'Google account OSINT (CLI)' },
      { title: 'Holehe', url: 'https://github.com/megadose/holehe', cat: 'Email', desc: 'Check email usage on 120+ sites (CLI)' },
      { title: 'Maigret', url: 'https://github.com/soxoj/maigret', cat: 'Username', desc: 'Collect dossier from username (CLI)' },
      { title: 'theHarvester', url: 'https://github.com/laramies/theHarvester', cat: 'Email/Domain', desc: 'Email, subdomain & host harvester (CLI)' },
      { title: 'DNSDumpster', url: 'https://dnsdumpster.com', cat: 'DNS', desc: 'DNS recon & research, visual mapping' },
      { title: 'Recon-ng', url: 'https://github.com/lanmaster53/recon-ng', cat: 'Automation', desc: 'Full-featured web recon framework (CLI)' },
      { title: 'EmailRep.io', url: 'https://emailrep.io', cat: 'Email', desc: 'Email reputation and intel lookup' },
      { title: 'Fofa', url: 'https://fofa.info', cat: 'Network', desc: 'Chinese internet asset search engine' },
      { title: 'ZoomEye', url: 'https://zoomeye.org', cat: 'Network', desc: 'Cyberspace search engine by Knownsec' },
      { title: 'Hunter.io', url: 'https://hunter.io', cat: 'Email', desc: 'Find professional email addresses' },
    ];
    document.getElementById('osint-resource-grid').innerHTML = resources.map(r => `
      <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="osint-resource-card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span class="osint-resource-card-title">${esc(r.title)}</span>
          <span style="font-size:.68rem;background:rgba(88,166,255,.1);color:var(--accent);border:1px solid rgba(88,166,255,.2);border-radius:3px;padding:1px 6px">${esc(r.cat)}</span>
        </div>
        <div class="osint-resource-card-desc">${esc(r.desc)}</div>
      </a>`).join('');
  }


  // ══════════════════════════════════════════════════════════════
  // HOME DASHBOARD
  // ══════════════════════════════════════════════════════════════

  let hdVictimsData = [];
  let hdGroupsData  = [];
  let hdIocData     = [];
  let hdPressData   = [];

  function hdGoTo(tab) {
    const btn = Array.from(document.querySelectorAll('.nav-tab')).find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + tab + "'"));
    if (btn) switchTab(tab, btn);
  }

  async function hdInit() {
    hdLoadStats();
    hdLoadVictims();
    hdLoadGroups();
    hdLoadIocMini();
    hdLoadPress();
    hdCheckStatus();
  }

  async function hdLoadStats() {
    try {
      // Crawl stats
      const cs = await (await fetch('/api/stats')).json();
      document.getElementById('hdKpiCrawlHits').textContent = (cs.total_hits||0).toLocaleString();
      // Seeds count
      try {
        const sk = await (await fetch('/api/seeds')).json();
        const seedCount = Array.isArray(sk) ? sk.length : (sk.seeds ? sk.seeds.length : 0);
        document.getElementById('hdKpiSeeds').textContent = seedCount.toLocaleString();
      } catch(e) { document.getElementById('hdKpiSeeds').textContent = '—'; }
      // Keywords count
      try {
        const kw = await (await fetch('/api/keywords')).json();
        let kwCount = 0;
        if (kw.categories) Object.values(kw.categories).forEach(arr => kwCount += arr.length);
        document.getElementById('hdKpiKeywords').textContent = kwCount.toLocaleString();
      } catch(e) { document.getElementById('hdKpiKeywords').textContent = '—'; }
      // RW stats
      const rw = await (await fetch('/api/rwlive/stats')).json();
      if (rw.ok && rw.data && rw.data.stats) {
        const s = rw.data.stats;
        document.getElementById('hdKpiGroups').textContent  = (s.groups||0).toLocaleString();
        document.getElementById('hdKpiVictims').textContent = (s.victims||0).toLocaleString();
        document.getElementById('hdKpiPress').textContent   = (s.press||0).toLocaleString();
        const upd = rw.data.last_update ? rw.data.last_update.slice(0,16) : '—';
        const el = document.getElementById('sysRwUpdate');
        if (el) el.textContent = upd;
      }
    } catch(e) { console.warn('hdLoadStats', e); }
  }

  async function hdLoadVictims() {
    const el = document.getElementById('hdVictimFeed');
    try {
      const r = await fetch('/api/rwlive/victims/recent?limit=12');
      const d = await r.json();
      if (!d.ok || !d.data.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.78rem">No victim data</div>'; return; }
      hdVictimsData = d.data;
      // Build SEA counts — fetch per country for accurate totals
      const seaCounts = {};
      try {
        const seaReq = await fetch('/api/rwlive/victims/sea?limit=500');
        const seaD   = await seaReq.json();
        if (seaD.ok) {
          seaD.data.forEach(v => {
            const c = (v.country||'').toUpperCase();
            seaCounts[c] = (seaCounts[c]||0) + 1;
          });
          hdRenderSeaBars(seaCounts);
        }
      } catch(e) { console.warn('SEA counts failed', e); }
      el.innerHTML = d.data.slice(0,10).map(v => {
        const date = (v.attackdate||'').slice(0,10);
        const sea  = ['PH','TH','ID','MY','VN','SG','MM','KH','LA','BN'].includes((v.country||'').toUpperCase());
        return `<div class="hd-victim-row">
          <span class="hd-victim-group">${esc(v.group||'?')}</span>
          <span class="hd-victim-name" title="${esc(v.victim||'')}">
            ${esc(v.victim||v.website||'Unknown')}${sea ? '<span class="hd-sea-tag">SEA</span>' : ''}
          </span>
          <span class="hd-victim-country">${esc(v.country||'')}</span>
          <span class="hd-victim-date">${esc(date)}</span>
        </div>`;
      }).join('');
      // Update threat level
      const seaCount = Object.values(seaCounts).reduce((a,b)=>a+b,0);
      const tlEl  = document.getElementById('hdThreatLevel');
      const tlSub = document.getElementById('hdThreatSub');
      if (seaCount > 20) {
        tlEl.className = 'hd-tl-badge hd-tl-high'; tlEl.textContent = '🔴 HIGH';
        tlSub.textContent = seaCount + ' recent SEA victims detected';
      } else if (seaCount > 5) {
        tlEl.className = 'hd-tl-badge hd-tl-elevated'; tlEl.textContent = '⚠ ELEVATED';
        tlSub.textContent = seaCount + ' recent SEA victims detected';
      } else {
        tlSub.textContent = seaCount + ' recent SEA victims';
      }
    } catch(e) { el.innerHTML = '<div style="color:var(--red);font-size:.78rem">Error loading victims: ' + esc(String(e)) + '</div>'; }
  }

  function hdRenderSeaBars(counts) {
    const map = {PH:'PH',ID:'ID',MY:'MY',TH:'TH',VN:'VN',SG:'SG'};
    const max = Math.max(1, ...Object.values(counts));
    for (const [iso, id] of Object.entries(map)) {
      const c = counts[iso]||0;
      const bar = document.getElementById('hdBar'+id);
      const cnt = document.getElementById('hdCnt'+id);
      if (bar) bar.style.width = Math.round(c/max*100) + '%';
      if (cnt) cnt.textContent = c;
    }
  }

  async function hdLoadGroups() {
    const el = document.getElementById('hdGroupFeed');
    try {
      const r = await fetch('/api/rwlive/groups');
      const d = await r.json();
      if (!d.ok || !d.data.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.78rem">No group data</div>'; return; }
      // Sort by victim count desc, skip groups with 0, take top 10
      const groups = d.data
        .filter(g => (g.victims||0) > 0)
        .sort((a,b) => (b.victims||0)-(a.victims||0))
        .slice(0,10);
      const seaSlugs = ['lockbit3','lockbit','ransomhub','akira','dragonforce','clop','cl0p','play','blackbasta','medusa','8base','hunters'];
      el.innerHTML = groups.map(g => {
        const vc    = (g.victims||0).toLocaleString();
        const slug  = (g.group||g.name||'').toLowerCase();
        const isSEA = g._sea_targeting || seaSlugs.includes(slug);
        const dot   = (g.victims||0) > 500 ? 'var(--red)' : (g.victims||0) > 100 ? 'var(--orange)' : 'var(--green)';
        return `<div class="hd-group-row" onclick="hdGoTo('ransomware')">
          <span class="hd-group-dot" style="background:${dot}"></span>
          <span class="hd-group-name">${esc(g.group||g.name||'')}</span>
          ${isSEA ? '<span class="hd-sea-tag">SEA</span>' : ''}
          <span class="hd-group-victims">${vc}</span>
        </div>`;
      }).join('');
    } catch(e) { el.innerHTML = '<div style="color:var(--muted);font-size:.78rem">Error: '+esc(String(e))+'</div>'; }
  }

  async function hdLoadIocMini() {
    const el = document.getElementById('hdIocMini');
    try {
      const r = await fetch('/api/proxy/threatfox', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: 'get_iocs', days: 1})
      });
      const d = await r.json();
      const iocs = (d.data||[]).slice(0,8);
      if (!iocs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.78rem">No IOC data</div>'; return; }
      el.innerHTML = iocs.map(ioc => {
        const type = (ioc.ioc_type||'').replace('_hash','');
        const cls  = 'ioc-chip-' + type.replace(':','');
        return `<div class="hd-ioc-row">
          <span class="hd-ioc-type">${esc(type)}</span>
          <span class="hd-ioc-val" title="${esc(ioc.ioc||'')}"> ${esc((ioc.ioc||'').slice(0,45))}</span>
          <span class="hd-ioc-malware">${esc(ioc.malware||'')}</span>
        </div>`;
      }).join('');
      hdIocData = d.data||[];
    } catch(e) { el.innerHTML = '<div style="color:var(--muted);font-size:.78rem">ThreatFox unavailable</div>'; }
  }

  async function hdLoadPress() {
    const el = document.getElementById('hdPressFeed');
    try {
      const r = await fetch('/api/rwlive/press/recent?sea=1');
      const d = await r.json();
      const items = (d.ok ? d.data : []).slice(0,6);
      if (!items.length) {
        // fallback to global recent
        const r2 = await fetch('/api/rwlive/press/recent');
        const d2 = await r2.json();
        const fb = (d2.ok ? d2.data : []).slice(0,6);
        el.innerHTML = fb.map(p => hdPressItem(p)).join('') || '<div style="color:var(--muted);font-size:.78rem">No press data</div>';
        return;
      }
      el.innerHTML = items.map(p => hdPressItem(p)).join('');
    } catch(e) { el.innerHTML = '<div style="color:var(--muted);font-size:.78rem">Error loading press</div>'; }
  }

  function hdPressItem(p) {
    const title = p.title || p.headline || 'Untitled';
    const url   = p.url || p.link || '#';
    const date  = (p.date||p.published||'').slice(0,10);
    const src   = p.source || p.group || '';
    return `<div class="hd-press-item">
      <div class="hd-press-title"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a></div>
      <div class="hd-press-meta">${esc(src)}${src && date ? ' · ' : ''}${esc(date)}</div>
    </div>`;
  }

  async function hdCheckStatus() {
    try {
      const r = await fetch('/api/rwlive/status');
      const d = await r.json();
      const dotEl = document.getElementById('sysDotRwLive');
      const valEl = document.getElementById('sysValRwLive');
      if (d.ok && d.data.key_valid) {
        if (dotEl) { dotEl.className = 'hd-sys-dot hd-ok'; }
        if (valEl) valEl.textContent = 'PRO Key Valid';
      } else {
        if (dotEl) { dotEl.className = 'hd-sys-dot hd-warn'; }
        if (valEl) valEl.textContent = 'No PRO Key';
      }
      // Crawler status from existing stats
      const cs = await (await fetch('/api/stats')).json();
      const crawlDot = document.getElementById('sysDotCrawler');
      const crawlVal = document.getElementById('sysValCrawler');
      if (crawlDot) crawlDot.className = 'hd-sys-dot hd-ok';
      if (crawlVal) crawlVal.textContent = 'Operational';
    } catch(e) {
      const dotEl = document.getElementById('sysDotRwLive');
      if (dotEl) dotEl.className = 'hd-sys-dot hd-err';
    }
  }

  // ══════════════════════════════════════════════════════════════
  // IOC FEED TAB
  // ══════════════════════════════════════════════════════════════

  let iocCurrentFeed = 'threatfox';
  let iocAllData     = [];

  function iocSwitchFeed(feed, btn) {
    iocCurrentFeed = feed;
    document.querySelectorAll('.ioc-abuse-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const labels = {threatfox: 'ThreatFox — Recent IOCs', urlhaus: 'URLhaus — Malicious URLs', feodo: 'Feodo Tracker — Active C2s'};
    document.getElementById('iocFeedLabel').textContent = labels[feed] || feed;
    iocAllData = [];
    iocLoadAll();
  }

  async function iocLoadAll() {
    document.getElementById('iocTableContainer').innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Loading…</div>';
    if (iocCurrentFeed === 'threatfox') await iocLoadThreatfox();
    else if (iocCurrentFeed === 'urlhaus') await iocLoadUrlhaus();
    else if (iocCurrentFeed === 'feodo') await iocLoadFeodo();
    const ts = new Date().toLocaleTimeString();
    document.getElementById('iocLastRefresh').textContent = 'Updated ' + ts;
    iocUpdateStats();
    iocRenderTable();
  }

  async function iocLoadThreatfox() {
    try {
      const r = await fetch('/api/proxy/threatfox', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: 'get_iocs', days: 1})
      });
      const d = await r.json();
      iocAllData = (d.data||[]).map(ioc => ({
        type:       ioc.ioc_type || '',
        value:      ioc.ioc || '',
        malware:    ioc.malware || '',
        confidence: ioc.confidence_level || 0,
        tags:       ioc.tags || [],
        first_seen: ioc.first_seen || '',
        reporter:   ioc.reporter || '',
        _source:    'ThreatFox',
      }));
    } catch(e) { console.warn('ThreatFox error', e); iocAllData = []; }
  }

  async function iocLoadUrlhaus() {
    try {
      const r = await fetch('/api/proxy/urlhaus', {
        method: 'POST', body: 'limit=100',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
      });
      const d = await r.json();
      iocAllData = (d.urls||[]).map(u => ({
        type:       'url',
        value:      u.url || '',
        malware:    (u.tags||[]).join(', '),
        confidence: 80,
        tags:       u.tags||[],
        first_seen: u.date_added||'',
        reporter:   u.host||'',
        _source:    'URLhaus',
        status:     u.url_status||'',
      }));
    } catch(e) { console.warn('URLhaus error', e); iocAllData = []; }
  }

  async function iocLoadFeodo() {
    try {
      const r = await fetch('/api/proxy/feodo');
      const d = await r.json();
      iocAllData = (Array.isArray(d) ? d : []).slice(0,200).map(e => ({
        type:       'ip:port',
        value:      (e.ip_address||'') + ':' + (e.port||''),
        malware:    e.malware||'',
        confidence: 95,
        tags:       [e.country||''],
        first_seen: e.first_seen||'',
        reporter:   e.country||'',
        _source:    'Feodo',
      }));
    } catch(e) { console.warn('Feodo error', e); iocAllData = []; }
  }

  function iocUpdateStats() {
    const data = iocAllData;
    document.getElementById('iocStatTotal').textContent  = data.length.toLocaleString();
    document.getElementById('iocStatIP').textContent     = data.filter(i=>i.type==='ip:port').length;
    document.getElementById('iocStatDomain').textContent = data.filter(i=>i.type==='domain').length;
    document.getElementById('iocStatURL').textContent    = data.filter(i=>i.type==='url').length;
    document.getElementById('iocStatHash').textContent   = data.filter(i=>i.type==='md5_hash'||i.type==='sha256_hash').length;
  }

  function iocRenderTable() {
    const q       = (document.getElementById('iocSearch')?.value||'').toLowerCase();
    const typeF   = document.getElementById('iocTypeFilter')?.value||'';
    let filtered  = iocAllData;
    if (typeF) filtered = filtered.filter(i=>i.type===typeF);
    if (q)     filtered = filtered.filter(i=>(i.value+i.malware+(i.tags||[]).join(' ')).toLowerCase().includes(q));
    document.getElementById('iocTableCount').textContent = filtered.length + ' IOCs';
    if (!filtered.length) {
      document.getElementById('iocTableContainer').innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">No IOCs match filter</div>';
      return;
    }
    const rows = filtered.slice(0,200).map(ioc => {
      const typeCls = 'ioc-chip-' + (ioc.type||'').replace('_hash','').replace(':','');
      const conf    = Math.round(ioc.confidence||0);
      const date    = (ioc.first_seen||'').slice(0,10);
      return `<tr>
        <td><span class="ioc-type-chip ${typeCls}">${esc(ioc.type||'')}</span></td>
        <td class="ioc-val-cell" title="${esc(ioc.value||'')}">${esc((ioc.value||'').slice(0,60))}</td>
        <td><span class="ioc-malware-chip">${esc(ioc.malware||'—')}</span></td>
        <td><div class="ioc-conf-bar"><div class="ioc-conf-track"><div class="ioc-conf-fill" style="width:${conf}%"></div></div><span style="font-size:.65rem;color:var(--muted)">${conf}%</span></div></td>
        <td style="font-size:.68rem;color:var(--muted)">${esc(date)}</td>
        <td style="font-size:.68rem;color:var(--muted)">${esc(ioc.reporter||'')}</td>
      </tr>`;
    }).join('');
    document.getElementById('iocTableContainer').innerHTML = `
      <table class="ioc-table">
        <thead><tr><th>Type</th><th>IOC Value</th><th>Malware</th><th>Confidence</th><th>First Seen</th><th>Reporter</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

