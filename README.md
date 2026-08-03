# Freight Lane Request & Route Frequency Analyzer

An interactive data visualization and analytics application that transforms carrier bidding statistics (`CarrierBiddingStatsDetailReport.xls`) into geographic corridor density maps, interstate flow analytics, and rankable leaderboards.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat&logo=Leaflet&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)

---

## 📊 Overview & Insights

The application parses **8,559 freight shipment records** across **1,935 unique freight corridors** to provide clear logistics visibility:

- 🥇 **Top Corridor**: **El Paso, TX → Everett, WA** (454 Bids / 5.3% of total freight)
- 🥈 **2nd Corridor**: **Indianapolis, IN → Auburn, AL** (258 Bids)
- 🥉 **3rd Corridor**: **Indianapolis, IN → Piedmont, SC** (249 Bids)
- 🇲🇽 **Top Cross-Border Corridor**: **Celaya Guanajuato, GJ → Town Of Tonawanda, NY** (234 Bids)
- 📍 **Primary Freight Hubs**: **Laredo, TX** (1,190 shipments) & **El Paso, TX** (1,028 shipments)

---

## ✨ Features

- **Geographic Flow Map**: Curved Bezier arcs connecting origin & destination coordinates across US, Mexico, and Canada with dynamic color intensity and stroke weights.
- **Hub Density Nodes**: Glowing markers sized proportionally to origin and destination volume.
- **Interactive Sidebar Filters**: Instant search by city/location, Origin State, Destination State, and minimum bid frequency slider.
- **Analytics & Leaderboards**: Rankable tables and Chart.js horizontal bar charts for top corridors and interstate flows (e.g. TX → WA, IN → AL).

---

## 🚀 Quick Start (Running Locally)

### 1. Clone the repository
```bash
git clone git@github.com:zsanford85/Lane-Request-Analyzer.git
cd Lane-Request-Analyzer
```

### 2. Start a local HTTP server
```bash
python3 -m http.server 8080
```

### 3. Open in browser
Navigate to `http://localhost:8080` in your web browser.

---

## 🛠 Data Processing

To re-process or update the underlying report data from a new `.xls` export:

```bash
python3 process_data.py
```

This will re-parse the raw report, update city geocoding in `geo_cache.json`, and regenerate `route_data.json`.
