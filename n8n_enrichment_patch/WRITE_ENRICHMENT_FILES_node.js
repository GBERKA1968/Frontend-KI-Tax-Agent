// =============================================
// WRITE_ENRICHMENT_FILES — n8n Code Node
// =============================================
// Neuer Node: Zwischen VALIDATE_INPUT und PREPARE_CSV_BINARY einfügen
// Typ: Code Node (JavaScript)
// Name: WRITE_ENRICHMENT_FILES
//
// Verbindung: VALIDATE_INPUT → WRITE_ENRICHMENT_FILES → PREPARE_CSV_BINARY
// =============================================

const input = $input.first().json;
const enrichmentFiles = input.enrichment_files || {};
const taxYear = input.tax_year || '2024';
const fs = require('fs');

const basePath = '/files/inbox/enrichment';

// Verzeichnis sicherstellen (im Container-Pfad)
try {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
} catch (e) {
  console.log('Verzeichnis existiert bereits oder konnte nicht erstellt werden:', e.message);
}

const mapping = {
  'enrichment_beteiligungsspiegel': `enrichment_beteiligungsspiegel_${taxYear}.txt`,
  'enrichment_bewirtung':           `enrichment_bewirtung_${taxYear}.txt`,
  'enrichment_spenden':             `enrichment_spenden_${taxYear}.txt`,
  'enrichment_darlehen':            `enrichment_darlehen_${taxYear}.txt`,
  'enrichment_vertrag':             `enrichment_vertrag_${taxYear}.txt`,
};

const written = [];
const errors = [];

for (const [key, filename] of Object.entries(mapping)) {
  if (enrichmentFiles[key] && enrichmentFiles[key].trim().length > 0) {
    const filepath = basePath + '/' + filename;
    try {
      fs.writeFileSync(filepath, enrichmentFiles[key], 'utf-8');
      const stats = fs.statSync(filepath);
      written.push({
        key: key,
        filename: filename,
        filepath: filepath,
        size_bytes: stats.size,
      });
      console.log(`✓ ${filename} geschrieben (${stats.size} bytes)`);
    } catch (err) {
      errors.push({ key: key, error: err.message });
      console.error(`✗ Fehler bei ${filename}: ${err.message}`);
    }
  }
}

console.log(`Enrichment: ${written.length} Datei(en) geschrieben, ${errors.length} Fehler`);

// Alle input-Felder durchreichen + Enrichment-Status hinzufügen
// enrichment_files-Objekt NICHT weiterreichen (zu groß für Pipeline)
const { enrichment_files, ...restInput } = input;

return [{
  json: {
    ...restInput,
    enrichment_files_written: written.map(w => w.filename),
    enrichment_files_count: written.length,
    enrichment_files_details: written,
    enrichment_errors: errors,
  }
}];
