<div align="center">

# 🛡️ VoiceLeague

**Sistema de Voz Dinâmico para League of Legends**

[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/lib-discord.js-5865F2?logo=discord&logoColor=fff)](https://discord.js.org/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle&logoColor=000)](https://orm.drizzle.team/)

Bot de Discord que detecta automaticamente quando um jogador registrado entra em partida no LoL, cria um canal de voz temporário e envia o convite via DM. Otimizado com monitoramento de presença para máxima economia de API.

</div>

---

## 📋 Índice

- [Por que o VoiceLeague?](#-por-que-o-voiceleague)
- [Tecnologias](#-tecnologias)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Roadmap](#-roadmap)

---

## 🎯 Por que o VoiceLeague?

O **VoiceLeague** automatiza a comunicação do seu time:

1. 🔍 **Presença Inteligente**: Monitora o status do Discord para saber quando você abre o LoL.
2. 🔊 **Canais Sob Demanda**: Cria um canal de voz exclusivo assim que a partida começa.
3. 📨 **Convite Automático**: Envia o link do canal via DM para facilitar o compartilhamento.
4. 🧹 **Otimização Extrema**: Só consome API da Riot quando você está efetivamente jogando.

---

## 🏗 Arquitetura & Otimização

O projeto utiliza um **Watchdog Engine** com duas camadas de filtragem:
- **Layer 1 (Subscrição)**: Monitora apenas jogadores que ativaram o registro.
- **Layer 2 (Discord Presence)**: Filtra apenas jogadores com status "Playing League of Legends" no Discord antes de consultar a Riot API.
- **Layer 3 (Bulk Discovery)**: Se um jogador é detectado em partida, o bot identifica todos os outros aliados registrados na mesma partida em uma única chamada de API.

---

## 📦 Pré-requisitos

### Discord Developer Portal
No menu **Bot** -> **Privileged Gateway Intents**, ative:
- ✅ **PRESENCE INTENT** (Obrigatório para a otimização de polling)
- ✅ **SERVER MEMBERS INTENT** (Recomendado)
- ✅ **MESSAGE CONTENT INTENT** (Para suporte a comandos legados, se houver)

### Permissões do Bot
Convide o bot com as seguintes permissões:
- `Manage Channels`
- `Move Members`
- `Create Instant Invite`

---

## 🚀 Instalação & Uso

```bash
# Instalação
bun install

# Configuração
cp .env.example .env

# Banco de Dados (Gerar e Aplicar Schema)
bun run db:push

# Iniciar
bun run dev
```

---

## 📜 Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `db:generate` | `drizzle-kit generate` | Gera migrations SQL |
| `db:push` | `drizzle-kit push` | Sincroniza schema sem migrations (Dev) |
| `db:studio` | `drizzle-kit studio` | Interface visual do banco de dados |
| `test` | `bun test` | Executa suíte de testes unitários |

---

## 🗺️ Roadmap (Issues Abertas)

O projeto está em constante evolução. Confira nossas prioridades:
- [#1](https://github.com/Dev-Etto/VoiceLeague/issues/1): Leaderboard de Vitórias e Estatísticas.
- [#2](https://github.com/Dev-Etto/VoiceLeague/issues/2): Nomes de Canais com o nome do Campeão.
- [#3](https://github.com/Dev-Etto/VoiceLeague/issues/3): Comando para pausar/resumir monitoramento.
- [#4](https://github.com/Dev-Etto/VoiceLeague/issues/4): Inativação automática de jogadores ausentes.

---

<div align="center">
Desenvolvido por <a href="https://github.com/Dev-Etto">Dev-Etto</a>
</div>
