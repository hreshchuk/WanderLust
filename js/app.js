/* =============================================
   WANDERLUST — app.js
   Завантаження даних, навігація, пошук, UI
   ============================================= */

'use strict';

/* ===== STATE ===== */
const state = {
  data: null,
  currentCategory: null,
  searchQuery: '',
  userName: ''
};

/* ===== DOM HELPERS ===== */
const $ = id => document.getElementById(id);
const create = (tag, cls, html) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html;
  return el;
};

/* ===== DATA LOADING ===== */
async function loadData() {
  try {
    const res = await fetch('data/destinations.json');
    if (!res.ok) throw new Error('Помилка завантаження даних');
    state.data = await res.json();
    initApp();
  } catch (err) {
    document.getElementById('catalog-grid').innerHTML =
      `<p class="error-msg">⚠️ ${err.message}. Перевірте з'єднання.</p>`;
    console.error(err);
  }
}

/* ===== INIT ===== */
function initApp() {
  renderCategories();
  initNavLinks();
  initGreeting();
  initSearch();
  initNavbar();
}

/* ===== NAVBAR ===== */
function initNavbar() {
  const navbar = $('navbar');
  const hamburger = $('hamburger');
  const mobileMenu = $('mobile-menu');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  // Close mobile menu on link click
  mobileMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });
}

function initNavLinks() {
  // Smooth scroll nav
  document.querySelectorAll('[data-scroll]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.dataset.scroll;
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      setActiveNav(link);
    });
  });

  // Highlight active nav on scroll
  const sections = ['hero','search-section','catalog','destinations','game'];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll('[data-scroll]').forEach(l => {
          l.classList.toggle('active', l.dataset.scroll === id);
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

function setActiveNav(link) {
  document.querySelectorAll('[data-scroll]').forEach(l => l.classList.remove('active'));
  link.classList.add('active');
}

/* ===== GREETING ===== */
function initGreeting() {
  const form = $('greeting-form');
  const input = $('name-input');
  const msg = $('greeting-message');
  const navGreeting = $('nav-greeting');

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    state.userName = name;

    const greetings = [
      `🌍 Вітаємо, ${name}! Ваша пригода починається!`,
      `✈️ Привіт, ${name}! Куди летимо?`,
      `🗺️ ${name}, відкривайте світ разом з нами!`,
      `🌏 Чудово, ${name}! Вибирайте напрямок мрії!`
    ];

    msg.textContent = greetings[Math.floor(Math.random() * greetings.length)];
    msg.style.animation = 'none';
    requestAnimationFrame(() => {
      msg.style.animation = 'fadeInUp 0.5s ease';
    });

    navGreeting.textContent = `👋 ${name}`;
    input.value = '';
  });
}

/* ===== SEARCH ===== */
function initSearch() {
  const form = $('search-form');
  const input = $('search-input');
  const label = $('search-results-label');

  form.addEventListener('submit', e => {
    e.preventDefault();
    performSearch(input.value.trim(), label);
  });

  input.addEventListener('input', () => {
    if (!input.value.trim()) {
      label.textContent = '';
      renderCategories();
    }
  });

  // Also allow search from nav
  $('nav-search-btn').addEventListener('click', () => {
    $('search-section').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => input.focus(), 600);
  });
}

function performSearch(query, label) {
  if (!query || !state.data) return;
  state.searchQuery = query.toLowerCase();

  const results = [];
  state.data.categories.forEach(cat => {
    cat.destinations.forEach(dest => {
      const searchable = `${dest.name} ${dest.description} ${dest.tags.join(' ')} ${cat.name}`.toLowerCase();
      if (searchable.includes(state.searchQuery)) {
        results.push({ ...dest, categoryName: cat.name });
      }
    });
  });

  if (results.length === 0) {
    label.textContent = `🔍 Нічого не знайдено за запитом «${query}»`;
    label.style.color = '#e94560';
    return;
  }

  label.textContent = `✅ Знайдено: ${results.length} напрямк${results.length === 1 ? '' : 'ів'}`;
  label.style.color = '#f5a623';

  // Scroll to destinations section
  $('destinations').scrollIntoView({ behavior: 'smooth' });

  // Show results with highlight
  const grid = $('destinations-grid');
  const header = $('destinations-header-title');
  header.textContent = `Результати пошуку: «${query}»`;
  $('back-to-categories').style.display = 'flex';

  grid.innerHTML = '';
  results.forEach((dest, i) => {
    const card = buildDestCard(dest, null, i, state.searchQuery);
    grid.appendChild(card);
  });

  $('catalog').style.display = 'none';
  $('destinations').style.display = 'block';
}

function highlightText(text, query) {
  if (!query) return text;
  const re = new RegExp(`(${escapeRe(query)})`, 'gi');
  return text.replace(re, '<mark class="highlight">$1</mark>');
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ===== CATEGORIES ===== */
function renderCategories() {
  if (!state.data) return;
  const grid = $('catalog-grid');
  grid.innerHTML = '';

  $('catalog').style.display = 'block';
  $('destinations').style.display = 'none';

  state.data.categories.forEach((cat, i) => {
    const card = create('div', 'category-card');
    card.style.animationDelay = `${i * 0.07}s`;
    card.classList.add('fade-in-up');

    card.innerHTML = `
      <div class="category-img">
        <img src="${cat.image}" alt="${cat.name}" loading="lazy">
        <div class="category-img-overlay"></div>
        <div class="category-icon-badge">${cat.icon}</div>
        <span class="category-count">${cat.destinations.length} напрямки</span>
      </div>
      <div class="category-body">
        <h3 class="category-name">${cat.name}</h3>
        <p class="category-desc">${cat.description}</p>
        <span class="category-btn">Переглянути <span>→</span></span>
      </div>
    `;

    card.addEventListener('click', () => openCategory(cat));
    grid.appendChild(card);
  });
}

function openCategory(cat) {
  state.currentCategory = cat;
  state.searchQuery = '';

  $('catalog').style.display = 'none';
  const destSection = $('destinations');
  destSection.style.display = 'block';

  $('destinations-header-title').textContent = `${cat.icon} ${cat.name}`;
  $('back-to-categories').style.display = 'flex';

  const grid = $('destinations-grid');
  grid.innerHTML = '';

  cat.destinations.forEach((dest, i) => {
    const card = buildDestCard(dest, cat, i, '');
    grid.appendChild(card);
  });

  destSection.scrollIntoView({ behavior: 'smooth' });
}

function buildDestCard(dest, cat, index, searchQuery) {
  const card = create('div', 'dest-card');
  card.style.animationDelay = `${index * 0.08}s`;

  const nameHTML = highlightText(dest.name, searchQuery);
  const descHTML = highlightText(dest.description.substring(0, 120) + '…', searchQuery);
  const tagsHTML = dest.tags.map(t => `<span class="dest-tag">${highlightText(t, searchQuery)}</span>`).join('');

  card.innerHTML = `
    <div class="dest-img">
      <img src="${dest.image}" alt="${dest.name}" loading="lazy">
      <div class="dest-tags">${tagsHTML}</div>
      <div class="dest-rating">${dest.rating}</div>
    </div>
    <div class="dest-body">
      <h3 class="dest-name">${nameHTML}</h3>
      <p class="dest-desc">${descHTML}</p>
      <div class="dest-meta">
        <span class="dest-price">${dest.price}</span>
        <span class="dest-duration">🕐 ${dest.duration}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModal(dest));
  return card;
}

/* ===== BACK BUTTON ===== */
document.addEventListener('DOMContentLoaded', () => {
  $('back-to-categories').addEventListener('click', () => {
    state.searchQuery = '';
    $('search-results-label').textContent = '';
    $('search-input').value = '';
    renderCategories();
    $('catalog').scrollIntoView({ behavior: 'smooth' });
  });
});

/* ===== MODAL ===== */
function openModal(dest) {
  const overlay = create('div', 'modal-overlay');
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-img" style="position:relative;">
        <img src="${dest.image}" alt="${dest.name}">
        <button class="modal-close" title="Закрити">✕</button>
      </div>
      <div class="modal-body">
        <h2 class="modal-name">${dest.name}</h2>
        <div class="modal-meta">
          <span class="modal-badge price">💰 ${dest.price}</span>
          <span class="modal-badge rating">⭐ ${dest.rating}</span>
          <span class="modal-badge">🕐 ${dest.duration}</span>
        </div>
        <p class="modal-desc">${dest.description}</p>
        <div class="modal-tags">
          ${dest.tags.map(t => `<span class="modal-tag">#${t}</span>`).join('')}
        </div>
        <div class="modal-cta">
          <button class="modal-book-btn" onclick="alert('Дякуємо за інтерес! Функція бронювання буде доступна незабаром 🌍')">
            Дізнатись більше
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const close = () => {
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
    }, 180);
  };

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/* ===== FOOTER NEWSLETTER ===== */
function initNewsletter() {
  const form = $('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = form.querySelector('input').value.trim();
    if (email) {
      alert(`✅ Дякуємо! ${email} успішно підписано на новини WanderLust!`);
      form.querySelector('input').value = '';
    }
  });
}

/* ===== BOOT ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initNewsletter();
});
