-- Sanitiza dados sensiveis apos espelhamento de producao para desenvolvimento.
-- Ajuste esta lista conforme novas colunas/tabelas sensiveis forem surgindo.

WITH ranked_users AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS seq
  FROM users
)
UPDATE users u
SET
  name = 'Dev User ' || ranked_users.seq,
  email = 'dev+' || ranked_users.seq || '@local.invalid',
  password_hash = '$2b$10$oq6Ml3lPEfeUlEjYozd28uR.fi4DSuWYeq8jBZSCXHwYA/8VdPPsS'
FROM ranked_users
WHERE u.id = ranked_users.id;

WITH ranked_accounts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id) AS seq
  FROM accounts
)
UPDATE accounts a
SET name = 'Conta Dev ' || ranked_accounts.seq
FROM ranked_accounts
WHERE a.id = ranked_accounts.id;

UPDATE transactions
SET
  description = CASE
    WHEN description IS NULL OR btrim(description) = '' THEN description
    ELSE 'Descricao sanitizada'
  END,
  notes = CASE
    WHEN notes IS NULL OR btrim(notes) = '' THEN notes
    ELSE 'Observacao sanitizada'
  END;
