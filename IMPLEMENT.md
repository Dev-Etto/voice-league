🛡️ VoiceLeague: Sistema de Voz Dinâmico para LoL
1. Visão Geral da Arquitetura
O sistema consiste em um Bot de Discord que monitora jogadores registrados. Quando um jogador entra em partida, o bot cria um canal de voz temporário e gera um link de convite para os aliados.

Runtime: Bun

Linguagem: TypeScript

Biblioteca Discord: discord.js

Banco de Dados: SQLite (via bun:sqlite) – leve e perfeito para hospedagens gratuitas.

API Principal: Riot Games API (Endpoints de Spectator-v5).

2. Configuração do Discord (Developer Portal)
Antes do código, você precisa configurar o "corpo" do bot:

Privileged Gateway Intents: Você PRECISA ativar GUILD_VOICE_STATES, GUILD_MESSAGES e MESSAGE_CONTENT no painel do desenvolvedor do Discord.

Permissões do Bot: O bot deve ser convidado com as permissões:

Manage Channels (Para criar/deletar salas).

Move Members (Para organizar o pessoal).

Create Instant Invite (Para gerar o link pros aleatórios).

3. Escopo de Funcionalidades (Detalhamento)
A. Fluxo de Registro (/register)
O usuário digita seu Game Name e TagLine (ex: Faker#KR1). "se possivel seria bom conseguir pegar o nick do jogador atravez da conta riot logada no discord e perguntar o nick apenas caso n encontremos seria bom indicar o usuário como vincular a conta dele no discord para facilitar o processo."

O bot consulta a API da Riot para validar se a conta existe.

O bot salva no SQLite o puuid (ID único e imutável da Riot) atrelado ao discord_id. "deveriamos sempre considerar a conta vinculada no momento do acesso, visto que o mesmo usuário pode ter varias contas de lol ou tentar usar o voice atravez de outra conta do discord para a mesma conta de lol."

B. O Monitor de Partidas (The Watchdog)
Como não temos Webhooks da Riot, faremos um Polling Estratégico:

Um loop roda a cada 30-60 segundos verificando apenas os jogadores que estão online no Discord ou marcados como "Premium/Ativos".

API Target: GET /lol/spectator/v5/active-games/by-summoner/{puuid}. "seria interessante ter um sistema de cache para evitar de ficar consultando a api da riot desnecessariamente, visto que o mesmo usuário pode ter varias contas de lol ou tentar usar o voice atravez de outra conta do discord para a mesma conta de lol."

C. Gestão de Salas Temporárias
Ao detectar uma partida ativa:

Verificação de Duplicidade: O bot checa se já existe uma sala para aquele gameId (para evitar criar 5 salas se o time todo usar o bot).

Criação: Cria um canal de voz: 🔊 Time [Azul/Vermelho] - [ID].

Convite: O bot envia uma DM para o usuário registrado: "Sua partida começou! Copie este link no chat do time para chamar seus aliados: [Link do Canal]".

D. Garbage Collector (Limpeza)
O bot monitora o estado da partida. Quando a API de Spectator retornar 404 Not Found, significa que a partida acabou.

Ação: O bot espera 2 minutos (tempo de conversa pós-jogo) e deleta o canal.

4. Estrutura do Projeto (Monorepo/Folder Structure)

VoiceLeague/
├── src/
│   ├── commands/          # Comandos Slash do Discord
│   ├── database/          # Lógica do SQLite (Bun:sqlite)
│   ├── services/          # Integração com API da Riot
│   ├── engine/            # O loop de monitoramento (Watchdog)
│   ├── utils/             # Formatadores e Helpers
│   └── index.ts           # Entry point
├── .env                   # RIOT_TOKEN, DISCORD_TOKEN
├── package.json
└── tsconfig.json

5. Especificações Técnicas (The "Bun" Way)
Integração com a Riot (Service)
Você deve tratar o Rate Limit da Riot (que é bem restritivo em chaves gratuitas).

Solução: Implementar uma fila simples ou um delay entre requisições para não tomar ban da API.

Banco de Dados (SQLite)

import { Database } from "bun:sqlite";
const db = new Database("VoiceLeague.sqlite");

// Tabela simples para o MVP
db.run(`CREATE TABLE IF NOT EXISTS players (
  discord_id TEXT PRIMARY KEY,
  puuid TEXT,
  game_name TEXT,
  tag_line TEXT,
  last_game_id TEXT
)`);

6. Desafios de Hospedagem Gratuita
Hospedagens gratuitas (como Render, Fly.io ou Railway no plano free) costumam "dormir" após inatividade.

O Problema: Se o bot dormir, ele não monitora as partidas.

A Solução: Usar um serviço como o Cron-job.org para "pingar" uma rota HTTP simples no seu bot a cada 5 minutos, mantendo-o acordado.

7. Próximo Passo: O Código Inicial
Para você começar a montar o repositório agora, eu preparei o Contrato da API da Riot (o que você vai receber quando o jogador estiver em partida).

Deseja que eu escreva o código do engine/watchdog.ts que faz a lógica de verificar quem está jogando e decidir se cria a sala? Esse é o código mais complexo do projeto, pois envolve tratar erros e evitar criar salas duplicadas.

Dica de Ouro para o Currículo: No seu README, destaque que você usou Bun pela baixa pegada de memória e SQLite para persistência leve, focando em eficiência de recursos em ambientes limitados. Seria uma excelente demonstração de conhecimento de infraestrutura!
