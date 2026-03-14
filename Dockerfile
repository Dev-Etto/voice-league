FROM oven/bun:latest AS base
WORKDIR /app

# Instala dependências do sistema necessárias para o SQLite e compilação de módulos nativos
RUN apt-get update && apt-get install -y \
    sqlite3 \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Instala as dependências do projeto
COPY package.json bun.lock ./
RUN bun install

# Copia o código fonte
COPY . .

# Garante permissões de escrita para o banco de dados
RUN mkdir -p /app/data && chown -R bun:bun /app

# Variável de ambiente padrão para o banco (pode ser sobrescrita)
ENV DATABASE_PATH=/app/data/VoiceLeague.sqlite

USER bun
EXPOSE 3000

CMD ["bun", "run", "start"]
