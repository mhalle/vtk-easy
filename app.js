const select = document.getElementById('example-select');

// Get example from URL hash or default to first option
const initial = location.hash.slice(1) || select.value;
if (select.querySelector(`option[value="${initial}"]`)) {
  select.value = initial;
}

async function load(name) {
  location.hash = name;
  // Reload to get a clean slate if there's already a canvas
  if (document.querySelector('.vtk-container, canvas')) {
    location.reload();
    return;
  }
  try {
    await import(`./examples/${name}/index.js`);
  } catch (err) {
    console.error(`Failed to load ${name}:`, err);
  }
}

select.addEventListener('change', () => load(select.value));

load(select.value);
