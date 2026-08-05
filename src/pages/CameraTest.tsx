import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Camera, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function CameraTest() {
  const [status, setStatus] = useState<string>("Click button to test camera & microphone");
  const [errorDetails, setErrorDetails] = useState<{ name?: string; message?: string; stack?: string } | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const testMedia = async () => {
    setStatus("Requesting media permissions...");
    setErrorDetails(null);
    setStreamActive(false);

    console.log("=== CAMERA TEST DIAGNOSTIC PRE-FLIGHT ===");
    console.log("navigator.mediaDevices:", navigator.mediaDevices);
    console.log("getUserMedia exists:", typeof navigator.mediaDevices?.getUserMedia === "function");
    console.log("isSecureContext:", window.isSecureContext);
    console.log("visibilityState:", document.visibilityState);
    console.log("locationOrigin:", location.origin);

    try {
      console.log("Requesting media...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("Media granted", stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setStreamActive(true);
      setStatus("SUCCESS: Camera and microphone access granted!");
    } catch (error: any) {
      console.log("=== CAMERA TEST ERROR DIAGNOSTICS ===");
      console.log(error);
      console.log(error?.stack);
      console.dir(error);

      setErrorDetails({
        name: error?.name || "UnknownError",
        message: error?.message || String(error),
        stack: error?.stack || "No stack trace available",
      });

      setStatus(`FAILED: ${error?.name || "Error"} - ${error?.message || String(error)}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-xl border-border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Camera className="h-6 w-6 text-primary" /> Standalone Media Diagnostic Test
          </CardTitle>
          <CardDescription>
            Tests raw browser <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">navigator.mediaDevices.getUserMedia()</code> directly without any WebRTC or application wrappers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Button size="lg" onClick={testMedia} className="w-full gap-2 text-base font-semibold">
              <Camera className="h-5 w-5" /> Test Camera & Microphone Access
            </Button>
          </div>

          <div className={`p-4 rounded-lg border text-sm font-medium flex items-start gap-3 ${
            streamActive ? "bg-green-500/10 border-green-500/30 text-green-400" :
            errorDetails ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-muted border-border text-muted-foreground"
          }`}>
            {streamActive ? <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" /> :
             errorDetails ? <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" /> : null}
            <div>
              <p className="font-semibold">{status}</p>
            </div>
          </div>

          <div className="relative aspect-video w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
            {!streamActive && !errorDetails && (
              <p className="text-slate-500 text-sm">Video stream preview will appear here</p>
            )}
          </div>

          {errorDetails && (
            <div className="bg-slate-900 border border-red-900/50 rounded-lg p-4 font-mono text-xs space-y-2 overflow-x-auto text-red-300">
              <p className="font-bold text-red-400">Error Details:</p>
              <p><span className="text-slate-400">Name:</span> {errorDetails.name}</p>
              <p><span className="text-slate-400">Message:</span> {errorDetails.message}</p>
              <div>
                <span className="text-slate-400">Stack:</span>
                <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                  {errorDetails.stack}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
