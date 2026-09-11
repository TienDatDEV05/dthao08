import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Bảng màu pastel cao cấp dành cho các môn học
const PASTEL_COLORS = [
  "#ffd6e7", // Hồng phấn
  "#e0c3fc", // Tím lavender
  "#d0f4de", // Xanh bạc hà
  "#ffdfba", // Cam đào
  "#bbf2f6", // Xanh biển nhạt
  "#fcf6bd", // Vàng pastel
  "#ffc6ff", // Hồng phong lan
  "#cbf3f0", // Xanh ngọc dịu
  "#e2ece9", // Xám xanh thanh lịch
  "#f1c0e8"  // Tím hồng kẹo ngọt
];

// Khung giờ chuẩn 12 tiết học (45 phút/tiết)
const DEFAULT_PERIODS = [
  { period: 1, start: "07:00:00", end: "07:45:00" },
  { period: 2, start: "07:50:00", end: "08:35:00" },
  { period: 3, start: "08:45:00", end: "09:30:00" },
  { period: 4, start: "09:35:00", end: "10:20:00" },
  { period: 5, start: "10:25:00", end: "11:10:00" },
  { period: 6, start: "13:00:00", end: "13:45:00" },
  { period: 7, start: "13:50:00", end: "14:35:00" },
  { period: 8, start: "14:45:00", end: "15:30:00" },
  { period: 9, start: "15:35:00", end: "16:20:00" },
  { period: 10, start: "16:25:00", end: "17:10:00" },
  { period: 11, start: "17:15:00", end: "18:00:00" },
  { period: 12, start: "18:05:00", end: "18:50:00" }
];

function extractPeriodsFromPattern(periodStr: string): number[] {
  const periods: number[] = [];
  const clean = String(periodStr || "").replace(/&minus;/g, "-");
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch !== "-" && ch !== " ") {
      const num = parseInt(ch, 10);
      if (!isNaN(num)) {
        if (i >= 9) {
          // Vị trí thứ 10 trở đi: 10, 11, 12...
          periods.push(i + 1);
        } else {
          periods.push(num);
        }
      }
    }
  }
  return periods;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    let { username, password, userId, autoApply = true, rawHtml = null } = body;

    // Nếu không truyền trực tiếp, tìm trong profile người dùng
    if ((!username || !password) && userId && !rawHtml) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("hpu2_student_id, hpu2_password")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile?.hpu2_student_id && profile?.hpu2_password) {
        username = profile.hpu2_student_id;
        password = profile.hpu2_password;
      }
    }

    let tkbHtml = rawHtml;
    let studentName = "";
    let detectedSemester = "Học kỳ 1 (2026-2027)";

    // Nếu không có rawHtml truyền lên, thực hiện cào trực tiếp từ Cổng HPU2
    if (!tkbHtml) {
      if (!username || !password) {
        return new Response(
          JSON.stringify({ error: "Vui lòng cung cấp Mã sinh viên và Mật khẩu HPU2." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cookieMap = new Map<string, string>();
      const updateCookies = (cookieHeaders: string[] | null) => {
        if (!cookieHeaders) return;
        for (const c of cookieHeaders) {
          const parts = c.split(";")[0].split("=");
          if (parts.length >= 2) {
            cookieMap.set(parts[0].trim(), parts.slice(1).join("=").trim());
          }
        }
      };
      const getCookieHeader = () => Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

      // Bước 1: Handshake trang chủ lấy PHPSESSID
      const initRes = await fetch("https://sinhvien.hpu2.edu.vn/", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      updateCookies(initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : []);

      // Bước 2: Đăng nhập
      const bodyParams = new URLSearchParams();
      bodyParams.append("txt_Login_ten_dang_nhap", username);
      bodyParams.append("pw_Login_mat_khau", password);
      bodyParams.append("bt_Login_submit", "");

      const loginRes = await fetch("https://sinhvien.hpu2.edu.vn/login/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": getCookieHeader(),
          "Referer": "https://sinhvien.hpu2.edu.vn/"
        },
        body: bodyParams.toString()
      });
      updateCookies(loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : []);
      const loginHtml = await loginRes.text();

      // Kiểm tra xem có redirect sang /sinhvien không
      if (!loginHtml.includes("frmRedirect") && !loginHtml.includes("sinhvien")) {
        return new Response(
          JSON.stringify({ error: "Mã sinh viên hoặc mật khẩu HPU2 không đúng." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Bước 3: Theo dõi redirect vào trang portal chính để lấy token pu
      const svRes = await fetch("https://sinhvien.hpu2.edu.vn/sinhvien", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": getCookieHeader(),
          "Referer": "https://sinhvien.hpu2.edu.vn/login/login"
        },
        body: "h_Sys_Arr="
      });
      updateCookies(svRes.headers.getSetCookie ? svRes.headers.getSetCookie() : []);
      const svHtml = await svRes.text();

      // Lấy tên sinh viên
      const nameMatch = svHtml.match(/<span class=["']user-name["'][^>]*>([^<]+)<\/span>/i) ||
                         svHtml.match(/title=["']Tài khoản["'][^>]*>([^<]+)<\/a>/i);
      studentName = nameMatch ? nameMatch[1].trim() : "";

      // Lấy token pu
      const puMatch = svHtml.match(/name=["']pu["'][^>]*value=["']([^"']*)["']/i);
      const pu = puMatch ? puMatch[1] : "";

      // Bước 4: POST lấy thời khóa biểu
      const tkbParams = new URLSearchParams();
      if (pu) tkbParams.append("pu", pu);

      const tkbRes = await fetch("https://sinhvien.hpu2.edu.vn/sinhvien/thoikhoabieu", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": getCookieHeader(),
          "Referer": "https://sinhvien.hpu2.edu.vn/sinhvien"
        },
        body: tkbParams.toString()
      });
      tkbHtml = await tkbRes.text();
    }

    // Bóc tách bảng thời khóa biểu tb_index
    const tableMatch = tkbHtml.match(/<table[^>]*id=['"]tb_index['"][^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) {
      return new Response(
        JSON.stringify({ error: "Không tìm thấy bảng thời khóa biểu trên hệ thống HPU2." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bóc tách thông tin học kỳ nếu có
    const namHocMatch = tkbHtml.match(/name=["']cmb_sr_ds_nam_hoc["'][^>]*>[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
    const hocKyMatch = tkbHtml.match(/name=["']cmb_sr_ds_hoc_ky["'][^>]*>[\s\S]*?<option[^>]*selected[^>]*>([^<]+)<\/option>/i);
    if (namHocMatch || hocKyMatch) {
      const nh = namHocMatch ? namHocMatch[1].trim() : "2026-2027";
      const hk = hocKyMatch ? hocKyMatch[1].trim() : "1";
      detectedSemester = `Học kỳ ${hk} (${nh})`;
    }

    const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
    const subjectsMap = new Map();
    const scheduleItems: any[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const codeMatch = row.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
      const code = codeMatch ? codeMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());

      if (!code || tds.length < 9) continue;

      const group = tds[0];
      const name = tds[1];
      const credits = parseFloat(tds[3]) || 0;
      const classCode = tds[4];
      const dayStr = tds[5];
      const periodRaw = tds[6];
      const teacher = tds[7];
      const room = tds[8];

      // Map day: 2 -> 1 (Thứ 2), 3 -> 2 (Thứ 3), ..., 7 -> 6 (Thứ 7), CN/8 -> 7 (Chủ nhật)
      let dayOfWeek = parseInt(dayStr, 10);
      if (dayStr.toLowerCase() === "cn" || dayOfWeek === 8) {
        dayOfWeek = 7;
      } else if (dayOfWeek >= 2 && dayOfWeek <= 7) {
        dayOfWeek = dayOfWeek - 1;
      }

      const periods = extractPeriodsFromPattern(periodRaw);

      if (!subjectsMap.has(code)) {
        subjectsMap.set(code, {
          code,
          name,
          credits,
          room,
          teacher,
          group,
          classCode
        });
      }

      for (const p of periods) {
        scheduleItems.push({
          subjectCode: code,
          subjectName: name,
          dayOfWeek,
          periodNumber: p,
          room
        });
      }
    }

    const parsedSubjects = Array.from(subjectsMap.values());

    // Nếu có userId và autoApply = true, lưu trực tiếp vào cơ sở dữ liệu Supabase
    if (userId && autoApply && parsedSubjects.length > 0) {
      // 1. Đảm bảo đầy đủ 12 tiết học trong bảng periods
      const { data: existingPeriods } = await supabase
        .from("periods")
        .select("period_number")
        .eq("user_id", userId);

      const existingPeriodNums = new Set((existingPeriods || []).map((p: any) => Number(p.period_number)));
      const missingPeriods = DEFAULT_PERIODS.filter((dp) => !existingPeriodNums.has(dp.period));

      if (missingPeriods.length > 0) {
        const periodInserts = missingPeriods.map((dp) => ({
          user_id: userId,
          period_number: dp.period,
          start_time: dp.start,
          end_time: dp.end
        }));
        await supabase.from("periods").insert(periodInserts);
      }

      // 2. Tìm hoặc tạo Học kỳ
      let targetSemesterId: string | null = null;
      const { data: semData } = await supabase
        .from("semesters")
        .select("*")
        .eq("user_id", userId);

      const matchedSem = (semData || []).find((s: any) => s.name.trim().toLowerCase() === detectedSemester.trim().toLowerCase());
      if (matchedSem) {
        targetSemesterId = matchedSem.id;
      } else {
        const { data: newSem, error: semErr } = await supabase
          .from("semesters")
          .insert({
            user_id: userId,
            name: detectedSemester
          })
          .select()
          .single();
        if (semErr) throw semErr;
        targetSemesterId = newSem.id;
      }

      // 3. Upsert các môn học vào bảng subjects (chỉ dùng các cột thực sự tồn tại)
      const { data: userSubjects } = await supabase
        .from("subjects")
        .select("*")
        .eq("user_id", userId);

      const subjectIdMap = new Map<string, string>();
      let colorIdx = 0;

      for (const sub of parsedSubjects) {
        const existingSub = (userSubjects || []).find(
          (s: any) => s.name.trim().toLowerCase() === sub.name.trim().toLowerCase() ||
                      (s.name && s.name.toLowerCase().includes(sub.code.toLowerCase()))
        );

        if (existingSub) {
          subjectIdMap.set(sub.code, existingSub.id);
          // Cập nhật thông tin giảng viên và phòng học mới nhất (B4.3)
          await supabase
            .from("subjects")
            .update({
              teacher: sub.teacher || existingSub.teacher,
              room: sub.room || existingSub.room
            })
            .eq("id", existingSub.id);
        } else {
          const color = PASTEL_COLORS[colorIdx % PASTEL_COLORS.length];
          colorIdx++;
          const { data: newSub, error: subErr } = await supabase
            .from("subjects")
            .insert({
              user_id: userId,
              name: sub.name,
              teacher: sub.teacher,
              room: sub.room,
              color: color
            })
            .select()
            .single();

          if (subErr) throw subErr;
          subjectIdMap.set(sub.code, newSub.id);
        }
      }

      // 4. Làm mới toàn bộ lịch học của học kỳ này
      if (targetSemesterId) {
        await supabase
          .from("schedule_entries")
          .delete()
          .eq("user_id", userId)
          .eq("semester_id", targetSemesterId);

        const newEntries = scheduleItems
          .map((item) => {
            const subId = subjectIdMap.get(item.subjectCode);
            if (!subId) return null;
            return {
              user_id: userId,
              semester_id: targetSemesterId,
              subject_id: subId,
              day_of_week: item.dayOfWeek,
              period_number: item.periodNumber
            };
          })
          .filter(Boolean);

        if (newEntries.length > 0) {
          const { error: insErr } = await supabase
            .from("schedule_entries")
            .insert(newEntries);
          if (insErr) throw insErr;
        }
      }

      // 5. Cập nhật hồ sơ tài khoản HPU2
      if (username) {
        await supabase.from("user_profiles").upsert({
          user_id: userId,
          hpu2_student_id: username,
          hpu2_password: password,
          hpu2_last_synced: new Date().toISOString()
        }, { onConflict: "user_id" });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        studentName,
        semesterName: detectedSemester,
        subjectCount: parsedSubjects.length,
        entryCount: scheduleItems.length,
        subjects: parsedSubjects,
        scheduleItems
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("HPU2 Sync Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Đã xảy ra lỗi khi đồng bộ từ HPU2." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
