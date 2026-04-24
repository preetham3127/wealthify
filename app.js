/* ═══════════════════════════════════════
   WEALTHIFY - JavaScript
   Full financial logic + API integration
═══════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────
// PAGE NAVIGATION
// ──────────────────────────────────────────

let currentPage = 'landing';

function showPage(id) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => {
    p.classList.remove('active', 'exit');
    if (p.id === currentPage && p.id !== id) {
      p.classList.add('exit');
    }
  });
  setTimeout(() => {
    pages.forEach(p => p.classList.remove('exit'));
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active');
      target.scrollTop = 0;
    }
    currentPage = id;
  }, 200);
}

// ──────────────────────────────────────────
// UTILITY FUNCTIONS
// ──────────────────────────────────────────

function formatINR(amount) {
  if (amount === null || isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  let formatted;
  if (abs >= 1e7) {
    formatted = (abs / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  } else if (abs >= 1e5) {
    formatted = (abs / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  } else {
    formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  return (amount < 0 ? '-₹' : '₹') + formatted;
}

function formatNumber(n, decimals = 2) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

const valueAnimations = {};
function animateDOMValue(id, endValue, formatter, duration = 600) {
  const el = document.getElementById(id);
  if (!el) return;
  const startValue = parseFloat(el.dataset.val) || 0;
  if (startValue === endValue) {
    el.textContent = formatter(endValue);
    return;
  }
  
  if(valueAnimations[id]) cancelAnimationFrame(valueAnimations[id]);

  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const current = startValue + easedProgress * (endValue - startValue);
    el.textContent = formatter(current);
    if (progress < 1) {
      valueAnimations[id] = requestAnimationFrame(step);
    } else {
      el.textContent = formatter(endValue);
    }
  };
  valueAnimations[id] = requestAnimationFrame(step);
  el.dataset.val = endValue;
}

// ──────────────────────────────────────────
// DONUT CHART RENDERER
// ──────────────────────────────────────────

const chartInstances = {};

function drawDonut(canvasId, investedVal, returnsVal) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const radius = Math.min(W, H) / 2 - 16;
  const innerRadius = radius * 0.62;
  const lineWidth = radius - innerRadius;

  const total = investedVal + returnsVal;
  if (total <= 0) {
    // Empty state ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius - lineWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    return;
  }

  const investedAngle = (investedVal / total) * Math.PI * 2;
  const returnsAngle = (returnsVal / total) * Math.PI * 2;
  const gap = 0.03;
  const start = -Math.PI / 2;

  // ── Invested segment
  const investedGrad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
  investedGrad.addColorStop(0, '#7c3aed');
  investedGrad.addColorStop(1, '#a855f7');
  ctx.beginPath();
  ctx.arc(cx, cy, radius - lineWidth / 2, start, start + investedAngle - gap);
  ctx.strokeStyle = investedGrad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // ── Returns segment
  const returnsGrad = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  returnsGrad.addColorStop(0, '#10b981');
  returnsGrad.addColorStop(1, '#34d399');
  ctx.beginPath();
  ctx.arc(cx, cy, radius - lineWidth / 2, start + investedAngle + gap, start + Math.PI * 2 - gap / 2);
  ctx.strokeStyle = returnsGrad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // ── Glow effect (shadow ring)
  ctx.save();
  ctx.shadowColor = 'rgba(124, 58, 237, 0.4)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - lineWidth / 2, start, start + investedAngle - gap);
  ctx.strokeStyle = 'transparent';
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

// Animate donut drawing
function animateDonut(canvasId, investedFinal, returnsFinal) {
  const steps = 50;
  let step = 0;
  const old = chartInstances[canvasId] || { inv: 0, ret: 0 };
  const invDiff = investedFinal - old.inv;
  const retDiff = returnsFinal - old.ret;

  function frame() {
    step++;
    const t = step / steps;
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    drawDonut(canvasId, old.inv + invDiff * eased, old.ret + retDiff * eased);
    if (step < steps) requestAnimationFrame(frame);
    else chartInstances[canvasId] = { inv: investedFinal, ret: returnsFinal };
  }
  requestAnimationFrame(frame);
}

// ──────────────────────────────────────────
// SIP CALCULATOR
// ──────────────────────────────────────────

function calcSIP(P, r_annual, years) {
  const r = r_annual / 12 / 100;
  const n = years * 12;
  const FV = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  const invested = P * n;
  const returns = FV - invested;
  return { FV, invested, returns };
}

function updateSIP() {
  const P = Number(document.getElementById('sip-amount').value);
  const rate = Number(document.getElementById('sip-rate').value);
  const years = Number(document.getElementById('sip-years').value);

  if (!P || !rate || !years) return;

  const { FV, invested, returns } = calcSIP(P, rate, years);

  animateDOMValue('sip-invested', invested, formatINR);
  animateDOMValue('sip-returns', returns, formatINR);
  animateDOMValue('sip-total', FV, formatINR);
  animateDOMValue('sip-total-display', FV, formatINR);

  animateDonut('sip-chart', invested, returns);
}

function syncSliderInput(sliderId, inputId, onChange) {
  const slider = document.getElementById(sliderId);
  const input = document.getElementById(inputId);
  if (!slider || !input) return;

  // Update slider fill color via CSS
  function updateFill() {
    const min = Number(slider.min), max = Number(slider.max), val = Number(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, #7c3aed 0%, #a855f7 ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
  }

  slider.addEventListener('input', () => {
    input.value = slider.value;
    updateFill();
    onChange();
  });

  input.addEventListener('input', () => {
    let val = Number(input.value);
    val = Math.max(Number(slider.min), Math.min(Number(slider.max), val));
    slider.value = val;
    updateFill();
    onChange();
  });

  updateFill();
}

// Initialize SIP
syncSliderInput('sip-amount-slider', 'sip-amount', updateSIP);
syncSliderInput('sip-rate-slider', 'sip-rate', updateSIP);
syncSliderInput('sip-years-slider', 'sip-years', updateSIP);
updateSIP();

// ──────────────────────────────────────────
// STEP-UP SIP CALCULATOR
// ──────────────────────────────────────────

function calcStepUpSIP(initialP, stepUpPct, r_annual, years) {
  const monthlyRate = r_annual / 12 / 100;
  let totalFV = 0;
  let totalInvested = 0;

  for (let year = 0; year < years; year++) {
    const P = initialP * Math.pow(1 + stepUpPct / 100, year);
    // Each year's SIP contributes 12 monthly investments, then compounds for remaining months
    const remainingMonths = (years - year) * 12;
    const yearFV = P * ((Math.pow(1 + monthlyRate, remainingMonths) - 1) / monthlyRate) * (1 + monthlyRate);
    totalFV += yearFV;
    totalInvested += P * 12;
  }

  return {
    FV: totalFV,
    invested: totalInvested,
    returns: totalFV - totalInvested,
    finalMonthly: initialP * Math.pow(1 + stepUpPct / 100, years - 1),
  };
}

function updateStepUp() {
  const P = Number(document.getElementById('su-amount').value);
  const stepUp = Number(document.getElementById('su-stepup').value);
  const rate = Number(document.getElementById('su-rate').value);
  const years = Number(document.getElementById('su-years').value);

  if (!P || !rate || !years) return;

  const { FV, invested, returns, finalMonthly } = calcStepUpSIP(P, stepUp, rate, years);

  animateDOMValue('su-invested', invested, formatINR);
  animateDOMValue('su-returns', returns, formatINR);
  animateDOMValue('su-total', FV, formatINR);
  animateDOMValue('su-total-display', FV, formatINR);
  animateDOMValue('su-final-sip', Math.round(finalMonthly), formatINR);
  animateDOMValue('su-months', years * 12, (v) => Math.round(v));

  animateDonut('su-chart', invested, returns);
}

syncSliderInput('su-amount-slider', 'su-amount', updateStepUp);
syncSliderInput('su-stepup-slider', 'su-stepup', updateStepUp);
syncSliderInput('su-rate-slider', 'su-rate', updateStepUp);
syncSliderInput('su-years-slider', 'su-years', updateStepUp);
updateStepUp();

// ──────────────────────────────────────────
// MUTUAL FUND SIMULATOR
// ──────────────────────────────────────────

let allFunds = [];         // { schemeName, schemeCode }[]
let selectedFund = null;   // { schemeName, schemeCode }
let mfFundDataCache = {};  // schemeCode → navHistory[]
let searchTimeout = null;

const MF_LIST_URL = 'https://api.mfapi.in/mf';
const MF_NAV_URL  = 'https://api.mfapi.in/mf/';

// Fetch full fund list once
async function fetchFundList() {
  if (allFunds.length > 0) return;
  try {
    document.getElementById('search-loader').style.display = 'inline-flex';
    const res = await fetch(MF_LIST_URL);
    if (!res.ok) throw new Error('Failed to fetch fund list');
    allFunds = await res.json();
  } catch (e) {
    console.error('Fund list fetch error:', e);
  } finally {
    document.getElementById('search-loader').style.display = 'none';
  }
}

// Search input handler (debounced, local filter)
const searchInput = document.getElementById('mf-search');
const dropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('focus', () => {
  fetchFundList();
  const q = searchInput.value.trim();
  if (q) filterFunds(q);
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (!q) {
    hideDropdown();
    return;
  }
  searchTimeout = setTimeout(() => filterFunds(q), 200);
});

document.addEventListener('click', (e) => {
  if (e.target !== searchInput && !dropdown.contains(e.target)) {
    hideDropdown();
  }
});

function filterFunds(query) {
  if (allFunds.length === 0) {
    showDropdownEmpty('Loading fund list...');
    return;
  }
  const q = query.toLowerCase();
  const results = allFunds
    .filter(f => f.schemeName.toLowerCase().includes(q))
    .slice(0, 50);

  if (results.length === 0) {
    showDropdownEmpty('No funds found for "' + query + '"');
    return;
  }
  renderDropdown(results);
}

function renderDropdown(funds) {
  dropdown.innerHTML = '';
  funds.forEach(f => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.innerHTML = `
      <span class="dropdown-fund-name">${escapeHtml(f.schemeName)}</span>
      <span class="dropdown-fund-code">Code: ${f.schemeCode}</span>`;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      selectFund(f);
    });
    dropdown.appendChild(item);
  });
  dropdown.classList.add('visible');
  dropdown.parentElement.style.position = 'relative';
}

function showDropdownEmpty(msg) {
  dropdown.innerHTML = `<div class="dropdown-empty">${msg}</div>`;
  dropdown.classList.add('visible');
}

function hideDropdown() {
  dropdown.classList.remove('visible');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function selectFund(fund) {
  selectedFund = fund;
  searchInput.value = '';
  hideDropdown();

  // Show badge
  document.getElementById('fund-badge-name').textContent = fund.schemeName;
  document.getElementById('fund-badge-code').textContent = 'Code: ' + fund.schemeCode;
  document.getElementById('selected-fund-badge').style.display = 'flex';

  // Enable calculate button
  document.getElementById('mf-calculate-btn').disabled = false;

  // Reset results
  showMFState('placeholder');
}

function clearFundSelection() {
  selectedFund = null;
  document.getElementById('selected-fund-badge').style.display = 'none';
  document.getElementById('mf-calculate-btn').disabled = true;
  showMFState('placeholder');
}

function showMFState(state) {
  // state: 'placeholder' | 'loading' | 'results' | 'error'
  document.getElementById('mf-placeholder').style.display = state === 'placeholder' ? '' : 'none';
  document.getElementById('mf-loading').style.display = state === 'loading' ? '' : 'none';
  document.getElementById('mf-results-content').style.display = state === 'results' ? '' : 'none';
  document.getElementById('mf-error').style.display = state === 'error' ? '' : 'none';
}

async function fetchFundNAV(schemeCode) {
  if (mfFundDataCache[schemeCode]) return mfFundDataCache[schemeCode];
  const res = await fetch(MF_NAV_URL + schemeCode);
  if (!res.ok) throw new Error('Failed to fetch NAV data');
  const data = await res.json();
  mfFundDataCache[schemeCode] = data;
  return data;
}

// Parse date string "DD-MM-YYYY" to Date object
function parseNAVDate(dateStr) {
  const [d, m, y] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Find NAV entry closest to target date
function findClosestNAV(navHistory, targetDate) {
  let closest = null;
  let minDiff = Infinity;
  for (const entry of navHistory) {
    const entryDate = parseNAVDate(entry.date);
    const diff = Math.abs(entryDate - targetDate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }
  return closest;
}

async function calculateMutualFund() {
  if (!selectedFund) return;

  const investment = Number(document.getElementById('mf-amount').value);
  const years = Number(document.getElementById('mf-years').value);

  if (!investment || !years) {
    alert('Please enter valid investment amount and years.');
    return;
  }

  showMFState('loading');

  try {
    const data = await fetchFundNAV(selectedFund.schemeCode);
    const navHistory = data.data; // [{ date: "DD-MM-YYYY", nav: "XX.XX" }]

    if (!navHistory || navHistory.length === 0) {
      throw new Error('No NAV history available for this fund.');
    }

    // Latest NAV = first entry (most recent)
    const latestEntry = navHistory[0];
    const latestNAV = Number(latestEntry.nav);

    // Target date = today minus selected years
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() - years);

    const oldEntry = findClosestNAV(navHistory, targetDate);
    const oldNAV = Number(oldEntry.nav);

    // Validate
    if (isNaN(latestNAV) || isNaN(oldNAV) || oldNAV <= 0) {
      throw new Error('Invalid NAV data received.');
    }

    // Calculations
    const units = investment / oldNAV;
    const currentValue = units * latestNAV;
    const returns = currentValue - investment;
    const cagr = (Math.pow(currentValue / investment, 1 / years) - 1) * 100;

    // Display
    document.getElementById('mf-result-fund-name').textContent = selectedFund.schemeName;
    animateDOMValue('mf-invested', investment, formatINR, 800);
    animateDOMValue('mf-returns', returns, (v) => (v >= 0 ? '+' : '') + formatINR(v), 800);
    animateDOMValue('mf-total', currentValue, formatINR, 800);
    animateDOMValue('mf-total-display', currentValue, formatINR, 800);
    animateDOMValue('mf-cagr', cagr, (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%', 800);
    animateDOMValue('mf-old-nav', oldNAV, (v) => '₹' + formatNumber(v), 800);
    animateDOMValue('mf-latest-nav', latestNAV, (v) => '₹' + formatNumber(v), 800);
    animateDOMValue('mf-units', units, (v) => formatNumber(v, 3), 800);

    // Color returns
    const returnsEl = document.getElementById('mf-returns');
    const cagrEl = document.getElementById('mf-cagr');
    returnsEl.style.color = returns >= 0 ? '#10b981' : '#f87171';
    cagrEl.style.color = cagr >= 0 ? '#10b981' : '#f87171';

    // Draw chart
    animateDonut('mf-chart', investment, Math.max(0, returns));

    showMFState('results');
  } catch (err) {
    console.error('MF calculation error:', err);
    document.getElementById('mf-error-msg').textContent = err.message || 'Failed to fetch fund data. Please try again.';
    showMFState('error');
  }
}

// MF Sliders
syncSliderInput('mf-amount-slider', 'mf-amount', () => {});
syncSliderInput('mf-years-slider', 'mf-years', () => {});

// ──────────────────────────────────────────
// BROKER MODAL
// ──────────────────────────────────────────

function openBrokerModal() {
  document.getElementById('broker-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBrokerModal(event) {
  if (!event || event.target === document.getElementById('broker-modal') || event.currentTarget === document.querySelector('.modal-close')) {
    document.getElementById('broker-modal').classList.remove('open');
    document.body.style.overflow = '';
  }
}

document.querySelector('.modal-close').addEventListener('click', closeBrokerModal);

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBrokerModal(null);
});

// ──────────────────────────────────────────
// INITIALIZATION — Draw empty charts
// ──────────────────────────────────────────

window.addEventListener('load', () => {
  // Trigger initial SIP / StepUp render (already done via updateSIP/updateStepUp calls above,
  // but re-trigger after canvas is fully ready)
  setTimeout(() => {
    updateSIP();
    updateStepUp();
  }, 100);
});
