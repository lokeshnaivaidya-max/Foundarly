import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";
import { generateMeetingToken, canGenerateTokens } from "./agoraToken";

// Agora configuration
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;

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

  constructor() {
    // Initialize Agora client following official documentation
    this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    this.setupEventListeners();
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
      } catch (error) {
        console.error(`Failed to subscribe to user ${user.uid}:`, error);
      }
    });

    // Handle user-unpublished event
    this.client.on("user-unpublished", (user, mediaType) => {
      console.log(`User ${user.uid} unpublished ${mediaType}`);
      // The Meeting component will handle UI updates
    });

    // Handle user-left event
    this.client.on("user-left", (user) => {
      console.log(`User ${user.uid} left the channel`);
      // The Meeting component will handle UI updates
    });

    // Handle connection state changes
    this.client.on("connection-state-change", (curState, revState) => {
      console.log(`Connection state changed from ${revState} to ${curState}`);
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
      throw new Error("Agora client not initialized");
    }

    if (this.isJoined) {
      console.warn("Already joined a channel");
      return;
    }

    try {
      console.log("Joining Agora channel:", config.channel);
      
      // Prepare token (following official documentation)
      let token = config.token || null;
      
      if (!token && canGenerateTokens()) {
        try {
          console.log("Attempting to generate Agora token...");
          const uid = config.uid || Math.floor(Math.random() * 1000000);
          token = generateMeetingToken(config.channel, uid);
          console.log("Token generated successfully");
        } catch (tokenError) {
          console.warn("Token generation failed:", tokenError.message);
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
      // Create microphone audio track
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      console.log("Created local audio track");

      // Create camera video track
      this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
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
   * Leave the channel and clean up (following official documentation)
   */
  async leave(): Promise<void> {
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
}

// Export singleton instance
export const agoraService = new AgoraService();

// Export Agora App ID
export const AGORA_CONFIG = {
  appId: AGORA_APP_ID,
};
