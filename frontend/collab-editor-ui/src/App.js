import React, { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import Editor from "@monaco-editor/react";

import "./App.css";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

import { useAuth } from "./context/AuthContext";

import {
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";

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

function debugState(label, chars) {

  console.log(
    label,

    chars
      .filter(c => !c.deleted)
      .map(c => c.value)
      .join("")
  );

  console.table(

    chars
      .filter(c => !c.deleted)
      .map((c,i) => ({

        i,

        value:c.value,

        position:JSON.stringify(
          c.position
        )

      }))

  );

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
          leftPos[depth] ?? {
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

function EditorPage() {

  const { documentId } = useParams();

  const { jwt } = useAuth();

  const [connected, setConnected] = useState(false);
  const [editorReadOnly, setEditorReadOnly] = useState(true);

  const clientRef = useRef(null);
  const connectedRef = useRef(false);
  const editorRef = useRef(null);
  const ignoreChangeRef = useRef(false);
  const charsRef = useRef([]);
  const editorReadyRef = useRef(false);
  const initializedRef = useRef(false);
  const remoteCursorsRef = useRef(new Map());
  const lastCursorPublishRef = useRef(0);
  const remoteDecorationsRef = useRef(new Map());

  const waitForEditor = async () => {

    while (!editorReadyRef.current) {

      await new Promise(
        resolve => setTimeout(resolve, 10)
      );

    }

  };  

  useEffect(() => {
    const bootstrapDocument =
      async () => {

        const response =
          await fetch(
            `http://localhost:8080/document/${documentId}/bootstrap`, 
            {
              headers: {
                Authorization: `Bearer ${jwt}`
              }
            }
          );
        
        if (!response.ok) {
          throw new Error(
            `Bootstrap failed (${response.status})`
          );
        }

        const operations =
          await response.json();

        operations.forEach((op) => {
          applyOperation(op, false);
        });

        if (editorRef.current) {
          const newCode = charsRef.current
            .filter((c) => !c.deleted)
            .map((c) => c.value)
            .join("");

          const model = editorRef.current.getModel();

          if(newCode.length > 0){
            ignoreChangeRef.current = true;

            model.pushEditOperations(
              [],
              [{ range: model.getFullModelRange(), text: newCode }],
              () => null
            );

            ignoreChangeRef.current = false;
          }
          else{
            ignoreChangeRef.current = false;
          }
        }
      
    };    
    const socket = new SockJS("http://localhost:8080/ws");

    const stomp = new Client({
      webSocketFactory: () => socket,

      connectHeaders: {

        Authorization: `Bearer ${jwt}`

      },

      debug: () => {},

      onConnect: async () => {

        setConnected(true);

        connectedRef.current = true;

        clientRef.current = stomp;

        await waitForEditor();

        const pendingBuffer = [];
        let bootstrapDone = false;

        stomp.subscribe(
          `/topic/document/${documentId}`,

          (msg) => {

            const op =
              JSON.parse(msg.body);

            if (
              op.clientId === clientId
            ) return;

            if (op.type === "CURSOR") {

              const model = editorRef.current?.getModel();

              if (!model) {
                  return;
              }

              const offset = model.getOffsetAt({

                  lineNumber: op.line,

                  column: op.column

              });

              remoteCursorsRef.current.set(

                  op.clientId,

                  offset

              );

              /*console.log(
                "REMOTE CURSOR",
                op.clientId,
                offset
              );*/

              renderRemoteCursors();

              return;
            }

            if (op.type === "LEAVE") {

              remoteCursorsRef.current.delete(op.clientId);
              //console.log("REMOTE LEFT", op.clientId);

              renderRemoteCursors();

              return;
            }

            if (!bootstrapDone) {
              pendingBuffer.push(op);
            } else {
              /*console.log(

                "REMOTE RECEIVED",

                op.value,

                op.position

              ); */             
              applyOperation(
                op,
                true
              );
            }

          }
        );

        await bootstrapDocument();

        bootstrapDone = true;

          pendingBuffer.forEach((op) => {
          applyOperation(op, false);
        });

        if (pendingBuffer.length > 0 && editorRef.current) {
          const newCode = charsRef.current
            .filter((c) => !c.deleted)
            .map((c) => c.value)
            .join("");

          const model = editorRef.current.getModel();

          if(newCode.length > 0){
            ignoreChangeRef.current = true;

            model.pushEditOperations(
              [],
              [{ range: model.getFullModelRange(), text: newCode }],
              () => null
            );

            ignoreChangeRef.current = false;
          }
          else{
            ignoreChangeRef.current = false;
          }
        }

        initializedRef.current = true;

        setEditorReadOnly(false);

      }     ,
    });

    stomp.activate();

    return () => stomp.deactivate();
  }, []);

  const CURSOR_COLORS = [
    "#ff4d4f", // Red
    "#52c41a", // Green
    "#1890ff", // Blue
    "#fa8c16", // Orange
    "#722ed1", // Purple
    "#13c2c2", // Cyan
    "#eb2f96", // Pink
    "#fadb14", // Yellow
  ];

  const getCursorColor = (clientId) => {

    let hash = 0;

    for (let i = 0; i < clientId.length; i++) {
      hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
    }

    return CURSOR_COLORS[
      hash % CURSOR_COLORS.length
    ];

  };

  const renderRemoteCursors = () => {

    if (!editorRef.current) {
      return;
    }

    const editor = editorRef.current;
    const model = editor.getModel();

    if (!model) {
      return;
    }

    const oldDecorationIds = [
      ...remoteDecorationsRef.current.values()
    ];

    const decorations = [];

    remoteCursorsRef.current.forEach((offset, clientId) => {

      const colorIndex = CURSOR_COLORS.indexOf(getCursorColor(clientId));

      const position =
        model.getPositionAt(offset);

      decorations.push({

        range: new window.monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),

        options: {

          beforeContentClassName: `remote-cursor remote-cursor-${colorIndex}`,

          stickiness:
            window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges

        }

      });

    });

    //console.log("DECORATIONS", decorations);

    const newDecorationIds =
      editor.deltaDecorations(
        oldDecorationIds,
        decorations
      );
    
    //console.log("Decoration IDs:", newDecorationIds);

    remoteDecorationsRef.current.clear();

    let i = 0;

    remoteCursorsRef.current.forEach((_, clientId) => {

      remoteDecorationsRef.current.set(
        clientId,
        newDecorationIds[i++]
      );

    });

  };

  const applyOperation = (op, updateEditor = true) => {
    
    let updated = [...charsRef.current];

    if (op.type === "INSERT") {
      if (op.value === null || op.value === undefined) {
        return;
      }

      const newChar = {
        ...op,
        deleted: false,
      };

      const idx = binarySearchInsert(updated, newChar);

      updated.splice(idx, 0, newChar);
    }

    if (op.type === "DELETE") {
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

    charsRef.current = updated;

    let opMonacoOffset = null;

    if (op.type === "INSERT") {

      const insertedIdx = updated.findIndex((c) => c.id === op.id);

      if (insertedIdx !== -1) {

        opMonacoOffset = updated
          .slice(0, insertedIdx)
          .filter((c) => !c.deleted)
          .length;

      }

    } else if (op.type === "DELETE") {

      const deletedIdx = updated.findIndex((c) => c.id === op.id);

      if (deletedIdx !== -1) {

        opMonacoOffset = updated
          .slice(0, deletedIdx)
          .filter((c) => !c.deleted)
          .length;

      }

    }

    if (opMonacoOffset !== null) {

      remoteCursorsRef.current.forEach(

        (cursorOffset, remoteClientId) => {

          let newOffset = cursorOffset;

          if (

            op.type === "INSERT" &&

            cursorOffset >= opMonacoOffset

          ) {

            newOffset++;

          }

          if (

            op.type === "DELETE" &&

            cursorOffset > opMonacoOffset

          ) {

            newOffset--;

          }

          remoteCursorsRef.current.set(

            remoteClientId,

            newOffset

          );

          /*console.log(
            "REMOTE MAP",
            [...remoteCursorsRef.current.entries()]
        );*/

        }

      );

    }

    if (opMonacoOffset !== null) {
      renderRemoteCursors();
    }

    const newCode = updated
      .filter((c) => !c.deleted)
      .map((c) => c.value)
      .join("");

    if (updateEditor && editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();

      const oldPosition = editor.getPosition();
      const oldCursorOffset = oldPosition
        ? model.getOffsetAt(oldPosition)
        : 0;
      
      let newCursorOffset = oldCursorOffset;
      if (opMonacoOffset !== null) {
        if (op.type === "INSERT" && opMonacoOffset <= oldCursorOffset) {
          newCursorOffset = oldCursorOffset + 1;
        } else if (op.type === "DELETE" && opMonacoOffset < oldCursorOffset) {
          newCursorOffset = oldCursorOffset - 1;
        }
      }

      ignoreChangeRef.current = true;

      model.pushEditOperations(
        [],
        [{ range: model.getFullModelRange(), text: newCode }],
        () => null
      );

      const newPosition = model.getPositionAt(newCursorOffset);
      editor.setPosition(newPosition);
    }    
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
        options={{
          readOnly: editorReadOnly,
        }}
        onMount={(editor) => {
          editorRef.current = editor;

          editorReadyRef.current = true;

          editor.onDidChangeCursorPosition((event) => {

            if (!initializedRef.current) {
              return;
            }

            if (!connectedRef.current || !clientRef.current) {
              return;
            }

            const now = Date.now();

            if (now - lastCursorPublishRef.current < 50) {
              return;
            }

            lastCursorPublishRef.current = now;

            clientRef.current.publish({

              destination: "/app/cursor",

              body: JSON.stringify({

                documentId: documentId,

                clientId: clientId,

                type: "CURSOR",

                line: event.position.lineNumber,

                column: event.position.column

              })

            });

            /*console.log(
              "CURSOR SENT",
              event.position.lineNumber,
              event.position.column
            );*/

          });         


          editor.onDidChangeModelContent((event) => {
            if (!initializedRef.current) {
              return;
            }

            if (ignoreChangeRef.current) {
              ignoreChangeRef.current = false;  
              return;
            }

            if (!connectedRef.current || !clientRef.current) {
              return;
            }

            event.changes.forEach((change) => {

              if (change.rangeLength > 0) {

                const index = change.rangeOffset;

                const end =
                  index + change.rangeLength;

                const visibleChars =
                  charsRef.current.filter(
                    (c) => !c.deleted
                  );

                const targets =
                  visibleChars.slice(
                    index,
                    end
                  );

                targets.forEach((target) => {

                  if (!target) return;

                  const op = {

                    documentId: documentId,

                    clientId: clientId,
                  
                    type: "DELETE",
                  
                    id: target.id,
                  
                  };
                
                  applyOperation(
                    op,
                    false
                  );

                  clientRef.current.publish({

                    destination: "/app/send",

                    body: JSON.stringify(op),

                  });

                });
              }


              // INSERT
              if (
                typeof change.text === "string" &&
                change.text.length > 0
              ) {
                const insertIndex = change.rangeOffset;

                const baseSnapshot = charsRef.current.filter((c) => !c.deleted);
                let currentLeftPos =
                  insertIndex > 0 && baseSnapshot[insertIndex - 1]
                    ? baseSnapshot[insertIndex - 1].position
                    : [];
                const fixedRightPos =
                  insertIndex < baseSnapshot.length && baseSnapshot[insertIndex]
                    ? baseSnapshot[insertIndex].position
                    : null;

                change.text.split("").forEach((ch) => {
                  const newPosition = generatePosition(
                    currentLeftPos,
                    fixedRightPos,
                    clientId
                  );

                  const op = {
                    documentId: documentId,
                    clientId: clientId,
                    type: "INSERT",
                    id: `${clientId}-${counter++}`,
                    value: ch,
                    position: newPosition,
                    deleted: false,
                  };

                  currentLeftPos = newPosition;

                  applyOperation(op, false);

                  /*console.log(

                    "LOCAL PUBLISH",

                    ch,

                    newPosition

                  );*/                

                  clientRef.current.publish({
                    destination: "/app/send",
                    body: JSON.stringify(op),
                  });
                });
              }
            });
          });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
        <Route
          path="/login"
          element={<LoginPage />}
        />
        <Route
          path="/register"
          element={<RegisterPage />}
        />
        <Route
          path="/doc/:documentId"
          element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}