// ═══════════════════════════════════════════════════════════
// initialize-payment
// Called by the browser when a student clicks "Pay with Mobile
// Money". Creates a `pending` booking and starts a Paystack
// transaction restricted to the mobile_money channel.
//
// Deploy:
//   supabase functions deploy initialize-payment --no-verify-jwt
//
// Required secrets (supabase secrets set ...):
//   PAYSTACK_SECRET_KEY
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
//  automatically by the Edge Functions runtime — do not set
//  them yourself.)
// ═══════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client — bypasses RLS. Never expose this key to the browser.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const {
      room_type_id,
      first_name,
      last_name,
      email,
      phone,
      callback_url, // optional — where Paystack sends the student back after paying
    } = body;

    // ── Validate input ──
    if (!room_type_id || !first_name || !last_name || !email || !phone) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!EMAIL_RE.test(email)) {
      return json({ error: "Invalid email address" }, 400);
    }

    // ── Re-price from the database. NEVER trust a client-sent amount. ──
    const { data: room, error: roomErr } = await supabase
      .from("room_types")
      .select("id, hostel_id, name, price, availability_status, hostels(name)")
      .eq("id", room_type_id)
      .single();

    if (roomErr || !room) {
      return json({ error: "Room type not found" }, 404);
    }

    if (room.availability_status === "full") {
      return json({ error: "This room type is fully booked" }, 409);
    }

    const amountPesewas = Math.round(Number(room.price) * 100);
    const reference = `uewh_${crypto.randomUUID().replace(/-/g, "")}`;

    // ── Create the pending booking first, so we have a row even if the
    //    Paystack call fails partway through. ──
    const { error: insertErr } = await supabase.from("bookings").insert({
      room_type_id: room.id,
      hostel_id: room.hostel_id,
      first_name,
      last_name,
      email,
      phone,
      amount: room.price,
      paystack_reference: reference,
      status: "pending",
    });

    if (insertErr) {
      console.error("Booking insert failed:", insertErr);
      return json({ error: "Could not create booking" }, 500);
    }

    // ── Start the Paystack transaction, mobile money only ──
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountPesewas,
        currency: "GHS",
        reference,
        channels: ["mobile_money"],
        callback_url: callback_url || undefined,
        metadata: {
          room_type_id: room.id,
          hostel_name: room.hostels?.name,
          room_name: room.name,
          student_name: `${first_name} ${last_name}`,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error("Paystack init failed:", paystackData);
      await supabase
        .from("bookings")
        .update({ status: "failed" })
        .eq("paystack_reference", reference);
      return json({ error: "Could not start payment. Please try again." }, 502);
    }

    return json({
      authorization_url: paystackData.data.authorization_url,
      reference,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}