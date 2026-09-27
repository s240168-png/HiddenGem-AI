const vibes = ['Solo & Quiet', 'Local Artisans', 'Hidden Food', 'Culture & Heritage', 'Nightlife'];
const API_BASE_URL = '/api';
const USE_REMOTE_API = true;

// Current authenticated merchant user
let currentMerchantUser = null;
try { currentMerchantUser = JSON.parse(localStorage.getItem('hgai_user') || '{}'); } catch (e) {}

// Business details captured on merchant-details.html (name/location/category/contact/hours), if any.
let merchantDetails = {};
try { merchantDetails = JSON.parse(localStorage.getItem('hgai_merchant') || '{}'); } catch (error) { merchantDetails = {}; }
const merchantLocation = merchantDetails.location || 'Ratnagiri, Maharashtra';
const merchantCategory = vibes.includes(merchantDetails.category) ? merchantDetails.category : vibes[1];
const merchantName = merchantDetails.businessName || currentMerchantUser.businessName || currentMerchantUser.name || 'Ratnagiri Merchant';

const app = document.querySelector('#merchant-app');
app.innerHTML = `
  <div class="app-shell">
    <div class="folk-pattern top-pattern"></div>
    <div class="folk-pattern side-pattern"></div>
    <div class="marigold marigold-one">✿</div>
    <div class="marigold marigold-two">✿</div>

    <nav class="topbar">
      <a class="brand" href="merchant.html"><span class="gem">◆</span><span>HiddenGems<span>AI</span></span></a>
      <div class="context">⌖ <span>${merchantLocation}</span><i></i><span>☀ Clear 28°C · Ratnagiri</span></div>
      <div class="nav-actions">
        <div class="user-profile-pill" id="merchant-user-pill">
          <span id="merchant-user-name">${merchantName}</span>
          <span class="user-role">Merchant</span>
          <button type="button" class="btn-logout" id="logout-button" title="Log out of merchant account">Log out</button>
        </div>
        <button class="notification" aria-label="Notifications">♧<b></b></button>
        <button class="mobile-menu" aria-label="Menu">☰</button>
      </div>
    </nav>

    <main class="merchant" style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
      <header class="merchant-hero" style="margin-bottom: 2rem; border-bottom: 2px solid var(--border); padding-bottom: 2rem;">
        <p class="eyebrow">⚡ MERCHANT DASHBOARD</p>
        <h1 style="font-size: 2.5rem; color: var(--text-dark);">Welcome back, <em>${merchantName}</em></h1>
        <p style="font-size: 1.1rem; color: var(--text-light);">${merchantLocation} • <a href="merchant-details.html" style="color: var(--brand-pop);">Edit Business Profile</a></p>
      </header>

      <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div class="glass" style="padding: 1.5rem; text-align: center; border-radius: 12px;">
          <h3 style="margin: 0; font-size: 0.9rem; color: var(--text-light); text-transform: uppercase;">Total Experiences</h3>
          <p style="margin: 0.5rem 0 0; font-size: 2.5rem; font-weight: 800; color: var(--brand-dark);" data-analytics="totalExperiences">—</p>
        </div>
        <div class="glass" style="padding: 1.5rem; text-align: center; border-radius: 12px;">
          <h3 style="margin: 0; font-size: 0.9rem; color: var(--text-light); text-transform: uppercase;">Active Offers</h3>
          <p style="margin: 0.5rem 0 0; font-size: 2.5rem; font-weight: 800; color: var(--brand-pop);" data-analytics="activeOffers">—</p>
        </div>
        <div class="glass" style="padding: 1.5rem; text-align: center; border-radius: 12px;">
          <h3 style="margin: 0; font-size: 0.9rem; color: var(--text-light); text-transform: uppercase;">Total Bookings</h3>
          <p style="margin: 0.5rem 0 0; font-size: 2.5rem; font-weight: 800; color: var(--brand-dark);" data-analytics="totalBookings">—</p>
        </div>
        <div class="glass" style="padding: 1.5rem; text-align: center; border-radius: 12px;">
          <h3 style="margin: 0; font-size: 0.9rem; color: var(--text-light); text-transform: uppercase;">Total Discounts Created</h3>
          <p style="margin: 0.5rem 0 0; font-size: 2.5rem; font-weight: 800; color: var(--brand-dark);" data-analytics="discountOffers">—</p>
        </div>
      </section>

      <section class="glass" id="merchant-experiences-section" style="margin-bottom: 2rem; padding: 1.5rem; border-radius: 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          <div>
            <p class="eyebrow" style="color:var(--brand-pop);">YOUR EXPERIENCES</p>
            <h2 style="margin:0;font-size:1.5rem;">Manage your listings</h2>
            <p style="margin:.4rem 0 0;color:var(--text-light);font-size:.9rem;">Create, edit, or remove the experiences attached to your merchant account.</p>
          </div>
          <button type="button" class="action" id="new-experience-button">＋ Add Experience</button>
        </div>
        <div id="merchant-experiences-list">
          <p style="color:var(--text-light);font-style:italic;">Loading your experiences...</p>
        </div>
      </section>

      <section class="merchant-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          <form class="offer-form glass" style="padding: 2rem; border-radius: 16px;">
            <div style="margin-bottom: 1.5rem;">
              <p class="eyebrow" style="color: var(--brand-pop);">MAKE AN OFFER</p>
              <h2 style="margin: 0; font-size: 1.5rem;">Create a flash discount</h2>
            </div>
            
            <label style="display: block; margin-bottom: 1rem;">Experience
              <select name="experienceId" id="offer-experience-select" style="width: 100%; padding: 0.8rem; margin-top: 0.5rem; border: 2px solid var(--border); border-radius: 8px;">
                <option value="">Loading your experiences...</option>
              </select>
            </label>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <label>Discount
                <div class="input-wrap" style="display: flex; align-items: center; background: #fff; border: 2px solid var(--border); border-radius: 8px; overflow: hidden; margin-top: 0.5rem;">
                  <input name="discount" value="20" inputmode="numeric" style="border: none; padding: 0.8rem; width: 100%;">
                  <span style="padding: 0 1rem; background: var(--bg-alt); font-weight: bold;">% OFF</span>
                </div>
              </label>
              <label>Available for
                <select name="duration" style="width: 100%; padding: 0.8rem; margin-top: 0.5rem; border: 2px solid var(--border); border-radius: 8px;">
                  <option>1 hour</option>
                  <option selected>2 hours</option>
                  <option>Until closing</option>
                </select>
              </label>
            </div>
            
            <label style="display: block; margin-bottom: 1rem;">Target vibe
              <select name="vibe" style="width: 100%; padding: 0.8rem; margin-top: 0.5rem; border: 2px solid var(--border); border-radius: 8px;">
                ${vibes.map(vibe => `<option ${vibe === merchantCategory ? 'selected' : ''}>${vibe}</option>`).join('')}
              </select>
            </label>
            
            <button class="broadcast" type="submit" style="width: 100%; padding: 1rem; background: var(--brand-pop); color: black; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; margin-top: 1rem;">⚡ Broadcast Offer</button>
          </form>

          <div class="glass" style="padding: 2rem; border-radius: 16px;">
            <p class="eyebrow">YOUR ACTIVE OFFERS</p>
            <h2 style="margin: 0 0 1rem; font-size: 1.5rem;">Live Discounts</h2>
            <div id="active-offers-list" style="display: flex; flex-direction: column; gap: 1rem;">
              <p style="color: var(--text-light); font-style: italic;">Loading active offers...</p>
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 2rem;">
          <div class="map-panel merchant-map glass" style="border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; height: 100%; min-height: 400px;">
            <div class="map-header" style="padding: 1rem; background: var(--bg-card); border-bottom: 1px solid var(--border); z-index: 10;"><span>⌖ YOUR LOCATIONS · ${merchantLocation}</span></div>
            <div id="merchant-leaflet-map" style="flex: 1; min-height: 300px;"></div>
          </div>
        </div>
      </section>

      <section style="margin-top: 2rem;" class="glass" id="merchant-bookings-section">
        <div style="padding: 1.5rem; border-bottom: 2px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <p class="eyebrow" style="color: var(--brand-pop);">CUSTOMER RESERVATIONS</p>
            <h2 style="margin: 0; font-size: 1.5rem;">Bookings Management</h2>
          </div>
          
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <input type="text" id="merchant-booking-search" placeholder="Search by ID, experience..." style="padding: 0.5rem 0.8rem; border: 2px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: #fff; color: #173748; min-width: 200px;">
            <select id="merchant-booking-filter-status" style="padding: 0.5rem 0.8rem; border: 2px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: #fff; color: #173748; font-weight: bold;">
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div id="merchant-bookings-list" style="padding: 1.5rem;">
          <p style="color: var(--text-light); font-style: italic;">Loading customer bookings...</p>
        </div>
      </section>

      <dialog id="merchant-experience-dialog" style="border:2px solid var(--border);border-radius:16px;padding:0;max-width:760px;width:calc(100% - 32px);background:var(--bg-card);color:var(--text-dark);">
        <form id="merchant-experience-form" method="dialog" style="padding:1.5rem;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;">
            <div>
              <p class="eyebrow" style="color:var(--brand-pop);">MERCHANT LISTING</p>
              <h2 id="merchant-experience-dialog-title" style="margin:0;">Add Experience</h2>
            </div>
            <button type="button" id="close-experience-dialog" aria-label="Close" style="border:2px solid var(--border);background:#fff;border-radius:8px;padding:6px 10px;font-weight:800;cursor:pointer;">×</button>
          </div>
          <input type="hidden" name="id">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-top:1rem;">
            <label>Name*<input required maxlength="120" name="name" class="merchant-input"></label>
            <label>Category*<input required maxlength="80" name="category" class="merchant-input"></label>
            <label>Location*<input required maxlength="180" name="location" class="merchant-input"></label>
            <label>Cost (₹)*<input required min="0" max="1000000" type="number" name="cost" class="merchant-input"></label>
            <label>Duration*<input required maxlength="40" name="duration" placeholder="60 min" class="merchant-input"></label>
            <label>Travel time<input maxlength="40" name="travel" placeholder="15 min" class="merchant-input"></label>
            <label>Max group size*<input required min="1" max="500" type="number" name="max_group_size" value="10" class="merchant-input"></label>
            <label>Vibes*<input required name="vibes" placeholder="Nature & Scenic, Photography" class="merchant-input"></label>
            <label>Weather type<select name="weather_type" class="merchant-input"><option value="all">All weather</option><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option></select></label>
            <label>Venue status<select name="venueStatus" class="merchant-input"><option value="open">Open</option><option value="temporarily_closed">Temporarily closed</option><option value="closed">Closed</option></select></label>
            <label>Latitude<input type="number" step="any" min="-90" max="90" name="latitude" class="merchant-input"></label>
            <label>Longitude<input type="number" step="any" min="-180" max="180" name="longitude" class="merchant-input"></label>
            <label style="grid-column:1/-1;">Image URL<input maxlength="500" name="image" placeholder="https://..." class="merchant-input"></label>
            <label style="grid-column:1/-1;">Description*<textarea required maxlength="2000" rows="4" name="description" class="merchant-input"></textarea></label>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:.75rem;margin-top:1.25rem;">
            <button type="button" id="cancel-experience-dialog" class="action" style="background:#fff;">Cancel</button>
            <button type="submit" id="save-experience-button" class="action">Save Experience</button>
          </div>
        </form>
      </dialog>
    </main>
  </div>
`;


const merchantCrudStyle = document.createElement('style');
merchantCrudStyle.textContent = '#merchant-experience-dialog::backdrop{background:rgba(23,55,72,.72)} #merchant-experience-dialog label{display:flex;flex-direction:column;gap:.35rem;font-weight:700;font-size:.85rem} .merchant-input{width:100%;box-sizing:border-box;padding:.7rem;border:2px solid var(--border);border-radius:8px;background:#fff;color:var(--text-dark);font:inherit}';
document.head.appendChild(merchantCrudStyle);

// Initialize browser Lucide icons after the dashboard markup exists.
function initializeIcons(root = app) {
  const icons = { '⌖': 'map-pin', '☀': 'sun', '←': 'arrow-left', '♧': 'bell', '☰': 'menu', '⚡': 'zap', '◆': 'gem', '✓': 'check' };
  let markup = root.innerHTML;
  Object.entries(icons).forEach(([character, name]) => { markup = markup.replaceAll(character, `<i data-lucide="${name}" aria-hidden="true"></i>`); });
  root.innerHTML = markup;
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
}

function initializeMerchant() {
  initializeIcons();
  setupAuthHandlers();
  const newButton = document.getElementById('new-experience-button');
  if (newButton) newButton.onclick = () => setExperienceDialog();
  const form = document.getElementById('merchant-experience-form');
  if (form) form.addEventListener('submit', saveMerchantExperience);
  document.getElementById('close-experience-dialog')?.addEventListener('click', closeExperienceDialog);
  document.getElementById('cancel-experience-dialog')?.addEventListener('click', closeExperienceDialog);
}

// --- Merchant map: merchant's approximate location + its verified experiences ---
// Same free stack as the traveler map (Leaflet + OpenStreetMap tiles, no API key).
const RATNAGIRI_CENTER = [16.9902, 73.3120];
let merchantMapInstance = null;

function getExperienceCoords(item) {
  const lat = Number(item.latitude ?? item.lat);
  const lng = Number(item.longitude ?? item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Geocode the merchant's free-text location (from merchant-details.html) via the free
// OpenStreetMap Nominatim API - a one-time lookup, no key. Never invented: falls back
// to the fixed Ratnagiri-town center if geocoding fails, times out, or finds nothing.
function geocodeMerchantLocation(locationText) {
  return new Promise(resolve => {
    const query = /india/i.test(locationText) ? locationText : `${locationText}, India`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const timeout = setTimeout(() => resolve(null), 6000);
    fetch(url)
      .then(res => (res.ok ? res.json() : null))
      .then(results => {
        clearTimeout(timeout);
        const first = Array.isArray(results) ? results[0] : null;
        if (first && Number.isFinite(Number(first.lat)) && Number.isFinite(Number(first.lon))) {
          resolve({ lat: Number(first.lat), lng: Number(first.lon) });
        } else {
          resolve(null);
        }
      })
      .catch(() => { clearTimeout(timeout); resolve(null); });
  });
}

async function loadNearbyVerifiedExperiences() {
  try {
    // The merchant endpoint is authenticated and is scoped by the session's
    // merchant id. Do not use the public catalog here: it contains listings
    // belonging to other merchants as well.
    const response = await fetch(`${API_BASE_URL}/merchant/experiences`);
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.message || `Experiences request failed: ${response.status}`);
    return data.data?.experiences || [];
  } catch (error) {
    console.error('Unable to load this merchant\'s experiences for merchant map', error);
    return [];
  }
}

function renderMerchantMap(center, experiences) {
  const container = document.getElementById('merchant-leaflet-map');
  if (!container || typeof L === 'undefined') return;

  if (merchantMapInstance) { merchantMapInstance.remove(); merchantMapInstance = null; }

  const map = L.map(container, { zoomControl: false }).setView(center, 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  const boundsPoints = [center];
  const merchantIcon = L.divIcon({ className: '', html: '<div class="hg-marker-user"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  L.marker(center, { icon: merchantIcon }).addTo(map).bindPopup('Your business (approximate location)');

  experiences.forEach(item => {
    const coords = getExperienceCoords(item);
    if (!coords) return; // never invent a coordinate for an experience that doesn't have one
    const markerIcon = L.divIcon({
      className: '',
      html: `<div class="hg-marker-pin"><span>${item.pin || '★'}</span></div>`,
      iconSize: [29, 29],
      iconAnchor: [14, 29],
      popupAnchor: [0, -26]
    });
    const marker = L.marker([coords.lat, coords.lng], { icon: markerIcon }).addTo(map);
    marker.bindPopup(`<div class="hg-popup"><h4>${item.title}</h4><p>${item.kind || ''} · ${item.budget || ''}</p></div>`);
    boundsPoints.push([coords.lat, coords.lng]);
  });

  if (boundsPoints.length > 1) map.fitBounds(boundsPoints, { padding: [28, 28] });
  merchantMapInstance = map;
}

async function loadMerchantMap() {
  const [center, experiences] = await Promise.all([
    geocodeMerchantLocation(merchantLocation),
    loadNearbyVerifiedExperiences()
  ]);
  renderMerchantMap(center || RATNAGIRI_CENTER, experiences);
}


const merchantExperienceState = { items: [], editingId: null };

function merchantExperienceFormValues(item = {}) {
  return {
    id: item.id ?? '',
    name: item.name || item.title || '',
    category: item.category || '',
    location: item.location || '',
    cost: item.cost ?? 0,
    duration: item.duration || '',
    travel: item.travel || '',
    max_group_size: item.max_group_size ?? 10,
    vibes: Array.isArray(item.vibes || item.vibe) ? (item.vibes || item.vibe).join(', ') : (item.vibes || item.vibe || ''),
    weather_type: item.weather_type || 'all',
    venueStatus: item.venueStatus || 'open',
    latitude: item.latitude ?? '',
    longitude: item.longitude ?? '',
    image: item.image || '',
    description: item.description || ''
  };
}

function setExperienceDialog(item = null) {
  const dialog = document.getElementById('merchant-experience-dialog');
  const form = document.getElementById('merchant-experience-form');
  if (!dialog || !form) return;

  merchantExperienceState.editingId = item?.id ? Number(item.id) : null;
  document.getElementById('merchant-experience-dialog-title').textContent = item ? 'Edit Experience' : 'Add Experience';
  const values = merchantExperienceFormValues(item || {});
  Object.entries(values).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  });
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeExperienceDialog() {
  const dialog = document.getElementById('merchant-experience-dialog');
  if (dialog?.open) dialog.close();
  merchantExperienceState.editingId = null;
}

function renderMerchantExperiencesCrud() {
  const container = document.getElementById('merchant-experiences-list');
  if (!container) return;

  if (!merchantExperienceState.items.length) {
    container.innerHTML = `
      <div style="padding:1.5rem;text-align:center;border:1.5px dashed var(--border);border-radius:12px;color:var(--text-light);">
        <p style="margin:0;font-weight:700;">No experiences yet.</p>
        <p style="margin:.4rem 0 1rem;font-size:.9rem;">Add your first local experience to start receiving bookings.</p>
        <button type="button" class="action" onclick="setExperienceDialog()">＋ Add Experience</button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;">
      ${merchantExperienceState.items.map(item => {
        const status = item.venueStatus || 'open';
        const image = typeof item.image === 'string' && /^(https?:\/\/|\/)/i.test(item.image) ? escapeHtml(item.image) : '';
        return `
          <article style="border:1.5px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;">
            ${image ? `<img src="${image}" alt="${escapeHtml(item.name || item.title)}" style="width:100%;height:150px;object-fit:cover;" loading="lazy">` : `<div style="height:150px;background:#f1d9ba;display:flex;align-items:center;justify-content:center;color:#173748;font-weight:800;">No image</div>`}
            <div style="padding:1rem;">
              <div style="display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start;">
                <div><p class="category">${escapeHtml(item.category || 'Local experience')}</p><h3 style="margin:.2rem 0;">${escapeHtml(item.name || item.title)}</h3></div>
                <span style="font-size:.72rem;font-weight:800;padding:4px 6px;border:1px solid var(--border);border-radius:6px;">${escapeHtml(status)}</span>
              </div>
              <p style="font-size:.86rem;color:var(--text-light);min-height:2.4em;">${escapeHtml(item.description || '')}</p>
              <div style="font-size:.8rem;color:var(--text-light);display:flex;flex-wrap:wrap;gap:8px;"><span>₹${escapeHtml(item.cost ?? 0)}</span><span>${escapeHtml(item.duration || 'Flexible')}</span><span>Max ${escapeHtml(item.max_group_size ?? '—')}</span></div>
              <div style="display:flex;gap:.5rem;margin-top:.9rem;">
                <button type="button" class="action" data-edit-experience="${Number(item.id)}" style="flex:1;">Edit</button>
                <button type="button" class="action" data-delete-experience="${Number(item.id)}" style="flex:1;background:#fff4db;border-color:#ef5a36;color:#ef5a36;">Delete</button>
              </div>
            </div>
          </article>`;
      }).join('')}
    </div>`;

  container.querySelectorAll('[data-edit-experience]').forEach(button => {
    button.addEventListener('click', () => {
      const item = merchantExperienceState.items.find(experience => Number(experience.id) === Number(button.dataset.editExperience));
      if (item) setExperienceDialog(item);
    });
  });
  container.querySelectorAll('[data-delete-experience]').forEach(button => {
    button.addEventListener('click', () => deleteMerchantExperienceUi(Number(button.dataset.deleteExperience)));
  });
}

async function loadMerchantExperiencesCrud() {
  const container = document.getElementById('merchant-experiences-list');
  if (!container) return;
  try {
    const response = await fetch(`${API_BASE_URL}/merchant/experiences`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.message || 'Could not load experiences.');
    merchantExperienceState.items = payload.data?.experiences || [];
    renderMerchantExperiencesCrud();
  } catch (error) {
    console.error('loadMerchantExperiencesCrud error:', error);
    container.innerHTML = `<div style="padding:1rem;color:#ef5a36;border:1.5px solid var(--border);border-radius:10px;">${escapeHtml(error.message || 'Unable to load experiences.')} <button type="button" class="action" onclick="loadMerchantExperiencesCrud()">Try Again</button></div>`;
  }
}

async function saveMerchantExperience(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById('save-experience-button');
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  ['cost', 'max_group_size', 'latitude', 'longitude'].forEach(key => {
    if (payload[key] === '') delete payload[key];
    else if (payload[key] != null) payload[key] = Number(payload[key]);
  });

  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    const id = merchantExperienceState.editingId;
    const url = id ? `${API_BASE_URL}/merchant/experiences/${encodeURIComponent(id)}` : `${API_BASE_URL}/merchant/experiences`;
    const response = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Could not save experience.');

    closeExperienceDialog();
    await loadMerchantExperiencesCrud();
    await loadMerchantData();
    await loadAnalytics();
    await loadMerchantMap();
  } catch (error) {
    console.error('saveMerchantExperience error:', error);
    alert(error.message || 'Could not save experience.');
  } finally {
    button.disabled = false;
    button.textContent = 'Save Experience';
  }
}

async function deleteMerchantExperienceUi(id) {
  const item = merchantExperienceState.items.find(experience => Number(experience.id) === Number(id));
  if (!item) return;
  if (!window.confirm(`Delete "${item.name || item.title}"? This cannot be undone.`)) return;

  try {
    const response = await fetch(`${API_BASE_URL}/merchant/experiences/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Could not delete experience.');
    await loadMerchantExperiencesCrud();
    await loadMerchantData();
    await loadAnalytics();
    await loadMerchantMap();
  } catch (error) {
    console.error('deleteMerchantExperienceUi error:', error);
    alert(error.message || 'Could not delete experience.');
  }
}

window.setExperienceDialog = setExperienceDialog;
window.loadMerchantExperiencesCrud = loadMerchantExperiencesCrud;

async function verifyAuth() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`);
    if (!res.ok) {
      window.location.href = 'login.html?redirect=merchant.html&role=merchant';
      return false;
    }
    const data = await res.json();
    if (!data.success || !data.data?.user || data.data.user.role !== 'merchant') {
      window.location.href = 'login.html?redirect=merchant.html&role=merchant';
      return false;
    }
    currentMerchantUser = data.data.user;
    localStorage.setItem('hgai_user', JSON.stringify(currentMerchantUser));
    const nameEl = document.querySelector('#merchant-user-name');
    if (nameEl) nameEl.textContent = currentMerchantUser.businessName || currentMerchantUser.name || 'Merchant';
    return true;
  } catch (err) {
    console.error('Merchant auth check failed:', err);
    window.location.href = 'login.html?redirect=merchant.html&role=merchant';
    return false;
  }
}

function setupAuthHandlers() {
  const logoutBtn = document.querySelector('#logout-button');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Logging out...';
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
      } catch (e) {}
      localStorage.removeItem('hgai_user');
      window.location.href = 'login.html';
    };
  }
}

window.addEventListener('resize', () => {
  if (typeof merchantMapInstance !== 'undefined' && merchantMapInstance) {
    merchantMapInstance.invalidateSize();
  }
});

initializeMerchant();

async function broadcastOffer(offer) {
  if (!USE_REMOTE_API) return { ...offer, status: 'demo' };
  const response = await fetch(`${API_BASE_URL}/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offer)
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw new Error(payload.message || `Offer request failed: ${response.status}`);
  return payload;
}

async function loadMerchantData() {
  try {
    const response = await fetch(`${API_BASE_URL}/merchant/experiences`);
    const data = await response.json();
    const experiences = data.data?.experiences || [];
    const select = document.getElementById('offer-experience-select');
    if (select) {
      if (experiences.length === 0) {
        select.innerHTML = '<option value="">No experiences found</option>';
      } else {
        select.innerHTML = experiences.map(e => `<option value="${e.id}">${e.name} (${Array.isArray(e.vibes) ? e.vibes.join(', ') : (e.vibes || e.vibe || '')})</option>`).join('');
      }
    }
    return experiences;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function loadActiveOffer() {
  if (!USE_REMOTE_API) return;
  try {
    const response = await fetch(`${API_BASE_URL}/offers/active`);
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.message || `Offer request failed: ${response.status}`);
    
    // Filter to show only this merchant's offers
    const myOffers = (data.data?.offers || []).filter(o => o.merchantId === currentMerchantUser.id);
    const listEl = document.getElementById('active-offers-list');
    
    if (listEl) {
      if (myOffers.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-light); font-style: italic;">No active offers. Broadcast one above!</p>';
      } else {
        listEl.innerHTML = myOffers.map(offer => `
          <div style="border: 1px solid var(--border); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; background: #fff;">
            <div>
              <h4 style="margin: 0; color: var(--brand-pop);">${offer.discount}% OFF</h4>
              <p style="margin: 0.2rem 0 0; font-size: 0.9rem;">${offer.experience?.name || 'All Experiences'} • ${offer.targetVibe}</p>
              <p style="margin: 0; font-size: 0.8rem; color: var(--text-light);">Expires: ${new Date(offer.expiresAt).toLocaleTimeString()}</p>
            </div>
            <button onclick="deleteOffer('${offer.id}')" style="background: none; border: none; color: #ff4444; cursor: pointer; text-decoration: underline;">End</button>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Unable to load active offers', error);
  }
}

async function deleteOffer(id) {
  if (!confirm('Are you sure you want to end this offer?')) return;
  try {
    await fetch(`${API_BASE_URL}/offers/${id}`, { method: 'DELETE' });
    loadActiveOffer();
    loadAnalytics();
  } catch (err) {
    console.error(err);
  }
}

async function loadAnalytics() {
  try {
    const response = await fetch(`${API_BASE_URL}/merchant/analytics`);
    const responseData = await response.json();
    if (!response.ok || responseData.success === false) throw new Error(responseData.message || `Analytics request failed: ${response.status}`);
    const analytics = responseData.data.analytics;
    Object.entries(analytics).forEach(([key, value]) => {
      const metric = document.querySelector(`[data-analytics="${key}"]`);
      if (metric) metric.textContent = key === 'potentialVisitors' ? `${value}%` : value;
    });
  } catch (error) {
    console.error('Unable to load analytics', error);
  }
}

function validateOffer(offer) {
  return Number.isInteger(offer.discount) && offer.discount >= 1 && offer.discount <= 100 && Boolean(offer.duration) && Boolean(offer.targetVibe);
}

const offerForm = document.querySelector('.offer-form');
const discountInput = offerForm.querySelector('[name="discount"]');
discountInput.type = 'number';
discountInput.min = '1';
discountInput.max = '100';
discountInput.required = true;

offerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('.broadcast');
  const formData = new FormData(event.currentTarget);
  const discount = Number(formData.get('discount'));
  const offer = { 
    discount, 
    duration: formData.get('duration'), 
    targetVibe: formData.get('vibe'),
    experienceId: formData.get('experienceId')
  };
  
  if (!validateOffer(offer)) {
    discountInput.setCustomValidity('Enter a discount from 1 to 100 percent.');
    discountInput.reportValidity();
    return;
  }
  discountInput.setCustomValidity('');
  button.disabled = true;
  button.textContent = 'Broadcasting offer...';
  try {
    await broadcastOffer(offer);
    button.classList.add('sent');
    button.textContent = '✓ Broadcast live';
    setTimeout(() => {
      button.classList.remove('sent');
      button.textContent = '⚡ Broadcast Offer';
    }, 3000);
    loadActiveOffer();
    loadAnalytics();
  } catch (error) {
    console.error('Unable to broadcast offer', error);
    button.textContent = 'Try broadcast again';
    alert(error.message || 'Offer could not be broadcast. Please try again.');
  } finally {
    button.disabled = false;
  }
});

document.querySelector('.notification').onclick = () => {
  alert('No new merchant notifications.');
};
document.querySelector('.mobile-menu').onclick = () => {
  alert('Ratnagiri merchant console active.');
};

let merchantBookingsData = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function merchantBookingCard(b) {
  const isConfirmed = b.status === 'confirmed';
  const isCancelled = b.status === 'cancelled';

  const expNames = (b.experienceNames && b.experienceNames.length)
    ? b.experienceNames.join(', ')
    : (b.experienceName || (b.experienceDetails && b.experienceDetails.length ? b.experienceDetails.map(e => e.name || e.title).join(', ') : 'Experience'));

  const dateStr = b.date || '';
  const timeStr = b.time || '';
  const peopleStr = b.numberOfPeople ? `${b.numberOfPeople} ${b.numberOfPeople === 1 ? 'guest' : 'guests'}` : '';
  const costStr = b.totalCost != null ? `₹${b.totalCost}` : '';
  const timeHours = b.totalTime != null ? `${b.totalTime} hrs` : '';
  const createdDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '';
  const travelerId = b.userId ? `Traveler #${b.userId}` : 'Customer';

  const statusBg = isConfirmed ? '#bce4d5' : isCancelled ? '#f1d9ba' : '#f9b52b';
  const statusColor = isConfirmed ? '#147c89' : isCancelled ? '#517079' : '#173748';
  const statusLabel = (b.status || 'confirmed').toUpperCase();

  return `
    <article class="glass" style="padding: 1.25rem; border-radius: 12px; background: #fff; border: 1.5px solid var(--border); display: flex; flex-direction: column; justify-content: space-between;" data-merchant-booking-card="${escapeHtml(b.bookingId)}">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem; gap: 8px;">
          <div>
            <p style="margin: 0; font: 700 10px 'DM Mono'; color: var(--brand-pop); letter-spacing: 0.5px;">RESERVATION • ${escapeHtml(travelerId)}</p>
            <h3 style="margin: 2px 0 0; font-size: 14px; font-weight: 800; color: #173748;">${escapeHtml(b.bookingId)}</h3>
          </div>
          <span style="background: ${statusBg}; color: ${statusColor}; border: 1.5px solid #173748; border-radius: 6px; padding: 3px 8px; font: 700 9px 'DM Mono';" data-merchant-booking-status="${escapeHtml(b.bookingId)}">${statusLabel}</span>
        </div>

        <p style="margin: 0 0 0.6rem; font-weight: 700; font-size: 13px; color: #173748; line-height: 1.3;">
          ${escapeHtml(expNames)}
        </p>

        <div style="display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 11px; color: var(--text-light); margin-bottom: 0.8rem;">
          ${dateStr ? `<span>◷ ${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span>` : ''}
          ${peopleStr ? `<span>👥 ${escapeHtml(peopleStr)}</span>` : ''}
          ${costStr ? `<span style="font-weight: 700; color: #173748;">${escapeHtml(costStr)}</span>` : ''}
          ${timeHours ? `<span>⚡ ${escapeHtml(timeHours)}</span>` : ''}
        </div>

        ${createdDate ? `<p style="margin: 0 0 0.8rem; font-size: 10px; color: #718198;">Booked on ${escapeHtml(createdDate)}</p>` : ''}
      </div>

      <div data-merchant-booking-action-wrap="${escapeHtml(b.bookingId)}">
        ${isConfirmed ? `
          <button type="button" onclick="handleMerchantCancelBooking('${escapeHtml(b.bookingId)}', this)" style="background: #fff4db; border: 1.5px solid #ef5a36; color: #ef5a36; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer; width: 100%;">
            Cancel Booking
          </button>
        ` : isCancelled ? `
          <span style="display: block; text-align: center; padding: 6px; font-size: 11px; color: #718198; font-style: italic;">
            Cancelled
          </span>
        ` : ''}
      </div>
    </article>
  `;
}

function renderMerchantBookingsTable() {
  const container = document.getElementById('merchant-bookings-list');
  if (!container) return;

  const searchInput = document.getElementById('merchant-booking-search');
  const statusSelect = document.getElementById('merchant-booking-filter-status');

  const query = (searchInput?.value || '').trim().toLowerCase();
  const statusFilter = statusSelect?.value || 'all';

  let filtered = [...merchantBookingsData];

  if (statusFilter !== 'all') {
    filtered = filtered.filter(b => (b.status || 'confirmed').toLowerCase() === statusFilter);
  }

  if (query) {
    filtered = filtered.filter(b => {
      const bId = (b.bookingId || '').toLowerCase();
      const uId = (b.userId || '').toString().toLowerCase();
      const expStr = (b.experienceNames ? b.experienceNames.join(' ') : (b.experienceName || '')).toLowerCase();
      const dateStr = (b.date || '').toLowerCase();
      return bId.includes(query) || uId.includes(query) || expStr.includes(query) || dateStr.includes(query);
    });
  }

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; border-radius: 8px; background: #fff4db; border: 1.5px solid var(--border); color: var(--text-light);">
        <p style="margin: 0; font-weight: 600;">${merchantBookingsData.length === 0 ? 'No customer bookings found for your experiences.' : 'No bookings match your filter criteria.'}</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
      ${filtered.map(merchantBookingCard).join('')}
    </div>`;
  
  initializeIcons(container);
}

async function loadMerchantBookings() {
  const container = document.getElementById('merchant-bookings-list');
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE_URL}/bookings/merchant`);

    if (response.status === 401) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; border-radius: 8px; background: #fff4db; border: 1.5px solid var(--border); color: #ef5a36; font-weight: bold;">
          <p style="margin: 0;">Session expired. Please log in again to manage bookings.</p>
        </div>`;
      return;
    }

    if (response.status === 403) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; border-radius: 8px; background: #fff4db; border: 1.5px solid var(--border); color: #ef5a36; font-weight: bold;">
          <p style="margin: 0;">Forbidden: Access denied. Merchant authorization required.</p>
        </div>`;
      return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to fetch merchant bookings (${response.status})`);
    }

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.message || 'Could not load merchant bookings.');
    }

    merchantBookingsData = payload.data?.bookings || [];
    renderMerchantBookingsTable();

    const searchInput = document.getElementById('merchant-booking-search');
    const statusSelect = document.getElementById('merchant-booking-filter-status');

    if (searchInput) {
      searchInput.oninput = () => renderMerchantBookingsTable();
    }
    if (statusSelect) {
      statusSelect.onchange = () => renderMerchantBookingsTable();
    }
  } catch (error) {
    console.error('loadMerchantBookings error:', error);
    if (container) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; border-radius: 8px; background: #fff4db; border: 1.5px solid var(--border); color: #ef5a36;">
          <p style="margin: 0; font-weight: bold;">${escapeHtml(error.message || 'Unable to load merchant bookings right now.')}</p>
          <button type="button" onclick="loadMerchantBookings()" style="margin-top: 0.8rem; padding: 6px 16px; border: 1.5px solid #173748; background: #fff; border-radius: 8px; font-weight: bold; cursor: pointer;">Try Again</button>
        </div>`;
    }
  }
}

async function handleMerchantCancelBooking(bookingId, button) {
  if (!bookingId) return;
  const confirmed = window.confirm(`Are you sure you want to cancel booking ${bookingId}?`);
  if (!confirmed) return;

  if (button) {
    button.disabled = true;
    button.textContent = 'Cancelling...';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const payload = await res.json().catch(() => ({}));

    if (res.ok && payload.success) {
      alert(payload.message || `Booking ${bookingId} cancelled successfully.`);
      if (Array.isArray(merchantBookingsData)) {
        const item = merchantBookingsData.find(b => b.bookingId === bookingId);
        if (item) item.status = 'cancelled';
      }
      renderMerchantBookingsTable();
      loadAnalytics();
    } else if (res.status === 401) {
      alert(payload.message || 'Session expired. Please log in again.');
      window.location.href = 'login.html?redirect=merchant.html&role=merchant';
    } else {
      if (button) {
        button.disabled = false;
        button.textContent = 'Cancel Booking';
      }
      alert(payload.message || `Could not cancel booking (${res.status}).`);
    }
  } catch (err) {
    console.error('handleMerchantCancelBooking error:', err);
    if (button) {
      button.disabled = false;
      button.textContent = 'Cancel Booking';
    }
    alert(err.message || 'Network error while cancelling booking.');
  }
}

window.loadMerchantBookings = loadMerchantBookings;
window.handleMerchantCancelBooking = handleMerchantCancelBooking;

// Verify authentication and load data
verifyAuth().then(authenticated => {
  if (authenticated) {
    loadMerchantData();
    loadMerchantExperiencesCrud();
    loadActiveOffer();
    loadAnalytics();
    loadMerchantMap();
    loadMerchantBookings();
  }
});
