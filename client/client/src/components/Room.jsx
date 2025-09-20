import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import VideoGrid from './VideoGrid';
import Chat from './Chat';
//import { api } from './api';

const SERVER = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
const STUN_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function Room({ token, user, onLogout }) {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [peers, setPeers] = useState({}); // socketId -> { pc, stream, userName }
  const localStreamRef = useRef(null);
  const pcsRef = useRef({}); // socketId -> RTCPeerConnection
  const localVideoRef = useRef(null);

  useEffect(() => {
    const s = io(SERVER, { transports: ['websocket'] });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      for (const id in pcsRef.current) {
        pcsRef.current[id]?.close();
      }
      pcsRef.current = {};
    };
  }, []);

  const startLocalStream = async () => {
    if (!localStreamRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    }
    return localStreamRef.current;
  };

  const join = async () => {
    if (!socket) return alert('Socket not ready');
    if (!roomId) return alert('Enter room id');

    const stream = await startLocalStream();
    pcsRef.current = pcsRef.current || {};
    setInRoom(true);

    socket.emit('join-room', { roomId, userId: user.id, userName: user.name });

    socket.on('all-participants', async (participants) => {
      // create offers to each existing participant
      for (const p of participants) {
        await createPeerConnectionAndOffer(p.socketId, p.userName, stream, socket, roomId);
      }
    });

    socket.on('new-participant', async ({ socketId, userName }) => {
      // someone new joined — we will wait for their offer (they will create offer)
      console.log('new participant', socketId, userName);
    });

    socket.on('signal', async ({ from, data }) => {
      // data: { type: 'offer'|'answer'|'ice', sdp?, candidate? }
      await handleSignal(from, data);
    });

    socket.on('participant-left', ({ socketId }) => {
      removePeer(socketId);
    });
  };

  async function createPeerConnectionAndOffer(remoteSocketId, remoteName, localStream, socket, roomId) {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcsRef.current[remoteSocketId] = pc;

    // add local tracks
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    // collect remote stream
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      setPeers(prev => ({ ...prev, [remoteSocketId]: { stream: remoteStream, userName: remoteName } }));
    };

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { toSocketId: remoteSocketId, data: { type: 'ice', candidate: e.candidate } });
      }
    };

    // create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', { toSocketId: remoteSocketId, data: { type: 'offer', sdp: pc.localDescription } });
  }

  async function handleSignal(fromSocketId, data) {
    // if offer -> create pc, set remote desc, create answer
    if (data.type === 'offer') {
      // create PC and answer
      if (!pcsRef.current[fromSocketId]) {
        const pc = new RTCPeerConnection(STUN_SERVERS);
        pcsRef.current[fromSocketId] = pc;

        // add local tracks
        const localStream = await startLocalStream();
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

        const remoteStream = new MediaStream();
        pc.ontrack = (event) => {
          event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
          setPeers(prev => ({ ...prev, [fromSocketId]: { stream: remoteStream, userName: 'Participant' } }));
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('signal', { toSocketId: fromSocketId, data: { type: 'ice', candidate: e.candidate } });
          }
        };
      }

      const pc = pcsRef.current[fromSocketId];
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', { toSocketId: fromSocketId, data: { type: 'answer', sdp: pc.localDescription } });
      return;
    }

    if (data.type === 'answer') {
      const pc = pcsRef.current[fromSocketId];
      if (!pc) return console.warn('No pc for answer from', fromSocketId);
      await pc.setRemoteDescription(data.sdp);
      return;
    }

    if (data.type === 'ice') {
      const pc = pcsRef.current[fromSocketId];
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (e) {
          console.error('ICE add err', e);
        }
      }
      return;
    }
  }

  function removePeer(socketId) {
    const pc = pcsRef.current[socketId];
    if (pc) {
      pc.close();
      delete pcsRef.current[socketId];
    }
    setPeers(prev => {
      const copy = { ...prev };
      delete copy[socketId];
      return copy;
    });
  }

  const leave = () => {
    // close pcs and streams, tell server
    for (const id in pcsRef.current) {
      pcsRef.current[id]?.close();
    }
    pcsRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (socket) socket.disconnect();
    setInRoom(false);
    onLogout(); // for simple demo we logout to reset state; in practice you'd just leave room
  };

  return (
    <div className="room">
      <div className="room-header">
        <div>
          <strong>Signed in:</strong> {user.name} &nbsp;
          <button onClick={() => { localStreamRef.current?.getAudioTracks().forEach(t=>t.enabled = !t.enabled); }}>Toggle Mic</button>
          <button onClick={() => { localStreamRef.current?.getVideoTracks().forEach(t=>t.enabled = !t.enabled); }}>Toggle Video</button>
        </div>
        <div>
          <input placeholder="Room ID" value={roomId} onChange={e=>setRoomId(e.target.value)} />
          <button onClick={join}>Join</button>
          <button onClick={leave}>Leave / Logout</button>
        </div>
      </div>

      <div className="main">
        <div className="video-area">
          <div className="local-video">
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '240px' }} />
            <div className="label">You ({user.name})</div>
          </div>
          <VideoGrid peers={peers} />
        </div>

        <div className="chat-area">
          <Chat server={SERVER} token={token} roomId={roomId} user={user} socket={socket} />
        </div>
      </div>
    </div>
  );
}
