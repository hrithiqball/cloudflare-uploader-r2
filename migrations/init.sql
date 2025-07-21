CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  category TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
