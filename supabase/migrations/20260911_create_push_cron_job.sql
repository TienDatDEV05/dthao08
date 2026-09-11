-- =========================================================
-- GIẢI PHÁP TỰ ĐỘNG GỬI THÔNG BÁO TIẾT HỌC 24/7 TRÊN SUPABASE CLOUD
-- Chạy ngầm 100% trên đám mây Supabase - TẮT MÁY TÍNH VẪN HOẠT ĐỘNG
-- =========================================================

-- 1. Bảng lưu vết thông báo đã gửi (Chống gửi trùng lặp tuyệt đối)
CREATE TABLE IF NOT EXISTS public.push_notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_tag TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_notif_logs_tag ON public.push_notification_logs(notification_tag);
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.push_notification_logs TO service_role;

-- Tự động dọn dẹp các log cũ hơn 7 ngày
DELETE FROM public.push_notification_logs WHERE created_at < now() - INTERVAL '7 days';

-- 2. Kích hoạt Extension pg_cron và pg_net trên Supabase
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Tạo hàm gọi Supabase Edge Function 'send-push'
CREATE OR REPLACE FUNCTION public.invoke_send_push_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://qwvhudppdoauivpdewin.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_nrxl7NwtMoleoNiJIg3NdQ_UYf5xy2x',
      'Authorization', 'Bearer sb_publishable_nrxl7NwtMoleoNiJIg3NdQ_UYf5xy2x'
    ),
    body := jsonb_build_object(
      'action', 'check_schedules'
    )
  );
END;
$$;

-- 4. Hủy cron job cũ (nếu có) để tránh xung đột
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-schedule-push-job') THEN
    PERFORM cron.unschedule('check-schedule-push-job');
  END IF;
END $$;

-- 5. Đặt lịch chạy mỗi 1 phút trên Cloud (* * * * *)
SELECT cron.schedule(
  'check-schedule-push-job',
  '* * * * *',
  'SELECT public.invoke_send_push_cron();'
);

-- 6. Câu lệnh kiểm tra trạng thái cron job (sau khi chạy, bạn sẽ thấy job 'check-schedule-push-job' xuất hiện):
-- SELECT * FROM cron.job;
