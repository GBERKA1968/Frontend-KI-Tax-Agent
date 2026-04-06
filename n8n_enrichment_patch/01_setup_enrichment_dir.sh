#!/bin/bash
# Schritt 1+2: Verzeichnis prüfen und erstellen
echo "=== Enrichment-Verzeichnis einrichten ==="
ssh root@n8n.junglex.eu "mkdir -p /opt/n8n/files/inbox/enrichment && chmod 777 /opt/n8n/files/inbox/enrichment && ls -la /opt/n8n/files/inbox/enrichment/ && echo '✓ Enrichment-Verzeichnis bereit'"
