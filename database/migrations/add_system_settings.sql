-- Create system settings table for global application settings
CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(128) NOT NULL UNIQUE,
    value JSON NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES 
    ('rag_search_enabled', '"true"', 'Enable/disable RAG search feature visibility')
ON CONFLICT (key) DO NOTHING;

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE
    ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();