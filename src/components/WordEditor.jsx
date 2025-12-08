import React, { useState, useEffect, useRef } from "react";
import Tree from "rc-tree";
import "rc-tree/assets/index.css";
import axios from "axios";
import JoditEditor from "jodit-react";
import "../components/WordEditor.css";

const MemoJodit = React.memo(JoditEditor, () => true);

export default function WordEditor() {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  const [renameText, setRenameText] = useState("");
  const [cutNode, setCutNode] = useState(null);
  const [copyNode, setCopyNode] = useState(null);

  const [contextMenu, setContextMenu] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const baseURL = 'EDITOR-BACKEND-SERVICE/';

  const instance = axios.create({
    baseURL
  });

  const editorRef = useRef(null);

  const [loadingReport, setLoadingReport] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // ---------- FUN HELPER: extract reportNumber robustly ----------
  function getReportNumberFromUrl() {
    try {
      // 1) try normal search params first
      const search = window.location.search || "";
      if (search && search.indexOf("?") === 0) {
        const p = new URLSearchParams(search);
        const rn = p.get("reportNumber");
        if (rn) return rn;
      }

      // 2) otherwise try hash: something like "#...?...reportNumber=213&..."
      const hash = window.location.hash || "";
      if (hash.includes("?")) {
        const parts = hash.split("?");
        const paramString = parts.slice(1).join("?"); // everything after first '?'
        const p = new URLSearchParams(paramString);
        const rn = p.get("reportNumber");
        if (rn) return rn;
      }

      // 3) fallback: try to find reportNumber anywhere in full href (last resort)
      const href = window.location.href || "";
      const fallbackMatch = href.match(/[?&]reportNumber=([^&]+)/i);
      if (fallbackMatch) return decodeURIComponent(fallbackMatch[1]);

      return null;
    } catch (err) {
      console.error("getReportNumberFromUrl error:", err);
      return null;
    }
  }

  // ---------- CALL API to fetch report tree by number of report ----------
  async function fetchReport(reportNumber) {
    try {
      setLoadingReport(true);
      setLoadError(null);
      console.log(reportNumber);
      // ====== adapt this endpoint to your backend route ya magdy ======
      const res = await instance.post(
        `/service/SAPHack2BuildSvcs/getTemplateInBase64ByReportId`,
        { reportNumber: reportNumber }
      );
      console.log(res.data);
      // Expecting res.data.tree 
      setNodes(res.data.value || []);
      setSelectedNode(null);
    } catch (err) {
      console.error("fetchReport error:", err);
      setLoadError(err?.response?.data || err.message || "Failed to load report");
    } finally {
      setLoadingReport(false);
    }
  }

  // ---------- run on mount: check URL and auto-load if reportNumber present ----------
  useEffect(() => {
    const rn = getReportNumberFromUrl();
    if (rn) {
      fetchReport(rn);
    }
    // else do nothing (upload input remains available)
  }, []);

  // ---------- rest of your component (mostly unchanged) ----------

  // APPLY INLINE RENAME
  const applyInlineRename = (id) => {
    const updated = updateNode(nodes, id, (n) => ({
      ...n,
      title: renameText,
    }));

    setNodes(updated);

    if (selectedNode?.id === id) {
      setSelectedNode({ ...selectedNode, title: renameText });
    }

    setEditingNodeId(null);
  };

  // INLINE EDIT TITLE
  const renderTitle = (node) => {
    const isEditing = editingNodeId === node.id;

    if (isEditing) {
      return (
        <input
          autoFocus
          value={renameText}
          onChange={(e) => setRenameText(e.target.value)}
          style={{
            padding: "2px 4px",
            fontSize: "14px",
            width: "80%",
          }}
          onBlur={() => applyInlineRename(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyInlineRename(node.id);
            if (e.key === "Escape") setEditingNodeId(null);
          }}
        />
      );
    }

    return (
  <span className="tree-title" title={node.title}>
    {node.title}
  </span>
);

  };

  // MAP TREE DATA
  const convert = (n) => ({
    title: renderTitle(n),
    key: n.id,
    raw: n,
    children: n.children.map((c) => convert(c)),
  });

  const treeData = nodes.map((n) => convert(n));

  const onSelect = (keys, info) => {
    setSelectedNode(info.node.raw);
    setContextMenu(null);
  };

  // UPLOAD DOCX (fallback if no reportNumber)
  const uploadWord = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await instance.post(
        "/api/upload-file",
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      //  const res = await axios.post(
      //   "http://localhost:4000/api/upload-file",
      //   form,
      //   {
      //     headers: { "Content-Type": "multipart/form-data" },
      //   }
      // );

      setNodes(res.data.tree);
      setSelectedNode(null);
    } catch (err) {
      console.error("uploadWord error:", err);
      setLoadError(err?.response?.data || err.message || "Upload failed");
    }
  };

  // UPDATE CONTENT
  const updateContent = (html) => {
    if (!selectedNode) return;
    const updated = updateNode(nodes, selectedNode.id, (n) => ({
      ...n,
      contentHtml: html,
    }));

    setNodes(updated);
    setSelectedNode({ ...selectedNode, contentHtml: html });
  };

  // RENAME
  const rename = () => {
    if (!selectedNode) return alert("Select a node");
    setRenameText(selectedNode.title);
    setEditingNodeId(selectedNode.id);
  };

  // CUT / COPY / PASTE
  const cut = () => {
    if (!selectedNode) return alert("Select a node");
    setCutNode(selectedNode);
    setCopyNode(null);
  };

  const copy = () => {
    if (!selectedNode) return alert("Select a node");
    setCopyNode(selectedNode);
    setCutNode(null);
  };

  const paste = () => {
    if (!selectedNode) return alert("Select a destination");

    const source = cutNode || copyNode;
    if (!source) return alert("Nothing to paste");

    let updated = [...nodes];
    if (cutNode) updated = removeNode(updated, source.id);

    const newNode = {
      ...source,
      id: "n_" + Math.random().toString(36).slice(2),
      level: selectedNode.level + 1,
    };

    updated = updateNode(updated, selectedNode.id, (n) => ({
      ...n,
      children: [...n.children, newNode],
    }));

    setNodes(updated);
    setCutNode(null);
    setCopyNode(null);
  };

  // DELETE
  const deleteNode = () => {
    if (!selectedNode) return alert("Select a node");
    setNodes(removeNode(nodes, selectedNode.id));
    setSelectedNode(null);
  };

  // ADD SECTION
  const addSection = () => {
    const newNode = {
      id: "n_" + Math.random().toString(36).slice(2),
      title: "New Section",
      level: 1,
      contentHtml: "<p></p>",
      children: [],
    };
    setNodes([...nodes, newNode]);
  };

  // ADD SUB SECTION
  const addSubSection = () => {
    if (!selectedNode) return alert("Select a parent");

    const newNode = {
      id: "n_" + Math.random().toString(36).slice(2),
      title: "New Sub Section",
      level: selectedNode.level + 1,
      contentHtml: "<p></p>",
      children: [],
    };

    setNodes(
      updateNode(nodes, selectedNode.id, (n) => ({
        ...n,
        children: [...n.children, newNode],
      }))
    );
  };

  // EXPORT WORD
const exportWord = async () => {
  const jsonString = JSON.stringify(nodes);

  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonString);
  const base64Data = btoa(
    bytes.reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  const res = await axios.post(
    "http://localhost:4000/api/export",
    { data: base64Data },
    { responseType: "blob" }
  );
  console.log("✅ Base64 :", base64Data);

  // Download file
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = "test.docx";
  a.click();
};





  // DRAG & DROP
  const onDrop = (info) => {
    const dragKey = info.dragNode.key;
    const dropKey = info.node.key;
    const dropPosition = info.dropPosition;
    const dropToGap = info.dropToGap;

    let newTree = [...nodes];
    let dragItem = null;

    newTree = removeNode(newTree, dragKey, (removed) => {
      dragItem = removed;
    });

    if (!dragItem) return;

    if (!dropToGap) {
      dragItem.level = info.node.raw.level + 1;
      newTree = updateNode(newTree, dropKey, (n) => ({
        ...n,
        children: [...n.children, dragItem],
      }));
      return setNodes(newTree);
    }

    const targetLevel = info.node.raw.level;
    dragItem.level = targetLevel;

    newTree = insertSibling(newTree, dropKey, dragItem, dropPosition);
    setNodes(newTree);
  };

  const insertSibling = (list, targetId, item, dropPosition) => {
    let result = [];

    for (let node of list) {
      if (node.id === targetId) {
        if (dropPosition > 0) {
          result.push(node);
          result.push(item);
        } else {
          result.push(item);
          result.push(node);
        }
      } else {
        result.push({
          ...node,
          children: insertSibling(node.children, targetId, item, dropPosition),
        });
      }
    }

    return result;
  };

  // HELPERS
  function updateNode(list, id, updater) {
    return list.map((n) => {
      if (n.id === id) return updater(n);
      return { ...n, children: updateNode(n.children, id, updater) };
    });
  }

  function removeNode(list, id, callback = null) {
    let result = [];
    for (let n of list) {
      if (n.id === id) {
        if (callback) callback(n);
        continue;
      }
      result.push({
        ...n,
        children: removeNode(n.children, id, callback),
      });
    }
    return result;
  }

  // const config = {
  //   readonly: false,
  //   height: 600,
  //   uploader: { insertImageAsBase64URI: true },
  //   removeButtons: ["file"],
  // };
  const config = {
  readonly: false,
  height: 600,
  uploader: { insertImageAsBase64URI: true },
  removeButtons: ["file"],

  buttons: [
    "bold", "italic", "underline", "|",
    "ul", "ol", "|",
    "font", "fontsize", "|",
    "align", "|",
    "link", "image", "|",

    // ✅ ضيف زر الـ Tags هنا
    "tagsDropdown"
  ],

  extraButtons: [
    {
      name: "🏷 Tags",
      icon: "select",
      tooltip: "Insert Tag",
      popup: (editor, current, self) => {
        const list = document.createElement("div");
        list.style.padding = "10px";
        list.style.minWidth = "180px";

        const tags = [
  { label: "Report Number", value: "{ReportNumber}" },
  { label: "Inspector", value: "{Inspector}" },
  { label: "Cycle", value: "{Cycle}" },
  { label: "Status", value: "{Status}" },
  { label: "Created At", value: "{CreatedAt}" },
  { label: "Created By", value: "{CreatedBy}" },
  { label: "ID", value: "{ID}" },
  { label: "Building Number", value: "{BuildingNumber}" },
  { label: "City", value: "{City}" },
  { label: "Country", value: "{Country}" },
  { label: "State", value: "{State}" },
  { label: "Address1", value: "{Address1}" },
  { label: "Address2", value: "{Address2}" },
  { label: "Lot", value: "{Lot}" },
  { label: "Bin", value: "{Bin}" },
  { label: "Block", value: "{Block}" },
  { label: "Full Name", value: "{FullName}" },
  { label: "Email", value: "{Email}" },
  { label: "Phone", value: "{Phone}" }
];



        tags.forEach(tag => {
          const btn = document.createElement("div");
          btn.innerText = tag.label;
          btn.style.cursor = "pointer";
          btn.style.padding = "6px";
          btn.style.borderBottom = "1px solid #eee";

          btn.onclick = () => {
            editor.s.insertHTML(tag.value);
            editor.events.fire("closeAllPopups");
          };

          list.appendChild(btn);
        });

        return list;
      }
    }
  ]
};


  return (
    <div style={{ display: "flex", height: "92vh" }}>
      {/* LEFT SIDE */}
      <div className="left-panel">
        <div style={{ marginBottom: 10 }}>
          {/* show upload only when no auto-loaded report */}
               {/* show upload only when no auto-loaded report */}
          {!loadingReport && nodes.length === 0 && (
            <input type="file" accept=".docx" onChange={uploadWord} />
          )}

          <div style={{ marginTop: 10 }}>
            <button onClick={addSection}>+ Section</button>
            <button onClick={addSubSection} style={{ marginLeft: 8 }}>
              + Sub
            </button>
            <button onClick={exportWord} style={{ marginLeft: 8 }}>
              ⬇ Export
            </button>
          </div>

          {loadingReport && <div style={{ marginTop: 8 }}>Loading report…</div>}
          {loadError && (
            <div style={{ marginTop: 8, color: "crimson" }}>
              Error: {String(loadError)}
            </div>
          )}
        </div>

        <div
          style={{
            height: "1px",
            background: "#d9d9d9",
            margin: "12px 0",
          }}
        ></div>

        <Tree
          treeData={treeData}
          defaultExpandAll
          draggable
          onSelect={onSelect}
          onDrop={onDrop}
          onRightClick={(info) => {
            setSelectedNode(info.node.raw);
            setContextMenu({
              x: info.event.clientX,
              y: info.event.clientY,
              node: info.node.raw,
            });
          }}
        />

        {contextMenu && (
          <div
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: 4,
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              zIndex: 9999,
              width: 150,
              padding: "4px 0",
            }}
          >
            {[
              { label: "✂ Cut", action: cut },
              { label: "📄 Copy", action: copy },
              { label: "📌 Paste", action: paste },
              { label: "✏ Rename", action: rename },
              { label: "🗑 Delete", action: deleteNode },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => {
                  item.action();
                  setContextMenu(null);
                }}
                style={{
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontSize: 14,
                }}
                onMouseEnter={(e) =>
                  (e.target.style.background = "#f1f1f1")
                }
                onMouseLeave={(e) => (e.target.style.background = "#fff")}
              >
                {item.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT SIDE */}
      <div style={{ flex: 1, padding: 20 }}>
        {selectedNode ? (
          <>
            <h2>{selectedNode.title}</h2>

            <div
              style={{
                border: "1px solid #d0d0d0",
                borderRadius: 5,
                padding: 10,
                background: "#fff",
                minHeight: "75vh",
                marginTop: 10,
              }}
            >
              <MemoJodit
                key={selectedNode?.id}
                ref={editorRef}
                value={selectedNode?.contentHtml}
                config={config}
                onChange={(content) => updateContent(content)}
              />
            </div>
          </>
        ) : (
          <h3>Select a section</h3>
        )}
      </div>
    </div>
  );
}
