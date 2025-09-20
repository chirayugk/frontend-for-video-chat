import React from 'react';

export default function VideoGrid({ peers }) {
  // peers: socketId -> { stream, userName }
  return (
    <div className="video-grid">
      {Object.entries(peers).map(([id, p]) => (
        <div key={id} className="remote-video">
          <VideoPlayer stream={p.stream} />
          <div className="label">{p.userName || 'Participant'}</div>
        </div>
      ))}
    </div>
  );
}

function VideoPlayer({ stream }) {
  const ref = React.useRef();
  React.useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline style={{ width: '240px' }} />;
}
