# Prompt für Google Antigravity Agent: App zum Laufen bringen

## Aufgabe: Deep Search App end-to-end funktionsfähig machen

### Kontext
Die App ist deployed auf Cloud Run:
- **URL**: https://allmighty-deep-search-357167321669.us-central1.run.app
- **Frontend**: `/app/` lädt korrekt
- **Session-404**: Wurde gefixt (Route-Prefix korrigiert)
- **Neues Problem**: Wenn User eine Query eingibt, kommt keine Antwort

Letzter Fehler in den Logs war:
```
google.genai.errors.ClientError: 403 Forbidden - Vertex AI API has not been used in project cloudshell-gca
```

Wir haben jetzt folgende Env-Variables auf Cloud Run gesetzt:
```
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=project-3ca39165-fb2e-4579-84e
GOOGLE_CLOUD_LOCATION=global
```

Und die Vertex AI API wurde im Projekt aktiviert.

### Anweisung

**Schritt 1: Teste ob die App jetzt funktioniert**

1. Öffne https://allmighty-deep-search-357167321669.us-central1.run.app/app/
2. Gib eine einfache Test-Query ein: "What is quantum computing?"
3. Warte 30 Sekunden ob eine Antwort kommt

**Schritt 2: Falls immer noch Fehler - prüfe die Logs**

```bash
gcloud run services logs read allmighty-deep-search --region us-central1 --limit 30
```

Typische Probleme und wie du sie fixst:

| Fehler | Fix |
|---|---|
| `403 Vertex AI API not enabled` | `gcloud services enable aiplatform.googleapis.com --project=project-3ca39165-fb2e-4579-84e` |
| `403 Permission denied` | Service Account braucht `Vertex AI User` Rolle: `gcloud projects add-iam-policy-binding project-3ca39165-fb2e-4579-84e --member="serviceAccount:SERVICE_ACCOUNT" --role="roles/aiplatform.user"` |
| `GOOGLE_CLOUD_LOCATION global not supported` | Ändere auf `us-central1`: `gcloud run services update allmighty-deep-search --region us-central1 --update-env-vars="GOOGLE_CLOUD_LOCATION=us-central1"` |
| `Model not found` | Prüfe ob `gemini-2.0-flash` in der Region verfügbar ist. Ggf. auf `gemini-2.0-flash-001` ändern |
| `google_search tool error` | Google Search API muss aktiviert sein: `gcloud services enable customsearch.googleapis.com --project=project-3ca39165-fb2e-4579-84e` |

**Schritt 3: Finde die Service Account**

```bash
gcloud run services describe allmighty-deep-search --region us-central1 --format="value(spec.template.spec.serviceAccountName)"
```

Falls leer, wird die default Compute Engine SA genutzt. Prüfe deren Berechtigungen:

```bash
# Default SA ist: PROJECT_NUMBER-compute@developer.gserviceaccount.com
gcloud projects describe project-3ca39165-fb2e-4579-84e --format="value(projectNumber)"
# Dann:
gcloud projects get-iam-policy project-3ca39165-fb2e-4579-84e --flatten="bindings[].members" --filter="bindings.members:compute@developer.gserviceaccount.com" --format="table(bindings.role)"
```

Falls `roles/aiplatform.user` fehlt:
```bash
gcloud projects add-iam-policy-binding project-3ca39165-fb2e-4579-84e \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

**Schritt 4: Iteriere bis es funktioniert**

- Logs lesen → Fehler identifizieren → fixen → testen → wiederholen
- Env-Variables via `gcloud run services update` ändern (kein Re-Deploy nötig)
- IAM-Berechtigungen via `gcloud projects add-iam-policy-binding` hinzufügen

**Schritt 5: Finaler End-to-End Test**

Wenn alles läuft:
1. Query eingeben → Research-Plan wird generiert
2. Plan bestätigen → Research startet
3. Sources werden gesammelt
4. Report wird generiert

### Erwartetes Ergebnis
- User gibt Query ein → Agent erstellt Research-Plan
- User bestätigt → Multi-Agent Research Pipeline läuft
- Finaler Report mit Citations wird angezeigt

### Fehlerbehandlung - NICHT ABBRECHEN

**Du sollst NICHT stoppen wenn ein Fehler auftritt.** Stattdessen:
1. Fehler analysieren und selbständig fixen
2. Erneut versuchen
3. Iterieren bis alles funktioniert
4. Erst wenn du nach 5+ Versuchen am selben Problem hängst, berichte den Fehler

### Einschränkungen
- NICHT `app/agent.py` grundlegend umstrukturieren
- NICHT die Modell-Konfiguration ändern (gemini-2.0-flash bleibt)
- Du darfst Env-Variables auf Cloud Run ändern
- Du darfst IAM-Berechtigungen hinzufügen
- Du darfst APIs im Projekt aktivieren
