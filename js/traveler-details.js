// Collects a few quick traveler preferences and hands them to customer.js via localStorage.
// Kept intentionally simple: no accounts, no backend call — just a personalization handoff.
const vibes = ['Solo & Quiet', 'Local Artisans', 'Hidden Food', 'Culture & Heritage', 'Nightlife', 'Nature & Scenic', 'Adventure', 'Photography', 'History', 'Family Friendly', 'Romantic', 'Shopping', 'Spiritual', 'Beach & Coastal', 'Wellness & Relaxation', 'Local Festivals', 'Art & Creativity'];
const budgets = ['$', '$$', '$$$'];
const budgetLimits = { '$': 500, '$$': 1000, '$$$': 1500 };
const groupSizes = { Solo: 1, Couple: 2, Friends: 4, Family: 4 };

let saved = {};
try { saved = JSON.parse(localStorage.getItem('hgai_traveler') || '{}'); } catch (error) { saved = {}; }

const form = document.querySelector('#traveler-form');
const hoursInput = document.querySelector('#hours');
const hoursValue = document.querySelector('#hours-value');
const groupWrap = document.querySelector('#group-size');
const budgetWrap = document.querySelector('#budget-buttons');
const vibeWrap = document.querySelector('#vibe-chips');
const weatherWrap = document.querySelector('#weather-choice');
const startTimeInput = document.querySelector('#start-time');

let chosenGroup = saved.groupSize || 'Solo';
let chosenBudget = saved.budget || '$$';
let chosenVibes = saved.vibes && saved.vibes.length ? saved.vibes : ['Local Artisans', 'Culture & Heritage'];
let chosenWeather = saved.weatherCondition || saved.weather_condition || 'clear';

let loggedInUser = {};
try { loggedInUser = JSON.parse(localStorage.getItem('hgai_user') || '{}'); } catch (e) {}

if (saved.name || loggedInUser.name) form.querySelector('[name="name"]').value = saved.name || loggedInUser.name;
if (saved.location) form.querySelector('[name="location"]').value = saved.location;
if (saved.hours) hoursInput.value = saved.hours;
if (saved.startTime || saved.start_time) startTimeInput.value = saved.startTime || saved.start_time;
hoursValue.textContent = `${hoursInput.value} hrs`;

function renderGroup() {
  groupWrap.querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.dataset.group === chosenGroup));
}
function renderBudget() {
  budgetWrap.innerHTML = budgets.map(value => `<button type="button" class="${chosenBudget === value ? 'selected' : ''}" data-budget="${value}">${value}</button>`).join('');
  budgetWrap.querySelectorAll('button').forEach(button => button.onclick = () => { chosenBudget = button.dataset.budget; renderBudget(); });
}
function renderVibes() {
  vibeWrap.innerHTML = vibes.map(vibe => `<button type="button" class="${chosenVibes.includes(vibe) ? 'selected' : ''}" data-vibe="${vibe}">${chosenVibes.includes(vibe) ? '✓ ' : ''}${vibe}</button>`).join('');
  vibeWrap.querySelectorAll('button').forEach(button => button.onclick = () => {
    const vibe = button.dataset.vibe;
    chosenVibes = chosenVibes.includes(vibe) ? chosenVibes.filter(item => item !== vibe) : [...chosenVibes, vibe];
    renderVibes();
  });
}
function renderWeather() {
  weatherWrap.querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.dataset.weather === chosenWeather));
}

groupWrap.querySelectorAll('button').forEach(button => button.onclick = () => { chosenGroup = button.dataset.group; renderGroup(); });
weatherWrap.querySelectorAll('button').forEach(button => button.onclick = () => { chosenWeather = button.dataset.weather; renderWeather(); });
hoursInput.oninput = event => { hoursValue.textContent = `${event.target.value} hrs`; };

renderGroup();
renderBudget();
renderVibes();
renderWeather();

form.onsubmit = event => {
  event.preventDefault();
  const preferences = {
    name: form.querySelector('[name="name"]').value.trim(),
    location: form.querySelector('[name="location"]').value.trim() || 'Ratnagiri, Maharashtra',
    hours: Number(hoursInput.value),
    groupSize: chosenGroup,
    group_size: groupSizes[chosenGroup],
    budget: chosenBudget,
    budget_limit: budgetLimits[chosenBudget],
    weatherCondition: chosenWeather,
    weather_condition: chosenWeather,
    startTime: startTimeInput.value || '09:00',
    start_time: startTimeInput.value || '09:00',
    vibes: chosenVibes.length ? chosenVibes : ['Local Artisans'],
    user_vibes: chosenVibes.length ? chosenVibes : ['Local Artisans'],
    time_available_hours: Number(hoursInput.value)
  };
  localStorage.setItem('hgai_traveler', JSON.stringify(preferences));
  location.href = 'customer.html';
};
