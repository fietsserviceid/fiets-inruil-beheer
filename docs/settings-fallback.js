
// ---- Settings dialog robustify patch ----
// Ensures openSettings/closeSettings exist and <dialog> fallback works
(function ensureSettingsDialog(){
  const dlg = document.getElementById('settingsDialog');
  // Define safe wrappers on window so onclick="openSettings()" always resolves
  if (!window.openSettings) {
    window.openSettings = function(){
      const d = document.getElementById('settingsDialog');
      if (!d) { console.warn('settingsDialog not found'); return; }
      if (typeof d.showModal === 'function') d.showModal();
      else { d.setAttribute('open',''); d.style.display='block'; }
      try {
        // Prefill fields from current GH settings if app.js placed them on window.GH
        if (window.GH) {
          document.getElementById('ghOwner').value  = window.GH.owner || '';
          document.getElementById('ghRepo').value   = window.GH.repo || '';
          document.getElementById('ghPath').value   = window.GH.path || '';
          document.getElementById('ghBranch').value = window.GH.branch || '';
        }
        const t = sessionStorage.getItem('ghToken') || '';
        const tokenEl = document.getElementById('ghToken');
        if (tokenEl) tokenEl.value = t;
      } catch(e) { console.debug(e); }
    }
  }
  if (!window.closeSettings) {
    window.closeSettings = function(){
      const d = document.getElementById('settingsDialog');
      if (!d) return;
      if (typeof d.close === 'function') d.close();
      else { d.removeAttribute('open'); d.style.display='none'; }
    }
  }

  if (!window.saveSettings) {
    window.saveSettings = function(){
      const owner  = (document.getElementById('ghOwner')||{}).value || '';
      const repo   = (document.getElementById('ghRepo')||{}).value || '';
      const path   = (document.getElementById('ghPath')||{}).value || '';
      const branch = (document.getElementById('ghBranch')||{}).value || '';
      const token  = (document.getElementById('ghToken')||{}).value || '';
      // Persist token in session; never write to disk
      if (token) sessionStorage.setItem('ghToken', token);
      // If app.js exposes GH, update it so the UI reflects changes immediately
      if (window.GH) {
        window.GH.owner  = owner  || window.GH.owner;
        window.GH.repo   = repo   || window.GH.repo;
        window.GH.path   = path   || window.GH.path;
        window.GH.branch = branch || window.GH.branch;
      }
      window.closeSettings();
    }
  }
})();
// ---- End patch ----
