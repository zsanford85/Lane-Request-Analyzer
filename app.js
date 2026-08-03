let currentDatasetMode = 'gta'; // 'gta' or 'carrier'
let gtaData = null;
let carrierData = null;
let activeData = null;

let map = null;
let routeLayersGroup = null;
let lanesChart = null;
let stateFlowChart = null;
let currentTab = 'city'; // 'city' or 'state'

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadAllDatasets();
  setupEventListeners();
});

function initMap() {
  map = L.map('map', {
    center: [38.5, -96.0],
    zoom: 4.5,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  routeLayersGroup = L.layerGroup().addTo(map);
}

async function loadAllDatasets() {
  try {
    const [gtaResp, carrierResp] = await Promise.all([
      fetch('gta_flight_data.json'),
      fetch('route_data.json')
    ]);

    gtaData = await gtaResp.json();
    carrierData = await carrierResp.json();

    switchDataset('gta');
  } catch (err) {
    console.error('Error loading dataset JSON files:', err);
  }
}

function switchDataset(mode) {
  currentDatasetMode = mode;
  document.getElementById('dataset-selector').value = mode;

  if (mode === 'gta') {
    activeData = gtaData;
    document.getElementById('group-aircraft').style.display = 'flex';
    document.getElementById('group-category').style.display = 'flex';
    document.getElementById('map-header-title').textContent = 'GTA Flight Path Density & Air Corridor Map';
    document.getElementById('kpi-shipments-label').textContent = 'Total Flights Logged';
    document.getElementById('kpi-busiest-label').textContent = `Top Flight Route (${activeData.summary.top_route_count})`;
    document.getElementById('kpi-origin-label').textContent = 'Top Airport Hub';
    document.getElementById('chart-lanes-title').textContent = 'Top 10 Most Frequent Flight Corridors';
    document.getElementById('chart-breakdown-title').textContent = 'Flight Distribution by Aircraft / Category';
    document.getElementById('table-title').textContent = 'Flight Corridor Frequency Leaderboard';
  } else {
    activeData = carrierData;
    document.getElementById('group-aircraft').style.display = 'none';
    document.getElementById('group-category').style.display = 'none';
    document.getElementById('map-header-title').textContent = 'Carrier Freight Route Density & Corridor Flow Map';
    document.getElementById('kpi-shipments-label').textContent = 'Total Freight Bids Analyzed';
    document.getElementById('kpi-busiest-label').textContent = `Top Freight Corridor (${activeData.summary.busiest_lane_count})`;
    document.getElementById('kpi-origin-label').textContent = 'Top Origin Freight Hub';
    document.getElementById('chart-lanes-title').textContent = 'Top 10 Most Frequent Freight Corridors';
    document.getElementById('chart-breakdown-title').textContent = 'Top Interstate Freight Movements';
    document.getElementById('table-title').textContent = 'Freight Corridor Frequency Leaderboard';
  }

  populateFilterDropdowns();
  updateDashboard();
}

function populateFilterDropdowns() {
  // Aircraft & Category Dropdowns
  const aircraftSelect = document.getElementById('filter-aircraft');
  const categorySelect = document.getElementById('filter-category');

  aircraftSelect.innerHTML = '<option value="">All Aircraft Types</option>';
  categorySelect.innerHTML = '<option value="">All Flight Categories</option>';

  if (currentDatasetMode === 'gta' && activeData.aircraft_options) {
    activeData.aircraft_options.forEach(ac => {
      const opt = document.createElement('option');
      opt.value = ac;
      opt.textContent = ac;
      aircraftSelect.appendChild(opt);
    });
    activeData.category_options.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }

  // Origin & Destination Dropdowns
  const origSelect = document.getElementById('filter-origin-state');
  const destSelect = document.getElementById('filter-dest-state');

  origSelect.innerHTML = '<option value="">All Origins</option>';
  destSelect.innerHTML = '<option value="">All Destinations</option>';

  const origins = new Set();
  const dests = new Set();

  activeData.top_lanes.forEach(l => {
    if (l.origin_state) origins.add(l.origin_state);
    if (l.dest_state) dests.add(l.dest_state);
  });

  Array.from(origins).sort().forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    origSelect.appendChild(opt);
  });

  Array.from(dests).sort().forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    destSelect.appendChild(opt);
  });
}

function setupEventListeners() {
  document.getElementById('dataset-selector').addEventListener('change', (e) => {
    switchDataset(e.target.value);
  });

  document.getElementById('filter-search').addEventListener('input', updateDashboard);
  document.getElementById('filter-aircraft').addEventListener('change', updateDashboard);
  document.getElementById('filter-category').addEventListener('change', updateDashboard);
  document.getElementById('filter-origin-state').addEventListener('change', updateDashboard);
  document.getElementById('filter-dest-state').addEventListener('change', updateDashboard);
  
  const minVolSlider = document.getElementById('filter-min-volume');
  minVolSlider.addEventListener('input', (e) => {
    const unit = currentDatasetMode === 'gta' ? 'Flights' : 'Bids';
    document.getElementById('range-val-text').textContent = `≥ ${e.target.value} ${unit}`;
    updateDashboard();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-aircraft').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-origin-state').value = '';
    document.getElementById('filter-dest-state').value = '';
    document.getElementById('filter-min-volume').value = 5;
    const unit = currentDatasetMode === 'gta' ? 'Flights' : 'Bids';
    document.getElementById('range-val-text').textContent = `≥ 5 ${unit}`;
    updateDashboard();
  });

  document.getElementById('tab-city').addEventListener('click', () => {
    currentTab = 'city';
    document.getElementById('tab-city').classList.add('active');
    document.getElementById('tab-state').classList.remove('active');
    renderLeaderboard();
  });

  document.getElementById('tab-state').addEventListener('click', () => {
    currentTab = 'state';
    document.getElementById('tab-state').classList.add('active');
    document.getElementById('tab-city').classList.remove('active');
    renderLeaderboard();
  });
}

function getFilteredLanes() {
  const searchVal = document.getElementById('filter-search').value.toLowerCase().trim();
  const selectedAircraft = document.getElementById('filter-aircraft').value;
  const selectedCategory = document.getElementById('filter-category').value;
  const origState = document.getElementById('filter-origin-state').value;
  const destState = document.getElementById('filter-dest-state').value;
  const minVol = parseInt(document.getElementById('filter-min-volume').value, 10) || 1;

  return activeData.top_lanes.filter(l => {
    if (currentDatasetMode === 'gta') {
      if (selectedAircraft && (!l.aircraft_breakdown || !l.aircraft_breakdown[selectedAircraft])) return false;
      if (selectedCategory && (!l.category_breakdown || !l.category_breakdown[selectedCategory])) return false;
    }

    if (l.count < minVol) return false;
    if (origState && l.origin_state !== origState) return false;
    if (destState && l.dest_state !== destState) return false;
    if (searchVal) {
      const matchLane = l.lane.toLowerCase().includes(searchVal);
      const matchOrig = l.origin.toLowerCase().includes(searchVal);
      const matchDest = l.dest.toLowerCase().includes(searchVal);
      if (!matchLane && !matchOrig && !matchDest) return false;
    }
    return true;
  });
}

function updateDashboard() {
  const filteredLanes = getFilteredLanes();

  updateKPIs(filteredLanes);
  renderMapRoutes(filteredLanes);
  renderCharts(filteredLanes);
  renderLeaderboard(filteredLanes);
}

function updateKPIs(filteredLanes) {
  const totalCount = filteredLanes.reduce((sum, l) => sum + l.count, 0);
  const totalLanesCount = filteredLanes.length;

  document.getElementById('kpi-shipments').textContent = totalCount.toLocaleString();
  document.getElementById('kpi-lanes').textContent = totalLanesCount.toLocaleString();

  if (filteredLanes.length > 0) {
    const top = filteredLanes[0];
    document.getElementById('kpi-busiest').textContent = `${top.lane} (${top.count})`;
  } else {
    document.getElementById('kpi-busiest').textContent = 'N/A';
  }

  const origCounts = {};
  filteredLanes.forEach(l => {
    origCounts[l.origin] = (origCounts[l.origin] || 0) + l.count;
  });

  let topOrig = 'N/A';
  let maxOrigCount = 0;
  for (const [city, cnt] of Object.entries(origCounts)) {
    if (cnt > maxOrigCount) {
      maxOrigCount = cnt;
      topOrig = city;
    }
  }

  document.getElementById('kpi-origin').textContent = topOrig !== 'N/A' ? `${topOrig}` : 'N/A';

  const unit = currentDatasetMode === 'gta' ? 'Flight Corridors' : 'Freight Corridors';
  document.getElementById('map-visible-lanes').textContent = `Displaying ${filteredLanes.length} ${unit}`;
  document.getElementById('nav-lane-count').textContent = `${totalLanesCount.toLocaleString()} Routes`;
  document.getElementById('nav-shipment-count').textContent = `${totalCount.toLocaleString()} Records`;
}

function getCurvedArcPoints(start, end, numPoints = 30) {
  const lat1 = start[0], lon1 = start[1];
  const lat2 = end[0], lon2 = end[1];

  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const dist = Math.sqrt(dLat * dLat + dLon * dLon);
  const offset = dist * 0.15;

  const ctrlLat = midLat + offset * (dLon / (dist || 1));
  const ctrlLon = midLon - offset * (dLat / (dist || 1));

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * ctrlLon + t * t * lon2;
    points.push([lat, lon]);
  }
  return points;
}

function renderMapRoutes(filteredLanes) {
  routeLayersGroup.clearLayers();
  const cityNodes = new Map();
  const lanesToPlot = filteredLanes.slice(0, 150);

  lanesToPlot.forEach(l => {
    const o = l.origin_coords;
    const d = l.dest_coords;
    if (!o || !d) return;

    cityNodes.set(l.origin, { coords: o, count: (cityNodes.get(l.origin)?.count || 0) + l.count, type: 'origin' });
    cityNodes.set(l.dest, { coords: d, count: (cityNodes.get(l.dest)?.count || 0) + l.count, type: 'dest' });

    let strokeColor = currentDatasetMode === 'gta' ? '#38bdf8' : '#f59e0b';
    let weight = Math.min(Math.max(l.count / 15, 2), 8);
    let opacity = Math.min(Math.max(l.count / 100, 0.4), 0.85);

    if (l.count > 100) {
      strokeColor = currentDatasetMode === 'gta' ? '#38bdf8' : '#38bdf8';
    } else if (l.count > 30) {
      strokeColor = '#a855f7';
    } else {
      strokeColor = '#64748b';
    }

    const curvePoints = getCurvedArcPoints(o, d);
    const polyline = L.polyline(curvePoints, {
      color: strokeColor,
      weight: weight,
      opacity: opacity,
      smoothFactor: 1
    });

    let extraInfoHtml = '';
    if (currentDatasetMode === 'gta') {
      const topAircraft = Object.entries(l.aircraft_breakdown || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'N/A';
      const topCat = Object.entries(l.category_breakdown || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'N/A';
      extraInfoHtml = `
        <div class="tooltip-row"><span>Top Aircraft:</span> <strong>${topAircraft}</strong></div>
        <div class="tooltip-row"><span>Primary Category:</span> <strong>${topCat}</strong></div>
      `;
    } else {
      extraInfoHtml = `
        <div class="tooltip-row"><span>Avg Miles:</span> <strong>${l.avg_miles} mi</strong></div>
        <div class="tooltip-row"><span>Avg Weight:</span> <strong>${l.avg_lbs} lbs</strong></div>
        <div class="tooltip-row"><span>Response Rate:</span> <strong>${l.response_rate}%</strong></div>
      `;
    }

    const popupHtml = `
      <div class="route-tooltip">
        <h4><i class="fa-solid fa-route"></i> ${l.lane}</h4>
        <div class="tooltip-row"><span>Total Volume:</span> <strong>${l.count}</strong></div>
        ${extraInfoHtml}
      </div>
    `;

    polyline.bindPopup(popupHtml);
    routeLayersGroup.addLayer(polyline);
  });

  cityNodes.forEach((node, city) => {
    const radius = Math.min(Math.max(Math.sqrt(node.count) * 1.5, 4), 16);
    const circle = L.circleMarker(node.coords, {
      radius: radius,
      fillColor: node.type === 'origin' ? '#38bdf8' : '#f59e0b',
      color: '#ffffff',
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.75
    });

    circle.bindTooltip(`<strong>${city}</strong><br>${node.count} total records`);
    routeLayersGroup.addLayer(circle);
  });
}

function renderCharts(filteredLanes) {
  // Top 10 Corridors Bar Chart
  const top10Lanes = filteredLanes.slice(0, 10);
  const laneLabels = top10Lanes.map(l => l.lane);
  const laneCounts = top10Lanes.map(l => l.count);

  const ctxLanes = document.getElementById('lanesChart').getContext('2d');
  if (lanesChart) lanesChart.destroy();

  lanesChart = new Chart(ctxLanes, {
    type: 'bar',
    data: {
      labels: laneLabels,
      datasets: [{
        label: currentDatasetMode === 'gta' ? 'Flight Count' : 'Bids Count',
        data: laneCounts,
        backgroundColor: currentDatasetMode === 'gta' ? 'rgba(56, 189, 248, 0.7)' : 'rgba(245, 158, 11, 0.7)',
        borderColor: currentDatasetMode === 'gta' ? '#38bdf8' : '#f59e0b',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#38bdf8',
          bodyColor: '#f8fafc',
          borderColor: '#334155',
          borderWidth: 1
        }
      },
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { color: '#f8fafc', font: { size: 11 } } }
      }
    }
  });

  // Secondary Chart: Distribution by Aircraft or State Flow
  const ctxState = document.getElementById('stateFlowChart').getContext('2d');
  if (stateFlowChart) stateFlowChart.destroy();

  if (currentDatasetMode === 'gta') {
    // Aircraft distribution
    const acCounts = {};
    filteredLanes.forEach(l => {
      for (const [ac, count] of Object.entries(l.aircraft_breakdown || {})) {
        acCounts[ac] = (acCounts[ac] || 0) + count;
      }
    });

    const acLabels = Object.keys(acCounts);
    const acValues = Object.values(acCounts);

    stateFlowChart = new Chart(ctxState, {
      type: 'doughnut',
      data: {
        labels: acLabels,
        datasets: [{
          data: acValues,
          backgroundColor: ['#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#f43f5e']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#f8fafc' } }
        }
      }
    });
  } else {
    // State to State Flow
    const stateFlows = {};
    filteredLanes.forEach(l => {
      if (l.origin_state && l.dest_state) {
        const pair = `${l.origin_state} → ${l.dest_state}`;
        stateFlows[pair] = (stateFlows[pair] || 0) + l.count;
      }
    });

    const sortedStateFlows = Object.entries(stateFlows).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const stateLabels = sortedStateFlows.map(s => s[0]);
    const stateCounts = sortedStateFlows.map(s => s[1]);

    stateFlowChart = new Chart(ctxState, {
      type: 'bar',
      data: {
        labels: stateLabels,
        datasets: [{
          label: 'Total Interstate Shipments',
          data: stateCounts,
          backgroundColor: 'rgba(168, 85, 247, 0.7)',
          borderColor: '#a855f7',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#f8fafc' } },
          y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }
}

function renderLeaderboard(lanes = null) {
  const filteredLanes = lanes || getFilteredLanes();
  const tbody = document.getElementById('leaderboard-body');
  const theadRow = document.getElementById('table-header-row');
  tbody.innerHTML = '';

  if (currentDatasetMode === 'gta') {
    theadRow.innerHTML = `
      <th style="width: 60px;">Rank</th>
      <th>Origin Airport</th>
      <th>Destination Airport</th>
      <th>Total Flights</th>
      <th>Top Aircraft</th>
      <th>Top Category</th>
    `;

    filteredLanes.slice(0, 50).forEach((l, idx) => {
      const topAircraft = Object.entries(l.aircraft_breakdown || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'N/A';
      const topCategory = Object.entries(l.category_breakdown || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'N/A';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rank-num">#${idx + 1}</td>
        <td><strong>${l.origin}</strong></td>
        <td><strong>${l.dest}</strong></td>
        <td><span class="vol-pill">${l.count} Flights</span></td>
        <td><span class="badge" style="display:inline-block; border-color:#a855f7; color:#a855f7;">${topAircraft}</span></td>
        <td>${topCategory}</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    theadRow.innerHTML = `
      <th style="width: 60px;">Rank</th>
      <th>Origin Hub</th>
      <th>Destination Hub</th>
      <th>Total Bids</th>
      <th>Avg Miles</th>
      <th>Response Rate</th>
    `;

    filteredLanes.slice(0, 50).forEach((l, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rank-num">#${idx + 1}</td>
        <td><strong>${l.origin}</strong></td>
        <td><strong>${l.dest}</strong></td>
        <td><span class="vol-pill" style="background:rgba(245, 158, 11, 0.2); color:#f59e0b;">${l.count} Bids</span></td>
        <td>${l.avg_miles} mi</td>
        <td>${l.response_rate}%</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
