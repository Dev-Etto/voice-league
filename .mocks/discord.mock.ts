import { mock } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";

export const createMockCollection = <K, V>(entries: [K, V][] = []) => {
  const map = new Map<K, V>(entries);
  (map as any).filter = (cb: (value: V, key: K) => boolean) => {
    const filtered = Array.from(map.entries()).filter(([k, v]) => cb(v, k));
    return createMockCollection(filtered);
  };
  return map;
};

export const createMockInteraction = (options: Record<string, string> = {}) => ({
  options: {
    getString: mock((name: string) => options[name] || null),
  },
  user: { id: "user-123" },
  reply: mock(() => Promise.resolve()),
  deferReply: mock(() => Promise.resolve()),
  editReply: mock(() => Promise.resolve()),
} as unknown as ChatInputCommandInteraction);

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
        return Promise.resolve(createMockCollection());
      }),
      create: mock(() => Promise.resolve(createMockVoiceChannel("Voice", "v1"))),
      cache: {
        find: mock(() => null),
        get: mock(() => null),
      },
    },
    members: {
      fetch: mock((id: string) => Promise.resolve(createMockMember(id))),
      cache: {
        get: mock((id: string) => null),
      }
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
  type: 2,
  members: { size: 0 },
  createdTimestamp: Date.now(),
  delete: mock(() => Promise.resolve()),
  createInvite: mock(() => Promise.resolve({ url: "http://invite" })),
  permissionOverwrites: {
    create: mock(() => Promise.resolve()),
  },
});
