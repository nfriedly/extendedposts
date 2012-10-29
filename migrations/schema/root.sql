CREATE TABLE schema_migrations (
	versions varchar(100) PRIMARY KEY,
	timestamp timestamptz DEFAULT NOW()
);

CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	name varchar(255),
	email varchar(255) NOT NULL,
	password_salt varchar(1024) NOT NULL,
	password_hash varchar(1024) NOT NULL,
	stripe_id varchar(100),
	stripe_plan varchar(100),
	is_admin boolean DEFAULT false,
	created_at timestamptz DEFAULT NOW()
);

INSERT INTO users (email, password_salt, password_hash, name, is_admin) VALUES (
	'nathan@nfriedly.com',
	'lSrYRMcIvE2HbHrB9YPR2gZImNpdSeXmOu4Vzk2U8nHDHP5I9yDAcndEWw0jzHyeZTRrsja6zLleezyEmMUZNeKsIxjSVbd/nGD2CAbHNDPMFUP+kQ7qG2DcDqcANTjqvLInaitS61hq1gOyz2lK/WT0B5RSp1PWx/TnDjuRMBsrBwO4dxegN18LbZhyGf57Hx7ys//c/mitLy/qhcKDFzP0fDw7AlMEvMmCXtPimb3FaB158ECRg9/wbPPFLCO8rujhjJXygZAcQ8zhv5ro/JpT+ev70xHToC0JG71PPSWeq5OoU85Jp7SgN4E8D4fnNejdx0Cahtw/b+DxYtwr0w==',
	'I8pIyWR/qj+8FSE1gLrobTQJx1ePLuywLouFDXSkDFr4u8DKlcO8FU/xLAvesJgPpA5SJl4lz2wOW8FrkHiomqzY0yhzGl36Z4ss7E5Jaqecl8INgj08rauYfUgtwz0KcL5xjg==',
	'Nathan',
	TRUE
);

CREATE TABLE posts (
	id SERIAL PRIMARY KEY,
	user_id integer NOT NULL REFERENCES users (id),
	name varchar(100) NOT NULL,
	body text NOT NULL,
	caption varchar(80),
	description varchar(320),
	visible boolean DEFAULT TRUE,
	created_at timestamptz DEFAULT NOW(),
	updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE fb_posts (
	post_id integer NOT NULL REFERENCES posts (id),
	fb_post_id varchar(60) UNIQUE NOT NULL
);
