ALTER TABLE account ALTER COLUMN api_key TYPE varchar(128);

UPDATE account SET api_key='ep_1_54ccea41e7527a662e4a48a1' WHERE email='nathan@nfriedly.com';
