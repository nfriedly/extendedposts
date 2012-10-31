ALTER TABLE account ADD COLUMN api_key varchar(32) UNIQUE;

INSERT INTO account(name, email, api_key, password_salt, password_hash) 
	VALUES ('demo', 'demo@extendedposts.com', '__demo__', '', '');