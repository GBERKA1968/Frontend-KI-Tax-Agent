// =============================================
// VALIDATE_INPUT — Enrichment-Patch
// =============================================
// Füge diesen Code am ENDE des bestehenden VALIDATE_INPUT Code Nodes ein,
// VOR dem return-Statement.
//
// Der bestehende Code liest csv_content, company_name etc. aus dem Body.
// Dieser Patch extrahiert zusätzlich die Enrichment-Dateien.
// =============================================

// --- ANFANG ENRICHMENT PATCH ---

// Enrichment-Dateien aus Payload extrahieren
const enrichmentTypes = [
  'beteiligungsspiegel',
  'bewirtung',
  'spenden',
  'darlehen',
  'vertrag'
];

const enrichmentFiles = {};
for (const type of enrichmentTypes) {
  const key = 'enrichment_' + type;
  if (body[key] && typeof body[key] === 'string' && body[key].trim().length > 10) {
    enrichmentFiles[key] = body[key];
  }
}

const enrichmentCount = Object.keys(enrichmentFiles).length;
if (enrichmentCount > 0) {
  console.log(`Enrichment: ${enrichmentCount} Datei(en) empfangen: ${Object.keys(enrichmentFiles).join(', ')}`);
}

// --- ENDE ENRICHMENT PATCH ---

// Im return-Objekt das Feld enrichment_files hinzufügen:
// return [{
//   json: {
//     ...bestehende_felder,
//     enrichment_files: enrichmentFiles,        // <-- NEU
//     enrichment_count: enrichmentCount,         // <-- NEU
//   }
// }];
