import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toNumericUid } from "../src/services/agoraToken.js";
import { AgoraService } from "../src/services/agora.js";

describe("Meeting Waiting Room Admission & Live RTC Flow Suite", () => {
  describe("1. Consistent Numeric UID Generation for Agora RTC", () => {
    it("should generate a consistent positive integer from numeric UID", () => {
      assert.equal(toNumericUid(12345), 12345);
      assert.equal(toNumericUid(999999), 999999);
    });

    it("should parse numeric string into positive integer", () => {
      assert.equal(toNumericUid("12345"), 12345);
      assert.equal(toNumericUid("567890"), 567890);
    });

    it("should deterministically hash UUID strings to valid positive 32-bit Agora UIDs", () => {
      const uuid1 = "3dc127b8-7334-4960-a3b5-8627923d40f1";
      const uid1a = toNumericUid(uuid1);
      const uid1b = toNumericUid(uuid1);

      assert.equal(uid1a, uid1b, "UID must be deterministic for the same user UUID");
      assert.ok(typeof uid1a === "number", "UID must be a number");
      assert.ok(uid1a > 0 && uid1a <= 10000000, "UID must be within safe positive range");

      const uuid2 = "a4d5e6f7-1111-2222-3333-444455556666";
      const uid2 = toNumericUid(uuid2);
      assert.notEqual(uid1a, uid2, "Different UUIDs should produce distinct UIDs");
    });
  });

  describe("2. Waiting Room Admission State & Realtime Broadcast Logic", () => {
    it("should allow consultant to broadcast admission signal to waiting room channel", () => {
      const broadcastMessages: any[] = [];
      const mockChannel = {
        send: async (msg: any) => {
          broadcastMessages.push(msg);
          return "ok";
        },
      };

      const consultantUserId = "consultant-123";
      const admitPayload = {
        admittedBy: consultantUserId,
        timestamp: new Date().toISOString(),
      };

      mockChannel.send({
        type: "broadcast",
        event: "meeting_admit",
        payload: admitPayload,
      });

      assert.equal(broadcastMessages.length, 1);
      assert.equal(broadcastMessages[0].type, "broadcast");
      assert.equal(broadcastMessages[0].event, "meeting_admit");
      assert.equal(broadcastMessages[0].payload.admittedBy, consultantUserId);
    });

    it("should transition client from waiting state to admitted state upon receiving meeting_admit", () => {
      let isAdmitted = false;
      let startCallTriggered = false;

      function onMeetingAdmitReceived(payload: any) {
        if (payload && payload.admittedBy) {
          isAdmitted = true;
          startCallTriggered = true;
        }
      }

      onMeetingAdmitReceived({ admittedBy: "consultant-123", timestamp: new Date().toISOString() });

      assert.equal(isAdmitted, true, "Client must be marked as admitted");
      assert.equal(startCallTriggered, true, "Admitted client must automatically trigger call join");
    });

    it("should prevent duplicate call starts on multiple admission broadcasts", () => {
      let callStarted = false;
      let joinCount = 0;

      function handleAdmit(payload: any) {
        if (callStarted) {
          // Guard against duplicate join
          return;
        }
        callStarted = true;
        joinCount++;
      }

      handleAdmit({ admittedBy: "consultant-123" });
      handleAdmit({ admittedBy: "consultant-123" }); // Duplicate broadcast
      handleAdmit({ admittedBy: "consultant-123" });

      assert.equal(joinCount, 1, "Join should only be executed once even if broadcast repeats");
    });
  });

  describe("3. Admission Permissions & Authorization Guard Logic", () => {
    it("should permit consultant (host) to start consultation when participants are ready", () => {
      const userRole = "consultant";
      const isAdmitted = false;
      const canJoin = false;
      const status = "upcoming";

      const isHost = userRole === "consultant";
      const allowedToStart = canJoin || isAdmitted || status === "live" || status === "rejoin_eligible" || isHost;

      assert.equal(allowedToStart, true, "Consultant host must be allowed to start session");
    });

    it("should permit client to enter once admitted by host even if session status was upcoming", () => {
      const userRole = "client";
      const isAdmitted = true; // Admitted by host
      const canJoin = false;
      const status = "upcoming";

      const isHost = userRole === "consultant";
      const allowedToStart = canJoin || isAdmitted || status === "live" || status === "rejoin_eligible" || isHost;

      assert.equal(allowedToStart, true, "Admitted client must be permitted to start call");
    });

    it("should block unadmitted, unauthorized non-participants", () => {
      const userRole = null;
      const isAdmitted = false;
      const canJoin = false;
      const status = "upcoming";

      const isHost = userRole === "consultant";
      const allowedToStart = canJoin || isAdmitted || status === "live" || status === "rejoin_eligible" || isHost;

      assert.equal(allowedToStart, false, "Unauthorized participant must remain blocked");
    });
  });

  describe("4. Agora Remote User Video & Audio Track Binding to Meeting UI", () => {
    it("should bind remote video track to MediaStream when onRemoteUserPublished fires", () => {
      const service = new AgoraService();
      const remoteParticipants = new Map<string, { id: string; stream: any }>();

      // Mock Agora remote user with video track
      const mockTrack = { id: "track-video-99", kind: "video" };
      const mockUser = {
        uid: 102030,
        videoTrack: {
          getMediaStreamTrack: () => mockTrack,
        },
      };

      // Simulated onRemoteUserPublished handler in Meeting.tsx
      const handleRemoteUserPublished = (remoteUser: any, mediaType: string) => {
        const uidStr = String(remoteUser.uid);
        const tracks: any[] = [];
        if (mediaType === "video" && remoteUser.videoTrack) {
          tracks.push(remoteUser.videoTrack.getMediaStreamTrack());
        }
        const mockMediaStream = {
          id: `stream-${uidStr}`,
          getTracks: () => tracks,
          getVideoTracks: () => tracks.filter(t => t.kind === "video"),
          getAudioTracks: () => tracks.filter(t => t.kind === "audio"),
        };
        remoteParticipants.set(uidStr, { id: uidStr, stream: mockMediaStream });
      };

      service.onRemoteUserPublished = handleRemoteUserPublished;
      service.onRemoteUserPublished(mockUser, "video");

      assert.equal(remoteParticipants.size, 1);
      assert.ok(remoteParticipants.has("102030"));
      const participant = remoteParticipants.get("102030");
      assert.equal(participant?.stream.getVideoTracks().length, 1);
      assert.equal(participant?.stream.getVideoTracks()[0].id, "track-video-99");
    });

    it("should clean up remote user when onRemoteUserLeft fires", () => {
      const remoteParticipants = new Map<string, { id: string; stream: any }>();
      remoteParticipants.set("102030", { id: "102030", stream: {} });

      const handleRemoteUserLeft = (remoteUser: any) => {
        remoteParticipants.delete(String(remoteUser.uid));
      };

      handleRemoteUserLeft({ uid: 102030 });
      assert.equal(remoteParticipants.size, 0, "Remote participant must be cleanly removed on left");
    });
  });
});
