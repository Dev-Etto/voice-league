import { describe, expect, it, mock } from "bun:test";
import { auditCommand } from "../src/commands/audit.ts";

describe("Audit Command", () => {
  it("deve conter permissão de administrador no builder", () => {
    const data = auditCommand.data.toJSON();
    expect(data.default_member_permissions).toBe("8");
  });

  it("deve executar e enviar o embed de auditoria", async () => {
    const mockInteraction = {
      deferReply: mock(() => Promise.resolve()),
      editReply: mock(() => Promise.resolve()),
    } as any;

    const mockWatchdog = {
      getTrackedGameCount: () => 5,
      isMonitoring: () => true,
    } as any;

    await auditCommand.execute(mockInteraction, mockWatchdog);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.any(Array)
    }));
  });
});
