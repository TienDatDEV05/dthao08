-- =========================================================
-- Bổ sung các trường liên kết tài khoản Cổng sinh viên HPU2
-- =========================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS hpu2_student_id TEXT,
ADD COLUMN IF NOT EXISTS hpu2_password TEXT,
ADD COLUMN IF NOT EXISTS hpu2_last_synced TIMESTAMPTZ;

-- Cập nhật ghi chú chú thích cho các cột
COMMENT ON COLUMN public.user_profiles.hpu2_student_id IS 'Mã sinh viên Cổng đào tạo HPU2';
COMMENT ON COLUMN public.user_profiles.hpu2_password IS 'Mật khẩu Cổng đào tạo HPU2';
COMMENT ON COLUMN public.user_profiles.hpu2_last_synced IS 'Thời điểm đồng bộ thời khóa biểu HPU2 gần nhất';
