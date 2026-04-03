import React, { useEffect, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

function App() {
  const [stompClient, setStompClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false); // ✅ track connection

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");

    const client = new Client({
      webSocketFactory: () => socket,
      debug: (str) => console.log(str),

      onConnect: () => {
        console.log("Connected to WebSocket");
        setConnected(true); // ✅ mark connected

        client.subscribe("/topic/messages", (msg) => {
          const body = JSON.parse(msg.body);
          setMessages((prev) => [...prev, body.content]);
        });
      },

      onStompError: (frame) => {
        console.error("Broker error:", frame.headers["message"]);
      },
    });

    client.activate();
    setStompClient(client);

    return () => {
      client.deactivate();
    };
  }, []);

  const sendMessage = () => {
    if (!connected) {
      console.log("Not connected yet!");
      return;
    }

    if (stompClient && input) {
      stompClient.publish({
        destination: "/app/send",
        body: JSON.stringify({ content: input }),
      });
      setInput("");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Collaborative Editor (Test)</h2>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type message..."
      />

      <button onClick={sendMessage} disabled={!connected}>
        Send
      </button>

      {!connected && <p>Connecting to server...</p>}

      <div style={{ marginTop: "20px" }}>
        <h4>Messages:</h4>
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>
    </div>
  );
}

export default App;