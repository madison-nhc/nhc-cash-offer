// ─── NHC Cash Offer · Supabase Save/Load Patch ───────────────────────────────
// Drop this file into the repo and add ONE line to calculator.html right before
// the closing </body> tag:
//   <script src="supabase-patch.js"></script>
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const SUPABASE_URL = 'https://rigoqxtyxlmidbkrppbo.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpZ29xeHR5eGxtaWRia3JwcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1ODg2MjMsImV4cCI6MjA5NjE2NDYyM30.11Vct2Vu7UA5bdu3QeY5taXglG9Ys_jqVn3WtrKZksQ';

  // ── helpers ──────────────────────────────────────────────────────────────────
  async function api(path, opts = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(opts.headers || {})
      },
      ...opts
    });
    if (!res.ok) throw new Error(await res.text());
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  function val(id) { return document.getElementById(id)?.value?.trim() || null; }
  function numVal(id) { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; }

  function collectPayload() {
    // Collect repair line items from the table
    const repairItems = [];
    document.querySelectorAll('#repair-tbody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      const name = inputs[0]?.value?.trim() || '';
      const cost = parseFloat(inputs[1]?.value) || 0;
      if (name || cost) repairItems.push({ name, cost });
    });

    return {
      address:                val('address'),
      beds:                   val('beds'),
      baths:                  val('baths'),
      sqft:                   val('sqft'),
      arv:                    val('arv'),
      asis_pct:               val('asis_pct'),
      asis_override:          val('asis_override'),
      profit_margin:          val('profit_margin'),
      profit_margin_override: val('profit_margin_override'),
      cash_offer_override:    val('cash_offer_override'),
      commission_cash_pct:    val('commission_cash_pct'),
      commission_list_pct:    val('commission_list_pct'),
      holding_cash_pct:       val('holding_cash_pct'),
      holding_cash_months:    val('holding_cash_months'),
      holding_opt2_pct:       val('holding_opt2_pct'),
      holding_opt2_months:    val('holding_opt2_months'),
      holding_opt3_pct:       val('holding_opt3_pct'),
      holding_opt3_months:    val('holding_opt3_months'),
      repair_items:           repairItems,
      updated_at:             new Date().toISOString()
    };
  }

  function populateField(id, value) {
    const el = document.getElementById(id);
    if (!el || value === null || value === undefined) return;
    el.value = value;
    el.dispatchEvent(new Event('input'));
  }

  function populateForm(row) {
    const fields = [
      'address','beds','baths','sqft','arv','asis_pct','asis_override',
      'profit_margin','profit_margin_override','cash_offer_override',
      'commission_cash_pct','commission_list_pct',
      'holding_cash_pct','holding_cash_months',
      'holding_opt2_pct','holding_opt2_months',
      'holding_opt3_pct','holding_opt3_months'
    ];
    fields.forEach(f => populateField(f, row[f]));

    // Restore repair items
    if (Array.isArray(row.repair_items) && row.repair_items.length > 0) {
      // Clear existing rows first
      const tbody = document.getElementById('repair-tbody');
      if (tbody) {
        tbody.innerHTML = '';
        row.repair_items.forEach(item => {
          if (typeof addRepairRow === 'function') {
            addRepairRow(item.name || '', item.cost || 0);
          }
        });
      }
    }

    // Trigger full recalc
    if (typeof recalc === 'function') recalc();
  }

  // ── Save button ──────────────────────────────────────────────────────────────
  function injectSaveButton() {
    // Build the button + status bar
    const bar = document.createElement('div');
    bar.id = 'nhc-save-bar';
    bar.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #1a1e2e; border-top: 2px solid #E8A819;
      padding: 12px 24px; display: flex; align-items: center; justify-content: space-between;
      z-index: 9999; font-family: 'DM Sans', sans-serif;
    `;

    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;">
        <a href="index.html" style="color:#6b7280;font-size:13px;text-decoration:none;">← All Offers</a>
        <span id="nhc-save-status" style="font-size:12px;color:#6b7280;"></span>
      </div>
      <button id="nhc-save-btn" style="
        background:#E8A819;color:#111;border:none;border-radius:6px;
        padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;
        font-family:'DM Sans',sans-serif;letter-spacing:0.5px;
      ">💾 Save Offer</button>
    `;

    document.body.appendChild(bar);

    // Add bottom padding to body so the save bar doesn't cover content
    document.body.style.paddingBottom = '64px';

    document.getElementById('nhc-save-btn').addEventListener('click', saveOffer);
  }

  function setStatus(msg, color = '#6b7280') {
    const el = document.getElementById('nhc-save-status');
    if (el) { el.textContent = msg; el.style.color = color; }
  }

  let currentId = null;

  async function saveOffer() {
    const btn = document.getElementById('nhc-save-btn');
    btn.textContent = 'Saving...';
    btn.disabled = true;
    setStatus('');

    try {
      const payload = collectPayload();

      if (!payload.address) {
        setStatus('Please enter a property address first.', '#B91C1C');
        btn.textContent = '💾 Save Offer';
        btn.disabled = false;
        document.getElementById('address')?.focus();
        return;
      }

      let result;
      if (currentId) {
        // Update existing
        result = await api(`cash_offers?id=eq.${currentId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        // Insert new
        result = await api('cash_offers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (result && result[0]) {
          currentId = result[0].id;
          // Update URL without reload so refresh also updates
          const url = new URL(window.location.href);
          url.searchParams.set('id', currentId);
          window.history.replaceState({}, '', url.toString());
        }
      }

      setStatus('✓ Saved ' + new Date().toLocaleTimeString(), '#5B8C3E');
      btn.textContent = '💾 Save Offer';
      btn.disabled = false;
    } catch (err) {
      setStatus('Save failed: ' + err.message, '#B91C1C');
      btn.textContent = '💾 Save Offer';
      btn.disabled = false;
    }
  }

  // ── Load on startup if ?id= is present ──────────────────────────────────────
  async function loadIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    currentId = id;
    setStatus('Loading offer...');

    try {
      const rows = await api(`cash_offers?id=eq.${id}&limit=1`);
      if (!rows || rows.length === 0) {
        setStatus('Offer not found.', '#B91C1C');
        return;
      }
      populateForm(rows[0]);
      setStatus('Offer loaded · ' + (rows[0].address || ''), '#5B8C3E');
    } catch (err) {
      setStatus('Load failed: ' + err.message, '#B91C1C');
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    injectSaveButton();
    // Wait a tick so the page's own initRepairs() and recalc() have run first
    setTimeout(loadIfNeeded, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
