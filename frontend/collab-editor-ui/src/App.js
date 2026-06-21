import React, { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import Editor from "@monaco-editor/react";

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

  const [connected, setConnected] = useState(false);
  const [editorReadOnly, setEditorReadOnly] = useState(true);

  const clientRef = useRef(null);
  const connectedRef = useRef(false);
  const editorRef = useRef(null);
  const ignoreChangeRef = useRef(false);
  const charsRef = useRef([]);
  const editorReadyRef = useRef(false);
  const initializedRef = useRef(false);

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
            `http://localhost:8080/document/${documentId}/bootstrap`
          );

        const operations =
          await response.json();

        console.log("BOOTSTRAP", documentId, operations);

        // Apply every bootstrap op to charsRef WITHOUT updating the editor on
        // each iteration — a document with N ops would otherwise trigger N full
        // Monaco redraws. Instead we accumulate into charsRef synchronously and
        // do a single editor write at the end.
        operations.forEach((op) => {
          applyOperation(op, false);
        });

        // Single editor write for the entire bootstrapped document.
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
      debug: () => {},

      onConnect: async () => {

        setConnected(true);

        connectedRef.current = true;

        clientRef.current = stomp;

        await waitForEditor();

        // FIX: Subscribe BEFORE fetching bootstrap so that any ops broadcast
        // by other tabs while our HTTP fetch is in-flight are captured rather
        // than silently lost.  We buffer them here and replay them after the
        // bootstrap snapshot has been applied.  Without this, there is a gap
        // between the moment the HTTP request leaves the browser and the moment
        // the subscription becomes active; ops arriving in that window are
        // never delivered to this tab, causing permanent divergence.
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

            // While bootstrap is still running, queue incoming remote ops.
            // Once bootstrap is done, apply them immediately as usual.
            if (!bootstrapDone) {
              pendingBuffer.push(op);
            } else {
              console.log(

                "REMOTE RECEIVED",

                op.value,

                op.position

              );              
              applyOperation(
                op,
                true
              );
            }

          }
        );

        await bootstrapDocument();

        // Bootstrap snapshot is now in charsRef.  Replay any ops that arrived
        // from other tabs while the HTTP fetch was in-flight.  These must be
        // applied with updateEditor=false for the intermediate steps and then
        // a single editor write at the end, matching the bootstrap pattern.
        bootstrapDone = true;

          pendingBuffer.forEach((op) => {
          applyOperation(op, false);
        });

        // One editor write to reflect any buffered remote ops.
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

        // Mark initialized BEFORE subscribing. The semantic meaning of this
        // flag is "bootstrap is done and user input is safe to process". 
        // Setting it after subscribe creates a window where the subscription
        // is live but the flag is false — any user keystroke landing in that
        // window would be silently dropped by the onDidChangeModelContent guard.
        initializedRef.current = true;

        // Lift the read-only lock now that bootstrap is complete and the
        // CRDT state is consistent. Any keystrokes before this point would
        // have generated ops against an empty/partial charsRef, producing
        // positions that are wrong relative to the already-bootstrapped
        // document — making the editor read-only during bootstrap is the
        // simplest correct solution.
        // Drive readOnly through React state so the prop and the editor
        // stay in sync across re-renders (imperative updateOptions loses
        // to the React prop on every re-render).
        setEditorReadOnly(false);
        console.log("Bootstrap complete", ignoreChangeRef.current);

      }     ,
    });

    stomp.activate();

    return () => stomp.deactivate();
  }, []);

  const applyOperation = (op, updateEditor = true) => {
    // IMPORTANT: charsRef.current is the synchronous source of truth.
    // We must read AND write it synchronously, right here, rather than inside
    // the setChars updater callback. setChars/React defers running that updater
    // until the next render — if two onDidChangeModelContent events fire back
    // to back (fast typing, key-repeat, paste) before React flushes the first
    // setChars call, the second event would otherwise read a stale
    // charsRef.current (missing the first op), generate a CRDT position with
    // the wrong neighbours, and land in the wrong place once both ops are
    // eventually applied — producing the "missed/jumbled first character" bug.
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

    // Write synchronously, BEFORE any other event has a chance to read it.

    debugState(

      `${clientId}

       ${op.type}

       ${op.value ?? op.id}`,

      updated

    );

    charsRef.current = updated;

    // TEMPORARY:
    // Rendering only visible chars.
    const newCode = updated
      .filter((c) => !c.deleted)
      .map((c) => c.value)
      .join("");

    if (updateEditor && editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();

      // Compute the current cursor offset in the OLD content before we
      // replace it, so we can adjust it for the incoming op.
      const oldPosition = editor.getPosition();
      const oldCursorOffset = oldPosition
        ? model.getOffsetAt(oldPosition)
        : 0;

      // Find where this op landed in the visible (non-deleted) character
      // sequence. For an INSERT, the op was placed at some index in
      // charsRef via binarySearchInsert; we count the visible chars before
      // that index to get its Monaco offset. For a DELETE, the char was
      // already tombstoned so we count visible chars up to its former slot.
      let opMonacoOffset = null;
      if (op.type === "INSERT") {
        // updated is already the new charsRef — find the inserted char.
        const insertedIdx = updated.findIndex((c) => c.id === op.id);
        if (insertedIdx !== -1) {
          // Count visible chars strictly before the inserted position.
          opMonacoOffset = updated
            .slice(0, insertedIdx)
            .filter((c) => !c.deleted)
            .length;
        }
      } else if (op.type === "DELETE") {
        // For a delete, the char is now tombstoned. Find how many visible
        // chars come before it in the array to get its old Monaco offset.
        const deletedIdx = updated.findIndex((c) => c.id === op.id);
        if (deletedIdx !== -1) {
          opMonacoOffset = updated
            .slice(0, deletedIdx)
            .filter((c) => !c.deleted)
            .length;
        }
      }

      // Adjust the cursor: if the op landed at or before the cursor,
      // shift the cursor right (INSERT) or left (DELETE) by 1. This keeps
      // the cursor pointing at the same logical character after the
      // full-range replace, rather than the same line/column which now
      // refers to a different character.
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

      // Restore cursor at the adjusted offset in the new content.
      const newPosition = model.getPositionAt(newCursorOffset);
      editor.setPosition(newPosition);
    }    

    // setChars only needs to trigger a re-render with the already-computed
    // array — it's no longer the place where charsRef gets updated, so it's
    // safe for this to be deferred/batched by React.
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


          editor.onDidChangeModelContent((event) => {
            if (!initializedRef.current) {
              return;
            }

            if (ignoreChangeRef.current) {
              console.log("Ignoring change event");
              ignoreChangeRef.current = false;  
              return;
            }

            if (!connectedRef.current || !clientRef.current) {
              return;
            }

            event.changes.forEach((change) => {

              // DELETE
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

                // Snapshot charsRef once before the loop. The insertion
                // window is fixed for the duration of this Monaco event:
                // - rightPos is the character that was at insertIndex before
                //   we started — it never moves regardless of how many chars
                //   we insert to its left, so it must be frozen here.
                // - leftPos seeds from the char immediately left of the insert
                //   point, then advances to each newly generated position so
                //   consecutive characters chain correctly.
                // Re-reading charsRef inside the loop would shift the right
                // boundary by +1 for every character already inserted (because
                // binarySearchInsert places each new char before the old right
                // neighbour, pushing it rightward in the array), causing Y and
                // Z in a paste of XYZ to be placed against the wrong neighbour.
                // JavaScript is single-threaded — no remote op can interleave
                // inside a synchronous forEach — so a single snapshot is both
                // correct and sufficient.
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

                  // Advance leftPos to the character we just inserted so the
                  // next character is placed immediately after it.
                  currentLeftPos = newPosition;

                  // applyOperation updates charsRef.current synchronously via
                  // binarySearchInsert — it is now the sole source of truth.
                  applyOperation(op, false);

                  console.log(

                    "LOCAL PUBLISH",

                    ch,

                    newPosition

                  );                  

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

    <Routes>

      <Route

        path="/"

        element={

          <Navigate

            to="/doc/default"

            replace

          />

        }

      />

      <Route

        path="/doc/:documentId"

        element={<EditorPage />}

      />

    </Routes>

  );

}