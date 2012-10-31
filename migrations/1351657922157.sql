ALTER TABLE users RENAME TO account;

ALTER TABLE story RENAME COLUMN user_id to account_id;