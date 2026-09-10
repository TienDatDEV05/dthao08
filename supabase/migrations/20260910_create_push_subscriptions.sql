-- =========================================================
-- Bảng lưu trữ Web Push Subscriptions của người dùng
-- Hỗ trợ iOS PWA (Apple APNs), Android (FCM), Desktop (Chrome/Edge/Firefox)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Người dùng chỉ có quyền xem subscription của chính mình
CREATE POLICY "Users can view their own push subscriptions"
    ON public.push_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Người dùng có thể thêm/cập nhật subscription của chính mình
CREATE POLICY "Users can insert their own push subscriptions"
    ON public.push_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
    ON public.push_subscriptions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Người dùng có thể xóa subscription của mình khi đăng xuất hoặc tắt thông báo
CREATE POLICY "Users can delete their own push subscriptions"
    ON public.push_subscriptions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Index để tối ưu truy vấn theo user_id và endpoint
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Cho phép Supabase Service Role truy cập đầy đủ (cho Edge Functions & Cron Jobs)
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
