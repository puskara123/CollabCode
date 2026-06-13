import React, { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import Editor from "@monaco-editor/react";

const clientId = crypto.randomUUID();
let counter = 0;

function randomBetween(min, max) {
  return (
    Math.floor(
      Math.random() * (max - min + 1)
    ) + min
  );
}

function comparePositions(a, b) {
  const minLength = Math.min(a.length, b.length);

  for (let i = 0; i < minLength; i++) {
    if (a[i].digit !== b[i].digit) {
      return a[i].digit - b[i].digit;
    }

    if (a[i].clientId !== b[i].clientId) {
      return a[i].clientId.localeCompare(
        b[i].clientId
      );
    }
  }

  return a.length - b.length;
}

function binarySearchInsert(arr, newChar) {
  let l = 0;
  let r = arr.length;

  while (l < r) {
    const mid = l + ((r - l) >> 1);

    if (
      comparePositions(
        arr[mid].position,
        newChar.position
      ) < 0
    ) {
      l = mid + 1;
    } else {
      r = mid;
    }
  }

  return l;
}

function generatePosition(
  leftPos,
  rightPos,
  clientId,
  depth = 0
) {
  const BASE = 1024 * (depth < 6 ? (1 << depth) : 64);

  const leftDigit =
    depth < leftPos.length
      ? leftPos[depth].digit
      : 0;

  const rightDigit =
    rightPos && depth < rightPos.length
      ? rightPos[depth].digit
      : BASE;

  if (rightDigit - leftDigit > 1) {
    const digit = randomBetween(leftDigit + 1, rightDigit - 1);

    return [
      ...leftPos.slice(0, depth),
      {
        digit,
        clientId,
      },
    ];
  }

  const prefix =
    depth < leftPos.length
      ? leftPos.slice(0, depth + 1)
      : [
          ...leftPos,
          {
            digit: leftDigit,
            clientId,
          },
        ];

  return [
    ...prefix,
    ...generatePosition(
      leftPos,
      rightPos,
      clientId,
      depth + 1
    ).slice(prefix.length)
  ];
}

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

          if(op.clientId === clientId) return;

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
        if (op.value === null || op.value === undefined) {
          return prev;
        }

        const newChar = {
          ...op,
          deleted: false,
        };

        const idx = binarySearchInsert(updated, newChar);

        updated.splice(idx, 0, newChar);

        /*updated.push({
          ...op,
          deleted: false,
        });

        updated.sort((a, b) =>
          comparePositions(a.position, b.position)
        );*/
      }

      if (op.type === "DELETE") {
        // TEMPORARY:
        // Full tombstones come later.
        // For now just mark deleted.
        updated = updated.map((c) => {
          if (c.id === op.id) {
            return {
              ...c,
              deleted: true,
            };
          }

          return c;
        });
      }

      // TEMPORARY:
      // Rendering only visible chars.
      const newCode = updated
        .filter((c) => !c.deleted)
        .map((c) => c.value)
        .join("");

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
          console.log("EDITOR MOUNTED");

          editorRef.current = editor;

          editor.onDidChangeModelContent((event) => {
            console.log("MONACO CHANGE EVENT", event);

            if (ignoreChangeRef.current) {
              ignoreChangeRef.current = false;
              return;
            }

            if (!connectedRef.current || !clientRef.current) {
              return;
            }

            event.changes.forEach((change) => {
              console.log("CHANGE:", change);

              // INSERT
              if (
                typeof change.text === "string" &&
                change.text.length > 0
              ) {
                const model = editorRef.current.getModel();
                const position = editorRef.current.getPosition();

                let cursorIndex = model.getOffsetAt(position);

                const visibleChars = charsRef.current.filter(
                  (c) => !c.deleted
                );

                let currentLeftPos = 0;

                change.text.split("").forEach((ch, i) => {
                  const currentIndex =
                    cursorIndex - change.text.length + i;

                  const leftPos =
                    currentIndex > 0 &&
                    visibleChars[currentIndex - 1]
                      ? visibleChars[currentIndex - 1].position
                      : [];
                  
                  currentLeftPos = i === 0 ? leftPos : currentLeftPos;

                  const rightPos =
                    currentIndex < visibleChars.length &&
                    visibleChars[currentIndex]
                      ? visibleChars[currentIndex].position
                      : null;

                  const newPosition = generatePosition(
                    currentLeftPos,
                    rightPos,
                    clientId
                  );  
                  console.log(leftPos, rightPos);              
                  const op = {
                    clientId: clientId,
                    type: "INSERT",
                    id: `${clientId}-${counter++}`,
                    value: ch,
                    position: newPosition,

                    deleted: false,
                  };

                  currentLeftPos = newPosition;

                  console.log("SENDING INSERT", op);
                  console.log("GENERATED POSITION", newPosition);

                  applyOperation(op);

                  clientRef.current.publish({
                    destination: "/app/send",
                    body: JSON.stringify(op),
                  });
                });
              }

              // DELETE
              if (change.rangeLength > 0) {
                const index = change.rangeOffset;
                const end = index + change.rangeLength;

                // Only visible chars
                const visibleChars = charsRef.current.filter(
                  (c) => !c.deleted
                );
                
                for(let i = index; i < end; i ++){
                  const target = visibleChars[i];
                  if (!target) continue;

                  const op = {
                    clientId: clientId,
                    type: "DELETE",
                    id: target.id,
                  };

                  console.log("SENDING DELETE", op);

                  applyOperation(op);

                  clientRef.current.publish({
                    destination: "/app/send",
                    body: JSON.stringify(op),
                  });
                }
              }
            });
          });
        }}
      />
    </div>
  );
}

export default App;