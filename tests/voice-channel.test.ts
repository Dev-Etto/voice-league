import { mock, describe, expect, it, beforeEach } from "bun:test";

mock.module("../src/utils/env.ts", () => ({
  getEnv: () => ({ GUILD_ID: "g123" })
}));

import { VoiceChannelManager } from "../src/services/voice-channel.ts";
import { createMockClient, createMockGuild, createMockVoiceChannel, createMockCollection } from "./../.mocks/discord.mock.ts";

describe("VoiceChannelManager", () => {
  let manager: VoiceChannelManager;
  let mockClient: any;
  let mockGuild: any;
  let mockNicknameService: any;
  let mockNotificationService: any;

  beforeEach(() => {
    mockClient = createMockClient();
    mockGuild = createMockGuild();
    mockClient.guilds.fetch.mockResolvedValue(mockGuild);
    
    mockNicknameService = {
      updateWithChampion: mock(() => Promise.resolve()),
      restore: mock(() => Promise.resolve()),
    };
    
    mockNotificationService = {
      sendGameInvite: mock(() => Promise.resolve()),
    };

    manager = new VoiceChannelManager(mockClient, mockNicknameService, mockNotificationService);
  });

  describe("initializeFromGuild", () => {
    it("deve sincronizar canais existentes que seguem o padrão de nome", async () => {
      const mockChannel = createMockVoiceChannel("🔊 Time Azul - 123", "v123");
      mockGuild.channels.fetch.mockResolvedValue(createMockCollection([["v123", mockChannel]]));

      await manager.initializeFromGuild();

      expect(manager.hasChannelForGame(123, 100)).toBe(true);
    });
  });

  describe("createGameChannel", () => {
    it("deve criar um novo canal se não existir", async () => {
      const mockChannel = createMockVoiceChannel("🔊 Time Azul - 999", "v999");
      mockGuild.channels.create.mockResolvedValue(mockChannel);
      mockChannel.createInvite.mockResolvedValue({ url: "http://invite" });

      const player = { discordId: "d1", puuid: "p1", gameName: "P1" } as any;
      const result = await manager.createGameChannel(999, 100, player);

      expect(mockGuild.channels.create).toHaveBeenCalled();
      expect(result?.channelId).toBe("v999");
      expect(manager.hasChannelForGame(999, 100)).toBe(true);
    });
  });

  describe("addPlayerToGameChannel", () => {
    it("deve configurar permissões e enviar convite", async () => {
      const mockChannel = createMockVoiceChannel("Name", "v1");
      mockGuild.channels.fetch.mockResolvedValue(mockChannel);
      
      const mockMember = { id: "d1" };
      mockGuild.members.fetch.mockResolvedValue(mockMember);

      const player = { discordId: "d1", puuid: "p1", gameName: "P1" } as any;
      const managed = { gameId: 1, teamId: 100, channelId: "v1", inviteUrl: "url", createdAt: Date.now() };

      await manager.addPlayerToGameChannel(player, managed, 10);

      expect(mockChannel.permissionOverwrites.create).toHaveBeenCalled();
      expect(mockNicknameService.updateWithChampion).toHaveBeenCalled();
      expect(mockNotificationService.sendGameInvite).toHaveBeenCalled();
    });
  });
  describe("pruneEmptyChannels", () => {
    it("deve deletar canais vazios e antigos", async () => {
      const mockChannel = createMockVoiceChannel("🔊 Time Azul - 123", "v123");
      mockChannel.members.size = 0;
      mockChannel.createdTimestamp = Date.now() - 40000;
      
      mockGuild.channels.fetch.mockResolvedValue(mockChannel);
      
      const mockChannelManaged = { gameId: 123, teamId: 100, channelId: "v123", inviteUrl: "", createdAt: Date.now() - 40000 };
      (manager as any).managedChannels.set("123-100", mockChannelManaged);
      
      await manager.pruneEmptyChannels(new Set());
      
      expect(mockChannel.delete).toHaveBeenCalled();
      expect(manager.hasChannelForGame(123, 100)).toBe(false);
    });
  });

  describe("setupEnemyVisibility", () => {
    it("deve dar permissão de visão no canal inimigo", async () => {
      const blueChannel = createMockVoiceChannel("🔊 Time Azul - 1", "vBlue");
      const redChannel = createMockVoiceChannel("🔊 Time Vermelho - 1", "vRed");
      
      (manager as any).managedChannels.set("1-100", { channelId: "vBlue", teamId: 100, gameId: 1 });
      (manager as any).managedChannels.set("1-200", { channelId: "vRed", teamId: 200, gameId: 1 });

      mockGuild.channels.fetch.mockImplementation((id: string) => {
        if (id === "vBlue") return Promise.resolve(blueChannel);
        if (id === "vRed") return Promise.resolve(redChannel);
        return Promise.resolve(null);
      });

      const player = { discordId: "pBlue", puuid: "puuid1" } as any;
      const managed = (manager as any).managedChannels.get("1-100");
      const mockMember = { id: "pBlue" };
      mockGuild.members.fetch.mockResolvedValue(mockMember);

      await manager.addPlayerToGameChannel(player, managed, 1);

      expect(redChannel.permissionOverwrites.create).toHaveBeenCalledWith("pBlue", expect.objectContaining({
        ViewChannel: true,
        Connect: false
      }));
    });
  });
});
