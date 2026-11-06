import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";
import { generateMeetingToken, canGenerateTokens } from "./agoraToken";

// Browser-safe lazy AgoraRTC module loader
let agoraRTCModule: any = null;
export async function getAgoraRTC(): Promise<any> {
  if (!agoraRTCModule && typeof window !== "undefined") {
    try {
      const mod = await import("agora-rtc-sdk-ng");
      agoraRTCModule = mod.default || mod;
    } catch (e) {
      console.warn("[AgoraService] Failed to load agora-rtc-sdk-ng:", e);
    }
  }
  return agoraRTCModule;
}

// Agora configuration
const AGORA_APP_ID = import.meta.env?.VITE_AGORA_APP_ID || "";

export interface AgoraConfig {
  appId: string;
  channel: string;
  token?: string;
  uid?: string | number;
}

export class AgoraService {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private localVideoTrack: ICameraVideoTrack | null = null;
  private isJoined = false;
  private manualLeave = false;
  private currentConfig: AgoraConfig | null = null;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Reconnection and connection state callbacks
  public onConnectionStateChange?: (curState: string, revState: string, reason?: string) => void;
  public onReconnecting?: (attempt: number) => void;
  public onReconnected?: () => void;
  public onReconnectFailed?: () => void;
  public onRemoteUserPublished?: (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => void;
  public onRemoteUserUnpublished?: (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => void;
  public onRemoteUserLeft?: (user: IAgoraRTCRemoteUser) => void;

  constructor() {
    // In browser environment, initialize Agora client
    if (typeof window !== "undefined") {
      this.initClient().catch((err) => {
        console.warn("[AgoraService] Eager client initialization note:", err?.message);
      });
    }
  }

  /**
   * Initialize Agora client instance safely in browser
   */
  async initClient(): Promise<IAgoraRTCClient | null> {
    if (this.client) return this.client;
    const RTC = await getAgoraRTC();
    if (RTC && typeof RTC.createClient === "function") {
      this.client = RTC.createClient({ mode: "rtc", codec: "vp8" });
      this.setupEventListeners();
    }
    return this.client;
  }

  /**
   * Set custom or mock client (e.g., for automated testing)
   */
  setClient(client: IAgoraRTCClient | null): void {
    this.client = client;
    if (this.client) {
      this.setupEventListeners();
    }
  }

  /**
   * Set up event listeners (following official documentation)
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // Handle user-published event
    this.client.on("user-published", async (user, mediaType) => {
      console.log(`User ${user.uid} published ${mediaType}`);
      
      try {
        // Subscribe to the remote user's media track
        await this.client!.subscribe(user, mediaType);
        
        if (mediaType === "video" && user.videoTrack) {
          console.log(`Subscribed to video from user ${user.uid}`);
          // Video will be played by the Meeting component
        }
        
        if (mediaType === "audio" && user.audioTrack) {
          console.log(`Subscribed to audio from user ${user.uid}`);
          // Play audio automatically
          user.audioTrack.play();
        }

        this.onRemoteUserPublished?.(user, mediaType);
      } catch (error) {
        console.error(`Failed to subscribe to user ${user.uid}:`, error);
      }
    });

    // Handle user-unpublished event
    this.client.on("user-unpublished", (user, mediaType) => {
      console.log(`User ${user.uid} unpublished ${mediaType}`);
      this.onRemoteUserUnpublished?.(user, mediaType);
    });

    // Handle user-left event
    this.client.on("user-left", (user) => {
      console.log(`User ${user.uid} left the channel`);
      this.onRemoteUserLeft?.(user);
    });

    // Handle connection state changes and automatic reconnection
    this.client.on("connection-state-change", (curState, revState, reason) => {
      console.log(`[AgoraService] Connection state changed from ${revState} to ${curState} (reason: ${reason || 'normal'})`);
      this.onConnectionStateChange?.(curState, revState, reason);

      if (curState === "RECONNECTING") {
        this.isReconnecting = true;
        this.onReconnecting?.(this.reconnectAttempts + 1);
      } else if (curState === "CONNECTED") {
        if (this.isReconnecting || this.reconnectAttempts > 0) {
          console.log("[AgoraService] Successfully reconnected to Agora RTC channel!");
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          this.onReconnected?.();
        }
      } else if ((curState === "DISCONNECTED" || curState === "FAILED") && !this.manualLeave && this.isJoined) {
        console.warn(`[AgoraService] Connection lost (${curState}). Initiating automatic reconnection...`);
        this.reconnect();
      }
    });

    // Handle network quality
    this.client.on("network-quality", (stats) => {
      console.log("Network quality:", stats);
    });
  }

  /**
   * Join a channel (following official documentation)
   */
  async join(config: AgoraConfig): Promise<void> {
    if (!this.client) {
      await this.initClient();
    }

    if (!this.client) {
      throw new Error("Agora client not initialized");
    }

    if (this.isJoined) {
      console.warn("Already joined a channel");
      return;
    }

    try {
      console.log("Joining Agora channel:", config.channel);
      this.currentConfig = { ...config };
      this.manualLeave = false;
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      
      // Prepare token (following official documentation)
      let token = config.token || null;
      
      if (!token && canGenerateTokens()) {
        try {
          console.log("Attempting to generate Agora token...");
          const uid = config.uid || Math.floor(Math.random() * 1000000);
          token = await generateMeetingToken(config.channel, uid);
          if (token) {
            console.log("Token generated successfully from server");
          } else {
            console.log("No token returned, attempting App ID mode");
          }
        } catch (tokenError: any) {
          console.warn("Token generation failed:", tokenError?.message);
          console.log("Falling back to App ID only mode");
          token = null;
        }
      } else if (!token) {
        console.log("Using App ID only mode (no token generation available)");
      }
      
      const uid = config.uid || Math.floor(Math.random() * 1000000);

      // Join the channel (official documentation step)
      const joinedUid = await this.client.join(
        config.appId,
        config.channel,
        token,
        uid
      );

      console.log("Joined channel successfully with UID:", joinedUid);
      this.isJoined = true;

      // Create and publish local media tracks (following official flow)
      await this.createLocalMediaTracks();
      await this.publishLocalTracks();

      return;
    } catch (error) {
      console.error("Failed to join channel:", error);
      
      // Provide helpful error message for common issues
      if (error.message?.includes("CAN_NOT_GET_GATEWAY_SERVER")) {
        throw new Error(
          `Agora connection failed. Please ensure:\n` +
          "1. Your Agora App ID is correct\n" +
          "2. Enable 'App ID only' mode in Agora Console (Project Settings → Authentication)\n" +
          "3. Your internet connection is stable\n" +
          "4. For production: Implement server-side token generation\n" +
          "Original error: " + error.message
        );
      }
      
      throw error;
    }
  }

  /**
   * Create local media tracks (following official documentation)
   */
  async createLocalMediaTracks(): Promise<void> {
    try {
      const RTC = await getAgoraRTC();
      if (!RTC) {
        throw new Error("AgoraRTC not available in current environment");
      }
      // Create microphone audio track
      this.localAudioTrack = await RTC.createMicrophoneAudioTrack();
      console.log("Created local audio track");

      // Create camera video track
      this.localVideoTrack = await RTC.createCameraVideoTrack();
      console.log("Created local video track");
    } catch (error) {
      console.error("Failed to create local tracks:", error);
      throw error;
    }
  }

  /**
   * Publish local tracks (following official documentation)
   */
  async publishLocalTracks(): Promise<void> {
    if (!this.client || !this.localAudioTrack || !this.localVideoTrack) {
      throw new Error("Client or tracks not initialized");
    }

    try {
      await this.client.publish([this.localAudioTrack, this.localVideoTrack]);
      console.log("Published local tracks successfully");
    } catch (error) {
      console.error("Failed to publish local tracks:", error);
      throw error;
    }
  }

  /**
   * Play local video in a container
   */
  playLocalVideo(container: HTMLElement | string): void {
    if (!this.localVideoTrack) {
      console.error("Local video track not available");
      return;
    }

    this.localVideoTrack.play(container);
    console.log("Playing local video");
  }

  /**
   * Subscribe to remote user
   */
  async subscribeToUser(
    user: IAgoraRTCRemoteUser,
    mediaType: "audio" | "video"
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      await this.client.subscribe(user, mediaType);
      console.log(`Subscribed to ${mediaType} from user ${user.uid}`);
    } catch (error) {
      console.error(`Failed to subscribe to ${mediaType}:`, error);
      throw error;
    }
  }

  /**
   * Play remote user's video
   */
  playRemoteVideo(user: IAgoraRTCRemoteUser, container: HTMLElement | string): void {
    if (!user.videoTrack) {
      console.error("Remote video track not available");
      return;
    }

    user.videoTrack.play(container);
    console.log(`Playing remote video for user ${user.uid}`);
  }

  /**
   * Play remote user's audio
   */
  playRemoteAudio(user: IAgoraRTCRemoteUser): void {
    if (!user.audioTrack) {
      console.error("Remote audio track not available");
      return;
    }

    user.audioTrack.play();
    console.log(`Playing remote audio for user ${user.uid}`);
  }

  /**
   * Toggle local audio (mute/unmute)
   */
  async toggleAudio(mute: boolean): Promise<void> {
    if (!this.localAudioTrack) {
      console.error("Local audio track not available");
      return;
    }

    await this.localAudioTrack.setEnabled(!mute);
    console.log(`Audio ${mute ? "muted" : "unmuted"}`);
  }

  /**
   * Toggle local video (on/off)
   */
  async toggleVideo(enabled: boolean): Promise<void> {
    if (!this.localVideoTrack) {
      console.error("Local video track not available");
      return;
    }

    await this.localVideoTrack.setEnabled(enabled);
    console.log(`Video ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Automatic reconnection logic for Agora RTC stream
   */
  async reconnect(): Promise<void> {
    if (this.isReconnecting || this.manualLeave || !this.currentConfig) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[AgoraService] Maximum reconnect attempts (${this.maxReconnectAttempts}) reached.`);
      this.isReconnecting = false;
      this.onReconnectFailed?.();
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    this.onReconnecting?.(this.reconnectAttempts);

    // Exponential backoff delay: 1s, 2s, 4s, 8s max
    const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 8000);
    console.log(`[AgoraService] Attempting automatic reconnection #${this.reconnectAttempts} in ${delayMs}ms...`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (!this.currentConfig || this.manualLeave) {
          this.isReconnecting = false;
          return;
        }

        console.log(`[AgoraService] Executing reconnection attempt #${this.reconnectAttempts}...`);

        // 1. Refresh RTC token if token service is available
        let freshToken: string | null = null;
        if (canGenerateTokens()) {
          try {
            const uid = this.currentConfig.uid || Math.floor(Math.random() * 1000000);
            freshToken = await generateMeetingToken(this.currentConfig.channel, uid);
            if (freshToken) {
              console.log("[AgoraService] Refreshed Agora RTC token for reconnection");
            }
          } catch (tErr: any) {
            console.warn("[AgoraService] Token refresh failed during reconnect, using cached token:", tErr?.message);
          }
        }

        // 2. Safely leave and re-join channel
        if (this.client) {
          try {
            await this.client.leave();
          } catch (_ignore) {
            // Ignore leave errors when already disconnected
          }

          const uid = this.currentConfig.uid || Math.floor(Math.random() * 1000000);
          await this.client.join(
            this.currentConfig.appId,
            this.currentConfig.channel,
            freshToken || this.currentConfig.token || null,
            uid
          );

          // 3. Re-create & re-publish local media tracks if not live
          if (!this.localAudioTrack || !this.localVideoTrack) {
            await this.createLocalMediaTracks();
          }
          await this.publishLocalTracks();

          this.isJoined = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          console.log("[AgoraService] Automatic reconnection succeeded!");
          this.onReconnected?.();
        }
      } catch (err) {
        console.error(`[AgoraService] Reconnection attempt #${this.reconnectAttempts} failed:`, err);
        this.isReconnecting = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.manualLeave && this.isJoined) {
          this.reconnect();
        } else {
          this.onReconnectFailed?.();
        }
      }
    }, delayMs);
  }

  /**
   * Leave the channel and clean up (following official documentation)
   */
  async leave(): Promise<void> {
    this.manualLeave = true;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.client) {
      return;
    }

    try {
      // Close local tracks to release microphone and camera resources
      if (this.localAudioTrack) {
        this.localAudioTrack.close();
        this.localAudioTrack = null;
        console.log("Closed local audio track");
      }

      if (this.localVideoTrack) {
        this.localVideoTrack.close();
        this.localVideoTrack = null;
        console.log("Closed local video track");
      }

      // Leave the channel
      if (this.isJoined) {
        await this.client.leave();
        this.isJoined = false;
        console.log("Left channel successfully");
      }
    } catch (error) {
      console.error("Failed to leave channel:", error);
      throw error;
    }
  }

  /**
   * Get the Agora client instance
   */
  getClient(): IAgoraRTCClient | null {
    return this.client;
  }

  /**
   * Get local tracks
   */
  getLocalTracks() {
    return {
      audio: this.localAudioTrack,
      video: this.localVideoTrack,
    };
  }

  /**
   * Check if joined
   */
  isInChannel(): boolean {
    return this.isJoined;
  }

  /**
   * Check if currently reconnecting
   */
  isCurrentlyReconnecting(): boolean {
    return this.isReconnecting;
  }

  /**
   * Get current reconnection attempts count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Export singleton instance
export const agoraService = new AgoraService();

// Export Agora App ID
export const AGORA_CONFIG = {
  appId: AGORA_APP_ID,
};
