import { useRef, useState, useCallback, useEffect } from "react";

/**
 * useCamera — manages webcam access and periodic frame capture.
 *
 * @param {number} captureIntervalMs  How often to capture a frame (ms). Default 3000.
 * @returns {{ videoRef, isActive, error, startCamera, stopCamera, captureFrame }}
 */
export function useCamera(captureIntervalMs = 3000) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const startCamera = useCallback(async (onFrame) => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);

      if (onFrame) {
        intervalRef.current = setInterval(() => {
          const dataUrl = captureFrame();
          if (dataUrl) onFrame(dataUrl);
        }, captureIntervalMs);
      }
    } catch (err) {
      setError(err.message || "Camera access denied.");
      setIsActive(false);
    }
  }, [captureFrame, captureIntervalMs]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, isActive, error, startCamera, stopCamera, captureFrame };
}
