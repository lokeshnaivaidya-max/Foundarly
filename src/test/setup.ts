import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

class MockMediaStreamTrack {
  id = `track_${Math.random().toString(36).substring(2, 9)}`;
  kind: "video" | "audio";
  enabled = true;
  readyState = "live";
  onmute: (() => void) | null = null;
  onunmute: (() => void) | null = null;
  onended: (() => void) | null = null;

  constructor(kind: "video" | "audio" = "video") {
    this.kind = kind;
  }

  stop() {
    this.readyState = "ended";
    if (this.onended) this.onended();
  }

  addEventListener() {}
  removeEventListener() {}
}

type GenericListener = (...args: unknown[]) => void;

class MockMediaStream {
  id = `stream_${Math.random().toString(36).substring(2, 9)}`;
  tracks: MockMediaStreamTrack[] = [];
  private listeners: Map<string, GenericListener[]> = new Map();

  constructor(tracks: MockMediaStreamTrack[] = []) {
    if (tracks && tracks.length) {
      this.tracks = [...tracks];
    } else {
      this.tracks = [new MockMediaStreamTrack("video"), new MockMediaStreamTrack("audio")];
    }
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }

  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }

  getTrackById(id: string) {
    return this.tracks.find((t) => t.id === id);
  }

  addTrack(track: MockMediaStreamTrack) {
    if (!this.getTrackById(track.id)) {
      this.tracks.push(track);
    }
  }

  removeTrack(track: MockMediaStreamTrack) {
    this.tracks = this.tracks.filter((t) => t.id !== track.id);
  }

  addEventListener(event: string, fn: GenericListener) {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
  }

  removeEventListener(event: string, fn: GenericListener) {
    const list = (this.listeners.get(event) || []).filter((f) => f !== fn);
    this.listeners.set(event, list);
  }
}

const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.MediaStream === "undefined") {
  g.MediaStream = MockMediaStream;
}
if (typeof g.MediaStreamTrack === "undefined") {
  g.MediaStreamTrack = MockMediaStreamTrack;
}

if (typeof window.HTMLMediaElement !== "undefined") {
  window.HTMLMediaElement.prototype.play = async () => {};
}

if (typeof window.HTMLCanvasElement !== "undefined") {
  window.HTMLCanvasElement.prototype.captureStream = function () {
    return new MockMediaStream() as unknown as MediaStream;
  };
}

const nav = navigator as unknown as { mediaDevices?: Record<string, unknown> };

if (!nav.mediaDevices) {
  nav.mediaDevices = {};
}

if (!nav.mediaDevices.getUserMedia) {
  nav.mediaDevices.getUserMedia = async () => {
    return new MockMediaStream() as unknown as MediaStream;
  };
}

if (!nav.mediaDevices.getDisplayMedia) {
  nav.mediaDevices.getDisplayMedia = async () => {
    return new MockMediaStream() as unknown as MediaStream;
  };
}

if (typeof g.RTCPeerConnection === "undefined") {
  class MockRTCPeerConnection {
    connectionState = "connected";
    iceConnectionState = "connected";
    signalingState = "stable";
    ontrack: ((e: unknown) => void) | null = null;
    onicecandidate: ((e: unknown) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    oniceconnectionstatechange: (() => void) | null = null;
    senders: Array<{ track: unknown; replaceTrack: (t: unknown) => Promise<void> }> = [];

    addTrack(track: unknown) {
      const sender = { track, replaceTrack: async (t: unknown) => { sender.track = t; } };
      this.senders.push(sender);
      return sender;
    }

    getSenders() {
      return this.senders;
    }

    getReceivers() {
      return [];
    }

    async createOffer() {
      return { type: "offer", sdp: "v=0..." };
    }

    async createAnswer() {
      return { type: "answer", sdp: "v=0..." };
    }

    async setLocalDescription() {}
    async setRemoteDescription() {}
    async addIceCandidate() {}
    restartIce() {}
    close() {
      this.connectionState = "closed";
    }
  }

  g.RTCPeerConnection = MockRTCPeerConnection;
}

if (typeof g.RTCSessionDescription === "undefined") {
  g.RTCSessionDescription = class RTCSessionDescription {
    type: string;
    sdp: string;
    constructor(init: { type: string; sdp: string }) {
      this.type = init.type;
      this.sdp = init.sdp;
    }
  };
}

if (typeof g.RTCIceCandidate === "undefined") {
  g.RTCIceCandidate = class RTCIceCandidate {
    candidate: string;
    constructor(init: { candidate: string }) {
      this.candidate = init.candidate;
    }
  };
}

