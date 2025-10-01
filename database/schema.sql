-- ========================================
-- CASHOO Banking Dashboard - Database Schema
-- Supabase PostgreSQL Database Setup
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS TABLE
-- ========================================
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT 'user_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 8),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret TEXT,
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked BOOLEAN DEFAULT false,
    account_locked_until TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ========================================
-- SESSIONS TABLE
-- ========================================
DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    refresh_token TEXT,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ========================================
-- PASSWORD RESETS TABLE
-- ========================================
DROP TABLE IF EXISTS password_resets CASCADE;

CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reset_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX idx_password_resets_token ON password_resets(reset_token);

-- ========================================
-- AUTH LOGS TABLE
-- ========================================
DROP TABLE IF EXISTS auth_logs CASCADE;

CREATE TABLE auth_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    success BOOLEAN DEFAULT true,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX idx_auth_logs_action ON auth_logs(action);
CREATE INDEX idx_auth_logs_created_at ON auth_logs(created_at);

-- ========================================
-- FLINKS DATA TABLE
-- ========================================
DROP TABLE IF EXISTS flinks_data CASCADE;

CREATE TABLE flinks_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_id TEXT,
    request_id TEXT,
    accounts_data JSONB DEFAULT '[]'::jsonb,
    transactions_data JSONB DEFAULT '[]'::jsonb,
    statements_data JSONB DEFAULT '[]'::jsonb,
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_flinks_data_user_id ON flinks_data(user_id);
CREATE INDEX idx_flinks_data_last_sync ON flinks_data(last_sync);

-- ========================================
-- INVERITE DATA TABLE
-- ========================================
DROP TABLE IF EXISTS inverite_data CASCADE;

CREATE TABLE inverite_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_guid TEXT,
    verification_status TEXT,
    accounts_data JSONB DEFAULT '[]'::jsonb,
    transactions_data JSONB DEFAULT '[]'::jsonb,
    verification_data JSONB DEFAULT '{}'::jsonb,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_inverite_data_user_id ON inverite_data(user_id);
CREATE INDEX idx_inverite_data_request_guid ON inverite_data(request_guid);

-- ========================================
-- CHAT HISTORY TABLE
-- ========================================
DROP TABLE IF EXISTS chat_history CASCADE;

CREATE TABLE chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    response TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at);

-- ========================================
-- NOTIFICATIONS TABLE
-- ========================================
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ========================================
-- STORED PROCEDURES
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flinks_data_updated_at BEFORE UPDATE ON flinks_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inverite_data_updated_at BEFORE UPDATE ON inverite_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    DELETE FROM password_resets WHERE expires_at < NOW() AND used = false;
END;
$$ language 'plpgsql';

-- Function to lock account after too many failed attempts
CREATE OR REPLACE FUNCTION check_failed_login_attempts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.failed_login_attempts >= 5 THEN
        NEW.account_locked = true;
        NEW.account_locked_until = NOW() + INTERVAL '30 minutes';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for account locking
CREATE TRIGGER check_account_lock BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (NEW.failed_login_attempts IS DISTINCT FROM OLD.failed_login_attempts)
    EXECUTE FUNCTION check_failed_login_attempts();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flinks_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inverite_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ========================================
-- INITIAL DATA (Demo Account)
-- ========================================

-- Insert demo user (password: DemoPassword123!)
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    email_verified,
    created_at
) VALUES (
    'user_demo_001',
    'demo@cashoo.ai',
    NULL, -- No password for demo account
    'Demo',
    'User',
    true,
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- ========================================
-- GRANTS (for Supabase service role)
-- ========================================

-- Grant all privileges to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant read access to anonymous users (for public data only)
GRANT SELECT ON users TO anon;

-- ========================================
-- COMPLETION MESSAGE
-- ========================================
DO $$
BEGIN
    RAISE NOTICE 'CASHOO Database schema created successfully!';
    RAISE NOTICE 'Demo account created: demo@cashoo.ai';
    RAISE NOTICE 'Tables created: users, sessions, password_resets, auth_logs, flinks_data, inverite_data, chat_history, notifications';
END $$;
