<div align="center">

# 🛡️ VoiceLeague

**Sistema de Voz Dinâmico para League of Legends**

[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/lib-discord.js-5865F2?logo=discord&logoColor=fff)](https://discord.js.org/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle&logoColor=000)](https://orm.drizzle.team/)

O **VoiceLeague** é um bot de Discord engenheirado para automatizar a comunicação de times de League of Legends. Ele detecta quando um jogador registrado entra em partida, cria instantaneamente um canal de voz temporário e gerencia o ciclo de vida deste canal até o fim do jogo.

</div>

---

## 🚀 Tecnologias

O projeto utiliza o estado da arte do ecossistema TypeScript moderno para garantir performance e baixa latência:

- **Runtime**: [Bun](https://bun.sh) para execução ultra-rápida, servidor HTTP e gerenciamento de dependências.
- **Linguagem**: TypeScript (Strict Mode) para máxima segurança de tipos.
- **Interface**: [Discord.js (v14+)](https://discord.js.org/) para interação com a API do Discord.
- **ORM & Banco**: [Drizzle ORM](https://orm.drizzle.team/) com [SQLite (Bun:SQLite)](https://bun.sh/docs/api/sqlite) para persistência leve.
- **Validação**: [Zod](https://zod.dev/) para esquemas de dados e variáveis de ambiente.
- **Integração**: Riot Games API (Active Games V5 & Account V1).

---

## 🏗️ Arquitetura

O projeto segue princípios de **Clean Architecture** e **SOLID**, organizados nas seguintes camadas:

- **Use Cases (Domain Logic)**: Centraliza as regras de negócio, como registro de jogadores e gerenciamento de preferências.
- **Engine (Watchdog)**: O núcleo reativo que processa o monitoramento. Combina **Polling Adaptativo** com **Eventos Reativos** (Presence & Voice Updates).
- **Service Layer**: Abstrai integrações externas (Riot API, Voice Manager, Notification Service).
- **Webhooks Server**: Servidor HTTP interno via `Bun.serve` para notificações externas de atividade.
- **Padrão de Segurança**: Uso sistemático de wrappers `safeAsync` e `safeRun` para tratamento de erros sem aninhamentos de try/catch.

---

## 🛠️ Pré-requisitos e Instalação

### Pré-requisitos

1.  **Bun** instalado (v1.0+ recomendado).
2.  **Discord Developer Portal**:
    - Ative **PRESENCE INTENT** e **GUILD_VOICE_STATES**.
    - Configure as permissões de `Manage Channels` e `Move Members`.
3.  **Riot Developer Portal**:
    - Obtenha uma `RIOT_TOKEN` (API Key).

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Dev-Etto/VoiceLeague.git

# Instale as dependências
bun install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves (RIOT_TOKEN, DISCORD_TOKEN, etc.)

# Prepare o banco de dados (Migrations)
bun run db:push

# Inicie em modo de desenvolvimento
bun run dev
```

---

## 📜 Interface de Comandos (Slash Commands)

| Comando | Parâmetros | Descrição |
|---|---|---|
| `/register` | `riotid` | Vincula sua conta (Ex: `Faker#KR1`) ao seu ID do Discord. |
| `/autojoin` | `enabled` | Liga/Desliga a entrada automática no canal de voz ao iniciar partida. |
| `/status` | - | Mostra suas contas vinculadas e o estado atual do monitoramento. |
| `/unregister` | - | Remove todos os seus dados e interrompe o monitoramento. |

---

## 🔗 Webhooks (API Interna)

O bot expõe um servidor de webhooks na porta `3000` para integrações imediatas:

- **Endpoint**: `POST /webhook/activity`
- **Payload**: `{ "discordId": "string" }`
- **Ação**: Dispara um `triggerImmediateCheck` no motor de monitoramento para o usuário informado, ignorando o intervalo de polling.

---

## 💎 Padrões de Código

Este projeto prioriza a qualidade técnica e segue rigorosamente:

- **Clean Code & SOLID**: Código modular e de responsabilidade única.
- **TypeScript Estrito**: Proibido o uso de `any`.
- **Early Return**: Lógica limpa evitando aninhamentos desnecessários.
- **Tratamento de Erros**: Uso do padrão Result com o utilitário `safeAsync`.
- **Mobile-First Docs**: Documentação e logs otimizados para leitura rápida.

---

## 📦 Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `bun run --watch src/index.ts` | Modo live-reload para desenvolvimento. |
| `start` | `bun run src/index.ts` | Execução em produção. |
| `test` | `bun test` | Executa a suíte completa de testes unitários e integração. |
| `db:push` | `bun x drizzle-kit push` | Sincroniza o banco local com o schema do Drizzle. |
| `db:studio` | `bun x drizzle-kit studio` | Interface visual para o banco de dados SQLite. |

---

## 🤝 Como Contribuir

1. Faça um **Fork** do projeto.
2. Crie uma **Branch** (`git checkout -b feature/minha-feature`).
3. Siga o padrão de **Commits Semânticos** (`feat:`, `fix:`, `docs:`).
4. Certifique-se de que os testes passam (`bun test`).
5. Abra um **Pull Request**.

---

<div align="center">
Desenvolvido por <a href="https://github.com/Dev-Etto">Dev-Etto</a>
</div>
