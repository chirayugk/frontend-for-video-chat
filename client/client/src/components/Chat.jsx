import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Chat({ server, token, roomId, user, socket }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!roomId) return;
    // fetch history
    (async () => {
      try {
        const res = await api.get(`/messages/${roomId}`);
        setMessages(res.data);
      } catch (e) { console.error(e); }
    })();
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('chat-message', (m) => {
      setMessages(prev => [...prev, m]);
    });
    return () => {
      socket.off('chat-message');
    };
  }, [socket]);

  const send = async () => {
    if (!text.trim()) return;
    const msg = {
      roomId,
      senderId: user.id,
      senderName: user.name,
      text,
      createdAt: new Date()
    };
    // persist
    try {
      await api.post('/messages', msg);
    } catch (e) {
      console.error('save message err', e);
    }
    // broadcast
    socket.emit('chat-message', msg);
    setText('');
  };

  return (
    <div className="chat">
      <h3>Room Chat</h3>
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={'message ' + (m.senderId === user.id ? 'me' : '')}>
            <strong>{m.senderName}</strong>: {m.text}
            <div className="time">{new Date(m.createdAt).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
      <div className="send">
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message" />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
