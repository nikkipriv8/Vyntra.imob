// Lovable Cloud Function: delete-whatsapp-contact
// Deletes a WhatsApp conversation + its messages/read states and optionally the linked lead.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeleteContactRequest = {
  conversation_id?: string;
  delete_lead?: boolean;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claimsRes = await supabase.auth.getClaims(token);
    const userIdFromClaims = (claimsRes.data as any)?.claims?.sub as string | undefined;
    if (claimsRes.error || !userIdFromClaims) {
      console.warn("Invalid token", claimsRes.error);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userIdFromClaims;
    const body = (await req.json().catch(() => ({}))) as DeleteContactRequest;
    const conversationId = body.conversation_id;
    const deleteLead = body.delete_lead !== false;

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission: admin OR broker OR attendant
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "broker", "attendant"])
      .maybeSingle();

    if (roleErr) {
      console.error("Role check failed", roleErr);
      return new Response(JSON.stringify({ error: "Permission check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch conversation to know lead_id
    const { data: conv, error: convErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, lead_id, phone, whatsapp_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convErr) {
      console.error("Failed to fetch conversation", convErr);
      return new Response(JSON.stringify({ error: "Failed to fetch conversation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conv) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Deleting contact", {
      requested_by: userId,
      conversation_id: conversationId,
      phone: conv.phone,
      whatsapp_id: conv.whatsapp_id,
      lead_id: conv.lead_id,
      delete_lead: deleteLead,
    });

    const leadId = conv.lead_id as string | null;

    const { count: messagesDeleted, error: msgErr } = await supabase
      .from("whatsapp_messages")
      .delete({ count: "exact" })
      .eq("conversation_id", conversationId);
    if (msgErr) throw msgErr;

    const { count: readsDeleted, error: readsErr } = await supabase
      .from("whatsapp_conversation_reads")
      .delete({ count: "exact" })
      .eq("conversation_id", conversationId);
    if (readsErr) throw readsErr;

    const { count: conversationsDeleted, error: convDelErr } = await supabase
      .from("whatsapp_conversations")
      .delete({ count: "exact" })
      .eq("id", conversationId);
    if (convDelErr) throw convDelErr;

    let leadDeleted = 0;
    if (deleteLead && leadId) {
      const { count: leadCount, error: leadErr } = await supabase
        .from("leads")
        .delete({ count: "exact" })
        .eq("id", leadId);
      if (leadErr) throw leadErr;
      leadDeleted = leadCount ?? 0;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        messages_deleted: messagesDeleted ?? 0,
        reads_deleted: readsDeleted ?? 0,
        conversations_deleted: conversationsDeleted ?? 0,
        lead_deleted: leadDeleted,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("delete-whatsapp-contact failed", error);
    return new Response(JSON.stringify({ error: (error as any)?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
