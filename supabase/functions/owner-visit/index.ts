import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOSE_STATUSES = ["taken", "skipped"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = await req.json();
    const token = body?.token;

    if (typeof token !== "string" || !UUID_PATTERN.test(token)) {
      return json({ error: "invalid_token" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (body.action === "get_visit") {
      const { data, error } = await admin.rpc("get_visit_by_token", { p_token: token });
      if (error) {
        console.error("get_visit_by_token failed", error);
        return json({ error: "load_failed" }, 500);
      }
      if (!data) {
        return json({ error: "not_found" }, 404);
      }
      return json({ visit: data });
    }

    if (body.action === "set_status") {
      const reminderId = body.reminderId;
      const status = body.status;

      if (typeof reminderId !== "string" || !UUID_PATTERN.test(reminderId)) {
        return json({ error: "invalid_reminder" }, 400);
      }
      if (typeof status !== "string" || !DOSE_STATUSES.includes(status)) {
        return json({ error: "invalid_status" }, 400);
      }

      const { data, error } = await admin.rpc("set_reminder_status", {
        p_token: token,
        p_reminder_id: reminderId,
        p_status: status,
      });
      if (error) {
        console.error("set_reminder_status failed", error);
        return json({ error: "save_failed" }, 500);
      }
      return json({ status: data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (cause) {
    console.error("owner-visit failed", cause);
    return json({ error: "internal_error" }, 500);
  }
});
