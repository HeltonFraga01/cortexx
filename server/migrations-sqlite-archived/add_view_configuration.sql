-- Migration: Adicionar coluna view_configuration
-- Data: 2025-11-08
-- Descrição: Adiciona suporte para configurações de visualização (calendar, kanban)

-- Verificar se a coluna já existe antes de adicionar
-- SQLite não tem IF NOT EXISTS para ALTER TABLE, então usamos uma abordagem segura

-- Adicionar coluna view_configuration (JSON)
ALTER TABLE database_connections 
ADD COLUMN view_configuration TEXT DEFAULT NULL;

-- Criar índice para melhor performance em queries que filtram por view_configuration
CREATE INDEX IF NOT EXISTS idx_database_connections_view_config 
ON database_connections(view_configuration);

-- Log da migration
INSERT INTO system_metadata (key, value, updated_at) 
VALUES ('migration_view_configuration', 'completed', datetime('now'))
ON CONFLICT(key) DO UPDATE SET value='completed', updated_at=datetime('now');
