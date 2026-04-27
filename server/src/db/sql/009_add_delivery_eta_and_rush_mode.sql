ALTER TABLE delivery_settings
ADD COLUMN estimated_delivery_time_min integer NOT NULL DEFAULT 30,
ADD COLUMN estimated_pickup_time_min integer NOT NULL DEFAULT 15,
ADD COLUMN rush_mode_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE delivery_settings
ADD CONSTRAINT delivery_settings_estimated_delivery_time_min_check
CHECK (estimated_delivery_time_min > 0);

ALTER TABLE delivery_settings
ADD CONSTRAINT delivery_settings_estimated_pickup_time_min_check
CHECK (estimated_pickup_time_min > 0);