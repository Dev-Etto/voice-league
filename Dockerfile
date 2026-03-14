# Use a imagem oficial do Bun
FROM oven/bun:latest

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependências
COPY package.json bun.lockb* ./

# Instala as dependências
RUN bun install --frozen-lockfile

# Copia o restante do código
COPY . .

# Expõe a porta (embora o bot não precise, algumas plataformas exigem)
EXPOSE 3000

# Variáveis de ambiente padrão para o Railway Volume
ENV DATABASE_PATH=/data/VoiceLeague.sqlite

# Comando para iniciar o bot
CMD ["bun", "run", "start"]
