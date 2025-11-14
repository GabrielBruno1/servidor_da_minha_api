#!/usr/bin/env bash
# Script para fixar o cache do Puppeteer no Render.com

set -eo pipefail

# Instala dependências
npm ci --only=production

# Instala o Chromium (versão estável)
npx @puppeteer/browsers install chrome@stable

# Define o diretório de cache do Puppeteer
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer

# Cria o diretório se não existir
mkdir -p $PUPPETEER_CACHE_DIR

# Copia o Chromium instalado para o cache do Render (evita perda no build)
if [[ ! -d $PUPPETEER_CACHE_DIR/chrome ]]; then
  echo "Copiando Chromium para cache do Render..."
  cp -R ~/.cache/puppeteer/chrome $PUPPETEER_CACHE_DIR/
else
  echo "Cache já existe, pulando cópia."
fi

# Permissões (para evitar erros de acesso)
chmod -R 755 $PUPPETEER_CACHE_DIR
