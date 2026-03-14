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

- **Runtime**: [Bun](https://bun.sh) para execução ultra-rápida e gerenciamento de dependências.
- **Linguagem**: TypeScript (Strict Mode) para máxima segurança de tipos.
- **Interface**: [Discord.js](https://discord.js.org/) para interação com a API do Discord.
- **ORM & Banco**: [Drizzle ORM](https://orm.drizzle.team/) com [SQLite](https://www.sqlite.org/) para persistência leve e eficiente.
- **Validação**: [Zod](https://zod.dev/) para validação de esquemas e variáveis de ambiente.
- **Integração**: Riot Games API (Active Games V5).

---

## 🏗️ Arquitetura

O projeto segue princípios de **Clean Architecture** e **SOLID**, garantindo manutenibilidade e escalabilidade:

- **Service Layer**: Abstrai as integrações externas (Riot API e Discord Voice Manager).
- **Engine (Watchdog)**: O núcleo do sistema que processa a lógica de monitoramento em tempo real.
- **Command Pattern**: Implementação desacoplada dos comandos slash do Discord.
- **Repository Pattern (via Drizzle)**: Camada de persistência isolada das regras de negócio.
- **Otimização de Polling**: Sistema de filtragem em 3 camadas (Subscription -> Presence -> Riot Query) para minimizar chamadas desnecessárias à API.

---

## 🛠️ Pré-requisitos e Instalação

### Pré-requisitos

1. **Bun** instalado em sua máquina.
2. **Discord Developer Portal**:
   - Ative **PRESENCE INTENT** e **GUILD_VOICE_STATES**.
   - Crie um bot e obtenha o `DISCORD_TOKEN` e `CLIENT_ID`.
3. **Riot Developer Portal**:
   - Obtenha uma `RIOT_TOKEN` (API Key).

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Dev-Etto/VoiceLeague.git

# Instale as dependências
bun install

# Configure as variáveis de ambiente
cp .env.example .env
# Preencha o .env com suas chaves

# Prepare o banco de dados
bun run db:push

# Inicie em modo de desenvolvimento
bun run dev
```

---

## 📜 Documentação de Comandos (Interface)

| Comando | Parâmetros | Descrição |
|---|---|---|
| `/register` | `name`, `tag` | Registra sua conta do LoL (ex: `Faker#KR1`) para monitoramento automático. |
| `/status` | - | Verifica o status atual do seu registro e se há uma partida sendo monitorada. |
| `/unregister` | - | Remove seu registro e interrompe o monitoramento automático. |

---

## 💎 Padrões de Código

Este projeto prioriza a qualidade técnica e segue rigorosamente:

- **Clean Code & SOLID**: Código modular, legível e de responsabilidade única.
- **TypeScript Estrito**: Tipagem detalhada sem o uso de `any`.
- **Early Return**: Lógica limpa evitando aninhamentos desnecessários (if/else).
- **Tratamento de Erros Robusto**: Middlewares e wrappers globais para capturar exceções silenciosas.
- **Imutabilidade**: Uso preferencial de métodos funcionais (`map`, `filter`, `reduce`).

---

## 📦 Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `dev` | `bun --watch src/index.ts` | Inicia o bot em modo live-reload (Desenvolvimento). |
| `start` | `bun src/index.ts` | Inicia o bot em modo de produção. |
| `test` | `bun test` | Executa a suíte de testes unitários com Bun Test. |
| `db:push` | `drizzle-kit push` | Sincroniza o schema do Drizzle com o SQLite local. |
| `db:studio` | `drizzle-kit studio` | Abre o painel visual para gerenciar o banco de dados. |

---

## 🤝 Como Contribuir

1. Faça um **Fork** do projeto.
2. Crie uma **Branch** para sua funcionalidade (`git checkout -b feature/nova-feature`).
3. Siga os padrões de escrita e **Commits Semânticos**.
4. Abra um **Pull Request** detalhando suas alterações.

---

<div align="center">
Desenvolvido por <a href="https://github.com/Dev-Etto">Dev-Etto</a>
</div>
