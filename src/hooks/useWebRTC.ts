import { useState, useRef, useCallback, useEffect } from 'react';

export const useWebRTC = (
  localVideoRef: React.RefObject<HTMLVideoElement>,
  remoteVideoRef: React.RefObject<HTMLVideoElement>
) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'searching' | 'connecting' | 'connected'
  >('idle');

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);
  const bitrateMonitorRef = useRef<number | null>(null);

  // 🔹 Initialize local media stream
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { max: 15 },
          },
          audio: true,
        });

        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    initializeMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 🔹 Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // 🔹 Monitor and adjust bitrate dynamically
  const monitorAndAdjust = useCallback((pc: RTCPeerConnection) => {
    if (bitrateMonitorRef.current) {
      clearInterval(bitrateMonitorRef.current);
    }

    const sender = pc.getSenders().find(s => s.track?.kind === "video");
if (!sender?.track) return;

    bitrateMonitorRef.current = window.setInterval(async () => {
      const stats = await pc.getStats(sender.track);
      stats.forEach(async (report) => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings || !params.encodings[0]) return;

          // 🔹 Adaptive logic
          if (report.packetsLost > 50 || report.framesPerSecond < 10) {
            // Bad connection → lower bitrate
            params.encodings[0].maxBitrate = 300_000; // 300 kbps
          } else {
            // Good connection → higher bitrate
            params.encodings[0].maxBitrate = 1_200_000; // 1.2 Mbps
          }

          try {
            await sender.setParameters(params);
            console.log("Adjusted bitrate:", params.encodings[0].maxBitrate);
          } catch (err) {
            console.error("Error setting parameters:", err);
          }
        }
      });
    }, 5000); // adjust every 5s
  }, []);

  // 🔹 Create PeerConnection
  const createPeerConnection = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Attach remote stream
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      setConnectionStatus('connected');
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && window.socketInstance) {
        window.socketInstance.emit('signal', {
          signal: { candidate: event.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (['disconnected', 'failed'].includes(pc.connectionState)) {
        setConnectionStatus('idle');
        setRemoteStream(null);
      }
    };

    // 🔹 Start monitoring bitrate once connection is established
    monitorAndAdjust(pc);

    peerConnection.current = pc;
    return pc;
  }, [localStream, monitorAndAdjust]);

  // 🔹 Start call
  const startCall = useCallback(
    async (isInitiator: boolean, signalHandler: (signal: any) => void) => {
      setConnectionStatus('connecting');
      const pc = createPeerConnection();

      window.signalHandler = async (data: any) => {
        if (data.signal.offer) {
          await pc.setRemoteDescription(data.signal.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalHandler({ answer });
          pendingCandidates.current.forEach((c) => pc.addIceCandidate(c));
          pendingCandidates.current = [];
        } else if (data.signal.answer) {
          await pc.setRemoteDescription(data.signal.answer);
          pendingCandidates.current.forEach((c) => pc.addIceCandidate(c));
          pendingCandidates.current = [];
        } else if (data.signal.candidate) {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(data.signal.candidate);
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          } else {
            pendingCandidates.current.push(data.signal.candidate);
          }
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalHandler({ offer });
      }
    },
    [createPeerConnection]
  );

  // 🔹 End call
  const endCall = useCallback(() => {
    if (bitrateMonitorRef.current) {
      clearInterval(bitrateMonitorRef.current);
      bitrateMonitorRef.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setRemoteStream(null);
    setConnectionStatus('idle');
    pendingCandidates.current = [];
  }, []);

  // 🔹 Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  // 🔹 Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }, [localStream]);

  return {
    localStream,
    remoteStream,
    connectionStatus,
    startCall,
    endCall,
    toggleVideo,
    toggleAudio,
  };
};
