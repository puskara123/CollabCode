import React, { useEffect, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import Editor from "@monaco-editor/react";

function App() {
  const [stompClient, setStompClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [code, setCode] = useState("// Start typing...");

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");

    const client = new Client({
      webSocketFactory: () => socket,
      debug: (str) => console.log(str),

      onConnect: () => {
        console.log("Connected to WebSocket");
        setConnected(true);

        client.subscribe("/topic/messages", (msg) => {
          const body = JSON.parse(msg.body);
          setCode(body.content); // 🔥 sync editor
        });
      },
    });

    client.activate();
    setStompClient(client);

    return () => client.deactivate();
  }, []);

  const handleChange = (value) => {
    setCode(value);

    if (connected && stompClient) {
      stompClient.publish({
        destination: "/app/send",
        body: JSON.stringify({ content: value }),
      });
    }
  };

  return (
    <div style={{ height: "100vh" }}>
      <h3 style={{ padding: "10px" }}>
        Collaborative Code Editor {connected ? "🟢" : "🔴"}
      </h3>

      <Editor
        height="90%"
        defaultLanguage="javascript"
        value={code}
        onChange={handleChange}
      />
    </div>
  );
}

export default App;