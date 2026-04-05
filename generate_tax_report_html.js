#!/usr/bin/env node
// =============================================
// generate_tax_report_html.js
// Generiert einen professionellen HTML-Report
// aus dem tax_report_temp.json
//
// Aufruf: node generate_tax_report_html.js <input.json> <output.html>
// =============================================

'use strict';

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error(JSON.stringify({ error: 'Usage: node generate_tax_report_html.js <input.json> <output.html>' }));
  process.exit(1);
}

let reportData;
try {
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const parsed = JSON.parse(raw);
  reportData = parsed.report || parsed;
} catch (e) {
  console.error(JSON.stringify({ error: 'Fehler beim Lesen der JSON-Datei: ' + e.message }));
  process.exit(1);
}

const ctx = reportData.run_context || {};
const header = reportData.report_header || {};
const mwr = reportData.mehr_weniger_rechnung || {};
const formK1 = reportData.form_k1 || {};
const plausibility = reportData.plausibility_result || {};
const risk = reportData.risk_assessment || {};
const humanReview = reportData.human_review_items || [];
const auditTrail = reportData.audit_trail || [];
const metrics = reportData.run_metrics || {};
const assessments = reportData.detail_assessments || [];

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtN(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('de-AT');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

function statusBadge(status) {
  const map = {
    'PASS': '<span class="badge badge-pass">✓ PASS</span>',
    'WARN': '<span class="badge badge-warn">⚠ WARN</span>',
    'FAIL': '<span class="badge badge-fail">✗ FAIL</span>',
    'REVIEW_REQUIRED': '<span class="badge badge-warn">⚠ REVIEW</span>',
    'BLOCKED': '<span class="badge badge-fail">✗ BLOCKED</span>',
    'LOW': '<span class="badge badge-pass">LOW</span>',
    'MEDIUM': '<span class="badge badge-warn">MEDIUM</span>',
    'HIGH': '<span class="badge badge-fail">HIGH</span>',
    'CRITICAL': '<span class="badge badge-fail">CRITICAL</span>',
  };
  return map[status] || `<span class="badge">${status || '—'}</span>`;
}

function riskBar(score) {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct <= 25 ? '#22c55e' : pct <= 50 ? '#f59e0b' : pct <= 75 ? '#ef4444' : '#7f1d1d';
  return `<div class="risk-bar-wrap"><div class="risk-bar" style="width:${pct}%;background:${color}"></div></div>`;
}

// Plausibility checks
const checks = (plausibility.checks || []);
const overallStatus = plausibility.overall_status || '—';

// MWR
const hinzu = mwr.hinzurechnungen || [];
const kuerzungen = mwr.kuerzungen || [];

// K1 Kennzahlen
const k1Entries = Object.entries(formK1).map(([kz, v]) => ({ kz, ...v }));

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KöSt-Report ${ctx.tax_year || ''} — ${header.company || ''}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap');

  :root {
    --navy: #0a1628;
    --navy-mid: #112240;
    --navy-light: #1a3560;
    --gold: #c9a84c;
    --gold-light: #e8c97a;
    --gold-muted: #8a6f33;
    --white: #f8f6f1;
    --gray: #8892a4;
    --gray-light: #e2e8f0;
    --red: #dc2626;
    --green: #16a34a;
    --amber: #d97706;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', sans-serif;
    background: var(--white);
    color: var(--navy);
    font-size: 13px;
    line-height: 1.6;
  }

  /* PRINT */
  @media print {
    .no-print { display: none; }
    body { font-size: 11px; }
    .page-break { page-break-before: always; }
    header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* HEADER */
  header {
    background: var(--navy);
    color: var(--white);
    padding: 40px 60px 32px;
    position: relative;
    overflow: hidden;
  }
  header::before {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 300px; height: 100%;
    background: linear-gradient(135deg, transparent 40%, rgba(201,168,76,0.08));
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }
  .header-brand {
    font-family: 'Playfair Display', serif;
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 8px;
  }
  .header-title {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 700;
    color: var(--white);
    line-height: 1.2;
  }
  .header-subtitle {
    font-size: 13px;
    color: var(--gray);
    margin-top: 4px;
  }
  .header-meta {
    text-align: right;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--gray);
    line-height: 1.8;
  }
  .header-meta strong { color: var(--gold); }
  .header-divider {
    height: 1px;
    background: linear-gradient(90deg, var(--gold) 0%, transparent 100%);
    margin-bottom: 20px;
  }
  .header-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }
  .stat-item label {
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--gray);
    display: block;
    margin-bottom: 4px;
  }
  .stat-item value {
    font-family: 'DM Mono', monospace;
    font-size: 18px;
    font-weight: 500;
    color: var(--gold);
  }
  .stat-item small {
    font-size: 10px;
    color: var(--gray);
    display: block;
  }

  /* MAIN */
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px 40px;
  }

  /* SECTIONS */
  .section {
    margin-bottom: 40px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--navy);
  }
  .section-number {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--gold);
    background: var(--navy);
    padding: 2px 8px;
    border-radius: 2px;
  }
  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 18px;
    font-weight: 600;
    color: var(--navy);
  }

  /* TABLES */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th {
    background: var(--navy);
    color: var(--gold);
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 10px 14px;
    text-align: left;
    font-weight: 500;
  }
  td {
    padding: 9px 14px;
    border-bottom: 1px solid var(--gray-light);
    color: var(--navy);
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: rgba(10,22,40,0.02); }
  .td-right { text-align: right; font-family: 'DM Mono', monospace; }
  .td-mono { font-family: 'DM Mono', monospace; font-size: 11px; }

  /* MWR TABLE */
  .mwr-table td.amount { text-align: right; font-family: 'DM Mono', monospace; font-weight: 500; }
  .mwr-total { background: var(--navy) !important; color: var(--white) !important; }
  .mwr-total td { color: var(--white) !important; border: none !important; }
  .mwr-total .amount { color: var(--gold) !important; font-size: 15px; }
  .mwr-subtotal td { background: rgba(10,22,40,0.05) !important; font-weight: 600; }
  .mehr { color: var(--red); }
  .weniger { color: var(--green); }

  /* BADGES */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }
  .badge-pass { background: #dcfce7; color: #15803d; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .badge-fail { background: #fee2e2; color: #991b1b; }

  /* RISK */
  .risk-bar-wrap {
    width: 100%;
    height: 6px;
    background: var(--gray-light);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 4px;
  }
  .risk-bar {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
  }
  .risk-score-big {
    font-family: 'DM Mono', monospace;
    font-size: 48px;
    font-weight: 500;
    color: var(--navy);
    line-height: 1;
  }

  /* INFO GRID */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .info-card {
    background: var(--navy);
    color: var(--white);
    padding: 20px 24px;
    border-radius: 4px;
  }
  .info-card label {
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--gray);
    display: block;
    margin-bottom: 6px;
  }
  .info-card value {
    font-family: 'DM Mono', monospace;
    font-size: 22px;
    color: var(--gold);
    display: block;
  }
  .info-card small { font-size: 10px; color: var(--gray); }

  /* REVIEW ITEMS */
  .review-item {
    border-left: 3px solid var(--gold);
    padding: 12px 16px;
    margin-bottom: 12px;
    background: rgba(201,168,76,0.05);
  }
  .review-item.high { border-color: var(--red); background: rgba(220,38,38,0.04); }
  .review-item.medium { border-color: var(--amber); background: rgba(217,119,6,0.04); }
  .review-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .review-account { font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 600; }
  .review-issue { color: var(--navy); margin-bottom: 4px; }
  .review-rec { color: var(--gray); font-size: 11px; font-style: italic; }

  /* PRINT BUTTON */
  .print-bar {
    background: var(--navy);
    padding: 12px 40px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .btn-print {
    background: var(--gold);
    color: var(--navy);
    border: none;
    padding: 8px 24px;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    cursor: pointer;
    border-radius: 2px;
  }
  .btn-print:hover { background: var(--gold-light); }
  .print-info { font-size: 11px; color: var(--gray); font-family: 'DM Mono', monospace; }

  /* FOOTER */
  footer {
    background: var(--navy);
    color: var(--gray);
    padding: 20px 60px;
    font-size: 10px;
    font-family: 'DM Mono', monospace;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 40px;
  }
  footer strong { color: var(--gold); }

  .empty-state {
    color: var(--gray);
    font-style: italic;
    padding: 16px;
    text-align: center;
    background: rgba(0,0,0,0.02);
    border-radius: 4px;
  }

  .version-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    font-size: 11px;
  }
  .version-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(10,22,40,0.04);
    border-radius: 2px;
  }
  .version-key { color: var(--gray); }
  .version-val { font-family: 'DM Mono', monospace; color: var(--navy); font-weight: 500; }
/* Conflict & Audit Summary Styles [AUTO-PATCH] */
.conflict-section { border-left: 4px solid #dc2626; margin-top: 32px; padding: 24px; background: #fff; border-radius: 8px; }
.conflict-section.no-conflicts { border-left-color: #16a34a; }
.conflict-badge { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; padding: 2px 10px; font-size: 0.85em; font-weight: 600; margin-left: 12px; }
.conflict-note { color: #6b7280; margin: 12px 0 16px 0; font-size: 0.95em; }
.conflict-table, .audit-summary-table { width: 100%; border-collapse: collapse; font-size: 0.88em; }
.conflict-table th, .conflict-table td, .audit-summary-table th, .audit-summary-table td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
.conflict-table th, .audit-summary-table th { background: #f9fafb; font-weight: 600; color: #374151; }
.conflict-table tr:nth-child(even), .audit-summary-table tr:nth-child(even) { background: #f9fafb; }
.status-badge { padding: 10px 16px; border-radius: 6px; font-weight: 500; display: inline-block; }
.status-green { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
.audit-summary-section { border-left: 4px solid #3b82f6; margin-top: 32px; padding: 24px; background: #fff; border-radius: 8px; }

/* ===== ASK QUESTION FEATURE [AUTO-PATCH] ===== */
.ask-modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(10, 22, 40, 0.82);
  z-index: 9999;
  display: none;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(4px);
}
.ask-modal-overlay.active { display: flex; }
.ask-btn {
  background: transparent;
  border: 1px solid var(--gold);
  color: var(--gold);
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: all 0.2s;
  white-space: nowrap;
}
.ask-btn:hover {
  background: var(--gold);
  color: var(--navy);
}
.ask-modal {
  background: var(--navy);
  border: 1px solid var(--gold);
  border-radius: 8px;
  padding: 32px;
  width: 560px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}
.ask-modal h3 {
  font-family: 'Playfair Display', serif;
  color: var(--gold);
  font-size: 18px;
  margin-bottom: 4px;
}
.ask-modal .ask-context {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: var(--gray);
  margin-bottom: 16px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
  border-left: 3px solid var(--gold-muted);
}
.ask-modal textarea {
  width: 100%;
  min-height: 80px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 4px;
  color: var(--white);
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  padding: 12px;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
}
.ask-modal textarea:focus {
  border-color: var(--gold);
}
.ask-modal textarea::placeholder {
  color: rgba(136,146,164,0.6);
}
.ask-modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.ask-submit-btn {
  background: var(--gold);
  color: var(--navy);
  border: none;
  padding: 9px 24px;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}
.ask-submit-btn:hover { background: var(--gold-light); }
.ask-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ask-cancel-btn {
  background: transparent;
  color: var(--gray);
  border: 1px solid rgba(136,146,164,0.3);
  padding: 9px 20px;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}
.ask-cancel-btn:hover { color: var(--white); border-color: var(--white); }
.ask-answer-box {
  margin-top: 20px;
  display: none;
}
.ask-answer-box.visible { display: block; }
.ask-answer-text {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 4px;
  padding: 16px;
  color: var(--white);
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 10px;
}
.ask-legal-refs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.ask-legal-tag {
  display: inline-block;
  background: rgba(201,168,76,0.12);
  color: var(--gold);
  border: 1px solid rgba(201,168,76,0.3);
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 3px;
  letter-spacing: 0.3px;
}
.ask-disclaimer {
  color: var(--gray);
  font-size: 10px;
  font-style: italic;
  line-height: 1.5;
  margin-top: 8px;
}
.ask-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid var(--gold-muted);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: ask-spin 0.8s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}
@keyframes ask-spin { to { transform: rotate(360deg); } }
/* ===== END ASK QUESTION CSS ===== */
</style>
</head>
<body>

<!-- PRINT BAR -->
<div class="print-bar no-print">
  <button class="btn-print" onclick="window.print()">⎙ Als PDF speichern</button>
  <span class="print-info">Datei → Drucken → Als PDF speichern → Ziel: "Als PDF speichern"</span>
</div>

<!-- HEADER -->
<header>
  <div class="header-top">
    <div>
      <div class="header-brand">Eliasv2 · KI-gestützte Steuerautomatisierung</div>
      <div class="header-title">${header.title || 'Körperschaftsteuererklärung'} ${ctx.tax_year || ''}</div>
      <div class="header-subtitle">${header.company || '—'} · ${header.company_type || '—'} · Steuerperiode ${ctx.tax_year || '—'}</div>
    </div>
    <div class="header-meta">
      <div><strong>Run-ID</strong> ${(ctx.run_id || '—').substring(0, 8).toUpperCase()}</div>
      <div><strong>Erstellt</strong> ${fmtDate(header.generated_utc)}</div>
      <div><strong>Workflow</strong> ${ctx.workflow_version || '—'}</div>
      <div><strong>Schema</strong> ${ctx.schema_version || '—'}</div>
      <div><strong>Status</strong> ${header.status || '—'}</div>
    </div>
  </div>
  <div class="header-divider"></div>
  <div class="header-stats">
    <div class="stat-item">
      <label>Jahresüberschuss</label>
      <value>${fmt(mwr.ausgangswert?.amount)}</value>
      <small>lt. G&amp;V</small>
    </div>
    <div class="stat-item">
      <label>Steuerpfl. Einkommen</label>
      <value>${fmt(mwr.steuerpflichtiges_einkommen?.value)}</value>
      <small>nach MWR</small>
    </div>
    <div class="stat-item">
      <label>Körperschaftsteuer</label>
      <value>${fmt(mwr.koerperschaftsteuer?.value)}</value>
      <small>${mwr.koerperschaftsteuer_rate || '23%'} KöSt</small>
    </div>
    <div class="stat-item">
      <label>Risk Score</label>
      <value>${risk.risk_score ?? '—'}/100</value>
      <small>${risk.risk_level || '—'}</small>
    </div>
  </div>
</header>

<main>

  <!-- SECTION 1: MWR -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">01</span>
      <span class="section-title">Mehr-Weniger-Rechnung</span>
      ${statusBadge(overallStatus)}
    </div>

    <table class="mwr-table">
      <thead>
        <tr>
          <th style="width:120px">Position</th>
          <th>Beschreibung</th>
          <th style="width:60px">Richtung</th>
          <th style="width:140px;text-align:right">Betrag</th>
          <th style="width:50px;text-align:center" class="no-print"></th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="td-mono">Ausgangswert</td>
          <td>${mwr.ausgangswert?.label || 'Jahresüberschuss lt. G&V'}</td>
          <td>—</td>
          <td class="amount">${fmt(mwr.ausgangswert?.amount)}</td>
          <td class="no-print"></td>
        </tr>
        ${hinzu.length > 0 ? hinzu.map(h => `
        <tr>
          <td class="td-mono" style="color:var(--red)">${h.rule_id || '—'}</td>
          <td>${h.description || h.label || '—'}</td>
          <td><span class="mehr">+MEHR</span></td>
          <td class="amount mehr">+ ${fmt(h.amount)}</td>
          <td class="no-print" style="text-align:center"><button class="ask-btn" onclick="openAskModal(${JSON.stringify({account_number: h.account_number||h.rule_id||'', description: h.description||h.label||'', direction: 'Hinzurechnung', amount: h.amount||0, tax_treatment: h.tax_treatment||(h.assessment&&h.assessment.tax_treatment)||'', legal_basis: Array.isArray(h.legal_basis)?h.legal_basis.join(', '):(h.legal_basis||''), reasoning: h.reasoning||(h.assessment&&h.assessment.reasoning)||'', assessment_source: h.assessment_source||'', confidence: h.confidence||(h.assessment&&h.assessment.confidence)||null}).replace(/"/g, '&quot;')})">? Fragen</button></td>
        </tr>`).join('') : `<tr><td colspan="5" class="empty-state">Keine Hinzurechnungen</td></tr>`}
        <tr class="mwr-subtotal">
          <td class="td-mono">Hinzurechnungen</td>
          <td>Summe Mehr</td>
          <td></td>
          <td class="amount mehr">+ ${fmt(mwr.hinzurechnungen_summe?.value)}</td>
          <td class="no-print"></td>
        </tr>
        ${kuerzungen.length > 0 ? kuerzungen.map(k => `
        <tr>
          <td class="td-mono" style="color:var(--green)">${k.rule_id || '—'}</td>
          <td>${k.description || k.label || '—'}</td>
          <td><span class="weniger">−WENIGER</span></td>
          <td class="amount weniger">− ${fmt(k.amount)}</td>
          <td class="no-print" style="text-align:center"><button class="ask-btn" onclick="openAskModal(${JSON.stringify({account_number: k.account_number||k.rule_id||'', description: k.description||k.label||'', direction: 'Kürzung', amount: k.amount||0, tax_treatment: k.tax_treatment||(k.assessment&&k.assessment.tax_treatment)||'', legal_basis: Array.isArray(k.legal_basis)?k.legal_basis.join(', '):(k.legal_basis||''), reasoning: k.reasoning||(k.assessment&&k.assessment.reasoning)||'', assessment_source: k.assessment_source||'', confidence: k.confidence||(k.assessment&&k.assessment.confidence)||null}).replace(/"/g, '&quot;')})">? Fragen</button></td>
        </tr>`).join('') : `<tr><td colspan="5" class="empty-state">Keine Kürzungen</td></tr>`}
        <tr class="mwr-subtotal">
          <td class="td-mono">Kürzungen</td>
          <td>Summe Weniger</td>
          <td></td>
          <td class="amount weniger">− ${fmt(mwr.kuerzungen_summe?.value)}</td>
          <td class="no-print"></td>
        </tr>
        <tr class="mwr-total">
          <td class="td-mono">Ergebnis</td>
          <td style="font-weight:600">Steuerpflichtiges Einkommen</td>
          <td></td>
          <td class="amount">${fmt(mwr.steuerpflichtiges_einkommen?.value)}</td>
          <td class="no-print"></td>
        </tr>
        <tr class="mwr-total">
          <td class="td-mono">KöSt</td>
          <td style="font-weight:600">Körperschaftsteuer (${mwr.koerperschaftsteuer_rate || '23%'})</td>
          <td></td>
          <td class="amount">${fmt(mwr.koerperschaftsteuer?.value)}</td>
          <td class="no-print"></td>
        </tr>
        ${mwr.mindest_koerperschaftsteuer_applicable ? `
        <tr class="mwr-total">
          <td class="td-mono">Min-KöSt</td>
          <td>Mindestkörperschaftsteuer (GmbH)</td>
          <td></td>
          <td class="amount">${fmt(mwr.mindest_koerperschaftsteuer)}</td>
          <td class="no-print"></td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- SECTION 2: K1 KENNZAHLEN -->
  <div class="section page-break">
    <div class="section-header">
      <span class="section-number">02</span>
      <span class="section-title">Formular K1 — Kennzahlen</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:80px">Kennzahl</th>
          <th>Bezeichnung</th>
          <th style="width:140px;text-align:right">Wert</th>
          <th style="width:80px;text-align:center">Auto</th>
          <th>Regel</th>
        </tr>
      </thead>
      <tbody>
        ${k1Entries.length > 0 ? k1Entries.map(e => `
        <tr>
          <td class="td-mono" style="font-weight:600;color:var(--gold-muted)">${e.kz}</td>
          <td>${e.label || '—'}</td>
          <td class="td-right">${fmt(e.value)}</td>
          <td style="text-align:center">${e.auto_filled ? '✓' : '○'}</td>
          <td class="td-mono" style="font-size:10px;color:var(--gray)">${e.rule_id || '—'}</td>
        </tr>`).join('') : '<tr><td colspan="5" class="empty-state">Keine K1-Kennzahlen verfügbar</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- SECTION 3: PLAUSIBILITÄTSCHECKS -->
  <div class="section">
    <div class="section-header">
      <span class="section-number">03</span>
      <span class="section-title">Plausibilitätsprüfung</span>
      ${statusBadge(overallStatus)}
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:80px">Check</th>
          <th>Beschreibung</th>
          <th style="width:80px;text-align:center">Status</th>
          <th style="width:80px;text-align:center">Aktion</th>
          <th>Abweichung</th>
        </tr>
      </thead>
      <tbody>
        ${checks.length > 0 ? checks.map(c => `
        <tr>
          <td class="td-mono">${c.check_id || '—'}</td>
          <td>${c.description || c.check_name || '—'}</td>
          <td style="text-align:center">${statusBadge(c.status)}</td>
          <td style="text-align:center"><span class="badge">${c.action_required || '—'}</span></td>
          <td class="td-mono" style="font-size:10px;color:var(--gray)">${c.deviation || '—'}</td>
        </tr>`).join('') : '<tr><td colspan="5" class="empty-state">Keine Plausibilitätschecks verfügbar</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- SECTION 4: RISIKOBEWERTUNG -->
  <div class="section page-break">
    <div class="section-header">
      <span class="section-number">04</span>
      <span class="section-title">Risikobewertung</span>
      ${statusBadge(risk.risk_level)}
    </div>
    <div class="info-grid" style="grid-template-columns: 1fr 2fr;">
      <div class="info-card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;padding:32px;">
        <label style="margin-bottom:8px">Risk Score</label>
        <div class="risk-score-big">${risk.risk_score ?? '—'}</div>
        <div style="font-size:11px;color:var(--gray);margin-top:4px">von 100</div>
        <div style="width:100%;margin-top:16px">${riskBar(risk.risk_score)}</div>
        <div style="margin-top:8px">${statusBadge(risk.risk_level)}</div>
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th>Risikofaktor</th>
              <th style="width:60px;text-align:right">Gewicht</th>
              <th>Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            ${(risk.risk_factors || []).length > 0 ? (risk.risk_factors || []).map(f => `
            <tr>
              <td class="td-mono" style="font-size:11px">${f.factor || '—'}</td>
              <td class="td-right">${f.weight ?? '—'}</td>
              <td style="font-size:11px;color:var(--gray)">${f.description || '—'}</td>
            </tr>`).join('') : '<tr><td colspan="3" class="empty-state">Keine Risikofaktoren</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- SECTION 5: HUMAN REVIEW -->
  ${humanReview.length > 0 ? `
  <div class="section">
    <div class="section-header">
      <span class="section-number">05</span>
      <span class="section-title">Human Review — Offene Punkte</span>
      <span class="badge badge-warn">${humanReview.length} Item${humanReview.length !== 1 ? 's' : ''}</span>
    </div>
    ${humanReview.map(item => `
    <div class="review-item ${(item.materiality_level || '').toLowerCase()}">
      <div class="review-item-header">
        <span class="review-account">Konto ${item.account_number || '—'}</span>
        <div style="display:flex;gap:8px;align-items:center">
          ${statusBadge(item.materiality_level)}
          <span class="badge" style="background:var(--navy);color:var(--gold)">Prio ${item.priority || '—'}</span>
        </div>
      </div>
      <div class="review-issue">${item.issue || '—'}</div>
      <div class="review-rec">→ ${item.recommendation || '—'}</div>
    </div>`).join('')}
  </div>` : ''}

  <!-- SECTION 6: VERSION SNAPSHOT -->
  <div class="section page-break">
    <div class="section-header">
      <span class="section-number">06</span>
      <span class="section-title">Verarbeitungsdetails &amp; Versionen</span>
    </div>
    <div class="version-grid">
      <div class="version-row"><span class="version-key">Run-ID</span><span class="version-val">${ctx.run_id || '—'}</span></div>
      <div class="version-row"><span class="version-key">Zeitstempel</span><span class="version-val">${fmtDate(ctx.timestamp_utc)}</span></div>
      <div class="version-row"><span class="version-key">Audit Level</span><span class="version-val">${ctx.audit_level || '—'}</span></div>
      <div class="version-row"><span class="version-key">Working Mode</span><span class="version-val">${ctx.working_mode || '—'}</span></div>
      <div class="version-row"><span class="version-key">Legal Framework</span><span class="version-val">${ctx.version_snapshot?.legal_framework_version || '—'}</span></div>
      <div class="version-row"><span class="version-key">Routing Table</span><span class="version-val">${ctx.version_snapshot?.routing_table_version || '—'}</span></div>
      <div class="version-row"><span class="version-key">Tax Config</span><span class="version-val">${ctx.version_snapshot?.tax_config_version || '—'}</span></div>
      <div class="version-row"><span class="version-key">Invariants</span><span class="version-val">${ctx.version_snapshot?.invariants_version || '—'}</span></div>
      ${Object.entries(ctx.version_snapshot?.agent_prompt_versions || {}).map(([k, v]) =>
        `<div class="version-row"><span class="version-key">${k}</span><span class="version-val">${v}</span></div>`
      ).join('')}
    </div>

    ${Object.keys(metrics).length > 0 ? `
    <div style="margin-top:24px">
      <table>
        <thead>
          <tr>
            <th>Metrik</th>
            <th style="text-align:right">Wert</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Laufzeit gesamt</td><td class="td-right">${metrics.runtime_seconds ?? '—'} s</td></tr>
          <tr><td>LLM Calls gesamt</td><td class="td-right">${metrics.llm_usage?.total_calls ?? '—'}</td></tr>
          <tr><td>Input Tokens</td><td class="td-right">${fmtN(metrics.llm_usage?.total_input_tokens)}</td></tr>
          <tr><td>Output Tokens</td><td class="td-right">${fmtN(metrics.llm_usage?.total_output_tokens)}</td></tr>
          <tr><td>Geschätzte Kosten</td><td class="td-right">${fmt(metrics.llm_usage?.cost_estimate_eur)}</td></tr>
          <tr><td>Rule Engine (ohne LLM)</td><td class="td-right">${metrics.rule_engine_usage?.resolved_without_llm_pct ?? '—'} %</td></tr>
        </tbody>
      </table>
    </div>` : ''}
  </div>

</main>

<footer>
  <div>
    <strong>Eliasv2</strong> · KI-gestützte Körperschaftsteuer-Automatisierung ·
    Kein Ersatz für professionelle Steuerberatung
  </div>
  <div>
    ${header.company || '—'} · ${ctx.tax_year || '—'} ·
    Run <strong>${(ctx.run_id || '—').substring(0, 8).toUpperCase()}</strong> ·
    ${fmtDate(header.generated_utc)}
  </div>
</footer>

${renderConflictsSection(reportData)}
${renderAuditSummarySection(reportData)}

<!-- ===== ASK QUESTION MODAL [AUTO-PATCH] ===== -->
<div id="askModalOverlay" class="ask-modal-overlay no-print" onclick="if(event.target===this)closeAskModal()">
  <div class="ask-modal">
    <h3>? Frage zur Position</h3>
    <div id="askContext" class="ask-context"></div>
    <textarea id="askQuestion" placeholder="Ihre Frage zu dieser Position eingeben... (Enter = Senden, Shift+Enter = neue Zeile)" rows="3"></textarea>
    <div class="ask-modal-actions">
      <button id="askSubmitBtn" class="ask-submit-btn" onclick="submitQuestion()">Senden</button>
      <button class="ask-cancel-btn" onclick="closeAskModal()">Schließen</button>
    </div>
    <div id="askAnswerBox" class="ask-answer-box">
      <div id="askAnswerText" class="ask-answer-text"></div>
      <div id="askLegalRefs" class="ask-legal-refs"></div>
      <div id="askDisclaimer" class="ask-disclaimer"></div>
    </div>
  </div>
</div>

<script>
(function() {
  'use strict';
  let currentCtx = {};

  window.openAskModal = function(ctx) {
    if (typeof ctx === 'string') { try { ctx = JSON.parse(ctx); } catch(e) { ctx = {}; } }
    currentCtx = ctx || {};
    var accountNumber = currentCtx.account_number || '';
    var description = currentCtx.description || '';
    var direction = currentCtx.direction || '';
    var amount = currentCtx.amount;
    var taxTreatment = currentCtx.tax_treatment || '';
    var legalBasis = currentCtx.legal_basis || '';
    var reasoning = currentCtx.reasoning || '';
    var assessmentSource = currentCtx.assessment_source || '';
    var confidence = currentCtx.confidence;
    const ctxEl = document.getElementById('askContext');
    ctxEl.innerHTML = '<strong>' + (accountNumber || '—') + '</strong> · ' + (description || '—') + '<br>' +
      '<span style="color:' + (direction === 'Hinzurechnung' ? 'var(--red)' : 'var(--green)') + '">' + direction + '</span>' +
      ' · <strong>' + (amount ? Number(amount).toLocaleString('de-AT', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' \u20AC' : '—') + '</strong>' +
      (taxTreatment ? '<br>Behandlung: ' + taxTreatment : '') +
      (legalBasis ? '<br>Rechtsgrundlage: ' + legalBasis : '') +
      (reasoning ? '<br><span style="color:var(--gray);font-size:10px">Begründung: ' + reasoning + '</span>' : '') +
      (assessmentSource ? '<br><span style="color:var(--gold-muted);font-size:10px">Quelle: ' + assessmentSource + '</span>' : '') +
      (confidence ? '<br><span style="color:var(--gold-muted);font-size:10px">Konfidenz: ' + confidence + '</span>' : '');
    document.getElementById('askQuestion').value = '';
    document.getElementById('askAnswerBox').classList.remove('visible');
    document.getElementById('askAnswerText').innerHTML = '';
    document.getElementById('askLegalRefs').innerHTML = '';
    document.getElementById('askDisclaimer').innerHTML = '';
    document.getElementById('askSubmitBtn').disabled = false;
    document.getElementById('askSubmitBtn').textContent = 'Senden';
    document.getElementById('askModalOverlay').classList.add('active');
    setTimeout(function() { document.getElementById('askQuestion').focus(); }, 100);
  };

  window.closeAskModal = function() {
    document.getElementById('askModalOverlay').classList.remove('active');
  };

  window.submitQuestion = function() {
    var q = document.getElementById('askQuestion').value.trim();
    if (!q) return;
    var btn = document.getElementById('askSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="ask-spinner"></span>Wird gesendet...';
    var payload = {
      account_number: currentCtx.account_number || '',
      description: currentCtx.description || '',
      direction: currentCtx.direction || '',
      amount: currentCtx.amount || '',
      tax_treatment: currentCtx.tax_treatment || '',
      legal_basis: currentCtx.legal_basis || '',
      reasoning: currentCtx.reasoning || '',
      assessment_source: currentCtx.assessment_source || '',
      confidence: currentCtx.confidence || null,
      question: q
    };
    fetch('https://n8n.junglex.eu/webhook/ask-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var answerBox = document.getElementById('askAnswerBox');
      var answerText = document.getElementById('askAnswerText');
      var legalRefs = document.getElementById('askLegalRefs');
      var disclaimer = document.getElementById('askDisclaimer');
      answerText.textContent = data.answer || 'Keine Antwort erhalten.';
      legalRefs.innerHTML = '';
      if (data.legal_references && Array.isArray(data.legal_references)) {
        data.legal_references.forEach(function(ref) {
          var tag = document.createElement('span');
          tag.className = 'ask-legal-tag';
          tag.textContent = ref;
          legalRefs.appendChild(tag);
        });
      }
      disclaimer.textContent = data.disclaimer || 'Hinweis: Diese Antwort wurde KI-gestützt generiert und ersetzt keine professionelle Steuerberatung.';
      answerBox.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Weitere Frage senden';
    })
    .catch(function(err) {
      var answerBox = document.getElementById('askAnswerBox');
      var answerText = document.getElementById('askAnswerText');
      answerText.innerHTML = '<span style="color:var(--red)">Fehler: ' + err.message + '</span>';
      answerBox.classList.add('visible');
      document.getElementById('askDisclaimer').textContent = '';
      document.getElementById('askLegalRefs').innerHTML = '';
      btn.disabled = false;
      btn.textContent = 'Erneut versuchen';
    });
  };

  // Enter = send, Shift+Enter = newline
  document.getElementById('askQuestion').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  });

  // ESC = close
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAskModal();
  });
})();
</script>
<!-- ===== END ASK QUESTION MODAL ===== -->

</body>
</html>`;

try {
  fs.writeFileSync(outputPath, html, 'utf-8');
  const size = fs.statSync(outputPath).size;
  console.log(JSON.stringify({
    success: true,
    output_path: outputPath,
    file_size_kb: Math.round(size / 1024 * 10) / 10,
    format: 'HTML'
  }));
  process.exit(0);
} catch (e) {
  console.error(JSON.stringify({ error: 'Fehler beim Schreiben der HTML-Datei: ' + e.message }));
  process.exit(1);
}


// ===== CONFLICT + AUDIT SUMMARY SECTIONS [AUTO-PATCH] =====
function renderConflictsSection(report) {
  const cs = report.conflicts_summary || report.conflicts || {};
  const conflicts = cs.conflicts || (Array.isArray(cs) ? cs : []);
  if (!conflicts.length) {
    return `<div class="section conflict-section no-conflicts">
      <h2 style="margin:0 0 12px 0">&#9878; Regelkonflikte (INV-441)</h2>
      <div class="status-badge status-green">&#10003; Keine Konflikte zwischen Rule Engine und LLM-Bewertung</div>
    </div>`;
  }
  const rows = conflicts.map(c => {
    const col = c.materiality_level === 'HIGH' ? '#dc2626' : c.materiality_level === 'MEDIUM' ? '#d97706' : '#16a34a';
    return `<tr>
      <td><code>${c.conflict_id||'-'}</code></td>
      <td><strong>${c.account_number||'-'}</strong></td>
      <td style="color:#1e40af">${c.rule_engine_treatment||'-'}</td>
      <td style="color:#7c3aed">${c.llm_treatment||'-'}</td>
      <td style="color:${col};font-weight:600">${c.materiality_level||'-'}</td>
      <td>${c.resolution||'LLM_OVERRIDE'}</td>
      <td>${c.requires_human_review ? '&#9888; Ja' : '&#10003; Nein'}</td>
    </tr>`;
  }).join('');
  return `<div class="section conflict-section has-conflicts">
    <h2 style="margin:0 0 12px 0">&#9878; Regelkonflikte (INV-441) <span class="conflict-badge">${conflicts.length} Konflikt${conflicts.length!==1?'e':''}</span></h2>
    <p class="conflict-note">Rule Engine hatte RESOLVED, LLM wich ab. Alle Konflikt-Konten: Human Review erzwungen.</p>
    <table class="conflict-table">
      <thead><tr><th>ID</th><th>Konto</th><th>Rule Engine</th><th>LLM</th><th>Materialit&#228;t</th><th>Resolution</th><th>Human Review</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderAuditSummarySection(report) {
  const summary = report.audit_events_summary || {};
  if (!Object.keys(summary).length) return '';
  const order = ['INGESTION','ROUTING','ENRICHMENT','RULE_ENGINE','IDEMPOTENCY_CHECK','MERGE_ASSESSMENTS','CONFLICT_CHECK','CALCULATOR','PLAUSIBILITY','METRICS','OUTPUT'];
  const all = [...new Set([...order, ...Object.keys(summary)])];
  const rows = all.filter(s => summary[s]).map(s =>
    `<tr><td><code>${s}</code></td><td>${summary[s]}</td><td style="color:#16a34a">&#10003;</td></tr>`
  ).join('');
  return `<div class="section audit-summary-section">
    <h2 style="margin:0 0 12px 0">&#128203; Audit Trail Summary</h2>
    <table class="audit-summary-table">
      <thead><tr><th>Stage</th><th>Events</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
// ===== END AUTO-PATCH =====
