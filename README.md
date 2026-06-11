# Tour-Control 🚚

Ladelisten fotografieren, Touren optimieren und pro Kunde eine Wissensdatenbank aufbauen –
als **Handy-Web-App (PWA)**, die **offline** funktioniert. Alle Daten bleiben **lokal auf dem Gerät**.

## Was es kann

- **📷 Ladeliste fotografieren** → Texterkennung läuft direkt auf dem Gerät (Tesseract, Deutsch), du korrigierst die erkannten Stopps.
- **🧭 Routenoptimierung** → Adressen werden verortet (OpenStreetMap) und in eine sinnvolle Fahrreihenfolge gebracht. Inklusive **Ladereihenfolge** (umgekehrt: zuletzt geladen = zuerst zugestellt).
- **📚 Wissensdatenbank pro Kunde** → Beim Ausliefern wichtige Infos festhalten (Tor, Klingel, Zeitfenster, Ansprechpartner …). Beim nächsten Mal erscheinen sie automatisch beim Stopp.
- **💾 Offline & lokal** → Karten und Daten werden gecacht; Backup als JSON exportierbar.

## Entwicklung

```bash
npm install
npm run dev      # Startet den Dev-Server (mit --host, auch im Heimnetz erreichbar)
```

Im Terminal erscheint eine `http://<PC-IP>:5173`-Adresse. Diese kannst du am Handy im
selben WLAN öffnen, um die App auf dem Telefon zu testen (Foto-Aufnahme funktioniert direkt).

## Produktiv bauen

```bash
npm run build    # erzeugt den Ordner dist/
npm run preview  # lokale Vorschau des Builds
```

Den Ordner `dist/` auf einen beliebigen Static-Host legen (z.B. Netlify, GitHub Pages,
Cloudflare Pages). **Wichtig:** Für die PWA-Installation und das Caching wird **HTTPS**
benötigt – die genannten Hoster liefern das kostenlos.

Danach auf dem Handy die Seite öffnen → Browser-Menü → **„Zum Startbildschirm hinzufügen"**.
Ab dann startet Tour-Control wie eine normale App und läuft offline.

## Technik

| Bereich        | Lösung                                           |
|----------------|--------------------------------------------------|
| App-Gerüst     | Vite, Vanilla JS, vite-plugin-pwa (Service Worker) |
| Texterkennung  | tesseract.js (Sprache `deu`), auf dem Gerät      |
| Karte          | Leaflet + OpenStreetMap-Kacheln                  |
| Geocoding      | Nominatim (kostenlos, max. 1 Anfrage/Sekunde)    |
| Route          | Nearest-Neighbor + 2-opt, Luftlinie (lokal)      |
| Speicher       | IndexedDB (über `idb`)                            |

## Datenschutz

Kundendaten und Notizen werden **ausschließlich lokal** im Browser des Geräts gespeichert.
Internet wird nur benötigt, um eine **neue** Adresse einmalig zu verorten; die Koordinaten
werden danach beim Kunden gespeichert. Denk an regelmäßige Backups
(Einstellungen → Backup exportieren).
