/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Foundarly In-Meeting Recording Engine
 * Enables seamless in-browser consultation recording via MediaRecorder API,
 * supporting screen + meeting audio capture, microphone mixing, and instant preview/download.
 */

export interface RecordingResult {
  blob: Blob;
  url: string;
  durationSeconds: number;
  formattedDuration: string;
  sizeBytes: number;
  formattedSize: string;
  filename: string;
  mimeType: string;
}

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export class MeetingRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private totalPausedDuration: number = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private status: RecordingStatus = 'idle';

  public onStatusChange?: (status: RecordingStatus) => void;
  public onTimeUpdate?: (seconds: number, formatted: string) => void;
  public onRecordingComplete?: (result: RecordingResult) => void;
  public onError?: (error: Error) => void;

  /**
   * Determine the optimal supported MIME type for the user's browser
   */
  public static getSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return 'video/webm';
    
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4'
    ];

    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    return 'video/webm';
  }

  /**
   * Format seconds into MM:SS or HH:MM:SS
   */
  public static formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (n: number) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Format bytes into readable string (e.g., 14.5 MB)
   */
  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Start recording the meeting
   * Can accept an existing composite stream or trigger browser displayMedia capture
   */
  public async startRecording(options?: {
    stream?: MediaStream;
    localMicStream?: MediaStream | null;
    sessionTitle?: string;
  }): Promise<void> {
    if (this.status === 'recording') return;

    try {
      let captureStream: MediaStream;

      if (options?.stream) {
        captureStream = options.stream;
      } else {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen recording is not supported in this browser or context.');
        }

        // Prompt user to select screen/window/tab with audio
        captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'browser',
          } as MediaTrackConstraints,
          audio: true
        });
      }

      // If user provided a microphone stream, mix both audio tracks using AudioContext
      let finalStream = captureStream;
      if (options?.localMicStream && typeof AudioContext !== 'undefined') {
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          this.audioContext = new AudioContextClass();
          const destination = this.audioContext.createMediaStreamDestination();

          // Add capture stream audio if present
          if (captureStream.getAudioTracks().length > 0) {
            const captureSource = this.audioContext.createMediaStreamSource(captureStream);
            captureSource.connect(destination);
          }

          // Add local mic audio
          if (options.localMicStream.getAudioTracks().length > 0) {
            const micSource = this.audioContext.createMediaStreamSource(options.localMicStream);
            micSource.connect(destination);
          }

          // Combine screen video with mixed audio
          const mixedAudioTracks = destination.stream.getAudioTracks();
          const videoTracks = captureStream.getVideoTracks();
          finalStream = new MediaStream([...videoTracks, ...mixedAudioTracks]);
        } catch (audioErr) {
          console.warn('[MeetingRecorder] Audio mixing notice, proceeding with default stream:', audioErr);
          finalStream = captureStream;
        }
      }

      this.recordingStream = finalStream;
      this.recordedChunks = [];
      const mimeType = MeetingRecorder.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps crisp 1080p/720p quality
      });

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStopped(options?.sessionTitle);
      };

      // If user stops sharing via browser native UI banner
      const videoTrack = finalStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (this.status === 'recording' || this.status === 'paused') {
            this.stopRecording();
          }
        };
      }

      // Start recording with 1-second timeslices for robust streaming
      this.mediaRecorder.start(1000);
      this.startTime = Date.now();
      this.totalPausedDuration = 0;
      this.status = 'recording';
      this.onStatusChange?.('recording');

      // Setup duration update interval
      this.timerInterval = setInterval(() => {
        if (this.status === 'recording') {
          const elapsedMs = Date.now() - this.startTime - this.totalPausedDuration;
          const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
          this.onTimeUpdate?.(seconds, MeetingRecorder.formatDuration(seconds));
        }
      }, 1000);

    } catch (err: unknown) {
      console.error('[MeetingRecorder] Start error:', err);
      this.cleanup();
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Pause the active recording
   */
  public pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseTime = Date.now();
      this.status = 'paused';
      this.onStatusChange?.('paused');
    }
  }

  /**
   * Resume paused recording
   */
  public resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      if (this.pauseTime > 0) {
        this.totalPausedDuration += Date.now() - this.pauseTime;
        this.pauseTime = 0;
      }
      this.status = 'recording';
      this.onStatusChange?.('recording');
    }
  }

  /**
   * Stop recording
   */
  public stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.status = 'stopped';
      this.onStatusChange?.('stopped');
    }
  }

  private handleRecordingStopped(sessionTitle?: string): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
    const blob = new Blob(this.recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const elapsedMs = Math.max(1000, Date.now() - this.startTime - this.totalPausedDuration);
    const durationSeconds = Math.max(1, Math.floor(elapsedMs / 1000));
    const formattedDuration = MeetingRecorder.formatDuration(durationSeconds);

    const dateStr = new Date().toISOString().split('T')[0];
    const safeTitle = (sessionTitle || 'Foundarly-Session').replace(/[^a-zA-Z0-9_-]/g, '-');
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const filename = `${safeTitle}-${dateStr}.${extension}`;

    const result: RecordingResult = {
      blob,
      url,
      durationSeconds,
      formattedDuration,
      sizeBytes: blob.size,
      formattedSize: MeetingRecorder.formatBytes(blob.size),
      filename,
      mimeType,
    };

    // Stop and cleanup tracks
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.status = 'idle';
    this.onStatusChange?.('idle');
    this.onRecordingComplete?.(result);
  }

  public getStatus(): RecordingStatus {
    return this.status;
  }

  public cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch { /* ignore */ }
    }
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.status = 'idle';
  }
}
