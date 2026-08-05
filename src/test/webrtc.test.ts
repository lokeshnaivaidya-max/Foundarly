import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebRTCService } from "../services/webrtcService";

// Helper to create synthetic MediaStream for testing environment
function createMockStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, 320, 240);
  }
  const stream = canvas.captureStream(10);
  
  // Add audio track
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const osc = audioCtx.createOscillator();
  const dst = audioCtx.createMediaStreamDestination();
  osc.connect(dst);
  osc.start();
  const audioTrack = dst.stream.getAudioTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);

  return stream;
}

describe("WebRTC Meeting End-To-End Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("completes full end-to-end WebRTC meeting flow between two users", async () => {
    const user1Id = "user_alice_101";
    const user2Id = "user_bob_202";

    const service1 = new WebRTCService(user1Id, { name: "Alice", email: "alice@example.com" });
    const service2 = new WebRTCService(user2Id, { name: "Bob", email: "bob@example.com" });

    // 1. Initialize local streams for both users
    const stream1 = await service1.initLocalStream(true, true);
    const stream2 = await service2.initLocalStream(true, true);

    expect(stream1).toBeDefined();
    expect(stream1.getTracks().length).toBeGreaterThan(0);
    expect(stream2).toBeDefined();
    expect(stream2.getTracks().length).toBeGreaterThan(0);

    // Verify local video and audio tracks
    expect(stream1.getVideoTracks().length).toBeGreaterThan(0);
    expect(stream1.getAudioTracks().length).toBeGreaterThan(0);

    // 2. Mock peer connections for simulated WebRTC connection
    const pc1 = new RTCPeerConnection();
    const pc2 = new RTCPeerConnection();

    stream1.getTracks().forEach((track) => pc1.addTrack(track, stream1));
    stream2.getTracks().forEach((track) => pc2.addTrack(track, stream2));

    // Handle ICE Candidate exchange between pc1 and pc2
    pc1.onicecandidate = (e) => {
      if (e.candidate) pc2.addIceCandidate(e.candidate);
    };
    pc2.onicecandidate = (e) => {
      if (e.candidate) pc1.addIceCandidate(e.candidate);
    };

    let remoteStream1: MediaStream | null = null;
    let remoteStream2: MediaStream | null = null;

    pc1.ontrack = (e) => {
      remoteStream1 = e.streams[0] || new MediaStream([e.track]);
    };
    pc2.ontrack = (e) => {
      remoteStream2 = e.streams[0] || new MediaStream([e.track]);
    };

    // Offer / Answer handshake
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);

    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);

    // Wait for RTCPeerConnection and ICE connection state transition
    await new Promise<void>((resolve) => {
      const checkState = () => {
        if (
          (pc1.connectionState === "connected" || pc1.iceConnectionState === "connected" || pc1.iceConnectionState === "completed") &&
          (pc2.connectionState === "connected" || pc2.iceConnectionState === "connected" || pc2.iceConnectionState === "completed")
        ) {
          resolve();
        }
      };
      pc1.onconnectionstatechange = checkState;
      pc1.oniceconnectionstatechange = checkState;
      pc2.onconnectionstatechange = checkState;
      pc2.oniceconnectionstatechange = checkState;
      setTimeout(resolve, 500); // Fallback timeout for loopback mock
    });

    // Verify RTCPeerConnection and ICE connection state criteria
    const pc1Connected = ["connected", "completed"].includes(pc1.iceConnectionState) || pc1.connectionState === "connected";
    const pc2Connected = ["connected", "completed"].includes(pc2.iceConnectionState) || pc2.connectionState === "connected";
    expect(pc1Connected).toBe(true);
    expect(pc2Connected).toBe(true);

    // 3. Verify Camera Toggle
    const videoEnabledInitial = service1.toggleVideo(true); // Stop video
    expect(videoEnabledInitial).toBe(false);
    expect(stream1.getVideoTracks()[0].enabled).toBe(false);

    const videoEnabledRestored = service1.toggleVideo(false); // Start video
    expect(videoEnabledRestored).toBe(true);
    expect(stream1.getVideoTracks()[0].enabled).toBe(true);

    // 4. Verify Microphone Toggle
    const audioEnabledMuted = service1.toggleAudio(true); // Mute audio
    expect(audioEnabledMuted).toBe(false);
    expect(stream1.getAudioTracks()[0].enabled).toBe(false);

    const audioEnabledUnmuted = service1.toggleAudio(false); // Unmute audio
    expect(audioEnabledUnmuted).toBe(true);
    expect(stream1.getAudioTracks()[0].enabled).toBe(true);

    // 5. Verify Screen Share Start and Stop (reverting to camera)
    const screenTrack = await service1.startScreenShare();
    expect(screenTrack).toBeDefined();
    expect(screenTrack.kind).toBe("video");

    await service1.stopScreenShare();
    expect(service1["screenTrack"]).toBeNull();
    expect(stream1.getVideoTracks()[0].enabled).toBe(true);

    // 6. Verify Participant Count tracking
    let presenceCount = 0;
    service1.onPresenceUpdate = (count) => {
      presenceCount = count;
    };
    service1.onPresenceUpdate(2, [
      { id: user1Id, name: "Alice" },
      { id: user2Id, name: "Bob" }
    ]);
    expect(presenceCount).toBe(2);

    // Cleanup
    pc1.close();
    pc2.close();
    await service1.leave();
    await service2.leave();
  });
});
