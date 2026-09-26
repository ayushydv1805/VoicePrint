import { useCallback, useEffect, useRef, useState } from "react";

const WINDOW_MS = 3000;
const REFRACTORY_MS = 350;

export function useClapDetector(onTrigger) {
  const [listening, setListening] = useState(false);
  const [clapCount, setClapCount] = useState(0);
  const [micError, setMicError] = useState("");
  const [lastClapAt, setLastClapAt] = useState(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const clapsRef = useRef([]);
  const lastDetectedRef = useRef(0);
  const previousAboveRef = useRef(false);
  const startingRef = useRef(false);
  const baselineRef = useRef(0.025);
  const onTriggerRef = useRef(onTrigger);

  useEffect(() => { onTriggerRef.current = onTrigger; }, [onTrigger]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    clapsRef.current = [];
    startingRef.current = false;
    setClapCount(0);
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current || startingRef.current) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone access is not supported in this browser.");
      return false;
    }

    try {
      startingRef.current = true;
      setMicError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        setMicError("Web Audio is not supported in this browser.");
        startingRef.current = false;
        return false;
      }

      const context = new AudioContextClass();
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.08;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = context;
      analyserRef.current = analyser;
      baselineRef.current = 0.025;
      previousAboveRef.current = false;
      clapsRef.current = [];
      setClapCount(0);
      setListening(true);
      startingRef.current = false;

      const timeData = new Float32Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      const detect = () => {
        if (!analyserRef.current) return;
        analyser.getFloatTimeDomainData(timeData);
        analyser.getByteFrequencyData(frequencyData);

        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i += 1) sumSquares += timeData[i] * timeData[i];
        const rms = Math.sqrt(sumSquares / timeData.length);

        const nyquist = context.sampleRate / 2;
        let totalEnergy = 0;
        let highEnergy = 0;
        for (let i = 1; i < frequencyData.length; i += 1) {
          const frequency = (i / frequencyData.length) * nyquist;
          const value = frequencyData[i] / 255;
          totalEnergy += value;
          if (frequency >= 1800 && frequency <= 9000) highEnergy += value;
        }

        const highFrequencyRatio = totalEnergy ? highEnergy / totalEnergy : 0;
        if (rms < baselineRef.current * 2.5) {
          baselineRef.current = baselineRef.current * 0.985 + rms * 0.015;
        }

        const dynamicThreshold = Math.max(0.075, baselineRef.current * 3.8);
        const isAbove = rms > dynamicThreshold && highFrequencyRatio > 0.14;
        const now = performance.now();

        if (isAbove && !previousAboveRef.current && now - lastDetectedRef.current > REFRACTORY_MS) {
          lastDetectedRef.current = now;
          setLastClapAt(Date.now());
          clapsRef.current = [...clapsRef.current, now].filter((time) => now - time <= WINDOW_MS);
          setClapCount(clapsRef.current.length);

          if (clapsRef.current.length >= 3) {
            clapsRef.current = [];
            setClapCount(0);
            onTriggerRef.current?.({ type: "three-clap", detectedAt: Date.now() });
          }
        }

        previousAboveRef.current = isAbove;
        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
      return true;
    } catch (error) {
      const message = error?.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access and try again."
        : error?.message || "Unable to start microphone detection.";
      setMicError(message);
      startingRef.current = false;
      stop();
      return false;
    }
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { listening, clapCount, lastClapAt, micError, start, stop };
}

export function useDeviceLocation() {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported by this browser.");
      return;
    }
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      }),
      (error) => setLocationError(
        error.code === 1 ? "Location permission was denied." : "Unable to read your current location."
      ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    setLocationError("");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setWatching(true);
      },
      (error) => {
        setWatching(false);
        setLocationError(
          error.code === 1 ? "Location permission was denied." : "Unable to read your current location."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    requestLocation();
  }, [requestLocation]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }, []);

  useEffect(() => stopWatching, [stopWatching]);
  return { location, locationError, watching, requestLocation, startWatching, stopWatching };
}
