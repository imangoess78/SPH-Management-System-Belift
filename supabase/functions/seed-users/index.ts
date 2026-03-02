import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USERS = [
  { email: "imangoess78@gmail.com", password: "Admin@2024!", fullName: "Iman Goess (Admin)", role: "admin" },
  { email: "staff1@belift.co.id", password: "Staff1@2024!", fullName: "Ahmad Hidayat", role: "staff" },
  { email: "staff2@belift.co.id", password: "Staff2@2024!", fullName: "Siti Nurhaliza", role: "staff" },
  { email: "staff3@belift.co.id", password: "Staff3@2024!", fullName: "Budi Santoso", role: "staff" },
  { email: "staff4@belift.co.id", password: "Staff4@2024!", fullName: "Dewi Lestari", role: "staff" },
  { email: "staff5@belift.co.id", password: "Staff5@2024!", fullName: "Rizky Pratama", role: "staff" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results = [];

    for (const user of USERS) {
      // Create user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
      });

      if (authError) {
        results.push({ email: user.email, status: "error", message: authError.message });
        continue;
      }

      // Assign role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: user.role });

      if (roleError) {
        results.push({ email: user.email, status: "partial", message: roleError.message });
        continue;
      }

      // Update profile name
      await supabase
        .from("profiles")
        .update({ full_name: user.fullName })
        .eq("user_id", authData.user.id);

      results.push({ email: user.email, status: "success", role: user.role });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
