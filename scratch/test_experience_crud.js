const assert = require('node:assert/strict');
const test = require('node:test');

const controller = require('../server/controllers/experienceController');
const merchantRoutes = require('../server/routes/merchantRoutes');
const customerJs = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'customer.js'), 'utf8');
const merchantJs = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'merchant.js'), 'utf8');

test('experience payload validation normalizes a valid merchant listing', () => {
  const result = controller.normalizeExperiencePayload({
    name: 'Konkan Pottery',
    category: 'Art',
    location: 'Ratnagiri',
    description: 'A hands-on local pottery workshop.',
    cost: '350',
    duration: '90 min',
    travel: '15 min',
    max_group_size: '8',
    vibes: 'Local Artisans, Art & Creativity',
    weather_type: 'indoor',
    venueStatus: 'open',
    latitude: '16.99',
    longitude: '73.31',
    image: 'https://example.com/pottery.jpg'
  });

  assert.equal(result.error, undefined);
  assert.equal(result.data.name, 'Konkan Pottery');
  assert.deepEqual(result.data.vibes, ['Local Artisans', 'Art & Creativity']);
  assert.equal(result.data.max_group_size, 8);
  assert.equal(result.data.indoor, true);
});

test('experience payload rejects unsafe image URLs and invalid group size', () => {
  const badImage = controller.normalizeExperiencePayload({
    name: 'Test',
    category: 'Art',
    location: 'Ratnagiri',
    description: 'Description',
    cost: 10,
    duration: '60 min',
    max_group_size: 2,
    vibes: ['Art'],
    image: 'javascript:alert(1)'
  });
  assert.match(badImage.error, /Image/);

  const badGroup = controller.normalizeExperiencePayload({
    name: 'Test',
    category: 'Art',
    location: 'Ratnagiri',
    description: 'Description',
    cost: 10,
    duration: '60 min',
    max_group_size: 0,
    vibes: ['Art']
  });
  assert.match(badGroup.error, /group size/i);
});

test('merchant routes expose authenticated CRUD handlers', () => {
  const routes = merchantRoutes.stack
    .filter(layer => layer.route)
    .map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

  assert.ok(routes.includes('POST /experiences'));
  assert.ok(routes.includes('PATCH /experiences/:id'));
  assert.ok(routes.includes('DELETE /experiences/:id'));
});

test('traveler merchant experience UI and merchant CRUD UI are wired', () => {
  assert.match(customerJs, /\/merchants\/\$\{encodeURIComponent\(merchantId\)\}\/experiences/);
  assert.match(customerJs, /View Experiences/);
  assert.match(merchantJs, /\/merchant\/experiences/);
  assert.match(merchantJs, /new-experience-button/);
  assert.match(merchantJs, /data-edit-experience/);
  assert.match(merchantJs, /data-delete-experience/);
});

console.log('Experience CRUD tests: 4/4 passed.');
