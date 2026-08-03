let globalData = null;
let map = null;
let routeLayersGroup = null;
let lanesChart = null;
let stateFlowChart = null;
let currentTab = 'city'; // 'city' or 'state'

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadData();
  setupEventListeners();
});

function initMap() {
  map = L.map('map', {
    center: [38.5, -96.0],
    zoom: 4.5,
    zoomControl: true,
  });

  // Dark Matter Carto Tile Layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  routeLayersGroup = L.layerGroup().addTo(map);
}

async function loadData() {
  try {
    const resp = await fetch('route_data.json');
    globalData = await resp.json();
    
    populateStateDropdowns();
    updateDashboard();
  } catch (err) {
    console.error('Error loading route_data.json:', err);
  }
}

function populateStateDropdowns() {
  const originStates = new Set();
  const destStates = new Set();

  globalData.top_lanes.forEach(l => {
    if (l.origin_state) originStates.add(l.origin_state);
    if (l.dest_state) destStates.add(l.dest_state);
  });

  const origSelect = document.getElementById('filter-origin-state');
  const destSelect = document.getElementById('filter-dest-state');

  Array.from(originStates).sort().forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    origSelect.appendChild(opt);
  });

  Array.from(destStates).sort().forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    destSelect.appendChild(opt);
  });
}

function setupEventListeners() {
  document.getElementById('filter-search').addEventListener('input', updateDashboard);
  document.getElementById('filter-origin-state').addEventListener('change', updateDashboard);
  document.getElementById('filter-dest-state').addEventListener('change', updateDashboard);
  
  const minVolSlider = document.getElementById('filter-min-volume');
  minVolSlider.addEventListener('input', (e) => {
    document.getElementById('range-val-text').textContent = `≥ ${e.target.value} Bids`;
    updateDashboard();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-origin-state').value = '';
    document.getElementById('filter-dest-state').value = '';
    document.getElementById('filter-min-volume').value = 5;
    document.getElementById('range-val-text').textContent = '≥ 5 Bids';
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
  const origState = document.getElementById('filter-origin-state').value;
  const destState = document.getElementById('filter-dest-state').value;
  const minVol = parseInt(document.getElementById('filter-min-volume').value, 10) || 1;

  return globalData.top_lanes.filter(l => {
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
  const totalBids = filteredLanes.reduce((sum, l) => sum + l.count, 0);
  const totalLanesCount = filteredLanes.length;

  document.getElementById('kpi-shipments').textContent = totalBids.toLocaleString();
  document.getElementById('kpi-lanes').textContent = totalLanesCount.toLocaleString();

  if (filteredLanes.length > 0) {
    const top = filteredLanes[0];
    document.getElementById('kpi-busiest').textContent = `${top.origin.split(',')[0]} → ${top.dest.split(',')[0]}`;
  } else {
    document.getElementById('kpi-busiest').textContent = 'N/A';
  }

  // Calculate top origin hub from filtered
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

  document.getElementById('kpi-origin').textContent = topOrig !== 'N/A' ? `${topOrig} (${maxOrigCount})` : 'N/A';
  document.getElementById('map-visible-lanes').textContent = `Displaying ${filteredLanes.length} Corridors`;
}

// Generate Curved Arc Path Points between two coordinates
function getCurvedArcPoints(start, end, numPoints = 30) {
  const lat1 = start[0], lon1 = start[1];
  const lat2 = end[0], lon2 = end[1];

  // Calculate midpoint offset for curve height
  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;

  // Add offset perpendicular to direction
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  // Normal offset multiplier based on distance
  const dist = Math.sqrt(dLat * dLat + dLon * dLon);
  const offset = dist * 0.15;

  // Control point
  const ctrlLat = midLat + offset * (dLon / (dist || 1));
  const ctrlLon = midLon - offset * (dLat / (dist || 1));

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Quadratic Bezier Formula
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * ctrlLon + t * t * lon2;
    points.push([lat, lon]);
  }
  return points;
}

function renderMapRoutes(filteredLanes) {
  routeLayersGroup.clearLayers();

  const cityNodes = new Map();

  // Show top 100 lanes on map for performance & visual clarity
  const lanesToPlot = filteredLanes.slice(0, 150);

  lanesToPlot.forEach(l => {
    const o = l.origin_coords;
    const d = l.dest_coords;
    if (!o || !d) return;

    // Track city node counts
    cityNodes.set(l.origin, { coords: o, count: (cityNodes.get(l.origin)?.count || 0) + l.count, type: 'origin' });
    cityNodes.set(l.dest, { coords: d, count: (cityNodes.get(l.dest)?.count || 0) + l.count, type: 'dest' });

    // Arc styling based on shipment count
    let strokeColor = '#38bdf8'; // Cyan
    let weight = Math.min(Math.max(l.count / 15, 2), 8);
    let opacity = Math.min(Math.max(l.count / 100, 0.4), 0.85);

    if (l.count > 100) {
      strokeColor = '#38bdf8'; // Glowing Cyan
    } else if (l.count > 30) {
      strokeColor = '#a855f7'; // Neon Purple
    } else {
      strokeColor = '#64748b'; // Muted Slate
    }

    const curvePoints = getCurvedArcPoints(o, d);
    const polyline = L.polyline(curvePoints, {
      color: strokeColor,
      weight: weight,
      opacity: opacity,
      smoothFactor: 1
    });

    const popupHtml = `
      <div class="route-tooltip">
        <h4><i class="fa-solid fa-route"></i> ${l.lane}</h4>
        <div class="tooltip-row"><span>Total Bids/Shipments:</span> <strong>${l.count}</strong></div>
        <div class="tooltip-row"><span>Average Mileage:</span> <strong>${l.avg_miles} mi</strong></div>
        <div class="tooltip-row"><span>Average Weight:</span> <strong>${l.avg_lbs} lbs</strong></div>
        <div class="tooltip-row"><span>Carrier Response Rate:</span> <strong>${l.response_rate}%</strong></div>
        <div class="tooltip-row"><span>Award Rate:</span> <strong>${l.award_rate}%</strong></div>
      </div>
    `;

    polyline.bindPopup(popupHtml);
    routeLayersGroup.addLayer(polyline);
  });

  // Plot City Nodes
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

    circle.bindTooltip(`<strong>${city}</strong><br>${node.count} total shipments`);
    routeLayersGroup.addLayer(circle);
  });
}

function renderCharts(filteredLanes) {
  // Top 10 Lanes Chart
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
        label: 'Shipments / Bids Count',
        data: laneCounts,
        backgroundColor: 'rgba(56, 189, 248, 0.7)',
        borderColor: '#38bdf8',
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
        x: {
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#f8fafc', font: { size: 11 } }
        }
      }
    }
  });

  // Top State to State Flow Chart
  const stateFlows = {};
  filteredLanes.forEach(l => {
    if (l.origin_state && l.dest_state) {
      const pair = `${l.origin_state} → ${l.dest_state}`;
      stateFlows[pair] = (stateFlows[pair] || 0) + l.count;
    }
  });

  const sortedStateFlows = Object.entries(stateFlows)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const stateLabels = sortedStateFlows.map(s => s[0]);
  const stateCounts = sortedStateFlows.map(s => s[1]);

  const ctxState = document.getElementById('stateFlowChart').getContext('2d');
  if (stateFlowChart) stateFlowChart.destroy();

  stateFlowChart = new Chart(ctxState, {
    type: 'bar',
    data: {
      labels: stateLabels,
      datasets: [{
        label: 'Total Interstate Shipments',
        data: stateCounts,
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f59e0b',
          bodyColor: '#f8fafc',
          borderColor: '#334155',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#f8fafc' }
        },
        y: {
          grid: { color: '#334155' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function renderLeaderboard(lanes = null) {
  const filteredLanes = lanes || getFilteredLanes();
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';

  if (currentTab === 'city') {
    const displayLanes = filteredLanes.slice(0, 50);

    displayLanes.forEach((l, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rank-num">#${idx + 1}</td>
        <td><strong>${l.origin}</strong></td>
        <td><strong>${l.dest}</strong></td>
        <td><span class="vol-pill">${l.count} Bids</span></td>
        <td>${l.avg_miles} mi</td>
        <td>${l.avg_lbs.toLocaleString()} lbs</td>
        <td>${l.response_rate}%</td>
        <td>${l.award_rate}%</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    // State to State aggregated ranking
    const stateMap = {};
    filteredLanes.forEach(l => {
      if (l.origin_state && l.dest_state) {
        const pair = `${l.origin_state} → ${l.dest_state}`;
        if (!stateMap[pair]) {
          stateMap[pair] = {
            orig: l.origin_state,
            dest: l.dest_state,
            count: 0,
            totalMiles: 0,
            totalLbs: 0
          };
        }
        stateMap[pair].count += l.count;
        stateMap[pair].totalMiles += l.total_miles;
        stateMap[pair].totalLbs += l.total_lbs;
      }
    });

    const stateList = Object.values(stateMap).sort((a, b) => b.count - a.count).slice(0, 50);

    stateList.forEach((s, idx) => {
      const avgM = Math.round(s.totalMiles / s.count);
      const avgL = Math.round(s.totalLbs / s.count);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="rank-num">#${idx + 1}</td>
        <td><strong>State of ${s.orig}</strong></td>
        <td><strong>State of ${s.dest}</strong></td>
        <td><span class="vol-pill" style="background:rgba(245, 158, 11, 0.2); color:#f59e0b;">${s.count} Bids</span></td>
        <td>${avgM} mi</td>
        <td>${avgL.toLocaleString()} lbs</td>
        <td>-</td>
        <td>-</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
