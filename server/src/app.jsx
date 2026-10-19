
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

// The backend is running on port 3000.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin.replace(/:\d+$/, ":3000");

const INITIAL_POSITION = { x: 120, y: 120 };
const AVATAR_SIZE = 36;
const SPEED = 8;

export default function App() {
  const [avatars, setAvatars] = useState({});
  const [myId, setMyId] = useState("");
  const [connected, setConnected] = useState(false);
  const [officeSize, setOfficeSize] = useState({ width: 900, height: 520 });
  const officeRef = useRef(null);
  const socketRef = useRef(null);
  const positionRef = useRef(INITIAL_POSITION);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setMyId(socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("existing-avatars", (users) => {
      setAvatars((previous) => {
        const next = { ...previous };
        users.forEach((user) => {
          next[user.id] = user;
        });
        return next;
      });
    });

    socket.on("avatar-joined", (avatar) => {
      setAvatars((previous) => ({ ...previous, [avatar.id]: avatar }));
    });

    socket.on("avatar-moved", (avatar) => {
      setAvatars((previous) => ({ ...previous, [avatar.id]: avatar }));
    });

    socket.on("avatar-left", (id) => {
      setAvatars((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const measureOffice = () => {
      if (!officeRef.current) return;
      const rect = officeRef.current.getBoundingClientRect();
      setOfficeSize({ width: rect.width, height: rect.height });
    };

    measureOffice();
    window.addEventListener("resize", measureOffice);
    return () => window.removeEventListener("resize", measureOffice);
  }, []);

  useEffect(() => {
    if (!myId) return;

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const directions = {
        arrowup: [0, -SPEED],
        w: [0, -SPEED],
        arrowdown: [0, SPEED],
        s: [0, SPEED],
        arrowleft: [-SPEED, 0],
        a: [-SPEED, 0],
        arrowright: [SPEED, 0],
        d: [SPEED, 0],
      };

      if (!directions[key]) return;
      event.preventDefault();

      const [dx, dy] = directions[key];
      const maxX = Math.max(0, officeSize.width - AVATAR_SIZE);
      const maxY = Math.max(0, officeSize.height - AVATAR_SIZE);

      positionRef.current = {
        x: Math.max(0, Math.min(maxX, positionRef.current.x + dx)),
        y: Math.max(0, Math.min(maxY, positionRef.current.y + dy)),
      };

      socketRef.current?.emit("move-avatar", positionRef.current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [myId, officeSize]);

  const moveTo = (event) => {
    if (!myId || !officeRef.current) return;

    const rect = officeRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - AVATAR_SIZE, event.clientX - rect.left - AVATAR_SIZE / 2));
    const y = Math.max(0, Math.min(rect.height - AVATAR_SIZE, event.clientY - rect.top - AVATAR_SIZE / 2));

    positionRef.current = { x, y };
    socketRef.current?.emit("move-avatar", positionRef.current);
  };

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <h1>ProxiSpeak</h1>
            <p>Virtual workspace</p>
          </div>
        </div>
        <div className={`connection ${connected ? "online" : "offline"}`}>
          <span className="status-dot" />
          {connected ? "Connected" : "Connecting..."}
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">YOUR DIGITAL OFFICE</p>
          <h2>Work together, wherever you are.</h2>
          <p className="subtitle">
            Move your avatar around the office and see other people in real time.
          </p>
        </div>
        <div className="people-count">
          <span className="people-icon">👥</span>
          <div>
            <strong>{Object.keys(avatars).length}</strong>
            <span> in office</span>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <h3>Team workspace</h3>
            <p>Use W A S D or the arrow keys to move.</p>
          </div>
          <span className="live-label">
            <span /> LIVE SPACE
          </span>
        </div>

        <div
          className="office"
          ref={officeRef}
          onClick={moveTo}
          role="application"
          aria-label="Virtual office. Click to move your avatar."
        >
          <div className="room room-one">
            <span className="room-label">COLLABORATION ZONE</span>
            <div className="meeting-table">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="room room-two">
            <span className="room-label">FOCUS AREA</span>
            <div className="desk"><span>DESK</span></div>
            <div className="desk desk-two"><span>DESK</span></div>
          </div>

          <div className="room room-three">
            <span className="room-label">LOUNGE</span>
            <div className="sofa" />
            <div className="plant">🌿</div>
          </div>

          {Object.values(avatars).map((avatar, index) => (
            <div
              key={avatar.id}
              className={`avatar ${avatar.id === myId ? "my-avatar" : ""}`}
              style={{
                left: `${Math.min(avatar.x, officeSize.width - AVATAR_SIZE)}px`,
                top: `${Math.min(avatar.y, officeSize.height - AVATAR_SIZE)}px`,
              }}
              title={avatar.id === myId ? "You" : `Teammate ${index + 1}`}
            >
              <div className="avatar-face">
                {avatar.id === myId ? "🙂" : "👨🏻‍💻"}
              </div>
              <span className="avatar-name">
                {avatar.id === myId ? "You" : `Teammate ${index + 1}`}
              </span>
            </div>
          ))}
        </div>

        <footer className="office-footer">
          <span><i className="legend-dot yours" /> Your avatar</span>
          <span><i className="legend-dot others" /> Teammates</span>
          <span className="hint">Tip: open this page in two browser tabs to test multiplayer.</span>
        </footer>
      </section>
    </main>
  );
}
