CREATE TABLE IF NOT EXISTS theme_settings (
    id SERIAL PRIMARY KEY,
    primary_color VARCHAR(7) NOT NULL DEFAULT '#007bff',
    secondary_color VARCHAR(7) NOT NULL DEFAULT '#6c757d',
    font_family VARCHAR(255) NOT NULL DEFAULT 'Arial, sans-serif',
    weather_widget_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    weather_widget_location VARCHAR(255) DEFAULT 'London',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO theme_settings (primary_color, secondary_color, font_family, weather_widget_enabled, weather_widget_location)
VALUES ('#007bff', '#6c757d', 'Arial, sans-serif', FALSE, 'London')
ON CONFLICT (id) DO NOTHING;