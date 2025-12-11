/* Rosewood Luxury — script.js
   Features:
   - loading fade
   - carving header animation
   - dust particles on estimator card
   - confetti for 5-star feedback
   - estimator logic + history (localStorage)
   - separate feedback panel: open/close, submit, list, CSV export, clear
   - simple sounds
*/

(() => {
  // Elements
  const loading = document.getElementById('loading-screen');
  const app = document.getElementById('app');
  const carveHeader = document.getElementById('carve-header');

  // Estimator inputs
  const form = document.getElementById('time-form');
  const wood = document.getElementById('wood');
  const complexity = document.getElementById('complexity');
  const size = document.getElementById('size');
  const tool = document.getElementById('tool');
  const calculateBtn = document.getElementById('calculate');
  const resultEl = document.getElementById('result');

  // actions
  const copyEstBtn = document.getElementById('copy-est');
  const exportEstBtn = document.getElementById('export-est');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history');

  // dust canvas
  const dustCanvas = document.getElementById('dust-canvas');
  const dustCtx = dustCanvas.getContext && dustCanvas.getContext('2d');

  // feedback UI
  const feedbackFab = document.getElementById('feedback-open');
  const feedbackPanel = document.getElementById('feedback-panel');
  const feedbackClose = document.getElementById('feedback-close');
  const fbForm = document.getElementById('feedback-form');
  const fbName = document.getElementById('fb-name');
  const fbMessage = document.getElementById('fb-message');
  const fbRating = document.getElementById('fb-rating');
  const fbList = document.getElementById('fb-list');
  const fbExport = document.getElementById('fb-export');
  const fbClear = document.getElementById('fb-clear');

  // confetti
  const confettiCanvas = document.getElementById('confetti-canvas');
  const confettiCtx = confettiCanvas.getContext && confettiCanvas.getContext('2d');

  // sounds
  const sndClick = document.getElementById('snd-click');
  const sndSuccess = document.getElementById('snd-success');
  const sndFeedback = document.getElementById('snd-feedback');

  // data
  let estimates = JSON.parse(localStorage.getItem('rc_estimates') || '[]');
  let feedbacks = JSON.parse(localStorage.getItem('rc_feedbacks') || '[]');

  // helper: play safe
  function safePlay(sound) {
    if (!sound) return;
    try { sound.currentTime = 0; sound.play(); } catch (e) {}
  }

  /* ------------------ Loading & header carve animation ------------------ */
  window.addEventListener('load', () => {
    // quick fade
    setTimeout(() => {
      loading.style.transition = 'opacity 0.35s ease';
      loading.style.opacity = 0;
      setTimeout(() => { loading.style.display = 'none'; }, 380);
      app.classList.remove('hidden');
      carveHeaderAnim();
      startDust();
      resizeCanvases();
      renderHistory();
      renderFeedbackList();
    }, 380);
  });

  function carveHeaderAnim() {
    const text = "Smart Time Estimator";
    carveHeader.innerHTML = '';
    for (let i = 0; i < text.length; i++) {
      const s = document.createElement('span');
      s.textContent = text[i];
      s.style.opacity = 0;
      s.style.display = 'inline-block';
      s.style.transform = 'translateY(12px)';
      s.style.transition = `all 320ms cubic-bezier(.2,.9,.3,1) ${i * 30}ms`;
      carveHeader.appendChild(s);
      requestAnimationFrame(() => {
        s.style.opacity = 1;
        s.style.transform = 'translateY(0)';
      });
    }
  }

  /* ------------------ Estimator logic ------------------ */
  function computeEstimate() {
    const w = parseFloat(wood.value);
    const c = parseFloat(complexity.value);
    const s = parseFloat(size.value);
    const t = parseFloat(tool.value);
    // baseTime in minutes
    const base = (s * c * w) / t;
    const hrs = Math.floor(base / 60);
    const mins = Math.round(base % 60);
    return { hrs, mins, raw: base };
  }

  function showResultText(hrs, mins) {
    resultEl.textContent = `Estimated Time: ${hrs} hours ${mins} minutes`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    safePlay(sndClick);
    const estimate = computeEstimate();
    showResultText(estimate.hrs, estimate.mins);

    // push to history
    const entry = {
      id: Date.now(),
      wood: wood.options[wood.selectedIndex].text,
      complexity: complexity.value,
      size: size.value,
      tool: tool.options[tool.selectedIndex].text,
      hrs: estimate.hrs,
      mins: estimate.mins,
      created: new Date().toISOString()
    };
    estimates.push(entry);
    localStorage.setItem('rc_estimates', JSON.stringify(estimates));
    renderHistory();
    safePlay(sndSuccess);
  });

  // update complexity/size labels
  const complexityVal = document.getElementById('complexity-value');
  const sizeVal = document.getElementById('size-value');
  complexity.addEventListener('input', () => {
    const v = parseFloat(complexity.value);
    complexityVal.textContent = v <= 1.2 ? '1 (Simple)' : v <= 1.6 ? `${v.toFixed(1)} (Medium)` : `${v.toFixed(1)} (High)`;
  });
  size.addEventListener('input', () => { sizeVal.textContent = `${size.value} cm`; });

  /* ------------------ History UI ------------------ */
  function renderHistory() {
    historyList.innerHTML = '';
    if (!estimates.length) {
      historyList.innerHTML = '<li class="small-muted">No estimates yet.</li>';
      return;
    }
    estimates.slice().reverse().forEach(e => {
      const li = document.createElement('li');
      li.innerHTML = `<div>
          <div style="font-weight:700">${e.wood} • ${e.size}cm • ${e.complexity}</div>
          <div class="small-muted">${e.tool} → ${e.hrs}h ${e.mins}m</div>
        </div>
        <div>
          <button class="btn-copy" data-id="${e.id}">📋</button>
          <button class="btn-del" data-id="${e.id}">🗑</button>
        </div>`;
      historyList.appendChild(li);

      li.querySelector('.btn-copy').addEventListener('click', async () => {
        const txt = `${e.wood}, ${e.size}cm, complexity ${e.complexity}, ${e.tool} = ${e.hrs}h ${e.mins}m`;
        try { await navigator.clipboard.writeText(txt); safePlay(sndSuccess); } catch (err) { /* ignore */ }
      });
      li.querySelector('.btn-del').addEventListener('click', () => {
        if (!confirm('Delete this estimate?')) return;
        estimates = estimates.filter(x => x.id !== e.id);
        localStorage.setItem('rc_estimates', JSON.stringify(estimates));
        renderHistory();
      });
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('Clear all estimates?')) return;
    estimates = [];
    localStorage.setItem('rc_estimates', JSON.stringify(estimates));
    renderHistory();
  });

  exportEstBtn.addEventListener('click', () => {
    if (!estimates.length) { alert('No history to export'); return; }
    const rows = ['wood,size,complexity,tool,hours,minutes,created', ...estimates.map(e => `${escapeCsv(e.wood)},${e.size},${e.complexity},${escapeCsv(e.tool)},${e.hrs},${e.mins},${e.created}`)];
    downloadCsv(rows.join('\n'), 'estimates.csv');
  });

  copyEstBtn.addEventListener('click', async () => {
    if (!estimates.length) { alert('No estimate yet'); return; }
    const e = estimates[estimates.length - 1];
    const txt = `${e.wood}, ${e.size}cm, ${e.complexity} complexity, ${e.tool} = ${e.hrs}h ${e.mins}m`;
    try { await navigator.clipboard.writeText(txt); safePlay(sndSuccess); } catch (err) { /* ignore */ }
  });

  /* ------------------ Feedback panel open/close ------------------ */
  feedbackFab.addEventListener('click', () => {
    feedbackPanel.classList.add('open');
    feedbackPanel.setAttribute('aria-hidden', 'false');
    safePlay(sndClick);
  });
  feedbackClose.addEventListener('click', () => {
    feedbackPanel.classList.remove('open');
    feedbackPanel.setAttribute('aria-hidden', 'true');
    safePlay(sndClick);
  });

  /* ------------------ Feedback logic ------------------ */
  function renderFeedbackList() {
    fbList.innerHTML = '';
    if (!feedbacks.length) { fbList.innerHTML = '<li class="small-muted">No feedback yet.</li>'; return; }
    feedbacks.slice().reverse().forEach(f => {
      const li = document.createElement('li');
      li.innerHTML = `<div>
          <div style="font-weight:700">${escapeHtml(f.name)} <span class="small-muted">• ${f.rating}⭐</span></div>
          <div class="small-muted">${escapeHtml(f.message)}</div>
        </div>
        <div>
          <button class="fb-del" data-id="${f.id}">🗑</button>
        </div>`;
      fbList.appendChild(li);
      li.querySelector('.fb-del').addEventListener('click', () => {
        if (!confirm('Delete this feedback?')) return;
        feedbacks = feedbacks.filter(x => x.id !== f.id);
        localStorage.setItem('rc_feedbacks', JSON.stringify(feedbacks));
        renderFeedbackList();
      });
      if (f.rating === "5") triggerConfetti();
    });
  }

  fbForm.addEventListener('submit', (e) => {
    e.preventDefault();
    safePlay(sndClick);
    const nm = fbName.value.trim();
    const msg = fbMessage.value.trim();
    const rt = fbRating.value;
    if (!nm || !msg) { alert('Please fill name & feedback'); return; }
    const entry = { id: Date.now(), name: nm, message: msg, rating: rt, created: new Date().toISOString() };
    feedbacks.push(entry);
    localStorage.setItem('rc_feedbacks', JSON.stringify(feedbacks));
    fbForm.reset();
    renderFeedbackList();
    safePlay(sndFeedback);
    if (rt === "5") triggerConfetti();
  });

  fbExport.addEventListener('click', () => {
    if (!feedbacks.length) { alert('No feedback to export'); return; }
    const rows = ['name,rating,message,created', ...feedbacks.map(f => `${escapeCsv(f.name)},${f.rating},${escapeCsv(f.message)},${f.created}`)];
    downloadCsv(rows.join('\n'), 'feedback.csv');
  });

  fbClear.addEventListener('click', () => {
    if (!confirm('Clear all feedback?')) return;
    feedbacks = [];
    localStorage.setItem('rc_feedbacks', JSON.stringify(feedbacks));
    renderFeedbackList();
  });

  /* ------------------ Confetti ------------------ */
  let confettiParticles = [];
  function resizeCanvases() {
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
    if (dustCanvas) {
      const rect = document.getElementById('estimator-card').getBoundingClientRect();
      dustCanvas.width = rect.width;
      dustCanvas.height = rect.height;
      dustCanvas.style.left = rect.left + 'px';
      dustCanvas.style.top = rect.top + 'px';
      dustCanvas.style.position = 'absolute';
    }
  }

  function initConfetti() {
    if (!confettiCtx) return;
    confettiParticles = [];
    for (let i = 0; i < 140; i++) confettiParticles.push(randomConf());
  }

  function randomConf() {
    return {
      x: Math.random() * confettiCanvas.width,
      y: -Math.random() * confettiCanvas.height,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      r: Math.random() * 8 + 4,
      color: `hsl(${Math.random() * 360}, 80%, 60%)`,
      rot: Math.random() * 360,
      vr: Math.random() * 6 - 3
    };
  }

  function drawConfettiOnce(duration = 2800) {
    if (!confettiCtx) return;
    initConfetti();
    const start = Date.now();
    const id = setInterval(() => {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiParticles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rot * Math.PI / 180);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.4);
        confettiCtx.restore();
        if (p.y > confettiCanvas.height + 30) { Object.assign(p, randomConf()); p.y = -10; }
      });
      if (Date.now() - start > duration) { clearInterval(id); confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
    }, 16);
  }

  function triggerConfetti() { safePlay(sndSuccess); drawConfettiOnce(3000); }

  /* ------------------ Dust particle animation ------------------ */
  let dustParticles = [];
  function startDust() {
    if (!dustCtx) return;
    resizeCanvases();
    dustParticles = [];
    const W = dustCanvas.width, H = dustCanvas.height;
    for (let i = 0; i < 55; i++) {
      dustParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2 + 0.5,
        vy: Math.random() * 0.5 + 0.1,
        alpha: Math.random() * 0.6 + 0.12
      });
    }
    requestAnimationFrame(animateDust);
    window.addEventListener('resize', () => { resizeCanvases(); });
  }

  function animateDust() {
    if (!dustCtx) return;
    dustCtx.clearRect(0, 0, dustCanvas.width, dustCanvas.height);
    dustParticles.forEach(p => {
      dustCtx.beginPath();
      dustCtx.fillStyle = `rgba(255,240,220,${p.alpha})`;
      dustCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      dustCtx.fill();
      p.y -= p.vy;
      p.x += Math.sin(p.y * 0.01) * 0.3;
      if (p.y < -6) { p.y = dustCanvas.height + 6; p.x = Math.random() * dustCanvas.width; }
    });
    requestAnimationFrame(animateDust);
  }

  /* ------------------ Utilities ------------------ */
  function downloadCsv(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function escapeCsv(s) { return '"' + ('' + s).replace(/"/g, '""') + '"'; }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ------------------ Persistence & init ------------------ */
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('rc_estimates', JSON.stringify(estimates));
    localStorage.setItem('rc_feedbacks', JSON.stringify(feedbacks));
  });

  // initial renderers
  function renderFeedbackList() { renderFeedbackList = renderFeedbackList; /* placeholder */ }
  // override with actual function above by calling it now:
  renderFeedbackList = function(){ fbList.innerHTML=''; if(!feedbacks.length){ fbList.innerHTML='<li class="small-muted">No feedback yet.</li>'; return } feedbacks.slice().reverse().forEach(f=>{ const li=document.createElement('li'); li.innerHTML = `<div><div style="font-weight:700">${escapeHtml(f.name)} <span class="small-muted">• ${f.rating}⭐</span></div><div class="small-muted">${escapeHtml(f.message)}</div></div><div><button class="fb-del" data-id="${f.id}">🗑</button></div>`; fbList.appendChild(li); li.querySelector('.fb-del').addEventListener('click', ()=>{ if(!confirm('Delete this feedback?')) return; feedbacks = feedbacks.filter(x=>x.id!==f.id); localStorage.setItem('rc_feedbacks', JSON.stringify(feedbacks)); renderFeedbackList(); }); if(f.rating==='5') triggerConfetti(); }) };

  // ensure canvases sized
  window.addEventListener('resize', resizeCanvases);
  // initial setup
  resizeCanvases();
  initConfetti();

  // call render functions once (populate UI)
  renderHistory();
  renderFeedbackList();

})(); // end closure
