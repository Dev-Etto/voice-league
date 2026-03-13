<div align="center">

# 🛡️ VoiceLeague

**Sistema de Voz Dinâmico para League of Legends**

[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/lib-discord.js-5865F2?logo=discord&logoColor=fff)](https://discord.js.org/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle&logoColor=000)](https://orm.drizzle.team/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Bot de Discord que detecta automaticamente quando um jogador registrado entra em partida no LoL, cria um canal de voz temporário para o time e envia um link de convite via DM.

</div>

---

## 📋 Índice

- [Por que o VoiceLeague?](#-por-que-o-voiceleague)
- [Tecnologias](#-tecnologias)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Comandos Slash](#-comandos-slash)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Padrões de Código](#-padrões-de-código)
- [Testes](#-testes)
- [Como Contribuir](#-como-contribuir)

---

## 🎯 Por que o VoiceLeague?

Coordenar comunicação com aliados aleatórios no League of Legends é um desafio constante. O **VoiceLeague** resolve isso automaticamente:

1. 🔍 **Detecta** quando você entra em uma partida
2. 🔊 **Cria** um canal de voz temporário para o seu time
3. 📨 **Envia** o link do canal via DM para você compartilhar com aliados
4. 🧹 **Limpa** o canal automaticamente após o término da partida

---

## 🧰 Tecnologias

| Camada | Tecnologia | Propósito |
|---|---|---|
| **Runtime** | [Bun](https://bun.sh) | Execução de alta performance e baixo consumo de memória |
| **Linguagem** | TypeScript (Strict Mode) | Tipagem estrita sem `any` |
| **Discord** | [discord.js](https://discord.js.org/) v14 | Interação com a Discord API |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) | Queries type-safe e portabilidade de banco |
| **Banco de Dados** | SQLite via `bun:sqlite` | Persistência leve e zero-config |
| **Validação** | [Zod](https://zod.dev/) | Validação de ENV e schemas da Riot API |
| **API** | Riot Games API (Spectator-v5 / Account-v1) | Dados de partidas e contas |

---

## 🏗 Arquitetura

O projeto segue uma arquitetura em camadas com separação clara de responsabilidades:

```
VoiceLeague/
├── src/
│   ├── commands/              # Slash Commands do Discord
│   │   ├── register.ts        # /register - Vincula conta LoL
│   │   ├── unregister.ts      # /unregister - Desvincula conta
│   │   └── status.ts          # /status - Mostra contas e status
│   ├── database/              # Camada de persistência (Drizzle)
│   │   ├── schema.ts          # Schema do banco (source of truth)
│   │   └── db.ts              # Conexão e funções CRUD
│   ├── engine/                # Core do monitoramento
│   │   └── watchdog.ts        # Loop de polling inteligente
│   ├── services/              # Integrações externas
│   │   ├── riot.ts            # API da Riot Games
│   │   └── voice-channel.ts   # Gestão de canais de voz
│   ├── utils/                 # Infraestrutura
│   │   ├── env.ts             # Validação de ENV com Zod
│   │   ├── errors.ts          # Classes de erro customizadas
│   │   └── error-handler.ts   # Handler global de exceções
│   └── index.ts               # Entry point
├── tests/                     # Testes unitários (bun:test)
├── drizzle/                   # Migrations geradas pelo Drizzle Kit
├── drizzle.config.ts          # Configuração do Drizzle Kit
├── .env.example               # Template de variáveis de ambiente
├── package.json
└── tsconfig.json
```

**Camadas principais:**

- **Commands** → Recebem interações do Discord e delegam para Services/Database
- **Services** → Encapsulam chamadas externas (Riot API, Discord Voice)
- **Database** → Drizzle ORM com schema tipado e funções CRUD isoladas
- **Engine** → Watchdog com polling inteligente e rate limit handling
- **Utils** → Validação de ENV, hierarquia de erros e error handler global

---

## 📦 Pré-requisitos

- [Bun](https://bun.sh) >= 1.0
- Conta no [Discord Developer Portal](https://discord.com/developers/applications)
- Chave da [Riot Games API](https://developer.riotgames.com/)

### Configuração do Discord Bot

No [Developer Portal](https://discord.com/developers/applications), ative os seguintes **Privileged Gateway Intents**:

- ✅ `GUILD_VOICE_STATES`
- ✅ `GUILD_MESSAGES`
- ✅ `MESSAGE_CONTENT`

**Permissões do bot** ao convidar para o servidor:

- `Manage Channels`
- `Move Members`
- `Create Instant Invite`

---

## 🚀 Instalação

```bash
# Clone o repositório
git clone https://github.com/Dev-Etto/VoiceLeague.git
cd VoiceLeague

# Instale as dependências
bun install

# Copie e configure as variáveis de ambiente
cp .env.example .env

# Sincronize o banco de dados
bun run db:push

# Inicie em modo de desenvolvimento (hot reload)
bun run dev
```

---

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token do bot do Discord |
| `CLIENT_ID` | ✅ | Application ID do bot |
| `GUILD_ID` | ✅ | ID do servidor Discord |
| `RIOT_API_KEY` | ✅ | Chave da API da Riot Games |
| `POLLING_INTERVAL_MS` | ❌ | Intervalo de polling em ms (padrão: `30000`) |

> **⚠️ Nota:** A aplicação **não inicia** sem todas as variáveis obrigatórias. A validação é feita com Zod no boot.

---

## 💬 Comandos Slash

| Comando | Descrição | Exemplo |
|---|---|---|
| `/register` | Vincula uma conta do LoL ao seu Discord | `/register riotid:Faker#KR1` |
| `/unregister` | Remove todas as contas vinculadas | `/unregister` |
| `/status` | Exibe suas contas e status de monitoramento | `/status` |

---

## 📜 Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `bun run dev` | `bun --watch src/index.ts` | Inicia com hot reload |
| `bun run start` | `bun src/index.ts` | Inicia em produção |
| `bun test` | `bun test` | Roda os testes unitários |
| `bun run db:generate` | `drizzle-kit generate` | Gera migrations a partir do schema |
| `bun run db:migrate` | `drizzle-kit migrate` | Aplica migrations pendentes |
| `bun run db:push` | `drizzle-kit push` | Sincroniza schema direto no banco |
| `bun run db:studio` | `drizzle-kit studio` | Abre interface visual do banco |
| `bun run db:drop` | `drizzle-kit drop` | Remove migrations |

---

## 🧪 Testes

```bash
bun test
```

| Suíte | Testes | Cobertura |
|---|---|---|
| `database.test.ts` | 6 | CRUD via Drizzle, upsert, ativos |
| `env.test.ts` | 5 | Validação, defaults, coerção |
| `errors.test.ts` | 5 | Hierarquia, herança, propriedades |

---

## 📐 Padrões de Código

- **TypeScript Strict** — Tipagem estrita, uso de `any` proibido
- **Clean Code & SOLID** — Responsabilidades bem separadas por camada
- **DRY** — Abstrações inteligentes (funções CRUD, error handler global)
- **Tratamento de Erros** — Hierarquia customizada (`AppError`, `RiotApiError`, `RateLimitError`, `DatabaseError`)
- **Validação** — Zod para ENV e retornos de API
- **Imutabilidade** — Preferência por `map`, `filter`, `some` sobre mutações diretas
- **Early Return** — Redução de aninhamento com retornos antecipados

---

## 🤝 Como Contribuir

1. Faça um **fork** do repositório
2. Crie uma branch para sua feature: `git checkout -b feat/minha-feature`
3. Commite suas alterações seguindo [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `refactor:` refatoração sem mudança de comportamento
   - `chore:` manutenção e configuração
4. Rode os testes: `bun test`
5. Abra um **Pull Request** para `main`

---

<div align="center">

Feito com 🛡️ por [Dev-Etto](https://github.com/Dev-Etto)

</div>
