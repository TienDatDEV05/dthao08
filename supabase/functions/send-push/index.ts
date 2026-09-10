import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cấu hình VAPID keys (mặc định lấy từ Environment Variables, fallback key đã tạo sẵn)
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BFc1YJgWlKUtje6VOoA34wB7S5Yu-CiCsiY-H0xJKFFdm0tvZA9NK6Fv5RKWeDe0sKWWF1tNCBAvfXSylKsPk4g";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "F9-rZZBZn7JRed5rkGrizu-wOJhP_F4RgmMg-d_hkAY";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@chongyeu.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  // Xử lý Preflight CORS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { action = "test", userId, delaySeconds = 0 } = body;

    // Chế độ 1: Gửi thông báo thử nghiệm (Test Push)
    if (action === "test") {
      let targetSubscriptions = [];

      if (body.subscription) {
        // Gửi trực tiếp vào object subscription truyền lên
        targetSubscriptions = [body.subscription];
      } else if (userId) {
        // Lấy tất cả subscription của user từ database
        const { data, error } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", userId);
        if (error) throw error;
        targetSubscriptions = data.map((s) => ({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth }
        }));
      }

      if (!targetSubscriptions.length) {
        return new Response(
          JSON.stringify({ error: "Không tìm thấy thiết bị nào đã đăng ký nhận thông báo." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Nếu có yêu cầu delay (để người dùng kịp khóa màn hình iPhone thử nghiệm)
      if (delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }

      const payload = JSON.stringify({
        title: body.title || "🔔 Thử nghiệm Web Push iOS thành công!",
        body: body.body || "Chồng yêu: Vợ ơi, thông báo đẩy đã xuyên qua màn hình khóa iPhone rồi nè ♡",
        tag: "dthao-test-push",
        data: { url: "./" }
      });

      const results = await Promise.allSettled(
        targetSubscriptions.map(async (sub) => {
          return await webpush.sendNotification(sub, payload);
        })
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã gửi thông báo tới ${successCount}/${targetSubscriptions.length} thiết bị.`,
          details: results
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chế độ 2: Cron Job tự động kiểm tra lịch học và gửi thông báo nhắc tiết
    if (action === "check_schedules") {
      // Giờ Việt Nam (UTC+7)
      const now = new Date();
      const vnTime = new Date(now.getTime() + 7 * 3600 * 1000);
      const jsDay = vnTime.getUTCDay();
      const currentDay = jsDay === 0 ? 7 : jsDay;
      const currentMinutes = vnTime.getUTCHours() * 60 + vnTime.getUTCMinutes();
      const todayStr = vnTime.toISOString().slice(0, 10);

      // Lấy tất cả subscriptions đang hoạt động
      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("*");
      if (subError) throw subError;

      if (!subscriptions || !subscriptions.length) {
        return new Response(
          JSON.stringify({ message: "Không có subscription nào." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Gom nhóm subscription theo user_id
      const userSubsMap = new Map();
      subscriptions.forEach((sub) => {
        if (!userSubsMap.has(sub.user_id)) {
          userSubsMap.set(sub.user_id, []);
        }
        userSubsMap.get(sub.user_id).push(sub);
      });

      let totalSent = 0;
      const deadSubscriptions = [];

      for (const [uid, userSubs] of userSubsMap.entries()) {
        // Lấy cấu hình thông báo của user
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("notif_config")
          .eq("user_id", uid)
          .maybeSingle();

        const notifConfig = profile?.notif_config || { enabled: true, minutes: 10 };
        if (!notifConfig.enabled) continue;

        const notifyWindow = Number(notifConfig.minutes) || 10;

        // Lấy lịch học hôm nay của user
        const { data: entries } = await supabase
          .from("schedule_entries")
          .select("*, subjects(name, room)")
          .eq("user_id", uid)
          .eq("day_of_week", currentDay);

        if (!entries || !entries.length) continue;

        // Lấy danh sách tiết học
        const { data: periods } = await supabase
          .from("periods")
          .select("*")
          .eq("user_id", uid);

        if (!periods || !periods.length) continue;

        for (const entry of entries) {
          const period = periods.find((p) => Number(p.period_number) === Number(entry.period_number));
          if (!period || !period.start_time) continue;

          const [sh, sm] = period.start_time.split(":").map(Number);
          const startMinutes = sh * 60 + sm;
          const diff = startMinutes - currentMinutes;

          // Kiểm tra nếu nằm trong khoảng nhắc nhở (ví dụ 10 phút trước đến khi vừa vào tiết)
          if (diff >= 0 && diff <= notifyWindow) {
            const subjectName = entry.subjects?.name || "Tiết học";
            const roomName = entry.room || entry.subjects?.room || "";
            const roomText = roomName ? ` • Phòng: ${roomName}` : "";

            const title = diff === 0
              ? `🔔 Tiết ${period.period_number} đang bắt đầu ngay bây giờ!`
              : `🔔 Tiết ${period.period_number} sắp bắt đầu (${diff} phút nữa)`;

            const bodyText = `Môn: ${subjectName}${roomText}\nThời gian: ${period.start_time.slice(0, 5)} - ${period.end_time.slice(0, 5)}`;

            const payload = JSON.stringify({
              title,
              body: bodyText,
              tag: `dthao-period-${todayStr}-${period.period_number}`,
              data: { url: "./" }
            });

            for (const sub of userSubs) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                  },
                  payload
                );
                totalSent++;
              } catch (pushErr) {
                // 410 Gone hoặc 404 Not Found: thiết bị đã gỡ PWA hoặc thu hồi quyền
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                  deadSubscriptions.push(sub.id);
                }
              }
            }
          }
        }
      }

      // Xóa các subscription đã chết
      if (deadSubscriptions.length) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .in("id", deadSubscriptions);
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalSent,
          cleanedSubscriptions: deadSubscriptions.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Hành động không hợp lệ." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
