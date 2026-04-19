-- ════════════════════════════════════════════════════════════
--  Execute este SQL no Supabase > SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. Tabela de fichas (uma por personagem, vinculada ao usuário)
CREATE TABLE IF NOT EXISTS fichas (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome       TEXT NOT NULL,
    classe     TEXT NOT NULL DEFAULT 'Guerreiro',
    genero     TEXT DEFAULT '',
    img        TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de dados da ficha (status, inventário, talentos)
--    Cada linha = uma "aba" de dados de uma ficha
CREATE TABLE IF NOT EXISTS fichas_dados (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ficha_id   UUID NOT NULL REFERENCES fichas(id) ON DELETE CASCADE,
    tipo       TEXT NOT NULL,   -- 'status' | 'inventario' | 'talentos'
    valor      TEXT NOT NULL,   -- JSON serializado
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ficha_id, tipo)      -- garante o upsert por ficha + tipo
);

-- ── Índices de performance ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fichas_user      ON fichas(user_id);
CREATE INDEX IF NOT EXISTS idx_fichas_dados_id  ON fichas_dados(ficha_id);

-- ── Row Level Security (RLS) — cada usuário vê só o seu ────
ALTER TABLE fichas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas_dados ENABLE ROW LEVEL SECURITY;

-- Políticas para fichas
CREATE POLICY "usuario vê próprias fichas"
    ON fichas FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "usuario cria próprias fichas"
    ON fichas FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuario edita próprias fichas"
    ON fichas FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "usuario exclui próprias fichas"
    ON fichas FOR DELETE USING (auth.uid() = user_id);

-- Políticas para fichas_dados (acesso via ficha vinculada ao usuário)
CREATE POLICY "usuario vê dados de suas fichas"
    ON fichas_dados FOR SELECT
    USING (ficha_id IN (SELECT id FROM fichas WHERE user_id = auth.uid()));

CREATE POLICY "usuario salva dados de suas fichas"
    ON fichas_dados FOR INSERT
    WITH CHECK (ficha_id IN (SELECT id FROM fichas WHERE user_id = auth.uid()));

CREATE POLICY "usuario atualiza dados de suas fichas"
    ON fichas_dados FOR UPDATE
    USING (ficha_id IN (SELECT id FROM fichas WHERE user_id = auth.uid()));

CREATE POLICY "usuario exclui dados de suas fichas"
    ON fichas_dados FOR DELETE
    USING (ficha_id IN (SELECT id FROM fichas WHERE user_id = auth.uid()));

-- ── Migração: adiciona coluna genero se ainda não existir ──
-- (execute este bloco se a tabela já existia antes)
ALTER TABLE fichas ADD COLUMN IF NOT EXISTS genero TEXT DEFAULT '';
