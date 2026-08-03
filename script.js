// ═══════════════════════════════════════════════════════════
// UEW HOSTEL FINDER — main site logic
// Fetches hostels + room types from Supabase and renders them.
// To add/change a hostel or room, edit the data in Supabase —
// you should not need to edit this file for content changes.
// ═══════════════════════════════════════════════════════════

let activeCard = null;
let activeHostelName = '';
let hostelsCache = [];      // [{ ...hostel, room_types: [...] }]
let currentHostelSlug = null;

// ── Load everything on page ready ──
document.addEventListener('DOMContentLoaded', () => {
    loadHostels();
    setupHamburgerMenu();
    setupScrollFadeIn();
});

// ── Fetch hostels + their room types from Supabase ──
async function loadHostels() {
    const grid = document.getElementById('hostels-grid');
    try {
        const { data: hostels, error: hostelsErr } = await sb
            .from('hostels')
            .select('*')
            .order('sort_order', { ascending: true });

        if (hostelsErr) throw hostelsErr;

        const { data: rooms, error: roomsErr } = await sb
            .from('room_types')
            .select('*')
            .order('sort_order', { ascending: true });

        if (roomsErr) throw roomsErr;

        // Attach each hostel's room types
        hostelsCache = hostels.map(h => ({
            ...h,
            room_types: rooms.filter(r => r.hostel_id === h.id)
        }));

        renderHostelCards();
        populateHostelSelect();
    } catch (err) {
        console.error('Failed to load hostels:', err);
        grid.innerHTML = '<p class="error-msg">Couldn\'t load hostels right now. Please refresh, or check back shortly.</p>';
    }
}

// ── Render the hostel cards grid ──
function renderHostelCards() {
    const grid = document.getElementById('hostels-grid');

    if (!hostelsCache.length) {
        grid.innerHTML = '<p class="loading-msg">No hostels available yet.</p>';
        return;
    }

    grid.innerHTML = hostelsCache.map(h => {
        const badgeClass = h.badge_style === 'limited' ? 'card-badge limited' : 'card-badge';
        const features = (h.features || []).map(f => `<span class="feature-tag">${escapeHtml(f)}</span>`).join('');
        return `
            <div class="hostel-card fade-in" data-slug="${h.slug}" onclick="openRooms('${h.slug}', this)">
                <div class="card-image-wrap">
                    <img src="${h.main_image_url || ''}" alt="${escapeHtml(h.name)}" loading="lazy"
                         onerror="this.parentElement.classList.add('placeholder'); this.style.display='none'">
                    <span class="${badgeClass}">${escapeHtml(h.badge_text || 'Available')}</span>
                </div>
                <div class="card-body">
                    <p class="card-type">${escapeHtml(h.type_label || '')}</p>
                    <h3 class="card-name">${escapeHtml(h.name)}</h3>
                    <p class="card-desc">${escapeHtml(h.description || '')}</p>
                    <div class="card-features">${features}</div>
                    <button class="card-cta">View Room Types →</button>
                    <p class="card-hint">Click card to explore rooms</p>
                </div>
            </div>
        `;
    }).join('');

    // Re-observe new .fade-in elements for scroll animation
    document.querySelectorAll('.hostels-grid .fade-in').forEach(el => fadeObserver.observe(el));
}

// ── Populate the contact form's hostel dropdown from live data ──
function populateHostelSelect() {
    const sel = document.getElementById('hostel');
    if (!sel) return;
    const current = sel.value;
    const options = hostelsCache.map(h => `<option value="${escapeHtml(h.name)}">${escapeHtml(h.name)}</option>`).join('');
    sel.innerHTML = `<option value="">— Select a Hostel —</option>${options}<option value="No Preference">No Preference</option>`;
    if (current) sel.value = current;
}

// ── Open the room detail panel for a given hostel ──
function openRooms(slug, card) {
    const panel = document.getElementById('room-detail-panel');

    if (activeCard === card && panel.classList.contains('open')) {
        closePanel(); return;
    }

    const hostel = hostelsCache.find(h => h.slug === slug);
    if (!hostel) return;

    if (activeCard) activeCard.classList.remove('active');
    activeCard = card;
    card.classList.add('active');

    currentHostelSlug = slug;
    activeHostelName = hostel.name;
    document.getElementById('panel-label').textContent = hostel.name;

    renderRoomTabs(hostel);

    panel.classList.add('open');
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

// ── Build the tab buttons + tab content for a hostel's room types ──
function renderRoomTabs(hostel) {
    const tabsEl = document.getElementById('room-tabs');
    const contentEl = document.getElementById('room-tabs-content');
    const rooms = hostel.room_types || [];

    if (!rooms.length) {
        tabsEl.innerHTML = '';
        contentEl.innerHTML = '<p class="loading-msg">No room types listed for this hostel yet.</p>';
        return;
    }

    tabsEl.innerHTML = rooms.map((r, i) =>
        `<button class="room-tab ${i === 0 ? 'active' : ''}" onclick="switchTab(this,'tab-${r.id}')">${escapeHtml(r.name)}</button>`
    ).join('');

    contentEl.innerHTML = rooms.map((r, i) => renderRoomTabContent(r, i === 0)).join('');
}

function renderRoomTabContent(room, isActive) {
    const availIcon = room.availability_status === 'full' ? '🔴' : room.availability_status === 'limited' ? '🟡' : '🟢';
    const availText = room.availability_status === 'full' ? 'Fully booked' : room.availability_status === 'limited' ? 'Few spaces left' : 'Spaces available';
    const amenities = (room.amenities || []).map(a => `<li>${escapeHtml(a)}</li>`).join('');
    const thumbs = (room.thumb_images || []).map(src =>
        `<img class="room-img-thumb" src="${src}" alt="${escapeHtml(room.name)} extra view" loading="lazy"
              onerror="this.style.opacity=0.15" onclick="showImage('${room.id}', this.src)">`
    ).join('');
    const hasVideo = !!room.video_url;
    const videoThumb = hasVideo ? `
        <div class="room-img-thumb video-thumb" style="background-image:url('${room.main_image_url || ''}')"
             onclick="showVideo('${room.id}', '${room.video_url}')">
            <span class="play-icon">▶</span>
        </div>` : '';

    return `
        <div class="room-content ${isActive ? 'active' : ''}" id="tab-${room.id}">
            <div class="room-layout">
                <div>
                    <div class="room-media-main" id="mediamain-${room.id}">
                        <img class="room-img-main" id="main-${room.id}"
                             src="${room.main_image_url || ''}"
                             alt="${escapeHtml(room.name)}"
                             onerror="this.style.display='none'; document.getElementById('ph-${room.id}').style.display='flex'">
                        <div class="room-placeholder" id="ph-${room.id}" style="display:none">🛏</div>
                    </div>
                    ${(thumbs || videoThumb) ? `<div class="room-img-thumbs">${thumbs}${videoThumb}</div>` : ''}
                </div>
                <div class="room-info">
                    <h3>${escapeHtml(room.name)} <small style="font-size:14px;font-weight:400;color:var(--muted)">(${room.capacity} ${room.capacity === 1 ? 'person' : 'persons'})</small></h3>
                    <div class="room-price">GH₵ ${Number(room.price).toLocaleString()} <small>${escapeHtml(room.price_period || '')}</small></div>
                    <div class="room-avail">${availIcon} ${availText}</div>
                    <p>${escapeHtml(room.description || '')}</p>
                    <ul class="room-amenities">${amenities}</ul>
                    <button type="button" class="room-book-btn" onclick="openBookingModal('${room.id}', '${escapeHtml(room.name)}', '${escapeHtml(activeHostelName)}', ${room.price})">Book This Room →</button>
                </div>
            </div>
        </div>
    `;
}

function closePanel() {
    const panel = document.getElementById('room-detail-panel');
    panel.classList.remove('open');
    pauseVideosIn(panel);
    if (activeCard) { activeCard.classList.remove('active'); activeCard = null; }
}

function switchTab(btn, id) {
    document.querySelectorAll('.room-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.room-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const content = document.getElementById(id);
    content.classList.add('active');
    pauseVideosIn(content.parentElement);
}

// ── Unified media gallery: swap main display between image and video ──
function showImage(roomId, src) {
    const mainWrap = document.getElementById('mediamain-' + roomId);
    if (!mainWrap) return;
    pauseVideosIn(mainWrap);
    mainWrap.innerHTML = `
        <img class="room-img-main" id="main-${roomId}" src="${src}" alt="Room photo"
             onerror="this.style.display='none'; document.getElementById('ph-${roomId}').style.display='flex'">
        <div class="room-placeholder" id="ph-${roomId}" style="display:none">🛏</div>
    `;
}

function showVideo(roomId, videoUrl) {
    const mainWrap = document.getElementById('mediamain-' + roomId);
    if (!mainWrap) return;
    mainWrap.innerHTML = `
        <video class="room-video-main" controls autoplay preload="none" playsinline src="${videoUrl}">
            Your browser doesn't support embedded video.
        </video>
    `;
}

function pauseVideosIn(scope) {
    (scope || document).querySelectorAll('video').forEach(v => v.pause());
}

function prefill() {
    if (!activeHostelName) return;
    const sel = document.getElementById('hostel');
    for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].text === activeHostelName) { sel.selectedIndex = i; break; }
    }
}

// ── Scroll fade-in ──
const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
        if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('visible'), i * 80);
            fadeObserver.unobserve(e.target);
        }
    });
}, { threshold: 0.12 });

function setupScrollFadeIn() {
    document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
}

// ── Mobile hamburger menu ──
function setupHamburgerMenu() {
    const navToggle = document.getElementById('nav-toggle');
    const mainNav = document.getElementById('main-nav');
    if (!navToggle || !mainNav) return;

    navToggle.addEventListener('click', () => {
        const isOpen = mainNav.classList.toggle('open');
        navToggle.classList.toggle('open', isOpen);
        navToggle.setAttribute('aria-expanded', isOpen);
    });
    mainNav.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            mainNav.classList.remove('open');
            navToggle.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        });
    });
}

// ── Contact form → inserts a real row into Supabase `enquiries` ──
async function handleSubmit() {
    const fname = document.getElementById('fname').value.trim();
    const lname = document.getElementById('lname').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const hostel = document.getElementById('hostel').value;
    const message = document.getElementById('message').value.trim();

    if (!fname || !email || !hostel) {
        alert('Please fill in your name, email, and preferred hostel.');
        return;
    }

    const btn = document.querySelector('.form-submit');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
        const { error } = await sb.from('enquiries').insert({
            first_name: fname,
            last_name: lname,
            email: email,
            phone: phone,
            preferred_hostel: hostel,
            message: message
        });

        if (error) throw error;

        btn.textContent = "✅ Enquiry Sent! We'll be in touch soon.";
        btn.style.background = '#2A9D5C';
        btn.style.color = 'white';
    } catch (err) {
        console.error('Failed to submit enquiry:', err);
        btn.textContent = originalText;
        btn.disabled = false;
        alert("Sorry, something went wrong sending your enquiry. Please try again.");
    }
}

// ── Small helper to avoid HTML injection from stored text ──
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// ── FAQ accordion ──
function toggleFaq(btn) {
    const item = btn.closest('.faq-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
}
