import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
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
  supply_unit: string | null;
  dose_amount: number | null;
  supply_remaining: number | null;
  supply_total: number | null;
  expiry_date: string | null;
  opened_date: string | null;
  days_after_opening: number | null;
  low_supply_days: number | null;
}

interface Settings {
  med_alarms: boolean;
  feed_alarms: boolean;
  family_id: string;
  child_id: string;
}

interface FeedSchedule {
  id: string;
  times: string[];
  target_amount: number | null;
  feed_type: string;
  family_id: string;
  child_id: string;
}

serve(async (req: Request) => {
  try {
    // Authenticate: only allow requests with the cron secret
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    if (token !== CRON_SECRET) {
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
        .select("med_alarms, feed_alarms")
        .eq("family_id", familyId)
        .eq("child_id", childId)
        .limit(1);

      const settings = settingsRows?.[0] as Settings | undefined;
      if (!settings?.med_alarms && !settings?.feed_alarms) continue;

      // Get current time in the device's timezone
      const nowInTz = new Date(
        new Date().toLocaleString("en-US", { timeZone: timezone })
      );
      const nowHours = nowInTz.getHours();
      const nowMinutes = nowInTz.getMinutes();
      const nowMin = nowHours * 60 + nowMinutes;
      const todayStr = nowInTz.toISOString().split("T")[0]; // YYYY-MM-DD

      // === MEDICATION NOTIFICATIONS ===
      if (settings?.med_alarms) {
        const { data: medications } = await supabase
          .from("medications")
          .select("id, name, dose, times, supply_unit, dose_amount, supply_remaining, supply_total, expiry_date, opened_date, days_after_opening, low_supply_days")
          .eq("family_id", familyId)
          .eq("child_id", childId)
          .eq("active", true);

        if (medications && medications.length > 0) {
          // Get today's med_logs to check what's already given
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

              if (givenSet.has(`${med.id}_${time}`)) continue;

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

              if (logError) continue;

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
                  if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                    expiredEndpoints.push(sub.endpoint);
                  }
                }
              }
            }
          }
        }
      }

      // === FEED SCHEDULE NOTIFICATIONS ===
      if (settings?.feed_alarms) {
        const { data: feedScheduleRows } = await supabase
          .from("feed_schedules")
          .select("id, times, target_amount, feed_type")
          .eq("family_id", familyId)
          .eq("child_id", childId)
          .limit(1);

        const feedSchedule = feedScheduleRows?.[0] as FeedSchedule | undefined;

        if (feedSchedule && feedSchedule.times && feedSchedule.times.length > 0) {
          // Get today's feeds to check completion
          const { data: todayFeeds } = await supabase
            .from("feeds")
            .select("time")
            .eq("family_id", familyId)
            .eq("child_id", childId)
            .eq("date", todayStr);

          const fedTimes = new Set(
            (todayFeeds || []).map((f: { time: string }) => f.time)
          );

          for (const time of feedSchedule.times) {
            const [h, m] = time.split(":").map(Number);
            const feedMin = h * 60 + m;

            if (nowMin !== feedMin) continue;
            if (fedTimes.has(time)) continue;

            // Dedup via notification_log
            const { error: logError } = await supabase
              .from("notification_log")
              .insert({
                family_id: familyId,
                child_id: childId,
                medication_id: "feed-schedule",
                med_time: time,
                notification_type: "feed-due",
                notification_date: todayStr,
              });

            if (logError) continue;

            const target = feedSchedule.target_amount;
            const title = `🍼 Feed due now!`;
            const body = `${target ? target + " mL " : ""}${formatTime12(time)} — tap to log`;
            const tag = `feed-due-${time}`;
            const payload = JSON.stringify({ title, body, tag, data: { url: "/app/feeding" } });

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
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                  expiredEndpoints.push(sub.endpoint);
                }
              }
            }
          }
        }
      }

      // === SUPPLY & EXPIRY NOTIFICATIONS (8:00 AM only) ===
      if (settings?.med_alarms && nowHours === 8 && nowMinutes === 0) {
        const { data: supplyMeds } = await supabase
          .from("medications")
          .select("id, name, dose, times, supply_unit, dose_amount, supply_remaining, supply_total, expiry_date, opened_date, days_after_opening, low_supply_days")
          .eq("family_id", familyId)
          .eq("child_id", childId)
          .eq("active", true);
        for (const med of (supplyMeds || []) as Medication[]) {
          const hasSupply = med.dose_amount != null && med.supply_remaining != null;
          const timesPerDay = med.times?.length || 1;
          const daysRemaining = hasSupply ? med.supply_remaining! / (med.dose_amount! * timesPerDay) : null;
          const lowDays = med.low_supply_days ?? 3;
          const isLow = daysRemaining != null && daysRemaining <= lowDays;

          // Calculate effective expiry
          let effectiveExpiry: string | null = med.expiry_date || null;
          if (med.opened_date && med.days_after_opening) {
            const opened = new Date(med.opened_date);
            opened.setDate(opened.getDate() + med.days_after_opening);
            const openedExpiry = opened.toISOString().split("T")[0];
            if (!effectiveExpiry || openedExpiry < effectiveExpiry) effectiveExpiry = openedExpiry;
          }
          const daysUntilExpiry = effectiveExpiry ? Math.ceil((new Date(effectiveExpiry).getTime() - new Date(todayStr).getTime()) / 86400000) : null;
          const isExpiringSoon = daysUntilExpiry != null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
          const isExpired = daysUntilExpiry != null && daysUntilExpiry <= 0;

          // Low supply notification
          if (isLow && daysRemaining != null) {
            const { error: logError } = await supabase.from("notification_log").insert({
              family_id: familyId, child_id: childId, medication_id: med.id,
              med_time: "supply", notification_type: "supply-low", notification_date: todayStr,
            });
            if (!logError) {
              const unit = med.supply_unit || "mL";
              const title = `⚠️ Low supply: ${med.name}`;
              const body = `${Math.round(daysRemaining)} days remaining (${med.supply_remaining}${unit})`;
              const tag = `supply-low-${med.id}`;
              const payload = JSON.stringify({ title, body, tag, data: { url: "/app/meds" } });
              for (const sub of subs) {
                try {
                  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
                  totalSent++;
                } catch (err: unknown) {
                  const pushErr = err as { statusCode?: number };
                  if (pushErr.statusCode === 410 || pushErr.statusCode === 404) expiredEndpoints.push(sub.endpoint);
                }
              }
            }
          }

          // Expiring soon notification
          if (isExpiringSoon && daysUntilExpiry != null) {
            const { error: logError } = await supabase.from("notification_log").insert({
              family_id: familyId, child_id: childId, medication_id: med.id,
              med_time: "expiry", notification_type: "supply-expiring", notification_date: todayStr,
            });
            if (!logError) {
              const title = `⚠️ Expiring soon: ${med.name}`;
              const body = `Expires in ${daysUntilExpiry} days`;
              const tag = `supply-exp-${med.id}`;
              const payload = JSON.stringify({ title, body, tag, data: { url: "/app/meds" } });
              for (const sub of subs) {
                try {
                  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
                  totalSent++;
                } catch (err: unknown) {
                  const pushErr = err as { statusCode?: number };
                  if (pushErr.statusCode === 410 || pushErr.statusCode === 404) expiredEndpoints.push(sub.endpoint);
                }
              }
            }
          }

          // Expired notification
          if (isExpired) {
            const { error: logError } = await supabase.from("notification_log").insert({
              family_id: familyId, child_id: childId, medication_id: med.id,
              med_time: "expiry", notification_type: "supply-expired", notification_date: todayStr,
            });
            if (!logError) {
              const title = `❌ Expired: ${med.name}`;
              const body = "This medication has expired and should not be used";
              const tag = `supply-expired-${med.id}`;
              const payload = JSON.stringify({ title, body, tag, data: { url: "/app/meds" } });
              for (const sub of subs) {
                try {
                  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
                  totalSent++;
                } catch (err: unknown) {
                  const pushErr = err as { statusCode?: number };
                  if (pushErr.statusCode === 410 || pushErr.statusCode === 404) expiredEndpoints.push(sub.endpoint);
                }
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
