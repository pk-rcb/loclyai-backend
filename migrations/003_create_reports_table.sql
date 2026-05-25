CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  citizen_id UUID REFERENCES citizens(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  state VARCHAR(100),
  district VARCHAR(100),
  municipality VARCHAR(100),
  ward VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
