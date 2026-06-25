// supabase-patch.js
// Wires Supabase save/load into the NHC Cash Offer calculator.
// Save is triggered by the Finalize Offer button (no separate save bar).
// If a record already exists for the current address, the button reads
// "Update Offer" and performs an upsert instead of a fresh insert.

(function () {
  const SUPABASE_URL = 'https://rigoqxtyxlmidbkrppbo.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ29xeHR5eGxtaWRia3JwcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODg2MjMsImV4cCI6MjA5NjE2NDYyM30.11Vct2Vu7UA5bdu3QeY5taXglG9Ys_jqVn3WtrKZksQ';

  // ── helpers ─────────────────────────────────────────────────────────────────

  async function supaFetch(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: options.prefer || 'return=representation',
        ...options.extraHeaders,
      },
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) throw data;
    return data;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = parseFloat(el.value);
    return isNaN(v) ? null : v;
  }

  function buildPayload() {
    return {
      address:               (document.getElementById('address')?.value || '').trim(),
      beds:                  getVal('beds'),
      baths:                 getVal('baths'),
      sqft:                  getVal('sqft'),
      arv:                   getVal('arv'),
      asis_pct:              getVal('asis_pct'),
      asis_override:         getVal('asis_override'),
      profit_margin:         getVal('profit_margin'),
      profit_margin_override: getVal('profit_margin_override'),
      cash_offer_override:   getVal('cash_offer_override'),
      commission_cash_pct:   getVal('commission_cash_pct'),
      commission_list_pct:   getVal('commission_list_pct'),
      holding_cash_pct:      getVal('holding_cash_pct'),
      holding_cash_months:   getVal('holding_cash_months'),
      holding_opt2_pct:      getVal('holding_opt2_pct'),
      holding_opt2_months:   getVal('holding_opt2_months'),
      holding_opt3_pct:      getVal('holding_opt3_pct'),
      holding_opt3_months:   getVal('holding_opt3_months'),
      repair_items:          getRepairItems(),
      updated_at:            new Date().toISOString(),
    };
  }

  // ── state ────────────────────────────────────────────────────────────────────

  let currentRecordId = null;   // set when loaded by ?id= or after first save
  let existingAddress = null;   // address that was found in DB (for upsert key)

  // ── button management ────────────────────────────────────────────────────────

  function getFinalizeBtn() {
    return document.querySelector('.finalize-btn');
  }

  function setButtonState(state, message) {
    const btn = getFinalizeBtn();
    if (!btn) return;
    if (state === 'update') {
      btn.textContent = 'Update Offer';
      btn.style.background = 'var(--blue)';
      btn.style.color = '#fff';
    } else if (state === 'saving') {
      btn.textContent = message || 'Saving…';
      btn.disabled = true;
      btn.style.opacity = '0.6';
    } else if (state === 'saved') {
      btn.textContent = message || 'Saved ✓';
      btn.disabled = false;
      btn.style.opacity = '1';
      setTimeout(() => refreshButtonLabel(), 2000);
    } else if (state === 'error') {
      btn.textContent = message || 'Save Failed';
      btn.disabled = false;
      btn.style.opacity = '1';
      setTimeout(() => refreshButtonLabel(), 3000);
    } else {
      // default / finalize
      btn.textContent = 'Finalize Offer';
      btn.style.background = 'var(--gold)';
      btn.style.color = '#111';
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }

  function refreshButtonLabel() {
    if (currentRecordId) {
      setButtonState('update');
    } else {
      setButtonState('default');
    }
  }

  // ── address-lookup debounce ──────────────────────────────────────────────────

  let lookupTimer = null;

  function onAddressChange() {
    clearTimeout(lookupTimer);
    const addr = (document.getElementById('address')?.value || '').trim();
    if (!addr) {
      currentRecordId = null;
      existingAddress = null;
      setButtonState('default');
      return;
    }
    // Only re-check if address changed from what we already know
    if (addr === existingAddress) return;
    lookupTimer = setTimeout(() => checkAddressExists(addr), 600);
  }

  async function checkAddressExists(addr) {
    try {
      const rows = await supaFetch(
        `cash_offers?address=eq.${encodeURIComponent(addr)}&select=id&limit=1`
      );
      if (rows && rows.length > 0) {
        currentRecordId = rows[0].id;
        existingAddress = addr;
        setButtonState('update');
      } else {
        currentRecordId = null;
        existingAddress = null;
        setButtonState('default');
      }
    } catch (e) {
      // silently fail — don't disrupt UX
    }
  }

  // ── save logic ───────────────────────────────────────────────────────────────

  async function saveOffer() {
    const payload = buildPayload();

    if (!payload.address) {
      alert('Please enter a property address before saving.');
      return;
    }

    const isUpdate = !!currentRecordId;
    setButtonState('saving', isUpdate ? 'Updating…' : 'Saving…');

    try {
      let result;
      if (isUpdate) {
        // PATCH existing record
        result = await supaFetch(
          `cash_offers?id=eq.${currentRecordId}`,
          {
            method: 'PATCH',
            body: payload,
            prefer: 'return=representation',
          }
        );
      } else {
        // POST new record
        result = await supaFetch('cash_offers', {
          method: 'POST',
          body: payload,
          prefer: 'return=representation',
        });
        if (Array.isArray(result) && result.length > 0) {
          currentRecordId = result[0].id;
          existingAddress = payload.address;
          // Update the URL so a refresh reloads this record
          history.replaceState(null, '', `?id=${currentRecordId}`);
        }
      }

      setButtonState('saved', isUpdate ? 'Updated ✓' : 'Saved ✓');

    } catch (err) {
      console.error('Save failed:', err);
      const msg = typeof err === 'object' && err.message ? err.message : JSON.stringify(err);
      setButtonState('error', 'Save Failed');
      alert('Save failed: ' + msg);
    }

    // Then run the existing generateProposal() to show the PDF preview
    if (typeof generateProposal === 'function') generateProposal();
  }

  // ── load by ?id= ─────────────────────────────────────────────────────────────

  async function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    try {
      const rows = await supaFetch(
        `cash_offers?id=eq.${encodeURIComponent(id)}&limit=1`
      );
      if (!rows || rows.length === 0) return;
      const r = rows[0];

      currentRecordId = r.id;
      existingAddress = r.address;

      function setField(fieldId, value) {
        const el = document.getElementById(fieldId);
        if (!el || value === null || value === undefined) return;
        el.value = value;
      }

      setField('address', r.address);
      setField('beds', r.beds);
      setField('baths', r.baths);
      setField('sqft', r.sqft);
      setField('arv', r.arv);
      setField('asis_pct', r.asis_pct);
      setField('asis_override', r.asis_override);
      setField('profit_margin', r.profit_margin);
      setField('profit_margin_override', r.profit_margin_override);
      setField('cash_offer_override', r.cash_offer_override);
      setField('commission_cash_pct', r.commission_cash_pct);
      setField('commission_list_pct', r.commission_list_pct);
      setField('holding_cash_pct', r.holding_cash_pct);
      setField('holding_cash_months', r.holding_cash_months);
      setField('holding_opt2_pct', r.holding_opt2_pct);
      setField('holding_opt2_months', r.holding_opt2_months);
      setField('holding_opt3_pct', r.holding_opt3_pct);
      setField('holding_opt3_months', r.holding_opt3_months);

      // Always clear default rows (initRepairs already ran) then load saved ones
      const tbody = document.getElementById('repair-tbody');
      if (tbody) tbody.innerHTML = '';
      if (r.repair_items && Array.isArray(r.repair_items) && r.repair_items.length > 0) {
        r.repair_items.forEach(item => {
          if (typeof addRepairRow === 'function') {
            addRepairRow(item.name || '', item.cost || 0);
          }
        });
      }

      if (typeof recalc === 'function') recalc();
      setButtonState('update');

    } catch (e) {
      console.error('Load failed:', e);
    }
  }

  // ── wire up ──────────────────────────────────────────────────────────────────

  function init() {
    // Intercept the Finalize Offer button — save first, then the existing
    // generateProposal() runs inside saveOffer() after a successful save.
    const btn = getFinalizeBtn();
    if (btn) {
      // Remove the inline onclick and replace with our handler
      btn.removeAttribute('onclick');
      btn.addEventListener('click', saveOffer);
    }

    // Watch address field for existing-record detection
    const addrEl = document.getElementById('address');
    if (addrEl) {
      addrEl.addEventListener('input', onAddressChange);
      // If address already has a value on load, check it
      if (addrEl.value.trim()) onAddressChange();
    }

    // Delay load so it runs after calculator.html's initRepairs() + recalc()
    // which are called synchronously at the bottom of the inline <script>.
    setTimeout(loadFromUrl, 50);
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
