// Collects a few quick business details and hands them to merchant.js via localStorage.
// Kept intentionally simple: no accounts, no backend call — just a personalization handoff.
const categories = ['Solo & Quiet', 'Local Artisans', 'Hidden Food', 'Culture & Heritage', 'Nightlife'];

let saved = {};
try { saved = JSON.parse(localStorage.getItem('hgai_merchant') || '{}'); } catch (error) { saved = {}; }

const form = document.querySelector('#merchant-form');
const categoryWrap = document.querySelector('#category-chips');
let chosenCategory = saved.category || categories[1];

let loggedInUser = {};
try { loggedInUser = JSON.parse(localStorage.getItem('hgai_user') || '{}'); } catch (e) {}

const defaultBusinessName = saved.businessName || loggedInUser.businessName || loggedInUser.name || '';
if (defaultBusinessName) form.querySelector('[name="businessName"]').value = defaultBusinessName;
if (saved.location) form.querySelector('[name="location"]').value = saved.location;
if (saved.contact) form.querySelector('[name="contact"]').value = saved.contact;
if (saved.hours) form.querySelector('[name="hours"]').value = saved.hours;

function renderCategories() {
  categoryWrap.innerHTML = categories.map(category => `<button type="button" class="${chosenCategory === category ? 'selected' : ''}" data-category="${category}">${category}</button>`).join('');
  categoryWrap.querySelectorAll('button').forEach(button => button.onclick = () => { chosenCategory = button.dataset.category; renderCategories(); });
}
renderCategories();

form.onsubmit = event => {
  event.preventDefault();
  const details = {
    businessName: form.querySelector('[name="businessName"]').value.trim(),
    location: form.querySelector('[name="location"]').value.trim() || 'Ratnagiri, Maharashtra',
    category: chosenCategory,
    contact: form.querySelector('[name="contact"]').value.trim(),
    hours: form.querySelector('[name="hours"]').value.trim()
  };
  localStorage.setItem('hgai_merchant', JSON.stringify(details));
  location.href = 'merchant.html';
};
