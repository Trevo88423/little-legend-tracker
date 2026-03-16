import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@littlelegendtracker.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface PushSubscription {
  id: string;
  user_id: string;
  family_id: string;
  child_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
}

interface Medication {
  id: string;
  name: string;
  dose: string;
  times: string[];
  family_id: string;
  child_id: string;
}

interface Settings {
  med_alarms: boolean;
  family_id: string;
  child_id: string;
}

serve(async (req: Request) => {
  try {
    // Authenticate: only allow service_role key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }
    // Verify the token is a service_role JWT by decoding the payload
    const token = authHeader.split(" ")[1];
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.role !== "service_role") {
        return new Response("Unauthorized", { status: 401 });
      }
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get all push subscriptions grouped by family+child
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Group subscriptions by family_id + child_id
    const groups = new Map<string, PushSubscription[]>();
    for (const sub of subscriptions as PushSubscription[]) {
      const key = `${sub.family_id}::${sub.child_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(sub);
    }

    let totalSent = 0;
    const expiredEndpoints: string[] = [];

    for (const [groupKey, subs] of groups) {
      const [familyId, childId] = groupKey.split("::");
      const timezone = subs[0].timezone || "UTC";

      // Check if med_alarms is enabled for this family+child
      const { data: settingsRows } = await supabase
        .from("settings")
        .select("med_alarms")
        .eq("family_id", familyId)
        .eq("child_id", childId)
        .limit(1);

      const settings = settingsRows?.[0] as Settings | undefined;
      if (!settings?.med_alarms) continue;

      // Get medications for this family+child
      const { data: medications } = await supabase
        .from("medications")
        .select("id, name, dose, times")
        .eq("family_id", familyId)
        .eq("child_id", childId);

      if (!medications || medications.length === 0) continue;

      // Get current time in the device's timezone
      const nowInTz = new Date(
        new Date().toLocaleString("en-US", { timeZone: timezone })
      );
      const nowHours = nowInTz.getHours();
      const nowMinutes = nowInTz.getMinutes();
      const nowMin = nowHours * 60 + nowMinutes;
      const todayStr = nowInTz.toISOString().split("T")[0]; // YYYY-MM-DD

      // Get today's med_logs to check what's already given
      // med_key format: "{medication_id}_{HH:MM}"
      const { data: medLogs } = await supabase
        .from("med_logs")
        .select("med_key")
        .eq("family_id", familyId)
        .eq("child_id", childId)
        .eq("date", todayStr);

      const givenSet = new Set(
        (medLogs || []).map((log: { med_key: string }) => log.med_key)
      );

      for (const med of medications as Medication[]) {
        for (const time of med.times) {
          const [h, m] = time.split(":").map(Number);
          const medMin = h * 60 + m;

          // Skip if already given
          if (givenSet.has(`${med.id}_${time}`)) continue;

          // Determine notification type
          let notificationType: string | null = null;
          let title = "";
          let body = "";

          if (nowMin === medMin - 5) {
            notificationType = "early";
            title = `💊 ${med.name} due in 5 minutes`;
            body = `${med.dose || ""} at ${formatTime12(time)}`;
          } else if (nowMin === medMin) {
            notificationType = "due";
            title = `⏰ ${med.name} is due now!`;
            body = `${med.dose || ""} — tap to open tracker`;
          } else if (nowMin === medMin + 15) {
            notificationType = "late";
            title = `⚠️ ${med.name} is 15 minutes overdue`;
            body = `${med.dose || ""} was due at ${formatTime12(time)}`;
          }

          if (!notificationType) continue;

          // Deduplicate via notification_log
          const { error: logError } = await supabase
            .from("notification_log")
            .insert({
              family_id: familyId,
              child_id: childId,
              medication_id: med.id,
              med_time: time,
              notification_type: notificationType,
              notification_date: todayStr,
            });

          // Unique constraint violation means already sent
          if (logError) continue;

          // Send push to all subscribed devices for this family+child
          const tag = `med-${notificationType}-${med.id}-${time}`;
          const payload = JSON.stringify({ title, body, tag, data: { url: "/app/meds" } });

          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              totalSent++;
            } catch (err: unknown) {
              const pushErr = err as { statusCode?: number };
              // 410 Gone or 404 = subscription expired
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                expiredEndpoints.push(sub.endpoint);
              }
            }
          }
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    // Clean up old notification_log entries (older than 2 days)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const cutoffDate = twoDaysAgo.toISOString().split("T")[0];

    await supabase
      .from("notification_log")
      .delete()
      .lt("notification_date", cutoffDate);

    return new Response(
      JSON.stringify({
        sent: totalSent,
        expired_cleaned: expiredEndpoints.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-notifications error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}
