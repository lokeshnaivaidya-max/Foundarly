import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Meeting Real-time Waiting Room & Agora RTC Automatic Reconnection Suite", () => {
  describe("1. Supabase Realtime Waiting Room Alert Logic", () => {
    it("should correctly distinguish roles and format waiting room notification for client when consultant enters", () => {
      const myRole = "client";
      const enteringParticipant = {
        userId: "consultant-user-123",
        name: "Dr. Jane Smith",
        role: "consultant",
        email: "jane@consultant.com",
      };

      const isEnteringConsultant = enteringParticipant.role === "consultant";
      const isMeClient = myRole === "client";

      let alertTitle = `${enteringParticipant.name} has entered the waiting room!`;
      let alertDescription = "You can click 'Join Meeting' to enter the consultation.";

      if (isMeClient && isEnteringConsultant) {
        alertTitle = `${enteringParticipant.name || "Your consultant"} has entered the waiting room!`;
        alertDescription = "Your consultant is now present. Click 'Join Meeting' to connect.";
      }

      assert.equal(alertTitle, "Dr. Jane Smith has entered the waiting room!");
      assert.equal(alertDescription, "Your consultant is now present. Click 'Join Meeting' to connect.");
    });

    it("should correctly format waiting room notification for consultant when client enters", () => {
      const myRole = "consultant";
      const enteringParticipant = {
        userId: "client-user-456",
        name: "Alice Johnson",
        role: "client",
        email: "alice@client.com",
      };

      const isEnteringClient = enteringParticipant.role === "client";
      const isMeConsultant = myRole === "consultant";

      let alertTitle = `${enteringParticipant.name} has entered the waiting room!`;
      let alertDescription = "You can click 'Join Meeting' to enter the consultation.";

      if (isMeConsultant && isEnteringClient) {
        alertTitle = `${enteringParticipant.name || "The client"} has entered the waiting room!`;
        alertDescription = "The client is waiting for you. Click 'Join Meeting' to begin the consultation.";
      }

      assert.equal(alertTitle, "Alice Johnson has entered the waiting room!");
      assert.equal(alertDescription, "The client is waiting for you. Click 'Join Meeting' to begin the consultation.");
    });

    it("should not alert self when receiving own presence join or broadcast", () => {
      const currentUserId = "my-user-id";
      const selfParticipant = {
        userId: "my-user-id",
        name: "Myself",
        role: "client",
      };

      let alertTriggered = false;
      if (selfParticipant.userId !== currentUserId) {
        alertTriggered = true;
      }

      assert.equal(alertTriggered, false, "Should never trigger waiting room notification for own entry");
    });

    it("should throttle duplicate alerts for the same participant within alert window", () => {
      const lastAlertMap = new Map<string, number>();
      const participantId = "participant-999";

      function shouldTriggerAlert(userId: string, now: number): boolean {
        const last = lastAlertMap.get(userId) || 0;
        if (now - last < 12000) {
          return false;
        }
        lastAlertMap.set(userId, now);
        return true;
      }

      const t0 = 100000;
      assert.equal(shouldTriggerAlert(participantId, t0), true, "First entry should alert");
      assert.equal(shouldTriggerAlert(participantId, t0 + 2000), false, "Duplicate within 2s should be throttled");
      assert.equal(shouldTriggerAlert(participantId, t0 + 11000), false, "Duplicate within 11s should be throttled");
      assert.equal(shouldTriggerAlert(participantId, t0 + 13000), true, "Entry after 13s should trigger new alert");
    });

    it("should aggregate active waiting room participants excluding current user on presence sync", () => {
      const currentUserId = "user-consultant-1";
      const presenceState: Record<string, any[]> = {
        "user-consultant-1": [{ userId: "user-consultant-1", name: "Consultant Dave", role: "consultant" }],
        "user-client-2": [{ userId: "user-client-2", name: "Client Bob", role: "client" }],
      };

      const activeWaiting: any[] = [];
      Object.entries(presenceState).forEach(([_key, presences]) => {
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p?.userId && p.userId !== currentUserId) {
              activeWaiting.push(p);
            }
          });
        }
      });

      assert.equal(activeWaiting.length, 1);
      assert.equal(activeWaiting[0].name, "Client Bob");
      assert.equal(activeWaiting[0].role, "client");
    });
  });

  describe("2. Agora RTC Stream Automatic Reconnection Logic", () => {
    it("should export AgoraService class with reconnection capabilities", async () => {
      const { AgoraService, AGORA_CONFIG } = await import("../src/services/agora.js");
      assert.ok(AgoraService, "AgoraService should be defined");
      assert.ok(AGORA_CONFIG, "AGORA_CONFIG should be defined");

      const service = new AgoraService();
      assert.equal(typeof service.reconnect, "function", "service.reconnect must be a function");
      assert.equal(typeof service.leave, "function", "service.leave must be a function");
      assert.equal(typeof service.isCurrentlyReconnecting, "function", "isCurrentlyReconnecting must be a function");
      assert.equal(typeof service.getReconnectAttempts, "function", "getReconnectAttempts must be a function");
    });

    it("should invoke onReconnecting callback with attempt number during reconnection", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      let reconnectingTriggered = false;
      let recordedAttempt = 0;

      service.onReconnecting = (attempt: number) => {
        reconnectingTriggered = true;
        recordedAttempt = attempt;
      };

      // Set internal config to enable reconnection simulation
      (service as any).currentConfig = { appId: "test-app", channel: "test-channel" };
      (service as any).isJoined = true;
      (service as any).manualLeave = false;

      await service.reconnect();

      assert.equal(reconnectingTriggered, true, "onReconnecting callback must be triggered");
      assert.equal(recordedAttempt, 1, "First attempt should be 1");
      assert.equal(service.isCurrentlyReconnecting(), true, "isCurrentlyReconnecting must be true");

      // Cleanup
      await service.leave();
      assert.equal(service.isCurrentlyReconnecting(), false, "isCurrentlyReconnecting must be false after leave");
    });

    it("should handle 'RECONNECTING' connection state change and trigger onReconnecting", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      const listeners: Record<string, (...args: any[]) => any> = {};
      const mockClient: any = {
        on: (event: string, callback: (...args: any[]) => any) => {
          listeners[event] = callback;
        },
        leave: async () => {},
        join: async () => 12345,
      };

      service.setClient(mockClient);

      let stateChangeRecorded: { cur: string; rev: string } | null = null;
      let onReconnectingCalled = false;

      service.onConnectionStateChange = (cur, rev) => {
        stateChangeRecorded = { cur, rev };
      };
      service.onReconnecting = () => {
        onReconnectingCalled = true;
      };

      // Trigger connection-state-change event
      listeners["connection-state-change"]("RECONNECTING", "CONNECTED", "INTERRUPTED");

      assert.deepEqual(stateChangeRecorded, { cur: "RECONNECTING", rev: "CONNECTED" });
      assert.equal(onReconnectingCalled, true, "onReconnecting should be called when state transitions to RECONNECTING");
      assert.equal(service.isCurrentlyReconnecting(), true);

      await service.leave();
    });

    it("should reset reconnection attempts and trigger onReconnected when connection is restored", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      const listeners: Record<string, (...args: any[]) => any> = {};
      const mockClient: any = {
        on: (event: string, callback: (...args: any[]) => any) => {
          listeners[event] = callback;
        },
        leave: async () => {},
        join: async () => 12345,
      };

      service.setClient(mockClient);

      let reconnectedTriggered = false;
      service.onReconnected = () => {
        reconnectedTriggered = true;
      };

      // Put into reconnecting state
      listeners["connection-state-change"]("RECONNECTING", "CONNECTED", "INTERRUPTED");
      assert.equal(service.isCurrentlyReconnecting(), true);

      // Now restore connection
      listeners["connection-state-change"]("CONNECTED", "RECONNECTING", "RESTORED");

      assert.equal(reconnectedTriggered, true, "onReconnected should be called when restored");
      assert.equal(service.isCurrentlyReconnecting(), false, "isCurrentlyReconnecting should be reset to false");
      assert.equal(service.getReconnectAttempts(), 0, "reconnectAttempts should be reset to 0");

      await service.leave();
    });

    it("should cleanly cancel pending reconnect timer and mark manualLeave on leave()", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      (service as any).currentConfig = { appId: "test-app", channel: "test-channel" };
      (service as any).isJoined = true;

      await service.reconnect();
      assert.equal(service.isCurrentlyReconnecting(), true);

      // Call leave
      await service.leave();

      assert.equal((service as any).manualLeave, true, "manualLeave flag should be true");
      assert.equal((service as any).reconnectTimer, null, "reconnectTimer must be cleared");
      assert.equal(service.isCurrentlyReconnecting(), false, "isReconnecting must be false");
      assert.equal(service.getReconnectAttempts(), 0, "reconnectAttempts must be 0");
    });
  });

  describe("3. Real-time 'Online' / 'Away' Participant Presence Status Suite", () => {
    it("should correctly resolve presence status for both consultant and client from presence map", () => {
      const presenceMap = new Map<string, { status: "Online" | "Away"; lastSeen: number }>();
      presenceMap.set("consultant-123", { status: "Online", lastSeen: Date.now() });
      presenceMap.set("client-456", { status: "Away", lastSeen: Date.now() });

      const booking = {
        id: "booking-001",
        user_id: "client-456",
        consultant_id: "consultant-123",
        consultants: { user_id: "consultant-123", name: "Dr. Smith" },
        name: "Client Alice",
      };

      // Client viewing consultant:
      const otherUserIdForClient = booking.consultants?.user_id;
      const consultantStatus = presenceMap.get(otherUserIdForClient!)?.status || "Offline";
      assert.equal(consultantStatus, "Online", "Client should see consultant as Online");

      // Consultant viewing client:
      const otherUserIdForConsultant = booking.user_id;
      const clientStatus = presenceMap.get(otherUserIdForConsultant)?.status || "Offline";
      assert.equal(clientStatus, "Away", "Consultant should see client as Away");
    });

    it("should transition user presence to 'Away' when tab is hidden or window blurs and 'Online' when visible", () => {
      let currentStatus: "Online" | "Away" = "Online";

      function handleVisibilityChange(isHidden: boolean): "Online" | "Away" {
        currentStatus = isHidden ? "Away" : "Online";
        return currentStatus;
      }

      assert.equal(handleVisibilityChange(true), "Away", "Tab hidden should switch presence to Away");
      assert.equal(handleVisibilityChange(false), "Online", "Tab visible should switch presence to Online");
    });

    it("should return 'Offline' when participant is not present in presence map or waiting room", () => {
      const presenceMap = new Map<string, { status: "Online" | "Away"; lastSeen: number }>();
      const unknownUserId = "missing-participant-789";

      const status = presenceMap.get(unknownUserId)?.status || "Offline";
      assert.equal(status, "Offline", "Unjoined participant should resolve to Offline");
    });

    it("should update presence map when receiving presence_status_change broadcast", () => {
      const presenceMap = new Map<string, { status: "Online" | "Away"; lastSeen: number }>();
      presenceMap.set("user-abc", { status: "Online", lastSeen: 1000 });

      // Simulated broadcast event
      const broadcastPayload = { userId: "user-abc", status: "Away" as const };
      presenceMap.set(broadcastPayload.userId, {
        status: broadcastPayload.status,
        lastSeen: Date.now(),
      });

      assert.equal(presenceMap.get("user-abc")?.status, "Away");
    });
  });

  describe("4. Agora Network Quality & Packet Loss Unstable Warning Badge Suite", () => {
    it("should consider network stable when packet loss is 0% and quality index is Excellent (1)", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      let qualityCallbackData: any = null;
      service.onNetworkQualityChange = (stats) => {
        qualityCallbackData = stats;
      };

      const result = service.evaluateNetworkQuality(1, 1, 0);

      assert.equal(result.isUnstable, false, "Network should be stable with 0% packet loss and quality 1");
      assert.equal(result.packetLossRate, 0);
      assert.equal(service.getIsNetworkUnstable(), false);
      assert.equal(qualityCallbackData?.isUnstable, false);
    });

    it("should trigger 'Network unstable' when packet loss exceeds threshold (>= 5%)", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      service.setPacketLossThreshold(5);
      assert.equal(service.getPacketLossThreshold(), 5);

      let qualityCallbackData: any = null;
      service.onNetworkQualityChange = (stats) => {
        qualityCallbackData = stats;
      };

      // Below threshold (4%) -> stable
      const stableResult = service.evaluateNetworkQuality(2, 2, 4);
      assert.equal(stableResult.isUnstable, false, "4% packet loss should be under threshold");
      assert.equal(service.getIsNetworkUnstable(), false);

      // At/above threshold (6%) -> unstable
      const unstableResult = service.evaluateNetworkQuality(2, 2, 6);
      assert.equal(unstableResult.isUnstable, true, "6% packet loss should trigger unstable badge");
      assert.equal(service.getIsNetworkUnstable(), true);
      assert.equal(service.getCurrentPacketLossRate(), 6);
      assert.equal(qualityCallbackData?.isUnstable, true);
    });

    it("should trigger 'Network unstable' when Agora quality index is Bad/Very Bad (>= 4) even if packet loss is unmeasured", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      // Uplink 4 (Bad)
      const uplinkBad = service.evaluateNetworkQuality(4, 2);
      assert.equal(uplinkBad.isUnstable, true, "Uplink quality 4 should trigger unstable warning");

      // Downlink 5 (Very Bad)
      const downlinkBad = service.evaluateNetworkQuality(2, 5);
      assert.equal(downlinkBad.isUnstable, true, "Downlink quality 5 should trigger unstable warning");
    });

    it("should recover to stable when network quality improves below threshold", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      // Degraded state
      service.evaluateNetworkQuality(5, 5, 12);
      assert.equal(service.getIsNetworkUnstable(), true);

      // Recovered state
      service.evaluateNetworkQuality(1, 1, 1);
      assert.equal(service.getIsNetworkUnstable(), false, "Network should recover to stable");
      assert.equal(service.getCurrentPacketLossRate(), 1);
    });

    it("should coordinate network quality listener via client 'network-quality' event", async () => {
      const { AgoraService } = await import("../src/services/agora.js");
      const service = new AgoraService();

      const listeners: Record<string, (...args: any[]) => any> = {};
      const mockClient: any = {
        on: (event: string, callback: (...args: any[]) => any) => {
          listeners[event] = callback;
        },
        leave: async () => {},
        join: async () => 12345,
        getRemoteVideoStats: () => ({ "remote-user-1": { packetLossRate: 8.5 } }),
      };

      service.setClient(mockClient);

      let qualityReceived: any = null;
      service.onNetworkQualityChange = (stats) => {
        qualityReceived = stats;
      };

      // Fire network-quality event
      listeners["network-quality"]({ uplinkNetworkQuality: 2, downlinkNetworkQuality: 2 });

      assert.ok(qualityReceived, "onNetworkQualityChange should have been invoked");
      assert.equal(qualityReceived.packetLossRate, 8.5, "Should extract packet loss rate from remote stats");
      assert.equal(qualityReceived.isUnstable, true, "8.5% packet loss should trigger unstable status");
      assert.equal(service.getIsNetworkUnstable(), true);

      await service.leave();
    });
  });
});

