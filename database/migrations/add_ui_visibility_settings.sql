-- Add UI visibility settings to system_settings table
INSERT INTO system_settings (key, value, description) VALUES 
    ('ui_show_logs_button', '"true"', 'Show/hide the logs button in the dashboard'),
    ('ui_show_similarity_features', '"true"', 'Show/hide similarity features (RAG search sidebar and Similar Tasks tab)')
ON CONFLICT (key) DO NOTHING;