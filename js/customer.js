const initialExperiences = [];
const rainExperiences = [];
const API_BASE_URL = '/api';
const USE_REMOTE_API = true;
const vibes = ['Solo & Quiet', 'Local Artisans', 'Hidden Food', 'Culture & Heritage', 'Nightlife', 'Nature & Scenic', 'Adventure', 'Photography', 'History', 'Family Friendly', 'Romantic', 'Shopping', 'Spiritual', 'Beach & Coastal', 'Wellness & Relaxation', 'Local Festivals', 'Art & Creativity'];
const budgetLimits = { '$': 500, '$$': 1000, '$$$': 1500 };
const groupSizes = { Solo: 1, Couple: 2, Friends: 4, Family: 4 };
// Preferences captured on traveler-details.html (name/location/hours/budget/vibes), if any.
let travelerDetails = {};
try { travelerDetails = JSON.parse(localStorage.getItem('hgai_traveler') || '{}'); } catch (error) { travelerDetails = {}; }
let loggedInTraveler = null;
try { loggedInTraveler = JSON.parse(localStorage.getItem('hgai_user') || 'null'); } catch (e) {}

const state = {
  user: loggedInTraveler,
  name: travelerDetails.name || loggedInTraveler?.name || '',
  location: travelerDetails.location || 'Ratnagiri, Maharashtra',
  hours: travelerDetails.hours || 2.5,
  budget: travelerDetails.budget || '$$',
  chosenVibes: travelerDetails.vibes && travelerDetails.vibes.length ? travelerDetails.vibes : ['Local Artisans', 'Culture & Heritage'],
  groupSize: Number(travelerDetails.group_size || groupSizes[travelerDetails.groupSize] || 1),
  budgetLimit: Number(travelerDetails.budget_limit || budgetLimits[travelerDetails.budget] || 1000),
  startTime: travelerDetails.start_time || travelerDetails.startTime || '09:00 AM',
  weatherCondition: travelerDetails.weather_condition || travelerDetails.weatherCondition || 'clear',
  rain: (travelerDetails.weather_condition || travelerDetails.weatherCondition) === 'rainy',
  itinerary: [2, 1, 3],
  originalItinerary: [2, 1, 3],
  saved: [],
  currentExperiences: initialExperiences,
  weather: { condition: 'Clear', temperature: 28 },
  itinerarySummary: null,
  userLocation: null,
  myBookings: null
};
const iconNames = { '⌖': 'map-pin', '☂': 'cloud-rain', '☀': 'sun', '♧': 'bell', '◷': 'clock-3', '＋': 'plus', '↗': 'arrow-up-right', '◆': 'gem', '←': 'arrow-left', '⚡': 'zap', '✦': 'sparkles', '×': 'x', '⌄': 'chevron-down', '★': 'star', '✓': 'check', '☰': 'menu' };
const icon = value => `<i data-lucide="${iconNames[value] || value}" aria-hidden="true"></i>`;
const app = document.querySelector('#customer-app');

// Convert the original icon characters to browser Lucide icons after each render.
function initializeIcons(root = document) {
  const icons = iconNames;
  let markup = root.innerHTML;
  Object.entries(icons).forEach(([character, name]) => { markup = markup.replaceAll(character, `<i data-lucide="${name}" aria-hidden="true"></i>`); });
  root.innerHTML = markup;
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
}

async function requestJson(endpoint, fallback, options = {}) {
  if (!USE_REMOTE_API) return fallback;
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.message || `Request failed: ${response.status}`);
    return payload;
  } catch (error) {
    console.error(`HiddenGemsAI API fallback for ${endpoint}`, error);
    showAlert(error.message.startsWith('Request failed') ? 'Unable to reach HiddenGemsAI right now. Please try again.' : error.message);
    return fallback;
  }
}
async function getExperiences() {
  const fallback = state.rain ? rainExperiences : initialExperiences;
  const data = await requestJson(`/experiences?rain=${state.rain}`, { experiences: fallback });
  return data.data?.experiences || fallback;
}
async function getMerchantOffers() {
  const data = await requestJson('/offers', { offers: [] });
  return data.data?.offers || [];
}
async function refreshWeather() {
  const data = await requestJson(`/weather?rain=${state.rain}`, null);
  if (data && data.data?.weather) state.weather = data.data.weather;
}
async function generateRoute() {
  const fallback = { experiences: await getExperiences(), itinerary: state.itinerary };
  const route = await requestJson('/recommendations', fallback, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      time_available_hours: state.hours,
      group_size: state.groupSize,
      budget_limit: state.budgetLimit,
      weather_condition: state.rain ? 'rainy' : state.weatherCondition,
      user_vibes: state.chosenVibes,
      start_time: state.startTime,
      // Legacy payload fields stay available for existing server consumers.
      availableTime: state.hours,
      budget: state.budget,
      vibes: state.chosenVibes,
      weather: state.rain ? 'rain' : state.weatherCondition
    })
  });
  state.currentExperiences = route.data?.recommendations || fallback.experiences;
  state.itinerary = (route.data?.itinerary || state.itinerary)
    .map(item => Number(typeof item === 'object' ? (item.id ?? item.experienceId) : item))
    .filter(Number.isFinite);
  render(state.currentExperiences);
}

function header() {
  const weatherIcon = state.rain ? '☂' : '☀';
  const travelerName = state.name || state.user?.name || 'Explorer';
  return `<nav class="topbar"><a class="brand" href="customer.html"><span class="gem">◆</span><span>HiddenGems<span>AI</span></span></a><div class="context">${icon('⌖')}<span>${state.location}</span><i></i><span>${weatherIcon} ${state.weather.condition} ${state.weather.temperature}°C</span></div><div class="nav-actions"><div class="user-profile-pill"><span>${travelerName}</span><span class="user-role">Traveler</span><button type="button" class="btn-logout" id="logout-button" title="Log out">Log out</button></div><button class="rain-button" id="rain-toggle">☂ <span>${state.rain ? 'Restore original route' : 'Simulate rain / closure'}</span></button><button class="notification" aria-label="Notifications">♧<b></b></button><button class="mobile-menu" aria-label="Menu">☰</button></div></nav>`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function card(item, index) {
  const added = state.itinerary.includes(item.id);
  const name = item.name || item.title || 'Hidden gem';
  const image = Array.isArray(item.images) ? item.images[0] : item.image || item.images || item.image_url;
  const imageUrl = typeof image === 'string' && /^(https?:\/\/|\/)/i.test(image) ? escapeHtml(image) : '';
  const imageMarkup = imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(name)}" data-experience-image>` : '';
  const fallbackVisibility = imageUrl ? 'hidden' : '';
  const fallbackDisplay = imageUrl ? 'none' : 'flex';
  const location = item.location || item.area || item.distance || 'Location unavailable';
  const category = item.category || item.kind || 'Local experience';
  const rawVibes = item.vibes || item.vibe || [];
  const itemVibes = Array.isArray(rawVibes) ? rawVibes : [rawVibes];
  const description = String(item.description || 'A local experience waiting to be discovered.');
  const shortDescription = description.length > 120 ? `${description.slice(0, 117)}...` : description;
  const price = item.cost != null ? `₹${item.cost}` : item.budget || 'Price varies';
  const duration = item.duration || (item.duration_hours ? `${item.duration_hours} hours` : 'Duration varies');
  const offerBadge = (item.merchantOffer && item.merchantOffer > 0) ? `<div style="position:absolute;top:10px;right:10px;background:#ef5a36;color:white;padding:4px 8px;font-weight:bold;border-radius:4px;z-index:2;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.2);">🔥 ${item.merchantOffer}% OFF!</div>` : '';
  return `<article class="experience-card" style="--delay:${index * 70}ms; position:relative;"><div class="card-image">${offerBadge}${imageMarkup}<div class="image-fallback" ${fallbackVisibility} style="position:absolute;inset:0;z-index:1;display:${fallbackDisplay};align-items:center;justify-content:center;background:#f1d9ba;color:#173748;font:700 11px Manrope">Image unavailable</div><div class="auth-badge">★ ${item.verified === true ? 'Verified gem' : '95% authentic'}</div><button class="save" aria-label="Save ${escapeHtml(name)}">＋</button></div><div class="card-body"><p class="category">${escapeHtml(category)}</p><h3>${escapeHtml(name)}</h3><p class="experience-description">${escapeHtml(shortDescription)}</p><div class="meta"><span>⌖ ${escapeHtml(location)}</span><span>◷ ${escapeHtml(duration)}</span><span>${escapeHtml(price)}</span></div><p class="experience-vibes">${itemVibes.map(escapeHtml).join(' · ')}</p><div class="fit"><div><span>AI feasibility</span><b>${item.fit}% fit</b></div><div class="progress"><i style="width:${item.fit}%"></i></div></div><button class="action map-action" data-map-view="${item.id}">View on Map</button><button class="action ${added ? 'added' : ''}" data-add="${item.id}">${added ? '✓ Added to route' : 'Add to itinerary ＋'}</button></div></article>`;
}
function map(experiences) {
  return `<div class="map-panel"><div id="leaflet-map"></div><div class="map-header"><span>⌖ LIVE DISCOVERY MAP · RATNAGIRI</span><button>♧ 186 exploring Ratnagiri</button></div><div class="map-brand">HiddenGems<span>AI</span></div></div>`;
}

// --- Real interactive map (Leaflet + OpenStreetMap tiles, free/open, no API key) ---
let leafletMapInstance = null;
let leafletMarkersGroup = null;
let leafletRouteLine = null;
let leafletUserMarker = null;
const leafletExperienceMarkers = new Map();
const RATNAGIRI_CENTER = [16.9902, 73.3120];

function getCoords(item) {
  const lat = Number(item.latitude ?? item.lat);
  const lng = Number(item.longitude ?? item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Ask the browser for the traveler's real location once at startup. Never invented,
// never re-prompted on every render — cached on state.userLocation (null if denied/unavailable).
function requestUserLocationOnce() {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null);
    const timeout = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      position => { clearTimeout(timeout); resolve({ lat: position.coords.latitude, lng: position.coords.longitude }); },
      () => { clearTimeout(timeout); resolve(null); },
      { maximumAge: 5 * 60 * 1000, timeout: 5500 }
    );
  });
}

function renderLeafletMap(experiences) {
  const container = document.getElementById('leaflet-map');
  if (!container || typeof L === 'undefined') return;

  if (leafletMapInstance) { leafletMapInstance.remove(); leafletMapInstance = null; }

  const map = L.map(container, { zoomControl: false }).setView(RATNAGIRI_CENTER, 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  leafletMarkersGroup = L.layerGroup().addTo(map);
  leafletExperienceMarkers.clear();
  const boundsPoints = [];

  experiences.forEach(item => {
    const coords = getCoords(item);
    if (!coords) return; // never invent a coordinate for an experience that doesn't have one
    const isInItinerary = state.itinerary.includes(item.id);
    const stopNumber = isInItinerary ? state.itinerary.indexOf(item.id) + 1 : '';
    const icon = L.divIcon({
      className: '',
      html: `<div class="hg-marker-pin${isInItinerary ? ' hg-marker-itinerary' : ''}"><span>${stopNumber || (item.pin || '★')}</span></div>`,
      iconSize: [29, 29],
      iconAnchor: [14, 29],
      popupAnchor: [0, -26]
    });
    const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(leafletMarkersGroup);
    leafletExperienceMarkers.set(String(item.id), marker);
    const popupHtml = `<div class="hg-popup"><h4>${escapeHtml(item.name || item.title || 'Hidden gem')}</h4><p>${item.match ?? item.fit ?? '—'}% match · ${escapeHtml(item.category || item.kind || '')}</p><button type="button" class="${isInItinerary ? 'hg-popup-added' : ''}" data-map-add="${item.id}">${isInItinerary ? '✓ In your itinerary' : 'Add to itinerary'}</button></div>`;
    marker.bindPopup(popupHtml);
    boundsPoints.push([coords.lat, coords.lng]);
  });

  // Straight-line route visualization connecting itinerary stops in visit order.
  // (A turn-by-turn routed path would require a hosted directions API; per project
  // guidance to avoid paid/unnecessary external services, this draws a direct sequential line instead.)
  const routeCoords = state.itinerary
    .map(id => experiences.find(item => item.id === id))
    .filter(Boolean)
    .map(getCoords)
    .filter(Boolean)
    .map(c => [c.lat, c.lng]);
  if (routeCoords.length > 1) {
    leafletRouteLine = L.polyline(routeCoords, { color: '#d9367b', weight: 3, dashArray: '2 8' }).addTo(map);
  }

  if (state.userLocation) {
    const userIcon = L.divIcon({ className: '', html: '<div class="hg-marker-user"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
    leafletUserMarker = L.marker([state.userLocation.lat, state.userLocation.lng], { icon: userIcon }).addTo(map).bindPopup('Your current location');
    boundsPoints.push([state.userLocation.lat, state.userLocation.lng]);
  }

  // Fetch and show merchants on the map
  fetch(`${API_BASE_URL}/merchants`).then(res => res.json()).then(data => {
    if (data.success && data.data) {
      data.data.forEach(m => {
        const lat = Number(m.latitude);
        const lng = Number(m.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const icon = L.divIcon({
            className: '',
            html: '<div style="background: var(--brand-pop); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white;">M</div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          const marker = L.marker([lat, lng], { icon }).addTo(leafletMarkersGroup);
          marker.bindPopup(`<div class="hg-popup"><h4>${escapeHtml(m.businessName || m.name)}</h4><p>Local Merchant</p></div>`);
          boundsPoints.push([lat, lng]);
        }
      });
      if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [28, 28] });
      }
    }
  }).catch(e => console.error('Failed to load merchants for map', e));

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [30, 30] });
      } else if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 14);
      }
    }
  }, 50);

  // Event delegation: popup buttons are injected as raw HTML, so wire clicks once on the container.
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-map-add]');
    if (!button || button.classList.contains('hg-popup-added')) return;
    addToItinerary(Number(button.dataset.mapAdd), button);
  });

  leafletMapInstance = map;
}
function focusExperienceOnMap(id) {
  const marker = leafletExperienceMarkers.get(String(id));
  if (!leafletMapInstance || !marker) return showAlert('This experience does not have map coordinates.');
  leafletMapInstance.setView(marker.getLatLng(), Math.max(leafletMapInstance.getZoom(), 15));
  marker.openPopup();
}
function updateItinerary(experiences) {
  const items = state.itinerary.map(id => experiences.find(item => item.id === id) || initialExperiences.find(item => item.id === id)).filter(Boolean);
  const used = items.reduce((total, item) => total + parseInt(item.duration, 10) + parseInt(item.travel, 10), 0);
  const remaining = Math.max(state.hours * 60 - used, 0);
  const totalCost = items.reduce((total, item) => total + (Number(item.cost) || 0), 0);
  return `<aside class="itinerary glass"><div class="itinerary-top"><div><p class="eyebrow">⚡ YOUR MICRO-ITINERARY</p><h2>Afternoon of small wonders</h2></div><button aria-label="Collapse itinerary">⌄</button></div><div class="route-progress"><div><span>${Math.floor(used / 60)} hrs ${used % 60} mins used · ${Math.floor(remaining / 60)} hrs ${remaining % 60} mins left</span><b>of ${state.hours} hrs</b></div><div class="progress"><i style="width:${Math.min(used / (state.hours * 60) * 100, 100)}%"></i></div></div><div class="timeline">${items.map((item, index) => `<div class="timeline-item"><div class="step"><span>${index + 1}</span>${index < items.length - 1 ? '<i></i>' : ''}</div><div><p>${item.duration} · ${item.travel}</p><h3>${item.title || item.name} <button class="remove-stop" data-remove="${item.id}" aria-label="Remove ${item.title || item.name}">×</button></h3><small>${item.kind || item.category}</small></div></div>`).join('')}</div><div class="itinerary-footer"><div><span>Total value</span><b>₹${totalCost}</b></div><button>Book all & save ↗</button></div></aside>`;
}
function calculateFeasibility(experience, preferences) {
  const budgetLevels = { '$': 1, '$$': 2, '$$$': 3 };
  const matchingVibes = experience.vibe.filter(vibe => preferences.chosenVibes.includes(vibe)).length;
  const visitMinutes = parseInt(experience.duration, 10) + parseInt(experience.travel, 10);
  const budgetScore = budgetLevels[experience.budget] <= budgetLevels[preferences.budget] ? 5 : -4;
  const timeScore = visitMinutes <= preferences.hours * 60 ? 4 : -8;
  const weatherScore = preferences.rain ? (experience.weather === 'covered' ? 10 : -18) : 2;
  const venueScore = experience.venueStatus === 'open' ? 3 : -20;
  const offerScore = Math.min(experience.merchantOffer || 0, 20) / 4;
  return Math.max(20, Math.min(99, Math.round(experience.score + matchingVibes * 3 + budgetScore + timeScore + weatherScore + venueScore + offerScore)));
}
function getScoredExperiences(source) {
  const experiences = source || state.currentExperiences || (state.rain ? rainExperiences : initialExperiences);
  return experiences.map(item => {
    const fit = Number.isFinite(item.fit) ? item.fit : calculateFeasibility(item, state);
    return { ...item, fit, match: Math.min(99, fit + 2) };
  }).sort((first, second) => second.fit - first.fit);
}
function render(source) {
  const experiences = getScoredExperiences(source);
  app.innerHTML = `<div class="app-shell"><div class="folk-pattern top-pattern"></div><div class="folk-pattern side-pattern"></div><div class="marigold marigold-one">✿</div><div class="marigold marigold-two">✿</div>${header()}<header class="hero"><div><p class="eyebrow">✦ AI LOCAL CONCIERGE</p><h1>${state.name ? `Hi ${state.name}, your` : 'Your'} time is short.<br><em>Make it unforgettable.</em></h1><p class="subtitle">We find the little places that turn a free afternoon into a story worth keeping.</p><div class="hand-painted-note">Made for happy wandering <span>✦</span></div></div><div class="hero-art" aria-hidden="true"><div class="hero-sun">☼</div><div class="hero-flower f-one">✿</div><div class="hero-flower f-two">❋</div><div class="hero-flower f-three">✽</div><p>Ghoomo<br>Phiro</p></div><button class="generate">✦ Generate my route ↗</button></header><section class="control-bar glass" style="flex-direction: column; align-items: stretch; gap: 16px;"><div style="display: flex; flex-wrap: wrap; gap: 18px; align-items: center; justify-content: center; width: 100%;"><div class="vibe-control"><div class="control-label">Where are you exploring?</div><input id="location" value="${escapeHtml(state.location)}" style="background: #fff4db; color: #173748; border: 1px solid #17374880; padding: 4px 8px; border-radius: 6px; font: inherit; width: 100%;"></div><div class="divider"></div><div class="time-control"><div class="control-label">◷ Available time <b id="hours-value">${state.hours} hrs</b></div><input id="hours" type="range" min="1" max="8" step="0.5" value="${state.hours}"><div class="range-labels"><span>1 hr</span><span>8 hrs</span></div></div><div class="divider"></div><div class="vibe-control"><div class="control-label">Who's exploring?</div><div class="vibe-chips" id="group-size">${Object.keys(groupSizes).map(group => `<button class="${state.groupSize === groupSizes[group] ? 'selected' : ''}" data-group="${group}">${group}</button>`).join('')}</div></div><div class="divider"></div><div class="vibe-control"><div class="control-label">Start time</div><input id="start-time" type="time" value="${state.startTime}" style="background: #fff4db; color: #173748; border: 1px solid #17374880; padding: 4px 8px; border-radius: 6px; font: inherit;"></div><div class="divider"></div><div class="vibe-control"><div class="control-label">Weather</div><div class="vibe-chips" id="weather-choice"><button class="${!state.rain ? 'selected' : ''}" data-weather="clear">Clear</button><button class="${state.rain ? 'selected' : ''}" data-weather="rainy">Rainy</button></div></div><div class="divider"></div><div class="budget-control"><div class="control-label">Your budget</div><div class="budget-buttons">${['$', '$$', '$$$'].map(value => `<button class="${state.budget === value ? 'selected' : ''}" data-budget="${value}">${value}</button>`).join('')}</div></div></div><div style="border-top: 1px dashed #17374844; padding-top: 14px;"><div class="control-label" style="justify-content: center; margin-bottom: 12px; font-size: 11px;">What’s your vibe?</div><div class="vibe-chips" style="justify-content: center;">${vibes.map(vibe => `<button class="${state.chosenVibes.includes(vibe) ? 'selected' : ''}" data-vibe="${vibe}">${state.chosenVibes.includes(vibe) ? '✓ ' : ''}${vibe}</button>`).join('')}</div></div><div class="map-container-top" style="margin-top: 30px; margin-bottom: 10px;">${map(experiences)}</div><main class="content">
<div class="main-column" style="display: flex; flex-direction: column; gap: 2rem;">
<section class="discover" id="local-offers-section" hidden>
  <div class="section-head">
    <div>
      <p class="eyebrow" style="color: var(--brand-pop);">🔥 LOCAL OFFERS</p>
      <h2>Flash deals happening now</h2>
    </div>
  </div>
  <div class="feed-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;" id="live-offers-container">
    <!-- Offers populated via AJAX -->
  </div>
</section>

<section class="discover">
  <div class="section-head">
    <div>
      <p class="eyebrow">CURATED FOR YOU</p>
      <h2>${state.rain ? 'A weather-proof adventure' : 'Your hidden gems nearby'}</h2>
    </div>
    <button class="text-button">See all gems ↗</button>
  </div>
  <div class="cards-grid">${experiences.map(card).join('')}</div>
</section>

<section class="discover" id="local-merchants-section" hidden>
  <div class="section-head">
    <div>
      <p class="eyebrow">LOCAL MERCHANTS</p>
      <h2>Support Ratnagiri's local businesses</h2>
    </div>
  </div>
  <div class="feed-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;" id="live-merchants-container">
    <!-- Merchants populated via AJAX -->
  </div>
</section>

<section class="discover" id="my-bookings-section">
  <div class="section-head">
    <div>
      <p class="eyebrow" style="color: var(--brand-pop);">YOUR RESERVATIONS</p>
      <h2>My Bookings</h2>
    </div>
  </div>
  <div id="my-bookings-container">
    <p style="color: var(--text-light); font-style: italic;">Loading your bookings...</p>
  </div>
</section>
</div>
${updateItinerary(experiences)}</main></div>`;
  initializeIcons(app);
  app.querySelectorAll('[data-experience-image]').forEach(image => {
    image.addEventListener('error', () => {
      image.hidden = true;
      const fallback = image.parentElement.querySelector('.image-fallback');
      fallback.hidden = false;
      fallback.style.display = 'flex';
    }, { once: true });
  });
  bindEvents();
  renderLeafletMap(experiences);
  loadMyBookings();
}
// Add selected experience to the itinerary without allowing duplicates or a fourth stop.
async function addToItinerary(id, button) {
  if (button) { button.disabled = true; button.textContent = 'Adding...'; }
  const result = await requestJson('/itinerary', { success: false, message: 'The itinerary could not be updated.' }, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ availableTime: state.hours, experiences: [...state.itinerary, id] })
  });
  if (!result.success) {
    if (button) { button.disabled = false; button.textContent = 'Add to itinerary ＋'; }
    return showAlert(result.message || 'This stop cannot be added to your itinerary.');
  }
  state.itinerary = result.data.itinerary;
  state.itinerarySummary = result.data;
  render(state.currentExperiences);
}
async function removeFromItinerary(id) {
  const result = await requestJson(`/itinerary/${id}`, { success: false, message: 'The itinerary could not be updated.' }, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ availableTime: state.hours, experiences: state.itinerary })
  });
  if (!result.success) return showAlert(result.message || 'This stop could not be removed.');
  state.itinerary = result.data.itinerary;
  state.itinerarySummary = result.data;
  render(state.currentExperiences);
}
async function simulateRain(button) {
  if (button) { button.disabled = true; button.querySelector('span').textContent = 'Simulating rain...'; }
  try {
    state.originalItinerary = [...state.itinerary];
    const weather = await requestJson('/weather/simulate', { success: false }, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ condition: 'rain' }) });
    if (!weather.success) return showAlert('Weather simulation could not be started.');
    state.rain = weather.data.condition === 'rain';
    await refreshWeather();
    await generateRoute();
    showAlert();
  } catch (error) {
    console.error('Unable to simulate rain', error);
    showAlert('Weather simulation could not be started.');
  } finally {
    if (button) { button.disabled = false; button.querySelector('span').textContent = 'Simulate rain / closure'; }
  }
}
async function restoreRoute(button) {
  if (button) { button.disabled = true; button.querySelector('span').textContent = 'Restoring route...'; }
  try {
    document.querySelectorAll('.weather-alert').forEach(alert => alert.remove());
    const weather = await requestJson('/weather/restore', { success: false }, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!weather.success) return showAlert('Weather simulation could not be restored.');
    state.rain = false;
    state.itinerary = [...state.originalItinerary];
    await refreshWeather();
    await generateRoute();
    showAlert();
  } catch (error) {
    console.error('Unable to restore weather', error);
    showAlert('Weather simulation could not be restored.');
  } finally {
    if (button) { button.disabled = false; button.querySelector('span').textContent = 'Restore original route'; }
  }
}
async function bookItinerary(button) {
  if (button) { button.disabled = true; button.textContent = 'Saving route...'; }
  const totalTime = state.itinerarySummary ? state.itinerarySummary.totalTime : Number((state.itinerary.reduce((total, id) => {
    const item = state.currentExperiences.find(experience => experience.id === id);
    return total + (item ? parseInt(item.duration, 10) + parseInt(item.travel, 10) : 0);
  }, 0) / 60).toFixed(2));
  const result = await requestJson('/bookings', null, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experiences: state.itinerary,
      totalTime,
      date: new Date().toISOString().slice(0, 10),
      time: state.startTime,
      numberOfPeople: state.groupSize
    })
  });
  if (button) { button.disabled = false; button.textContent = 'Book all & save ↗'; }
  if (result?.success && result.data?.booking?.bookingId) {
    showAlert(`Booking confirmed — ${result.data.booking.bookingId}`);
    loadMyBookings();
  } else {
    showAlert('Booking could not be saved. Please try again.');
  }
}

function bookingCard(b) {
  const isConfirmed = b.status === 'confirmed';
  const isCancelled = b.status === 'cancelled';
  
  const expNames = (b.experienceNames && b.experienceNames.length)
    ? b.experienceNames.join(', ')
    : (b.experienceName || (b.experienceDetails && b.experienceDetails.length ? b.experienceDetails.map(e => e.name || e.title).join(', ') : 'Experience'));

  const dateStr = b.date || '';
  const timeStr = b.time || '';
  const peopleStr = b.numberOfPeople ? `${b.numberOfPeople} ${b.numberOfPeople === 1 ? 'person' : 'people'}` : '';
  const costStr = b.totalCost != null ? `₹${b.totalCost}` : '';
  const timeHours = b.totalTime != null ? `${b.totalTime} hrs` : '';
  const createdDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '';

  const statusBg = isConfirmed ? '#bce4d5' : isCancelled ? '#f1d9ba' : '#f9b52b';
  const statusColor = isConfirmed ? '#147c89' : isCancelled ? '#517079' : '#173748';
  const statusLabel = (b.status || 'confirmed').toUpperCase();

  return `
    <article class="glass" style="padding: 1.25rem; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between;" data-booking-card="${escapeHtml(b.bookingId)}">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem; gap: 8px;">
          <div>
            <p style="margin: 0; font: 700 10px 'DM Mono'; color: #d9367b; letter-spacing: 0.5px;">RESERVATION</p>
            <h3 style="margin: 2px 0 0; font-size: 14px; font-weight: 800; color: #173748;">${escapeHtml(b.bookingId)}</h3>
          </div>
          <span style="background: ${statusBg}; color: ${statusColor}; border: 1.5px solid #173748; border-radius: 6px; padding: 3px 8px; font: 700 9px 'DM Mono';" data-booking-status-badge="${escapeHtml(b.bookingId)}">${statusLabel}</span>
        </div>

        <p style="margin: 0 0 0.6rem; font-weight: 700; font-size: 13px; color: #173748; line-height: 1.3;">
          ${escapeHtml(expNames)}
        </p>

        <div style="display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 11px; color: #517079; margin-bottom: 0.8rem;">
          ${dateStr ? `<span>◷ ${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span>` : ''}
          ${peopleStr ? `<span>👥 ${escapeHtml(peopleStr)}</span>` : ''}
          ${costStr ? `<span style="font-weight: 700; color: #173748;">${escapeHtml(costStr)}</span>` : ''}
          ${timeHours ? `<span>⚡ ${escapeHtml(timeHours)}</span>` : ''}
        </div>

        ${createdDate ? `<p style="margin: 0 0 0.8rem; font-size: 10px; color: #718198;">Booked on ${escapeHtml(createdDate)}</p>` : ''}
      </div>

      <div data-booking-action-wrap="${escapeHtml(b.bookingId)}">
        ${isConfirmed ? `
          <button type="button" class="action" onclick="handleCancelBooking('${escapeHtml(b.bookingId)}', this)" style="background: #fff4db; border-color: #ef5a36; color: #ef5a36; font-weight: 700; width: 100%; cursor: pointer;">
            Cancel Booking
          </button>
        ` : isCancelled ? `
          <span style="display: block; text-align: center; padding: 6px; font-size: 11px; color: #718198; font-style: italic;">
            Booking Cancelled
          </span>
        ` : ''}
      </div>
    </article>
  `;
}

function renderMyBookingsContainer(bookings) {
  const container = document.getElementById('my-bookings-container');
  if (!container) return;

  if (!bookings || bookings.length === 0) {
    container.innerHTML = `
      <div class="glass" style="padding: 1.5rem; text-align: center; border-radius: 8px; color: #517079;">
        <p style="margin: 0; font-weight: 600;">No active bookings yet.</p>
        <p style="margin: 0.4rem 0 0; font-size: 11px;">Select experiences above and click "Book all & save" to create your first reservation!</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
      ${bookings.map(bookingCard).join('')}
    </div>`;
  
  initializeIcons(container);
}

async function loadMyBookings() {
  const container = document.getElementById('my-bookings-container');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE_URL}/bookings/my`);
    
    if (response.status === 401) {
      container.innerHTML = `
        <div class="glass" style="padding: 1.5rem; text-align: center; border-radius: 8px;">
          <p style="margin: 0; color: #ef5a36; font-weight: bold;">Session expired. Please log in again to view your bookings.</p>
        </div>`;
      return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to fetch bookings (${response.status})`);
    }

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.message || 'Could not load bookings.');
    }

    const bookings = payload.data?.bookings || [];
    state.myBookings = bookings;
    renderMyBookingsContainer(bookings);
  } catch (error) {
    console.error('loadMyBookings error:', error);
    if (container) {
      container.innerHTML = `
        <div class="glass" style="padding: 1.5rem; text-align: center; border-radius: 8px;">
          <p style="margin: 0; color: #ef5a36; font-weight: bold;">${escapeHtml(error.message || 'Unable to load bookings right now.')}</p>
          <button type="button" class="action" onclick="loadMyBookings()" style="width: auto; margin: 0.8rem auto 0; padding: 6px 16px;">Try Again</button>
        </div>`;
    }
  }
}

async function handleCancelBooking(bookingId, button) {
  if (!bookingId) return;
  
  const confirmed = window.confirm(`Are you sure you want to cancel booking ${bookingId}?`);
  if (!confirmed) return;

  if (button) {
    button.disabled = true;
    button.textContent = 'Cancelling...';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const payload = await response.json().catch(() => ({}));

    if (response.ok && payload.success) {
      showAlert(payload.message || `Booking ${bookingId} cancelled successfully.`);
      
      const badge = document.querySelector(`[data-booking-status-badge="${escapeHtml(bookingId)}"]`);
      if (badge) {
        badge.textContent = 'CANCELLED';
        badge.style.background = '#f1d9ba';
        badge.style.color = '#517079';
      }

      const actionWrap = document.querySelector(`[data-booking-action-wrap="${escapeHtml(bookingId)}"]`);
      if (actionWrap) {
        actionWrap.innerHTML = '<span style="display: block; text-align: center; padding: 6px; font-size: 11px; color: #718198; font-style: italic;">Booking Cancelled</span>';
      }

      if (Array.isArray(state.myBookings)) {
        const item = state.myBookings.find(b => b.bookingId === bookingId);
        if (item) item.status = 'cancelled';
      }
    } else if (response.status === 401) {
      showAlert(payload.message || 'Session expired. Please log in again.');
      setTimeout(() => {
        window.location.href = 'login.html?redirect=customer.html&role=traveler';
      }, 1500);
    } else {
      if (button) {
        button.disabled = false;
        button.textContent = 'Cancel Booking';
      }
      showAlert(payload.message || `Could not cancel booking (${response.status}).`);
    }
  } catch (error) {
    console.error('handleCancelBooking error:', error);
    if (button) {
      button.disabled = false;
      button.textContent = 'Cancel Booking';
    }
    showAlert(error.message || 'Network error while cancelling booking.');
  }
}

window.loadMyBookings = loadMyBookings;
window.handleCancelBooking = handleCancelBooking;
function bindEvents() {
  document.querySelector('#rain-toggle').onclick = event => state.rain ? restoreRoute(event.currentTarget) : simulateRain(event.currentTarget);
  document.querySelector('.generate').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Generating route...';
    try {
      await generateRoute();
      showAlert('Route refreshed from your current time, budget, and vibe selections.');
    } catch (error) {
      console.error('Unable to generate route', error);
      showAlert('The route could not be generated. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = '✦ Generate my route ↗';
    }
  };
  document.querySelector('#hours').oninput = event => {
    state.hours = Number(event.target.value);
    const experiences = state.currentExperiences;
    const items = state.itinerary.map(id => experiences.find(item => item.id === id) || initialExperiences.find(item => item.id === id)).filter(Boolean);
    const used = items.reduce((total, item) => total + parseInt(item.duration, 10) + parseInt(item.travel, 10), 0);
    const capacity = state.hours * 60;
    document.querySelector('#hours-value').textContent = `${state.hours} hrs`;
    const remaining = Math.max(capacity - used, 0);
    document.querySelector('.route-progress span').textContent = `${Math.floor(used / 60)} hrs ${used % 60} mins used · ${Math.floor(remaining / 60)} hrs ${remaining % 60} mins left`;
    document.querySelector('.route-progress b').textContent = `of ${state.hours} hrs`;
    document.querySelector('.route-progress .progress i').style.width = `${Math.min(used / capacity * 100, 100)}%`;
  };
  document.querySelector('#location').onchange = event => { state.location = event.target.value; render(); };
  document.querySelector('#start-time').onchange = event => { state.startTime = event.target.value; render(); };
  document.querySelectorAll('[data-group]').forEach(button => button.onclick = () => { state.groupSize = groupSizes[button.dataset.group]; render(); });
  document.querySelectorAll('[data-weather]').forEach(button => button.onclick = () => { state.rain = button.dataset.weather === 'rainy'; render(); });
  document.querySelectorAll('[data-budget]').forEach(button => button.onclick = () => { state.budget = button.dataset.budget; state.budgetLimit = budgetLimits[button.dataset.budget]; render(); });
  document.querySelectorAll('[data-vibe]').forEach(button => button.onclick = () => { state.chosenVibes = state.chosenVibes.includes(button.dataset.vibe) ? state.chosenVibes.filter(vibe => vibe !== button.dataset.vibe) : [...state.chosenVibes, button.dataset.vibe]; render(); });
  document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => addToItinerary(Number(button.dataset.add), button));
  document.querySelectorAll('[data-map-view]').forEach(button => button.onclick = () => focusExperienceOnMap(button.dataset.mapView));
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => removeFromItinerary(Number(button.dataset.remove)));
  document.querySelectorAll('.save').forEach((button, index) => button.onclick = () => {
    const experience = state.currentExperiences[index];
    if (!experience) return;
    const saved = state.saved.includes(experience.id);
    state.saved = saved ? state.saved.filter(id => id !== experience.id) : [...state.saved, experience.id];
    showAlert(saved ? `${experience.title} removed from saved gems.` : `${experience.title} saved for later.`);
  });
  const bookButton = document.querySelector('.itinerary-footer button');
  bookButton.onclick = event => bookItinerary(event.currentTarget);
  const logoutBtn = document.querySelector('#logout-button');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Logging out...';
      try { await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' }); } catch (e) {}
      localStorage.removeItem('hgai_user');
      window.location.href = 'login.html';
    };
  }
  document.querySelector('.notification').onclick = () => showAlert('You are all caught up — nearby Ratnagiri updates will appear here.');
  document.querySelector('.mobile-menu').onclick = () => showAlert('Ratnagiri traveler console active.');
  document.querySelector('.map-header button').onclick = () => showAlert('186 explorers are discovering Ratnagiri coastal gems right now.');
  document.querySelector('.text-button').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Loading gems...';
    try {
      await generateRoute();
      showAlert('Showing the gems best matched to your current preferences.');
    } catch (error) {
      console.error('Unable to load all gems', error);
      showAlert('The gems could not be loaded. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = 'See all gems ↗';
    }
  };
  document.querySelector('.itinerary-top button').onclick = event => {
    const timeline = document.querySelector('.timeline');
    timeline.hidden = !timeline.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!timeline.hidden));
  };
  window.addEventListener('resize', () => {
    if (leafletMapInstance) {
      leafletMapInstance.invalidateSize();
    }
  });
}
function showAlert(message) { document.querySelectorAll('.weather-alert').forEach(alert => alert.remove()); const alert = document.createElement('div'); alert.className = 'weather-alert'; const title = message || (state.rain ? 'Weather alert: Rain expected in 15 mins' : 'Route restored: Clear skies ahead'); const detail = message ? 'Your itinerary and recommendations stay synced with your current selections.' : (state.rain ? 'AI is replacing your outdoor walk with a nearby covered artisan market.' : 'Your original outdoor discoveries are back on the route.'); alert.innerHTML = `<div class="alert-icon">☂</div><div><strong>${title}</strong><p>${detail}</p></div><button aria-label="Close">×</button>`; document.body.append(alert); initializeIcons(alert); alert.querySelector('button').onclick = () => alert.remove(); setTimeout(() => alert.remove(), 5000); }
let lastOffersString = '';
let lastMerchantsString = '';

async function loadLiveData() {
  try {
    const [offersRes, merchantsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/offers/active`),
      fetch(`${API_BASE_URL}/merchants`)
    ]);
    
    if (offersRes.ok) {
      const data = await offersRes.json();
      const offers = data.data?.offers || [];
      const newOffersString = JSON.stringify(offers);
      
      if (lastOffersString && newOffersString !== lastOffersString && offers.length > 0) {
        // Assume the first one or a new one was added (just take the newest by creation)
        const newest = offers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        if (newest && new Date(newest.createdAt).getTime() > Date.now() - 30000) {
          showToast(`🔥 New local offer available! ${newest.discount}% OFF at ${newest.merchant?.businessName || newest.merchant?.name || 'a local business'}`);
        }
      }
      
      if (newOffersString !== lastOffersString) {
        lastOffersString = newOffersString;
        renderOffers(offers);
        // Refresh the main recommendations to apply the new discount badges immediately
        generateRoute();
      }
    }
    
    if (merchantsRes.ok) {
      const data = await merchantsRes.json();
      const merchants = data.data || [];
      const newMerchantsString = JSON.stringify(merchants);
      
      if (lastMerchantsString && newMerchantsString !== lastMerchantsString && merchants.length > 0) {
        const newest = merchants.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        // If created recently
        if (newest) showToast(`📍 New local experience provider added: ${newest.businessName || newest.name}!`);
      }
      
      if (newMerchantsString !== lastMerchantsString) {
        lastMerchantsString = newMerchantsString;
        renderMerchants(merchants);
      }
    }
  } catch (err) {
    console.error('Live polling failed', err);
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 20px; left: 20px; background: var(--bg-card); color: var(--text-dark); padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; border-left: 4px solid var(--brand-pop); font-weight: 600; animation: slideUp 0.3s ease-out;';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function renderOffers(offers) {
  const section = document.getElementById('local-offers-section');
  const container = document.getElementById('live-offers-container');
  if (!section || !container) return;
  
  if (offers.length === 0) {
    section.hidden = true;
    return;
  }
  
  section.hidden = false;
  container.innerHTML = offers.map(offer => `
    <article class="glass" style="padding: 1.5rem; border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h3 style="margin: 0; color: var(--brand-pop); font-size: 1.4rem;">🔥 ${offer.discount}% OFF</h3>
        <p style="margin: 0.5rem 0; font-weight: bold;">${offer.experience?.name || 'All Experiences'}</p>
        <p style="margin: 0 0 0.5rem; color: var(--text-light); font-size: 0.9rem;">${offer.merchant?.businessName || offer.merchant?.name}</p>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <span style="background: var(--bg-alt); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">${offer.targetVibe}</span>
          <span style="background: var(--bg-alt); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">Valid for ${offer.duration}</span>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        ${offer.experienceId ? `<button class="action map-action" onclick="focusExperienceOnMap('${offer.experienceId}')" style="flex: 1;">View Map</button>` : ''}
        ${offer.experienceId ? `<button class="action" onclick="addToItinerary('${offer.experienceId}', this)" style="flex: 1;">Add to Route</button>` : ''}
      </div>
    </article>
  `).join('');
}

function renderMerchants(merchants) {
  const section = document.getElementById('local-merchants-section');
  const container = document.getElementById('live-merchants-container');
  if (!section || !container) return;

  if (merchants.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  container.innerHTML = merchants.map(m => {
    const merchantId = Number(m.id);
    const merchantName = m.businessName || m.name || 'Local Merchant';
    const initial = escapeHtml(merchantName.charAt(0).toUpperCase());
    return `
      <article class="glass" style="padding: 1.5rem; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--brand-pop); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
            ${initial}
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.2rem;">${escapeHtml(merchantName)}</h3>
            <p style="margin: 0; color: var(--text-light); font-size: 0.9rem;">${escapeHtml(m.name || '')}</p>
          </div>
        </div>
        <p style="margin: 0 0 1rem; font-size: 0.9rem;">⌖ ${escapeHtml(m.address || 'Ratnagiri')}</p>
        <button class="action" style="width: 100%;" data-view-merchant="${Number.isInteger(merchantId) ? merchantId : ''}" ${Number.isInteger(merchantId) ? '' : 'disabled'}>
          View Experiences
        </button>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-view-merchant]').forEach(button => {
    button.addEventListener('click', () => openMerchantExperiences(Number(button.dataset.viewMerchant), button));
  });
}

async function openMerchantExperiences(merchantId, button) {
  if (!Number.isInteger(merchantId)) return showAlert('This merchant does not have a valid profile yet.');
  if (button) { button.disabled = true; button.textContent = 'Loading...'; }

  try {
    const response = await fetch(`${API_BASE_URL}/merchants/${encodeURIComponent(merchantId)}/experiences`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load merchant experiences.');

    const merchantExperiences = payload.data?.experiences || [];
    const existing = document.getElementById('merchant-experience-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'merchant-experience-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(23,55,72,.72);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="merchant-experience-title" class="glass" style="width:min(900px,100%);max-height:90vh;overflow:auto;padding:1.5rem;border:2px solid var(--border);border-radius:16px;background:var(--bg-card);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem;">
          <div>
            <p class="eyebrow" style="color:var(--brand-pop);">LOCAL MERCHANT</p>
            <h2 id="merchant-experience-title" style="margin:0;">Merchant Experiences</h2>
          </div>
          <button type="button" id="close-merchant-experience-modal" aria-label="Close" style="border:2px solid var(--border);background:#fff;border-radius:8px;padding:6px 10px;font-weight:800;cursor:pointer;">×</button>
        </div>
        ${merchantExperiences.length ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;">
            ${merchantExperiences.map(item => {
              const image = Array.isArray(item.images) ? item.images[0] : item.image;
              const imageUrl = typeof image === 'string' && /^(https?:\/\/|\/)/i.test(image) ? escapeHtml(image) : '';
              return `
                <article style="border:1.5px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;">
                  ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(item.name || item.title || 'Experience')}" style="width:100%;height:150px;object-fit:cover;" loading="lazy">` : `<div style="height:150px;background:#f1d9ba;display:flex;align-items:center;justify-content:center;font-weight:800;color:#173748;">Hidden gem</div>`}
                  <div style="padding:1rem;">
                    <p class="category">${escapeHtml(item.category || 'Local experience')}</p>
                    <h3 style="margin:.2rem 0 .5rem;">${escapeHtml(item.name || item.title || 'Experience')}</h3>
                    <p style="font-size:.9rem;color:var(--text-light);margin:.4rem 0 .8rem;">${escapeHtml(item.description || 'A local experience worth discovering.')}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:.8rem;color:var(--text-light);">
                      <span>⌖ ${escapeHtml(item.location || 'Ratnagiri')}</span>
                      <span>◷ ${escapeHtml(item.duration || 'Flexible')}</span>
                      <span>${item.cost != null ? `₹${escapeHtml(item.cost)}` : 'Price varies'}</span>
                    </div>
                    <button type="button" class="action" data-merchant-modal-add="${Number(item.id)}" style="width:100%;margin-top:.8rem;">Add to itinerary ＋</button>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        ` : `<div style="padding:2rem;text-align:center;color:var(--text-light);">This merchant has no published experiences yet.</div>`}
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#close-merchant-experience-modal').addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    modal.querySelectorAll('[data-merchant-modal-add]').forEach(addButton => {
      addButton.addEventListener('click', async () => {
        await addToItinerary(Number(addButton.dataset.merchantModalAdd), addButton);
        close();
      });
    });
  } catch (error) {
    console.error('openMerchantExperiences error:', error);
    showAlert(error.message || 'Unable to load this merchant right now.');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'View Experiences'; }
  }
}

window.openMerchantExperiences = openMerchantExperiences;

function startLivePolling() {
  loadLiveData();
  setInterval(loadLiveData, 5000);
}

async function initializeCustomer() {
  try {
    const authRes = await fetch(`${API_BASE_URL}/auth/me`);
    if (!authRes.ok) {
      window.location.href = 'login.html?redirect=customer.html&role=traveler';
      return;
    }
    const authData = await authRes.json();
    if (!authData.success || !authData.data?.user || authData.data.user.role !== 'traveler') {
      window.location.href = 'login.html?redirect=customer.html&role=traveler';
      return;
    }
    state.user = authData.data.user;
    if (!state.name && state.user.name) {
      state.name = state.user.name;
    }
    localStorage.setItem('hgai_user', JSON.stringify(state.user));
  } catch (e) {
    console.error('Traveler auth verification error:', e);
    window.location.href = 'login.html?redirect=customer.html&role=traveler';
    return;
  }

  const health = await requestJson('/health', null);
  if (!health || !health.success) showAlert('The backend is unavailable. Showing the last available recommendations.');
  state.userLocation = await requestUserLocationOnce();
  await refreshWeather();
  await generateRoute();
  
  // Start the live polling after initial render
  startLivePolling();
}
initializeCustomer();


// --- Nugen Chatbot Widget Integration ---
function initChatWidget() {
  const widgetHtml = `
    <div id="hg-chat-widget">
      <div id="hg-chat-window">
        <div class="chat-header">
          <div><span style="color:#f9b52b;">?</span> AI Concierge</div>
          <button id="hg-chat-close">?</button>
        </div>
        <div id="hg-chat-messages">
          <div class="chat-msg bot">Namaskar! I am your local Ratnagiri concierge. How can I help you discover hidden gems today?</div>
        </div>
        <div class="typing-indicator" id="hg-chat-typing">Concierge is typing...</div>
        <form class="chat-input-area" id="hg-chat-form">
          <input type="text" id="hg-chat-input" placeholder="Ask about Ratnagiri..." autocomplete="off" required>
          <button type="submit" id="hg-chat-send">Send</button>
        </form>
      </div>
      <button id="hg-chat-toggle" title="Chat with AI Concierge">?</button>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", widgetHtml);

  const toggleBtn = document.getElementById("hg-chat-toggle");
  const closeBtn = document.getElementById("hg-chat-close");
  const chatWindow = document.getElementById("hg-chat-window");
  const chatForm = document.getElementById("hg-chat-form");
  const chatInput = document.getElementById("hg-chat-input");
  const chatMessages = document.getElementById("hg-chat-messages");
  const typingIndicator = document.getElementById("hg-chat-typing");

  toggleBtn.addEventListener("click", () => {
    chatWindow.style.display = chatWindow.style.display === "flex" ? "none" : "flex";
    if (chatWindow.style.display === "flex") chatInput.focus();
  });

  closeBtn.addEventListener("click", () => chatWindow.style.display = "none");

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;
    
    // Add User Message
    chatMessages.insertAdjacentHTML("beforeend", `<div class="chat-msg user">${escapeHtml(msg)}</div>`);
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Show typing
    typingIndicator.style.display = "block";
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await requestJson("/chat", { success: false, message: "Chat failed" }, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context: state.itinerary })
      });
      
      typingIndicator.style.display = "none";
      if (res.success && res.data && res.data.reply) {
        chatMessages.insertAdjacentHTML("beforeend", `<div class="chat-msg bot">${escapeHtml(res.data.reply)}</div>`);
      } else {
        chatMessages.insertAdjacentHTML("beforeend", `<div class="chat-msg bot" style="background:#ef5a36;color:#fff;">Sorry, I am having trouble connecting to Nugen right now.</div>`);
      }
    } catch (err) {
      typingIndicator.style.display = "none";
      chatMessages.insertAdjacentHTML("beforeend", `<div class="chat-msg bot" style="background:#ef5a36;color:#fff;">Network error. Please try again later.</div>`);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// Initialize chat widget once on load
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("hg-chat-widget")) {
    initChatWidget();
  }
});

