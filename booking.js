// ═══════════════════════════════════════════════════════════
// BOOKING + PAYMENT (Paystack Mobile Money)
// Opens a small modal to collect student details, then calls
// the `initialize-payment` Edge Function and redirects the
// student to Paystack's Mobile Money checkout.
//
// Relies on SUPABASE_URL / SUPABASE_ANON_KEY from supabase-client.js
// (load this file AFTER supabase-client.js).
// ═══════════════════════════════════════════════════════════

let selectedRoom = null; // { id, name, hostelName, price }

function openBookingModal(roomId, roomName, hostelName, price) {
    selectedRoom = { id: roomId, name: roomName, hostelName, price };

    document.getElementById('booking-modal-room').textContent = `${roomName} — ${hostelName}`;
    document.getElementById('booking-modal-price').textContent = `GH₵ ${Number(price).toLocaleString()}`;
    document.getElementById('booking-error').textContent = '';
    document.getElementById('booking-form').reset();

    const payBtn = document.getElementById('booking-pay-btn');
    payBtn.disabled = false;
    payBtn.textContent = 'Pay with Mobile Money →';

    document.getElementById('booking-modal').classList.add('open');
}

function closeBookingModal() {
    document.getElementById('booking-modal').classList.remove('open');
    selectedRoom = null;
}

async function submitBooking(e) {
    e.preventDefault();
    if (!selectedRoom) return;

    const errorEl = document.getElementById('booking-error');
    errorEl.textContent = '';

    const first_name = document.getElementById('bk-fname').value.trim();
    const last_name = document.getElementById('bk-lname').value.trim();
    const email = document.getElementById('bk-email').value.trim();
    const phone = document.getElementById('bk-phone').value.trim();

    if (!first_name || !last_name || !email || !phone) {
        errorEl.textContent = 'Please fill in all fields.';
        return;
    }

    const payBtn = document.getElementById('booking-pay-btn');
    payBtn.disabled = true;
    payBtn.textContent = 'Starting payment…';

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/initialize-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                room_type_id: selectedRoom.id,
                first_name,
                last_name,
                email,
                phone,
                callback_url: window.location.origin + window.location.pathname,
            }),
        });

        const result = await res.json();

        if (!res.ok || !result.authorization_url) {
            throw new Error(result.error || 'Could not start payment.');
        }

        // Off to Paystack's Mobile Money checkout. The webhook
        // (paystack-webhook Edge Function) is what actually confirms
        // the booking server-side, independent of this redirect.
        window.location.href = result.authorization_url;
    } catch (err) {
        console.error('Payment init failed:', err);
        errorEl.textContent = err.message || 'Something went wrong. Please try again.';
        payBtn.disabled = false;
        payBtn.textContent = 'Pay with Mobile Money →';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('booking-form');
    if (form) form.addEventListener('submit', submitBooking);
});
