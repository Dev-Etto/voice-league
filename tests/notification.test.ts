import { mock, describe, expect, it } from "bun:test";

import { NotificationService } from "../src/services/notification-service.ts";

describe("NotificationService", () => {
  it("sendGameInvite deve buscar usuário e enviar DM", async () => {
    const mockUser = {
      send: mock(() => Promise.resolve({}))
    };
    const mockClient = {
      users: {
        fetch: mock(() => Promise.resolve(mockUser))
      }
    } as any;

    const service = new NotificationService(mockClient);
    const player = { discordId: "d1", gameName: "P1" } as any;

    await service.sendGameInvite(player, "Azul", 123, "http://invite");

    expect(mockClient.users.fetch).toHaveBeenCalledWith("d1");
    expect(mockUser.send).toHaveBeenCalledWith(expect.stringContaining("http://invite"));
  });
});
