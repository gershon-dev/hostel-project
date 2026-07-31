// ═══════════════════════════════════════════════════════════
// paystack-webhook
// This is the SOURCE OF TRUTH for "did the student actually
// pay". Paystack calls this server-to-server after a Mobile
// Money charge succeeds — independent of whether the student's
// browser is even still open.
//
// Deploy:
//   supabase functions deploy paystack-webhook --no-verify-jwt
//
// After deploying, copy the function URL into:
//   Paystack Dashboard → Settings → API Keys & Webhooks → Webhook URL
//
// Required secrets: PAYSTACK_SECRET_KEY (same key used to sign
// the webhook payload — Paystack uses your secret key for both).
// ═══════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read the RAW body — signature is computed over the exact bytes Paystack sent.
  // Do not req.json() first; that would let whitespace differences break verification.
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  const expectedSignature = await hmacSha512Hex(PAYSTACK_SECRET_KEY, rawBody);

  if (!timingSafeEqual(signature, expectedSignature)) {
    console.warn("Webhook signature mismatch — rejecting.");
    // Don't leak details. A mismatched signature means this request did
    // not come from Paystack (or the secret key is misconfigured).
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const data = event.data;
    const reference: string = data.reference;
    const amountPesewasPaid: number = data.amount;

    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("id, amount, status")
      .eq("paystack_reference", reference)
      .single();

    if (fetchErr || !booking) {
      console.error("Webhook for unknown reference:", reference);
      // Still 200 — nothing Paystack can retry its way out of here.
      return new Response("ok", { status: 200 });
    }

    // Idempotency: if we've already marked this paid, do nothing further.
    if (booking.status === "paid") {
      return new Response("already processed", { status: 200 });
    }

    // Sanity check the amount actually paid matches what we charged for,
    // in case of any mismatch/tampering upstream.
    const expectedPesewas = Math.round(Number(booking.amount) * 100);
    if (amountPesewasPaid !== expectedPesewas) {
      console.error(
        `Amount mismatch on ${reference}: expected ${expectedPesewas}, got ${amountPesewasPaid}`
      );
      await supabase.from("bookings").update({ status: "failed" }).eq("id", booking.id);
      return new Response("amount mismatch", { status: 200 });
    }

    await supabase
      .from("bookings")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", booking.id);
  }

  // Any other event type (charge.failed, etc.) — acknowledge and ignore.
  return new Response("ok", { status: 200 });
});

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}