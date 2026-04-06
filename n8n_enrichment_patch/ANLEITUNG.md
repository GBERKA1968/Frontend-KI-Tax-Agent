# Enrichment-Patch für WEBHOOK_GATEWAY Workflow

## Übersicht
Das Frontend schickt jetzt optionale Enrichment-Dateien als `enrichment_*` Felder im JSON-Payload mit.
Dieser Patch fängt die Dateien ab und speichert sie unter `/files/inbox/enrichment/`.

## Schritt 1 — Enrichment-Verzeichnis erstellen

```bash
ssh root@n8n.junglex.eu "mkdir -p /opt/n8n/files/inbox/enrichment && chmod 777 /opt/n8n/files/inbox/enrichment"
```

## Schritt 2 — VALIDATE_INPUT Node patchen

Öffne den **VALIDATE_INPUT** Code Node im WEBHOOK_GATEWAY Workflow.

Füge **vor** dem `return`-Statement diesen Code ein:

```javascript
// --- ENRICHMENT PATCH ---
const enrichmentTypes = ['beteiligungsspiegel', 'bewirtung', 'spenden', 'darlehen', 'vertrag'];
const enrichmentFiles = {};
for (const type of enrichmentTypes) {
  const key = 'enrichment_' + type;
  if (body[key] && typeof body[key] === 'string' && body[key].trim().length > 10) {
    enrichmentFiles[key] = body[key];
  }
}
// --- ENDE ENRICHMENT PATCH ---
```

Dann im `return`-Objekt hinzufügen:
```javascript
enrichment_files: enrichmentFiles,
enrichment_count: Object.keys(enrichmentFiles).length,
```

## Schritt 3 — Neuen Code Node einfügen: WRITE_ENRICHMENT_FILES

1. Rechtsklick auf die Verbindung VALIDATE_INPUT → PREPARE_CSV_BINARY
2. "Add node" wählen
3. **Code** Node auswählen (JavaScript)
4. Name: `WRITE_ENRICHMENT_FILES`
5. Code aus `WRITE_ENRICHMENT_FILES_node.js` einfügen
6. Speichern

**Verbindung danach:**
```
VALIDATE_INPUT → WRITE_ENRICHMENT_FILES → PREPARE_CSV_BINARY
```

## Schritt 4 — Testen

1. Im Frontend eine Analyse mit Enrichment-Dateien starten
2. Prüfen ob Dateien geschrieben wurden:
```bash
ssh root@n8n.junglex.eu "ls -la /opt/n8n/files/inbox/enrichment/"
```

Erwartete Dateien:
- `enrichment_beteiligungsspiegel_2024.txt`
- `enrichment_bewirtung_2024.txt`
- etc.

## Schritt 5 — Verifizierung

```bash
ssh root@n8n.junglex.eu "ls -la /opt/n8n/files/inbox/enrichment/ && echo '---' && cat /opt/n8n/files/inbox/enrichment/enrichment_beteiligungsspiegel_2024.txt | head -5"
```

## Dateien in diesem Verzeichnis

| Datei | Beschreibung |
|-------|-------------|
| `VALIDATE_INPUT_patch.js` | Code-Patch für den bestehenden VALIDATE_INPUT Node |
| `WRITE_ENRICHMENT_FILES_node.js` | Vollständiger Code für den neuen n8n Code Node |
| `WRITE_ENRICHMENT_FILES_n8n_node.json` | n8n-kompatible JSON-Definition (Copy-Paste in n8n) |
| `01_setup_enrichment_dir.sh` | Shell-Script zum Erstellen des Verzeichnisses |
