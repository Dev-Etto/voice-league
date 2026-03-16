import { mock } from "bun:test";

export const createMockInteraction = (options: Record<string, string> = {}) => ({
  options: {
    getString: mock((name: string) => options[name] || null),
  },
  user: { id: "user-123" },
  reply: mock(() => Promise.resolve()),
  deferReply: mock(() => Promise.resolve()),
  editReply: mock(() => Promise.resolve()),
});

export const createMockClient = () => {
  const client = {
    users: {
      fetch: mock(() => Promise.resolve({
        send: mock(() => Promise.resolve({})),
      })),
    },
    guilds: {
      fetch: mock(() => Promise.resolve(createMockGuild())),
    },
  } as any;
  return client;
};

export const createMockGuild = () => {
  const guild = {
    id: "g123",
    channels: {
      fetch: mock((id?: string) => {
         if (id) return Promise.resolve(createMockVoiceChannel("Voice", id));
         // Simula uma Collection do Discord.js que possui o método filter
         const mockChannels = [] as any;
         mockChannels.filter = (cb: any) => mockChannels.filter(cb); // Isso é recursivo e errado
         return Promise.resolve([]); // Vamos retornar um array puro, que tem filter
      }),
      create: mock(() => Promise.resolve(createMockVoiceChannel("Voice", "v1"))),
      cache: {
        find: mock(() => null),
        get: mock(() => null),
      },
    },
    members: {
      fetch: mock((id: string) => Promise.resolve(createMockMember(id))),
    },
  } as any;
  return guild;
};

export const createMockMember = (id: string = "m1") => ({
  id,
  nickname: "Nickname",
  user: { username: "Username" },
  presence: {
    status: "online",
    activities: [],
  },
  setNickname: mock(() => Promise.resolve()),
});

export const createMockVoiceChannel = (name: string, id: string) => ({
  id,
  name,
  type: 2, // GuildVoice
  members: { size: 0 },
  createdTimestamp: Date.now(),
  delete: mock(() => Promise.resolve()),
  createInvite: mock(() => Promise.resolve({ url: "http://invite" })),
  permissionOverwrites: {
    create: mock(() => Promise.resolve()),
  },
});
