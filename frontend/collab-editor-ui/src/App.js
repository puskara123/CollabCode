import React, { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import Editor from "@monaco-editor/react";

const clientId = Math.random().toString(36).substring(2, 8);
let counter = 0;

function App() {
  const [connected, setConnected] = useState(false);
  const [chars, setChars] = useState([]);

  const clientRef = useRef(null);
  const connectedRef = useRef(false);
  const editorRef = useRef(null);
  const ignoreChangeRef = useRef(false);
  const charsRef = useRef([]);

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");

    const stomp = new Client({
      webSocketFactory: () => socket,
      debug: () => {},

      onConnect: () => {
        setConnected(true);
        connectedRef.current = true;
        clientRef.current = stomp;

        stomp.subscribe("/topic/messages", (msg) => {
          const op = JSON.parse(msg.body);
          applyOperation(op);
        });
      },
    });

    stomp.activate();

    return () => stomp.deactivate();
  }, []);

  const applyOperation = (op) => {
    setChars((prev) => {
      let updated = [...prev];

      if (op.type === "INSERT") {
        if (op.value === null || op.value === undefined) return prev;
        updated.push(op);
      }

      if (op.type === "DELETE") {
        console.log("deleted: ", op.id, op.value);
        updated = updated.filter((c) => c.id !== op.id);
      }

      const newCode = updated.map((c) => c.value).join("");

      if (editorRef.current) {
        const editor = editorRef.current;
        const model = editor.getModel();
        const position = editor.getPosition();

        ignoreChangeRef.current = true;
        model.setValue(newCode);

        if (position) {
          editor.setPosition(position);
        }
      }
      console.log(updated);
      charsRef.current = updated;

      return updated;
    });
  };

  return (
    <div style={{ height: "100vh" }}>
      <h3>
        CRDT Editor ({clientId}) {connected ? "🟢" : "🔴"}
      </h3>

      <Editor
        height="90%"
        defaultLanguage="javascript"
        defaultValue=""
        onMount={(editor) => {
          console.log("EDITOR MOUNTED DIRECT");

          editorRef.current = editor;

          editor.onDidChangeModelContent((event) => {
            console.log("MONACO CHANGE EVENT", event);

            if (ignoreChangeRef.current) {
              ignoreChangeRef.current = false;
              return;
            }

            if (!connectedRef.current || !clientRef.current) return;

            event.changes.forEach((change) => {
              console.log("CHANGE:", change);

              if (typeof change.text === "string" && change.text.length > 0) {
                change.text.split("").forEach((ch) => {
                  const op = {
                    type: "INSERT",
                    id: `${clientId}-${counter++}`,
                    value: ch,
                    prevId: null,
                  };

                  console.log("SENDING INSERT", op);

                  clientRef.current.publish({
                    destination: "/app/send",
                    body: JSON.stringify(op),
                  });
                });
              }
              if (change.rangeLength > 0) {
                const index = change.rangeOffset;

                console.log(index, charsRef.current[index], charsRef.current.length);

                const target = charsRef.current[index];

                if (!target) return;

                const op = {
                  type: "DELETE",
                  id: target.id,
                };

                console.log("SENDING DELETE", op);

                clientRef.current.publish({
                  destination: "/app/send",
                  body: JSON.stringify(op),
                });
              }
            });
          });
        }}
      />
    </div>
  );
}

export default App;