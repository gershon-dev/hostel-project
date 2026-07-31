// ═══════════════════════════════════════════════════════════
// UEW HOSTEL FINDER — ADMIN DASHBOARD LOGIC
// Requires: supabase-client.js loaded first (provides `sb`)
// ═══════════════════════════════════════════════════════════

const BUCKET = 'hostel-media';

let hostelsCache = [];
let roomsCache = [];
let currentView = 'hostels';

// ══════════════════════ AUTH ══════════════════════

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('hostel-form').addEventListener('submit', handleHostelSubmit);
    document.getElementById('room-form').addEventListener('submit', handleRoomSubmit);
    document.getElementById('hostel-image-file').addEventListener('change', e => previewImage(e, 'hostel-image-preview'));
    document.getElementById('room-image-file').addEventListener('change', e => previewImage(e, 'room-image-preview'));
    document.getElementById('room-thumbs-file').addEventListener('change', previewThumbs);
    document.getElementById('room-video-file').addEventListener('change', e => {
        document.getElementById('room-video-name').textContent = e.target.files[0]?.name || '';
    });
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    checkSession();
    sb.auth.onAuthStateChange((_event, session) => {
        session ? showDashboard(session) : showLogin();
    });
});

async function checkSession() {
    const { data: { session } } = await sb.auth.getSession();
    session ? showDashboard(session) : showLogin();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    const { error } = await sb.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';

    if (error) {
        errEl.textContent = 'Incorrect email or password.';
    }
}

async function handleLogout() {
    await sb.auth.signOut();
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard(session) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('admin-email').textContent = session.user.email;
    loadAllData();
}

// ══════════════════════ VIEW SWITCHING ══════════════════════

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');
}

async function loadAllData() {
    await Promise.all([loadHostels(), loadRooms(), loadEnquiries()]);
}

// ══════════════════════ HOSTELS ══════════════════════

async function loadHostels() {
    const wrap = document.getElementById('hostels-table-wrap');
    const { data, error } = await sb.from('hostels').select('*').order('sort_order', { ascending: true });
    if (error) { wrap.innerHTML = `<p class="empty-msg">Error loading hostels: ${escapeHtml(error.message)}</p>`; return; }
    hostelsCache = data || [];
    renderHostelsTable();
    populateHostelDropdowns();
}

function renderHostelsTable() {
    const wrap = document.getElementById('hostels-table-wrap');
    if (!hostelsCache.length) { wrap.innerHTML = '<p class="empty-msg">No hostels yet. Click "Add Hostel" to create one.</p>'; return; }

    wrap.innerHTML = `
        <table>
            <thead><tr><th></th><th>Name</th><th>Type</th><th>Badge</th><th>Order</th><th></th></tr></thead>
            <tbody>
                ${hostelsCache.map(h => `
                    <tr>
                        <td>${h.main_image_url ? `<img class="cell-thumb" src="${escapeHtml(h.main_image_url)}" onerror="this.style.visibility='hidden'">` : '<div class="cell-thumb"></div>'}</td>
                        <td><strong>${escapeHtml(h.name)}</strong><br><small style="color:var(--muted)">${escapeHtml(h.slug)}</small></td>
                        <td>${escapeHtml(h.type_label || '—')}</td>
                        <td><span class="badge ${h.badge_style === 'limited' ? 'limited' : 'available'}">${escapeHtml(h.badge_text || '')}</span></td>
                        <td>${h.sort_order}</td>
                        <td class="cell-actions">
                            <button class="icon-btn" onclick="openHostelForm('${h.id}')" title="Edit">✏️</button>
                            <button class="icon-btn danger" onclick="deleteHostel('${h.id}','${escapeHtml(h.name)}')" title="Delete">🗑️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}

function openHostelForm(id) {
    const form = document.getElementById('hostel-form');
    form.reset();
    document.getElementById('hostel-form-error').textContent = '';
    document.getElementById('hostel-image-preview').classList.add('hidden');
    document.getElementById('hostel-image-url').value = '';

    if (id) {
        const h = hostelsCache.find(x => x.id === id);
        document.getElementById('hostel-modal-title').textContent = 'Edit Hostel';
        document.getElementById('hostel-id').value = h.id;
        document.getElementById('hostel-name').value = h.name;
        document.getElementById('hostel-slug').value = h.slug;
        document.getElementById('hostel-type-label').value = h.type_label || '';
        document.getElementById('hostel-description').value = h.description || '';
        document.getElementById('hostel-badge-text').value = h.badge_text || 'Available';
        document.getElementById('hostel-badge-style').value = h.badge_style || 'default';
        document.getElementById('hostel-features').value = (h.features || []).join('\n');
        document.getElementById('hostel-sort-order').value = h.sort_order || 0;
        document.getElementById('hostel-image-url').value = h.main_image_url || '';
        if (h.main_image_url) {
            const img = document.getElementById('hostel-image-preview');
            img.src = h.main_image_url; img.classList.remove('hidden');
        }
    } else {
        document.getElementById('hostel-modal-title').textContent = 'Add Hostel';
        document.getElementById('hostel-id').value = '';
    }
    openModal('hostel-modal');
}

async function handleHostelSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('hostel-form-error');
    const btn = document.getElementById('hostel-save-btn');
    errEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Saving…';

    try {
        const id = document.getElementById('hostel-id').value;
        const slug = document.getElementById('hostel-slug').value.trim();
        let imageUrl = document.getElementById('hostel-image-url').value;

        const file = document.getElementById('hostel-image-file').files[0];
        if (file) imageUrl = await uploadFile(file, `hostels/${slug}`);

        const payload = {
            name: document.getElementById('hostel-name').value.trim(),
            slug,
            type_label: document.getElementById('hostel-type-label').value.trim(),
            description: document.getElementById('hostel-description').value.trim(),
            badge_text: document.getElementById('hostel-badge-text').value.trim() || 'Available',
            badge_style: document.getElementById('hostel-badge-style').value,
            features: linesToArray(document.getElementById('hostel-features').value),
            main_image_url: imageUrl || null,
            sort_order: Number(document.getElementById('hostel-sort-order').value) || 0
        };

        const { error } = id
            ? await sb.from('hostels').update(payload).eq('id', id)
            : await sb.from('hostels').insert(payload);

        if (error) throw error;

        closeModal('hostel-modal');
        showToast('Hostel saved.');
        await loadHostels();
    } catch (err) {
        errEl.textContent = err.message || 'Something went wrong.';
    } finally {
        btn.disabled = false; btn.textContent = 'Save Hostel';
    }
}

async function deleteHostel(id, name) {
    if (!confirm(`Delete "${name}"? This also deletes all of its room types. This cannot be undone.`)) return;
    const { error } = await sb.from('hostels').delete().eq('id', id);
    if (error) { showToast('Failed to delete: ' + error.message, true); return; }
    showToast('Hostel deleted.');
    await loadHostels();
    await loadRooms();
}

// ══════════════════════ ROOM TYPES ══════════════════════

async function loadRooms() {
    const wrap = document.getElementById('rooms-table-wrap');
    const { data, error } = await sb.from('room_types').select('*').order('sort_order', { ascending: true });
    if (error) { wrap.innerHTML = `<p class="empty-msg">Error loading room types: ${escapeHtml(error.message)}</p>`; return; }
    roomsCache = data || [];
    renderRoomsTable();
}

function populateHostelDropdowns() {
    const opts = hostelsCache.map(h => `<option value="${h.id}">${escapeHtml(h.name)}</option>`).join('');

    const filter = document.getElementById('room-hostel-filter');
    const prevFilter = filter.value;
    filter.innerHTML = `<option value="">All Hostels</option>${opts}`;
    if (prevFilter) filter.value = prevFilter;
    filter.onchange = renderRoomsTable;

    document.getElementById('room-hostel-id').innerHTML = opts;
}

function renderRoomsTable() {
    const wrap = document.getElementById('rooms-table-wrap');
    const filterVal = document.getElementById('room-hostel-filter').value;
    const rows = filterVal ? roomsCache.filter(r => r.hostel_id === filterVal) : roomsCache;

    if (!rows.length) { wrap.innerHTML = '<p class="empty-msg">No room types yet. Click "Add Room Type" to create one.</p>'; return; }

    wrap.innerHTML = `
        <table>
            <thead><tr><th></th><th>Room</th><th>Hostel</th><th>Capacity</th><th>Price</th><th>Status</th><th></th></tr></thead>
            <tbody>
                ${rows.map(r => {
                    const hostel = hostelsCache.find(h => h.id === r.hostel_id);
                    return `
                    <tr>
                        <td>${r.main_image_url ? `<img class="cell-thumb" src="${escapeHtml(r.main_image_url)}" onerror="this.style.visibility='hidden'">` : '<div class="cell-thumb"></div>'}</td>
                        <td><strong>${escapeHtml(r.name)}</strong></td>
                        <td>${escapeHtml(hostel ? hostel.name : '—')}</td>
                        <td>${r.capacity}</td>
                        <td>GH₵ ${Number(r.price).toLocaleString()}<br><small style="color:var(--muted)">${escapeHtml(r.price_period || '')}</small></td>
                        <td><span class="badge ${r.availability_status}">${escapeHtml(r.availability_status)}</span></td>
                        <td class="cell-actions">
                            <button class="icon-btn" onclick="openRoomForm('${r.id}')" title="Edit">✏️</button>
                            <button class="icon-btn danger" onclick="deleteRoom('${r.id}','${escapeHtml(r.name)}')" title="Delete">🗑️</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

function openRoomForm(id) {
    const form = document.getElementById('room-form');
    form.reset();
    document.getElementById('room-form-error').textContent = '';
    document.getElementById('room-image-preview').classList.add('hidden');
    document.getElementById('room-image-url').value = '';
    document.getElementById('room-thumbs-preview').innerHTML = '';
    document.getElementById('room-thumbs-urls').value = '[]';
    document.getElementById('room-video-name').textContent = '';
    document.getElementById('room-video-url').value = '';

    if (id) {
        const r = roomsCache.find(x => x.id === id);
        document.getElementById('room-modal-title').textContent = 'Edit Room Type';
        document.getElementById('room-id').value = r.id;
        document.getElementById('room-hostel-id').value = r.hostel_id;
        document.getElementById('room-name').value = r.name;
        document.getElementById('room-capacity').value = r.capacity;
        document.getElementById('room-price').value = r.price;
        document.getElementById('room-price-period').value = r.price_period || '';
        document.getElementById('room-availability').value = r.availability_status || 'available';
        document.getElementById('room-description').value = r.description || '';
        document.getElementById('room-amenities').value = (r.amenities || []).join('\n');
        document.getElementById('room-sort-order').value = r.sort_order || 0;
        document.getElementById('room-image-url').value = r.main_image_url || '';
        if (r.main_image_url) {
            const img = document.getElementById('room-image-preview');
            img.src = r.main_image_url; img.classList.remove('hidden');
        }
        const thumbs = r.thumb_images || [];
        document.getElementById('room-thumbs-urls').value = JSON.stringify(thumbs);
        renderThumbsPreview(thumbs);
        if (r.video_url) {
            document.getElementById('room-video-url').value = r.video_url;
            document.getElementById('room-video-name').textContent = 'Current video attached';
        }
    } else {
        document.getElementById('room-modal-title').textContent = 'Add Room Type';
        document.getElementById('room-id').value = '';
        const filterVal = document.getElementById('room-hostel-filter').value;
        if (filterVal) document.getElementById('room-hostel-id').value = filterVal;
    }
    openModal('room-modal');
}

async function handleRoomSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('room-form-error');
    const btn = document.getElementById('room-save-btn');
    errEl.textContent = '';
    btn.disabled = true; btn.textContent = 'Saving…';

    try {
        const id = document.getElementById('room-id').value;
        const hostelId = document.getElementById('room-hostel-id').value;
        if (!hostelId) throw new Error('Please choose a hostel.');
        const roomSlug = id || `new-${Date.now()}`;

        let imageUrl = document.getElementById('room-image-url').value;
        const imageFile = document.getElementById('room-image-file').files[0];
        if (imageFile) imageUrl = await uploadFile(imageFile, `rooms/${roomSlug}`);

        let thumbUrls = JSON.parse(document.getElementById('room-thumbs-urls').value || '[]');
        const thumbFiles = Array.from(document.getElementById('room-thumbs-file').files || []);
        if (thumbFiles.length) {
            const uploaded = await Promise.all(thumbFiles.map(f => uploadFile(f, `rooms/${roomSlug}/thumbs`)));
            thumbUrls = thumbUrls.concat(uploaded);
        }

        let videoUrl = document.getElementById('room-video-url').value || null;
        const videoFile = document.getElementById('room-video-file').files[0];
        if (videoFile) videoUrl = await uploadFile(videoFile, `rooms/${roomSlug}/video`);

        const payload = {
            hostel_id: hostelId,
            name: document.getElementById('room-name').value.trim(),
            capacity: Number(document.getElementById('room-capacity').value) || 1,
            price: Number(document.getElementById('room-price').value) || 0,
            price_period: document.getElementById('room-price-period').value.trim() || '/ semester',
            availability_status: document.getElementById('room-availability').value,
            description: document.getElementById('room-description').value.trim(),
            amenities: linesToArray(document.getElementById('room-amenities').value),
            main_image_url: imageUrl || null,
            thumb_images: thumbUrls,
            video_url: videoUrl,
            sort_order: Number(document.getElementById('room-sort-order').value) || 0
        };

        const { error } = id
            ? await sb.from('room_types').update(payload).eq('id', id)
            : await sb.from('room_types').insert(payload);

        if (error) throw error;

        closeModal('room-modal');
        showToast('Room type saved.');
        await loadRooms();
    } catch (err) {
        errEl.textContent = err.message || 'Something went wrong.';
    } finally {
        btn.disabled = false; btn.textContent = 'Save Room Type';
    }
}

async function deleteRoom(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await sb.from('room_types').delete().eq('id', id);
    if (error) { showToast('Failed to delete: ' + error.message, true); return; }
    showToast('Room type deleted.');
    await loadRooms();
}

// ══════════════════════ ENQUIRIES ══════════════════════

async function loadEnquiries() {
    const wrap = document.getElementById('enquiries-table-wrap');
    const { data, error } = await sb.from('enquiries').select('*').order('created_at', { ascending: false });
    if (error) { wrap.innerHTML = `<p class="empty-msg">Error loading enquiries: ${escapeHtml(error.message)}</p>`; return; }

    const countEl = document.getElementById('enquiry-count');
    if (data && data.length) { countEl.textContent = data.length; countEl.classList.remove('hidden'); }
    else { countEl.classList.add('hidden'); }

    if (!data || !data.length) { wrap.innerHTML = '<p class="empty-msg">No enquiries yet.</p>'; return; }

    wrap.innerHTML = `
        <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Hostel</th><th>Message</th><th>Date</th><th></th></tr></thead>
            <tbody>
                ${data.map(en => `
                    <tr>
                        <td><strong>${escapeHtml(en.first_name || '')} ${escapeHtml(en.last_name || '')}</strong></td>
                        <td>${escapeHtml(en.email || '')}<br><small style="color:var(--muted)">${escapeHtml(en.phone || '')}</small></td>
                        <td>${escapeHtml(en.preferred_hostel || '—')}</td>
                        <td style="max-width:220px">${escapeHtml(en.message || '—')}</td>
                        <td><small>${new Date(en.created_at).toLocaleDateString()}</small></td>
                        <td class="cell-actions">
                            <button class="icon-btn danger" onclick="deleteEnquiry('${en.id}')" title="Delete">🗑️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}

async function deleteEnquiry(id) {
    if (!confirm('Delete this enquiry?')) return;
    const { error } = await sb.from('enquiries').delete().eq('id', id);
    if (error) { showToast('Failed to delete: ' + error.message, true); return; }
    showToast('Enquiry deleted.');
    await loadEnquiries();
}

// ══════════════════════ FILE UPLOADS ══════════════════════

async function uploadFile(file, pathPrefix) {
    const ext = file.name.split('.').pop();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${pathPrefix}/${safeName}`;

    const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error('Upload failed: ' + error.message);

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

function previewImage(e, previewId) {
    const file = e.target.files[0];
    if (!file) return;
    const img = document.getElementById(previewId);
    img.src = URL.createObjectURL(file);
    img.classList.remove('hidden');
}

function previewThumbs(e) {
    const files = Array.from(e.target.files || []);
    const wrap = document.getElementById('room-thumbs-preview');
    const existing = JSON.parse(document.getElementById('room-thumbs-urls').value || '[]');
    renderThumbsPreview(existing, files);
}

function renderThumbsPreview(existingUrls, newFiles) {
    const wrap = document.getElementById('room-thumbs-preview');
    let html = (existingUrls || []).map(u => `<img src="${escapeHtml(u)}">`).join('');
    if (newFiles) html += newFiles.map(f => `<img src="${URL.createObjectURL(f)}">`).join('');
    wrap.innerHTML = html;
}

// ══════════════════════ MODAL / TOAST / HELPERS ══════════════════════

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

let toastTimer = null;
function showToast(msg, isError) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function linesToArray(text) {
    return text.split('\n').map(s => s.trim()).filter(Boolean);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
