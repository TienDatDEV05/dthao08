-- Fix semesters schema compatibility
-- Thêm cột is_active vào bảng semesters (nếu chưa có) để tương thích đầy đủ
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'semesters' AND column_name = 'is_active'
    ) THEN 
        ALTER TABLE semesters ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;
