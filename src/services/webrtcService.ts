import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface SignalPayload {
  type: 'user-joined' | 'offer' | 'answer' | 'ice-candidate' | 'user-left' | 'request-offer' | 'renegotiate';
  senderId: string;
  targetId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  name?: string;
  email?: string;
}

export interface WebRTCUser {
  id: string;
  stream?: MediaStream;
  email?: string;
  name?: string;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

export class WebRTCService {
  private channel: RealtimeChannel | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private localStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private roomId: string = '';
  private userId: string = '';
  private userInfo: { name?: string; email?: string } = {};
  
  private candidateBuffers: Map<string, RTCIceCandidateInit[]> = new Map();

  // Callbacks
  public onRemoteStream?: (stream: MediaStream, remoteUserId: string) => void;
  public onRemoteUserLeft?: (remoteUserId: string) => void;
  public onPresenceUpdate?: (participantCount: number, participants: Array<{ id: string; name?: string; email?: string }>) => void;
  public onConnectionStateChange?: (state: RTCPeerConnectionState, remoteUserId: string) => void;

  constructor(userId: string, userInfo?: { name?: string; email?: string }) {
    this.userId = userId;
    this.userInfo = userInfo || {};
  }

  public cameraAvailable: boolean = false;
  public micAvailable: boolean = false;
  public mediaError: string | null = null;

  /**
   * Initialize local media stream using real webcam and microphone
   */
  async initLocalStream(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    if (!navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw new Error('Camera and microphone access is not supported by your browser or secure context (HTTPS/localhost) is required.');
    }

    const requestedConstraints: MediaStreamConstraints = {
      video: video ? true : false,
      audio: audio ? true : false
    };

    if (!requestedConstraints.video && !requestedConstraints.audio) {
      this.localStream = new MediaStream();
      return this.localStream;
    }

    console.log('[WebRTC] Diagnostic pre-flight checks:', {
      mediaDevices: navigator.mediaDevices,
      hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
      isSecureContext: window.isSecureContext,
      visibilityState: document.visibilityState,
      locationOrigin: location.origin
    });

    console.log("Requesting media...", requestedConstraints);
    this.mediaError = null;

    try {
      // Direct permissions request FIRST using simple constraints
      console.log("Requesting media...", requestedConstraints);
      this.localStream = await navigator.mediaDevices.getUserMedia(requestedConstraints);
      console.log("Media granted", this.localStream);
    } catch (err: unknown) {
      const error = err as Error;
      console.log("=== GEUSERMEDIA ERROR DIAGNOSTIC ===");
      console.log(error);
      console.log(error?.stack);
      console.dir(error);
      console.error(error?.name, error?.message, error);

      // If combined request failed because a specific device is missing (e.g. no camera attached or no mic)
      if (requestedConstraints.video && requestedConstraints.audio && (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError')) {
        console.log('[WebRTC] Combined device request failed due to missing device hardware, trying individual device streams...');
        const stream = new MediaStream();

        try {
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
          vStream.getVideoTracks().forEach(t => stream.addTrack(t));
        } catch (vErr) {
          console.warn('[WebRTC] Webcam not available:', vErr);
        }

        try {
          const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          aStream.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch (aErr) {
          console.warn('[WebRTC] Microphone not available:', aErr);
        }

        this.localStream = stream;
        this.mediaError = stream.getTracks().length === 0 ? error.message : null;
      } else if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError' || error?.name === 'NotFoundError') {
        console.warn('[WebRTC] Hardware or permissions unavailable, continuing in listener/screen-share mode:', error);
        this.localStream = new MediaStream();
        this.mediaError = error.message;
      } else {
        // Other device access issues
        console.warn('[WebRTC] getUserMedia failed, creating fallback stream:', error);
        this.localStream = new MediaStream();
        this.mediaError = error.message;
      }
    }

    // Update track availability indicators
    if (this.localStream) {
      this.cameraAvailable = this.localStream.getVideoTracks().some(t => t.readyState === 'live');
      this.micAvailable = this.localStream.getAudioTracks().some(t => t.readyState === 'live');

      this.localStream.getTracks().forEach((track) => {
        console.log(`[WebRTC] Real track initialized: kind=${track.kind}, id=${track.id}, enabled=${track.enabled}, state=${track.readyState}`);
        track.onmute = () => console.warn(`[WebRTC] Local track muted: ${track.kind} (${track.id})`);
        track.onunmute = () => console.log(`[WebRTC] Local track unmuted: ${track.kind} (${track.id})`);
        track.onended = () => console.warn(`[WebRTC] Local track ended: ${track.kind} (${track.id})`);
      });
    }

    return this.localStream;
  }

  private negotiationInterval: any = null;

  /**
   * Canonicalizes any room ID variant to ensure both client and consultant
   * connect to the exact same signaling channel regardless of URL format.
   */
  public static canonicalizeRoomId(raw: string): string {
    if (!raw) return 'foundarly-default';
    let clean = raw.trim();
    if (clean.includes('/meeting/')) {
      clean = clean.split('/meeting/').pop() || clean;
    }
    clean = clean.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();
    if (!clean.startsWith('foundarly-')) {
      clean = `foundarly-${clean}`;
    }
    return clean;
  }

  getRoomId(): string {
    return this.roomId;
  }

  /**
   * Join meeting room and set up Supabase Realtime signaling
   */
  async joinRoom(roomId: string): Promise<void> {
    const canonical = WebRTCService.canonicalizeRoomId(roomId);
    this.roomId = canonical;
    const channelName = `meeting_room_${canonical}`;

    console.log(`[WebRTC] Joining room: ${canonical} on channel: ${channelName}`);

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
        presence: {
          key: this.userId
        }
      }
    });

    // Listen for broadcast signaling events
    this.channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      await this.handleSignalPayload(payload);
    });

    // Listen for presence changes
    this.channel.on('presence', { event: 'sync' }, () => {
      if (!this.channel) return;
      const state = this.channel.presenceState();
      console.log('[Presence Sync] Current presence state:', state);

      const participants: Array<{ id: string; name?: string; email?: string }> = [];
      Object.keys(state).forEach((key) => {
        const presences = state[key] as Array<{ name?: string; email?: string }>;
        if (presences && presences.length > 0) {
          const info = presences[0];
          participants.push({
            id: key,
            name: info.name,
            email: info.email
          });
        }
      });

      const participantCount = participants.length;
      console.log(`[Presence Sync] Participant count: ${participantCount}`, participants);
      
      if (this.onPresenceUpdate) {
        this.onPresenceUpdate(participantCount, participants);
      }

      // Automatically trigger negotiation with peers detected in presence
      participants.forEach((p) => {
        if (p.id !== this.userId) {
          this.ensurePeerNegotiation(p.id);
        }
      });
    });

    this.channel.on('presence', { event: 'join' }, async ({ key, newPresences }) => {
      console.log(`[User Joined Presence] User: ${key}`, newPresences);
      if (key !== this.userId) {
        console.log(`[Signaling] New user ${key} joined room, ensuring negotiation.`);
        this.ensurePeerNegotiation(key);
      }
    });

    this.channel.on('presence', { event: 'leave' }, ({ key }) => {
      console.log(`[User Left Presence] User: ${key}`);
      if (key !== this.userId) {
        this.handleUserLeft(key);
      }
    });

    // Subscribe to channel
    return new Promise((resolve, reject) => {
      if (!this.channel) return reject(new Error("Channel not initialized"));

      this.channel.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Socket Connected] Joined room ${this.roomId} successfully.`);
          
          // Track presence
          await this.channel?.track({
            userId: this.userId,
            name: this.userInfo.name || 'Participant',
            email: this.userInfo.email || '',
            joinedAt: new Date().toISOString()
          });

          // Broadcast user-joined to all connected peers in room
          await this.sendSignal({
            type: 'user-joined',
            senderId: this.userId,
            name: this.userInfo.name,
            email: this.userInfo.email
          });

          // Periodic watchdog: if there are other participants in presence but not yet connected, re-attempt negotiation
          if (this.negotiationInterval) {
            clearInterval(this.negotiationInterval);
          }
          this.negotiationInterval = setInterval(() => {
            if (!this.channel) return;
            const state = this.channel.presenceState();
            Object.keys(state).forEach((peerId) => {
              if (peerId !== this.userId) {
                const pc = this.peerConnections.get(peerId);
                if (!pc || (pc.connectionState !== 'connected' && pc.iceConnectionState !== 'connected')) {
                  this.ensurePeerNegotiation(peerId);
                }
              }
            });
          }, 3500);

          resolve();
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[WebRTC] Supabase Channel Error:', err);
          reject(err || new Error("Channel subscription error"));
        } else if (status === 'TIMED_OUT') {
          console.error('[WebRTC] Supabase Channel Timeout');
          reject(new Error("Channel subscription timeout"));
        }
      });
    });
  }

  /**
   * Handle incoming WebRTC signals
   */
  private async handleSignalPayload(payload: SignalPayload): Promise<void> {
    const { type, senderId, targetId, sdp, candidate } = payload;

    // Ignore messages sent by ourselves
    if (senderId === this.userId) return;

    // If targeted message, ignore if not targeted to us
    if (targetId && targetId !== this.userId) return;

    console.log(`[Signaling Received] Event: ${type} from senderId: ${senderId}`);

    switch (type) {
      case 'user-joined': {
        console.log(`[Signaling] User joined: ${senderId}`);
        // Ensure deterministic peer negotiation
        await this.ensurePeerNegotiation(senderId);
        break;
      }

      case 'request-offer': {
        console.log(`[Signaling] Received request-offer from ${senderId}`);
        await this.createAndSendOffer(senderId);
        break;
      }

      case 'renegotiate': {
        console.log(`[Signaling] Received renegotiate from ${senderId}`);
        await this.createAndSendOffer(senderId);
        break;
      }

      case 'offer': {
        console.log(`[Signaling] Offer received from ${senderId}`);
        await this.handleOffer(senderId, sdp!);
        break;
      }

      case 'answer': {
        console.log(`[Signaling] Answer received from ${senderId}`);
        await this.handleAnswer(senderId, sdp!);
        break;
      }

      case 'ice-candidate': {
        console.log(`[Signaling] ICE candidate received from ${senderId}`);
        if (candidate) {
          await this.handleIceCandidate(senderId, candidate);
        }
        break;
      }

      case 'user-left': {
        console.log(`[Signaling] User left: ${senderId}`);
        this.handleUserLeft(senderId);
        break;
      }

      default:
        console.warn(`[Signaling] Unknown signal type: ${type}`);
    }
  }

  /**
   * Deterministically ensures WebRTC negotiation between this user and a remote peer.
   * Prevents deadlock when participants join at different times or miss ephemeral broadcast packets.
   */
  public async ensurePeerNegotiation(remoteUserId: string): Promise<void> {
    if (!remoteUserId || remoteUserId === this.userId) return;

    const pc = this.getOrCreatePeerConnection(remoteUserId);
    if (pc.connectionState === 'connected') return;

    // Deterministic role: participant with lexicographically smaller ID acts as offerer
    const isOfferer = this.userId < remoteUserId;

    if (isOfferer) {
      if (pc.signalingState === 'stable') {
        console.log(`[WebRTC] Initiating offer as designated offerer for ${remoteUserId}`);
        await this.createAndSendOffer(remoteUserId);
      }
    } else {
      console.log(`[WebRTC] Prompting designated offerer ${remoteUserId} for offer`);
      await this.sendSignal({
        type: 'request-offer',
        senderId: this.userId,
        targetId: remoteUserId,
      });
    }
  }

  /**
   * Create or retrieve RTCPeerConnection for a remote peer
   */
  private getOrCreatePeerConnection(remoteUserId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(remoteUserId);
    if (pc) return pc;

    console.log(`[WebRTC] Creating RTCPeerConnection for ${remoteUserId}...`);
    pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks to peer connection
    if (this.localStream) {
      const tracks = this.localStream.getTracks();
      tracks.forEach((track) => {
        const sender = pc!.addTrack(track, this.localStream!);
        console.log(`[WebRTC] Added local track to PC (${remoteUserId}): kind=${track.kind}, id=${track.id}, senderId=${sender.id}`);
      });
      console.log(`[WebRTC] Total ${tracks.length} local track(s) added to PeerConnection for ${remoteUserId}`);
    } else {
      console.warn(`[WebRTC] Warning: localStream is null when creating PeerConnection for ${remoteUserId}`);
    }

    // Handle remote tracks via ontrack
    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack fired from ${remoteUserId}! Track kind: ${event.track.kind}, track ID: ${event.track.id}, state: ${event.track.readyState}`);
      
      const track = event.track;
      
      // Log track events
      track.onmute = () => console.warn(`[WebRTC] Remote track muted from ${remoteUserId}: ${track.kind} (${track.id})`);
      track.onunmute = () => console.log(`[WebRTC] Remote track unmuted from ${remoteUserId}: ${track.kind} (${track.id})`);
      track.onended = () => console.warn(`[WebRTC] Remote track ended from ${remoteUserId}: ${track.kind} (${track.id})`);

      // Retrieve or create persistent remote MediaStream for this user
      let remoteStream = this.remoteStreams.get(remoteUserId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        this.remoteStreams.set(remoteUserId, remoteStream);
        console.log(`[WebRTC] Created new remote MediaStream for user ${remoteUserId}`);
      }

      // Add track if not already present
      if (!remoteStream.getTrackById(track.id)) {
        remoteStream.addTrack(track);
        console.log(`[WebRTC] Added ${track.kind} track to remoteStream for ${remoteUserId}. Total tracks:`, remoteStream.getTracks().length);
      } else {
        console.log(`[WebRTC] Track ${track.id} already exists in remoteStream for ${remoteUserId}`);
      }

      // Trigger callback
      if (this.onRemoteStream) {
        console.log(`[WebRTC] Dispatching onRemoteStream callback for ${remoteUserId}`);
        this.onRemoteStream(remoteStream, remoteUserId);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] ICE candidate generated for ${remoteUserId}:`, event.candidate.candidate);
        this.sendSignal({
          type: 'ice-candidate',
          senderId: this.userId,
          targetId: remoteUserId,
          candidate: event.candidate.toJSON()
        });
      } else {
        console.log(`[WebRTC] All ICE candidates gathered for ${remoteUserId}`);
      }
    };

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] PeerConnection state (${remoteUserId}):`, pc!.connectionState);
      
      // Log senders and receivers
      pc!.getSenders().forEach((s) => console.log(`[WebRTC] Sender (${remoteUserId}): kind=${s.track?.kind}, trackId=${s.track?.id}`));
      pc!.getReceivers().forEach((r) => console.log(`[WebRTC] Receiver (${remoteUserId}): kind=${r.track?.kind}, trackId=${r.track?.id}`));

      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(pc!.connectionState, remoteUserId);
      }
      
      if (pc!.connectionState === 'failed') {
        console.warn(`[WebRTC] PeerConnection failed for ${remoteUserId}, attempting ICE restart...`);
        pc!.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state (${remoteUserId}):`, pc!.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state (${remoteUserId}):`, pc!.signalingState);
    };

    this.peerConnections.set(remoteUserId, pc);
    return pc;
  }

  /**
   * Create and send WebRTC Offer
   */
  private async createAndSendOffer(remoteUserId: string): Promise<void> {
    try {
      const pc = this.getOrCreatePeerConnection(remoteUserId);
      console.log(`[WebRTC] Creating offer for ${remoteUserId}...`);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      console.log(`[WebRTC] Local description (Offer) set for ${remoteUserId}`);

      await this.sendSignal({
        type: 'offer',
        senderId: this.userId,
        targetId: remoteUserId,
        sdp: offer
      });
      console.log(`[Signaling] Offer sent to ${remoteUserId}`);
    } catch (err) {
      console.error(`[WebRTC] Error creating offer for ${remoteUserId}:`, err);
    }
  }

  /**
   * Handle incoming WebRTC Offer
   */
  private async handleOffer(remoteUserId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.getOrCreatePeerConnection(remoteUserId);
      const isOfferCollision = pc.signalingState !== 'stable';
      const isPolite = this.userId > remoteUserId;

      if (isOfferCollision) {
        if (!isPolite) {
          console.log(`[WebRTC] Glare detected. Impolite peer ignoring offer collision from ${remoteUserId}`);
          return;
        }
        console.log(`[WebRTC] Glare detected. Polite peer rolling back to accept offer from ${remoteUserId}`);
        await pc.setLocalDescription({ type: 'rollback' });
      }

      console.log(`[WebRTC] Setting remote description (Offer) from ${remoteUserId}...`);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush buffered candidates
      await this.flushCandidateBuffer(remoteUserId, pc);

      console.log(`[WebRTC] Creating answer for ${remoteUserId}...`);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log(`[WebRTC] Local description (Answer) set for ${remoteUserId}`);

      await this.sendSignal({
        type: 'answer',
        senderId: this.userId,
        targetId: remoteUserId,
        sdp: answer
      });
      console.log(`[Signaling] Answer sent to ${remoteUserId}`);
    } catch (err) {
      console.error(`[WebRTC] Error handling offer from ${remoteUserId}:`, err);
    }
  }

  /**
   * Handle incoming WebRTC Answer
   */
  private async handleAnswer(remoteUserId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(remoteUserId);
      if (!pc) {
        console.warn(`[WebRTC] No PeerConnection found for answer from ${remoteUserId}`);
        return;
      }
      console.log(`[WebRTC] Setting remote description (Answer) from ${remoteUserId}...`);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush buffered candidates
      await this.flushCandidateBuffer(remoteUserId, pc);
    } catch (err) {
      console.error(`[WebRTC] Error handling answer from ${remoteUserId}:`, err);
    }
  }

  /**
   * Handle incoming ICE Candidate
   */
  private async handleIceCandidate(remoteUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(remoteUserId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        console.log(`[WebRTC] Adding ICE candidate for ${remoteUserId}`);
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log(`[WebRTC] Buffering ICE candidate for ${remoteUserId} (remoteDescription not set yet)`);
        const buffer = this.candidateBuffers.get(remoteUserId) || [];
        buffer.push(candidate);
        this.candidateBuffers.set(remoteUserId, buffer);
      }
    } catch (err) {
      console.error(`[WebRTC] Error adding ICE candidate from ${remoteUserId}:`, err);
    }
  }

  /**
   * Flush candidate buffer after setRemoteDescription
   */
  private async flushCandidateBuffer(remoteUserId: string, pc: RTCPeerConnection): Promise<void> {
    const buffer = this.candidateBuffers.get(remoteUserId);
    if (buffer && buffer.length > 0) {
      console.log(`[WebRTC] Flushing ${buffer.length} buffered ICE candidates for ${remoteUserId}`);
      for (const candidate of buffer) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(`[WebRTC] Error adding buffered candidate:`, err);
        }
      }
      this.candidateBuffers.delete(remoteUserId);
    }
  }

  /**
   * Handle user leaving
   */
  private handleUserLeft(remoteUserId: string): void {
    console.log(`[WebRTC] Cleaning up resources for remote user ${remoteUserId}`);
    const pc = this.peerConnections.get(remoteUserId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteUserId);
    }
    this.remoteStreams.delete(remoteUserId);
    this.candidateBuffers.delete(remoteUserId);

    if (this.onRemoteUserLeft) {
      this.onRemoteUserLeft(remoteUserId);
    }
  }

  /**
   * Send signal payload over Supabase Realtime Broadcast
   */
  private async sendSignal(payload: SignalPayload): Promise<void> {
    if (!this.channel) return;
    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload
      });
    } catch (err) {
      console.error('[Signaling] Failed to send broadcast signal:', err);
    }
  }

  /**
   * Toggle audio mute/unmute
   */
  toggleAudio(muted: boolean): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !muted;
      console.log(`[WebRTC] Local audio track ${track.id} enabled state set to: ${!muted}`);
    });
    return !muted;
  }

  /**
   * Toggle video start/stop
   */
  toggleVideo(videoOff: boolean): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !videoOff;
      console.log(`[WebRTC] Local video track ${track.id} enabled state set to: ${!videoOff}`);
    });
    return !videoOff;
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStreamTrack> {
    console.log('[WebRTC] Requesting screen share display media...');
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

    this.screenTrack = displayStream.getVideoTracks()[0];
    if (!this.screenTrack) {
      throw new Error('Screen sharing track unavailable');
    }
    console.log('[WebRTC] Screen share track obtained:', this.screenTrack.id);

    // Replace video track in all active peer connections
    this.peerConnections.forEach((pc, remoteUserId) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender && this.screenTrack) {
        console.log(`[WebRTC] Replacing video sender track for ${remoteUserId} with screen track`);
        videoSender.replaceTrack(this.screenTrack);
      }
    });

    return this.screenTrack;
  }

  /**
   * Stop screen sharing and revert to real camera track
   */
  async stopScreenShare(): Promise<void> {
    if (this.screenTrack) {
      console.log('[WebRTC] Stopping screen share track...');
      this.screenTrack.stop();
      this.screenTrack = null;
    }

    let cameraTrack: MediaStreamTrack | undefined;
    if (this.localStream) {
      cameraTrack = this.localStream.getVideoTracks().find(t => t.readyState === 'live');
    }

    if (!cameraTrack) {
      try {
        console.log('[WebRTC] Re-acquiring live camera track after screen share...');
        const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraTrack = freshStream.getVideoTracks()[0];
        if (this.localStream && cameraTrack) {
          this.localStream.getVideoTracks().forEach(t => this.localStream?.removeTrack(t));
          this.localStream.addTrack(cameraTrack);
        }
      } catch (err) {
        console.warn('[WebRTC] Could not re-acquire camera track:', err);
      }
    }

    if (cameraTrack) {
      console.log('[WebRTC] Reverting peer connections to camera track:', cameraTrack.id);
      this.peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack!);
        }
      });
    }
    console.log('[WebRTC] Reverted to camera track after screen share');
  }

  /**
   * Leave meeting and cleanup all WebRTC resources
   */
  async leave(): Promise<void> {
    console.log('[WebRTC] Leaving meeting and cleaning up resources...');

    if (this.negotiationInterval) {
      clearInterval(this.negotiationInterval);
      this.negotiationInterval = null;
    }

    // Send user-left signal
    await this.sendSignal({
      type: 'user-left',
      senderId: this.userId
    });

    // Close peer connections
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.candidateBuffers.clear();

    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.screenTrack) {
      this.screenTrack.stop();
      this.screenTrack = null;
    }

    // Unsubscribe from channel
    if (this.channel) {
      await this.channel.untrack();
      await this.channel.unsubscribe();
      this.channel = null;
    }

    console.log('[WebRTC] Cleanup complete.');
  }
}
