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

// Bộ nhớ đệm chống gửi trùng thông báo đẩy trong ngày
const sentNotificationCache = new Set<string>();

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
      // Giờ Việt Nam chuẩn (UTC+7)
      const now = new Date();
      const vnFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      const parts = vnFormatter.formatToParts(now);
      const partObj: Record<string, string> = {};
      parts.forEach((p) => (partObj[p.type] = p.value));

      const vnYear = partObj.year;
      const vnMonth = partObj.month;
      const vnDay = partObj.day;
      const vnHour = parseInt(partObj.hour, 10);
      const vnMinute = parseInt(partObj.minute, 10);

      const todayStr = `${vnYear}-${vnMonth}-${vnDay}`;
      const currentMinutes = vnHour * 60 + vnMinute;

      // Tính ngày trong tuần (Việt Nam): Thứ 2 = 1, Thứ 3 = 2, ..., CN = 7
      const vnDateObj = new Date(`${vnYear}-${vnMonth}-${vnDay}T${partObj.hour}:${partObj.minute}:00+07:00`);
      const jsDay = vnDateObj.getDay();
      const currentDay = jsDay === 0 ? 7 : jsDay;

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
      const deadSubscriptions: string[] = [];

      for (const [uid, userSubs] of userSubsMap.entries()) {
        // Lấy cấu hình thông báo tùy chỉnh của user (mặc định nhắc trước 45 phút)
        let notifyWindow = 45;
        try {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("notif_config")
            .eq("user_id", uid)
            .maybeSingle();
          if (profile?.notif_config?.minutes) {
            notifyWindow = Number(profile.notif_config.minutes) || 45;
          }
        } catch (_) {}

        // Lấy học kỳ đang kích hoạt nếu có
        const { data: activeSem } = await supabase
          .from("semesters")
          .select("id")
          .eq("user_id", uid)
          .eq("is_active", true)
          .maybeSingle();

        // Lấy lịch học hôm nay của user (bao gồm thông tin môn học)
        let scheduleQuery = supabase
          .from("schedule_entries")
          .select("*, subjects(name, teacher, room, color)")
          .eq("user_id", uid)
          .eq("day_of_week", currentDay);

        if (activeSem?.id) {
          scheduleQuery = scheduleQuery.eq("semester_id", activeSem.id);
        }

        const { data: entries } = await scheduleQuery;

        if (!entries || !entries.length) continue;

        // Lấy danh sách tiết học
        const { data: periods } = await supabase
          .from("periods")
          .select("*")
          .eq("user_id", uid);

        if (!periods || !periods.length) continue;

        const sortedPeriods = [...periods].sort((a, b) => Number(a.period_number) - Number(b.period_number));

        const parseMin = (t: string) => {
          if (!t) return null;
          const [h, m] = t.split(":").map(Number);
          return (h || 0) * 60 + (m || 0);
        };

        const isAdjacent = (p1: any, p2: any) => {
          if (!p1 || !p2) return false;
          const isNumAdj = Number(p2.period_number) === Number(p1.period_number) + 1;
          const t1End = parseMin(p1.end_time);
          const t2Start = parseMin(p2.start_time);
          if (t1End !== null && t2Start !== null) {
            const gap = t2Start - t1End;
            return gap >= 0 && gap <= 45;
          }
          return isNumAdj;
        };

        const todayEntries = entries.sort((a, b) => Number(a.period_number) - Number(b.period_number));

        for (const entry of todayEntries) {
          const periodNum = Number(entry.period_number);
          const pIndex = sortedPeriods.findIndex((p) => Number(p.period_number) === periodNum);
          if (pIndex < 0) continue;

          const period = sortedPeriods[pIndex];
          if (!period || !period.start_time) continue;

          // Nếu tiết trước đó liền kề học cùng môn -> Bỏ qua, chỉ thông báo ở tiết đầu
          const prevPeriod = pIndex > 0 ? sortedPeriods[pIndex - 1] : null;
          const isContinuation =
            prevPeriod &&
            isAdjacent(prevPeriod, period) &&
            todayEntries.some(
              (prev) =>
                Number(prev.period_number) === Number(prevPeriod.period_number) &&
                prev.subject_id === entry.subject_id
            );
          if (isContinuation) continue;

          // Tính số tiết học liên tiếp của môn này
          let consecutiveCount = 1;
          let lastPeriod = period;
          let nextIdx = pIndex + 1;
          while (nextIdx < sortedPeriods.length) {
            const nextP = sortedPeriods[nextIdx];
            const isAdj = isAdjacent(lastPeriod, nextP);
            const nextEntry = todayEntries.find(
              (e) =>
                Number(e.period_number) === Number(nextP.period_number) &&
                e.subject_id === entry.subject_id
            );
            if (isAdj && nextEntry) {
              consecutiveCount++;
              lastPeriod = nextP;
              nextIdx++;
            } else {
              break;
            }
          }

          const [sh, sm] = period.start_time.split(":").map(Number);
          const startMinutes = sh * 60 + sm;
          const diff = startMinutes - currentMinutes;

          // Cửa sổ nhắc nhở: trước 45 phút (hoặc theo cài đặt người dùng) đến khi vừa vào tiết
          if (diff >= 0 && diff <= notifyWindow) {
            const dedupTag = `dthao-push-${uid}-${todayStr}-${periodNum}`;

            // Chống trùng lặp (In-memory Cache + Database Log nếu có)
            if (sentNotificationCache.has(dedupTag)) continue;

            try {
              const { data: existingLog } = await supabase
                .from("push_notification_logs")
                .select("id")
                .eq("notification_tag", dedupTag)
                .maybeSingle();
              if (existingLog) {
                sentNotificationCache.add(dedupTag);
                continue;
              }
            } catch (_) {}

            const subjectName = entry.subjects?.name || "Tiết học";
            const roomName = entry.subjects?.room || "";
            const roomText = roomName ? ` • Phòng: ${roomName}` : "";

            const periodLabel =
              consecutiveCount > 1
                ? `Tiết ${periodNum} - ${lastPeriod.period_number}`
                : `Tiết ${periodNum}`;
            const countNote = consecutiveCount > 1 ? ` (${consecutiveCount} tiết liên tiếp)` : "";
            const timeInfo = `${period.start_time.slice(0, 5)} - ${(lastPeriod.end_time || period.end_time || "").slice(0, 5)}`;

            let title = `🔔 ${periodLabel}`;
            if (diff > 0) {
              title += ` sắp bắt đầu (${diff} phút nữa)`;
            } else {
              title += ` đang bắt đầu ngay bây giờ!`;
            }

            const bodyText = `Môn: ${subjectName}${countNote}\nThời gian: ${timeInfo}${roomText}`;

            const payload = JSON.stringify({
              title,
              body: bodyText,
              tag: dedupTag,
              data: { url: "./" }
            });

            // Ghi nhận đã gửi để không bị gửi lặp
            sentNotificationCache.add(dedupTag);
            try {
              await supabase.from("push_notification_logs").insert({
                user_id: uid,
                notification_tag: dedupTag
              });
            } catch (_) {}

            // Gửi push tới tất cả thiết bị đã đăng ký
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
              } catch (pushErr: any) {
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                  deadSubscriptions.push(sub.id);
                }
              }
            }
          }
        }
      }

      // Xóa các subscription không còn tồn tại
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
