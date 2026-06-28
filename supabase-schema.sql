-- ====================================================================
-- UNIVERSAL CHURCH KIOSK TERMINAL - SUPABASE DATABASE SCHEMA
-- Generic white-label structure for any church or ministry
-- ====================================================================

-- 1. BRANCHES TABLE (Multi-campus support)
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    branch_name TEXT NOT NULL,
    branch_code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed default fallback campus
INSERT INTO branches (id, branch_name, branch_code)
VALUES (1, 'Headquarters', 'HQ')
ON CONFLICT (id) DO NOTHING;

-- 2. MEMBERS TABLE (Core registry)
CREATE TABLE IF NOT EXISTS members (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    member_id_code TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_address TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    contact_number_1 TEXT NOT NULL,
    contact_number_2 TEXT,
    email_address TEXT,
    occupation TEXT,
    marital_status TEXT NOT NULL CHECK (marital_status IN ('Single', 'Married', 'Widowed', 'Divorced')),
    nationality TEXT NOT NULL,
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL,
    want_to_join_department TEXT NOT NULL CHECK (want_to_join_department IN ('Yes', 'No')),
    baptized TEXT NOT NULL CHECK (baptized IN ('Yes', 'No')),
    photo_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. DEPARTMENTS TABLE (Ministry wings)
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    dept_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed 12 standard ministry wings
INSERT INTO departments (id, dept_name) VALUES
    (1, 'Music Team'),
    (2, 'Media & IT Team'),
    (3, 'Ushering Wing'),
    (4, 'Intercessory Ministry'),
    (5, 'Protocol & Security'),
    (6, 'Welfare & Hospitality'),
    (7, 'Sunday School Teachers'),
    (8, 'Evangelism & Outreach'),
    (9, 'Sanctuary Cleaners'),
    (10, 'Counseling & Follow-Up'),
    (11, 'Men''s Fellowship'),
    (12, 'Women''s Fellowship')
ON CONFLICT (id) DO NOTHING;

-- 4. MEMBER_DEPARTMENTS TABLE (Many-to-many junction)
CREATE TABLE IF NOT EXISTS member_departments (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(member_id, department_id)
);

-- 5. ATTENDANCE_RECORDS TABLE (Service tracking)
CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    is_present BOOLEAN NOT NULL DEFAULT FALSE,
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    service_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for faster attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date 
ON attendance_records(branch_id, service_date);
CREATE INDEX IF NOT EXISTS idx_attendance_dept_member 
ON attendance_records(department_id, member_id);

-- 6. VISITORS TABLE (First-time guest tracking)
CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    invited_by TEXT,
    remarks_prayer_request TEXT,
    date_visited DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. FINANCIAL_LOGS TABLE (Contribution tracking)
CREATE TABLE IF NOT EXISTS financial_logs (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0.10),
    contribution_type TEXT NOT NULL CHECK (contribution_type IN ('Tithe', 'Welfare Contribution', 'Building Fund', 'Special Seed Offering')),
    date_logged DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for financial analytics queries
CREATE INDEX IF NOT EXISTS idx_financial_branch_type 
ON financial_logs(branch_id, contribution_type, date_logged);

-- ====================================================================
-- ROW LEVEL SECURITY (Enable for Supabase production)
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_logs ENABLE ROW LEVEL SECURITY;

-- Public read access policy (adjust for production)
CREATE POLICY "Allow public read access" ON branches FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON members FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON departments FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON member_departments FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON attendance_records FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON visitors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON financial_logs FOR SELECT USING (true);

-- Allow inserts for authenticated operations
CREATE POLICY "Allow public insert" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON member_departments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON visitors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON financial_logs FOR INSERT WITH CHECK (true);

-- ====================================================================
-- UTILITY VIEWS FOR REPORTING
-- ====================================================================

-- View: Member full profile with departments
CREATE OR REPLACE VIEW member_full_profile AS
SELECT 
    m.id,
    m.branch_id,
    b.branch_name,
    b.branch_code,
    m.member_id_code,
    m.first_name,
    m.last_name,
    m.full_address,
    m.date_of_birth,
    m.gender,
    m.contact_number_1,
    m.contact_number_2,
    m.email_address,
    m.occupation,
    m.marital_status,
    m.nationality,
    m.emergency_contact_name,
    m.emergency_contact_phone,
    m.want_to_join_department,
    m.baptized,
    m.photo_data,
    COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', d.id, 'name', d.dept_name))
        FILTER (WHERE d.id IS NOT NULL),
        '[]'::json
    ) AS departments
FROM members m
JOIN branches b ON m.branch_id = b.id
LEFT JOIN member_departments md ON m.id = md.member_id
LEFT JOIN departments d ON md.department_id = d.id
GROUP BY m.id, b.branch_name, b.branch_code;

-- View: Financial summary by branch and type
CREATE OR REPLACE VIEW financial_summary AS
SELECT 
    branch_id,
    contribution_type,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    MIN(date_logged) as earliest_date,
    MAX(date_logged) as latest_date
FROM financial_logs
GROUP BY branch_id, contribution_type;

-- View: Attendance statistics per member
CREATE OR REPLACE VIEW attendance_stats AS
SELECT 
    member_id,
    branch_id,
    COUNT(*) as total_services,
    COUNT(*) FILTER (WHERE is_present = TRUE) as present_count,
    COUNT(*) FILTER (WHERE is_present = FALSE) as absent_count,
    ROUND(
        (COUNT(*) FILTER (WHERE is_present = TRUE)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
        2
    ) as attendance_percentage
FROM attendance_records
GROUP BY member_id, branch_id;