ALTER TABLE story ADD COLUMN
  variation_of integer REFERENCES story (id),
  post_starts integer DEFAULT 0,
  views integer DEFAULT 0;
