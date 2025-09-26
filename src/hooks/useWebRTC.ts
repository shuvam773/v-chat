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

  // Initialize local media stream
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

        // Attach to local video
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

  // Attach remote stream automatically
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

    // Add local stream tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      const videoSender = pc
        .getSenders()
        .find((s) => s.track?.kind === 'video');

      if (videoSender) {
        const params = videoSender.getParameters();
        if (!params.encodings) {
          params.encodings = [{}];
        }

        // Limit bitrate to ~300 kbps (adjust as needed)
        params.encodings[0].maxBitrate = 300_000;

        // Optionally allow downscaling
        params.encodings[0].scaleResolutionDownBy = 2;

        videoSender.setParameters(params).catch((err) => {
          console.error('Error setting video parameters:', err);
        });
      }
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      setConnectionStatus('connected');
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && window.socketInstance) {
        window.socketInstance.emit('signal', {
          signal: { candidate: event.candidate },
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed'
      ) {
        setConnectionStatus('idle');
        setRemoteStream(null);
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [localStream]);

  const startCall = useCallback(
    async (isInitiator: boolean, signalHandler: (signal: any) => void) => {
      setConnectionStatus('connecting');

      const pc = createPeerConnection();

      // Set up signal handler
      window.signalHandler = async (data: any) => {
        if (data.signal.offer) {
          await pc.setRemoteDescription(data.signal.offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalHandler({ answer });

          // Flush pending candidates
          pendingCandidates.current.forEach((c) => pc.addIceCandidate(c));
          pendingCandidates.current = [];
        } else if (data.signal.answer) {
          await pc.setRemoteDescription(data.signal.answer);

          // Flush pending candidates
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
        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalHandler({ offer });
      }
    },
    [createPeerConnection]
  );

  const endCall = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setRemoteStream(null);
    setConnectionStatus('idle');
    pendingCandidates.current = [];
  }, []);

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
