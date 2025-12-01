import React, { useState } from "react";
import Tree from "rc-tree";
import "rc-tree/assets/index.css";
import axios from "axios";
import JoditEditor from "jodit-react";

export default function WordEditor() {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  const [renameMode, setRenameMode] = useState(false);
  const [renameText, setRenameText] = useState("");

  const [cutNode, setCutNode] = useState(null);
  const [copyNode, setCopyNode] = useState(null);

  const baseURL = 'EDITOR-BACKEND-SERVICE/';

  // Render title simple
  const renderTitle = (node) => (
    <span style={{ cursor: "pointer" }}>{node.title}</span>
  );

  const convert = (n) => ({
    title: renderTitle(n),
    key: n.id,
    raw: n,
    children: n.children.map((c) => convert(c)),
  });

  const treeData = nodes.map((n) => convert(n));

  // Select node
  const onSelect = (keys, info) => {
    setSelectedNode(info.node.raw);
  };

  // Upload .docx
  const uploadWord = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    const res = await axios.post(baseURL + "api/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    setNodes(res.data.tree);
    setSelectedNode(null);
  };

  // Update content
  const updateContent = (html) => {
    const updated = updateNode(nodes, selectedNode.id, (n) => ({
      ...n,
      contentHtml: html,
    }));

    setNodes(updated);
    setSelectedNode({ ...selectedNode, contentHtml: html });
  };

  // Rename
  const rename = () => {
    if (!selectedNode) return alert("Select a node");
    setRenameText(selectedNode.title);
    setRenameMode(true);
  };

  const applyRename = () => {
    const updated = updateNode(nodes, selectedNode.id, (n) => ({
      ...n,
      title: renameText,
    }));

    setNodes(updated);
    setSelectedNode({ ...selectedNode, title: renameText });
    setRenameMode(false);
  };

  // CUT
  const cut = () => {
    if (!selectedNode) return alert("Select a node");
    setCutNode(selectedNode);
    setCopyNode(null);
  };

  // COPY
  const copy = () => {
    if (!selectedNode) return alert("Select a node");
    setCopyNode(selectedNode);
    setCutNode(null);
  };

  // PASTE (as child)
  const paste = () => {
    if (!selectedNode) return alert("Select a destination");

    const source = cutNode || copyNode;
    if (!source) return alert("Nothing to paste");

    let updated = [...nodes];

    if (cutNode) {
      updated = removeNode(updated, source.id);
    }

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

  // Delete
  const deleteNode = () => {
    if (!selectedNode) return alert("Select a node");
    setNodes(removeNode(nodes, selectedNode.id));
    setSelectedNode(null);
  };

  // Add Section
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

  // Add Sub Section
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

  // Export
  const exportWord = async () => {
    const res = await axios.post(baseURL + "api/export", nodes, {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "updated.docx";
    a.click();
  };

  // Helpers
  function updateNode(list, id, updater) {
    return list.map((n) => {
      if (n.id === id) return updater(n);
      return { ...n, children: updateNode(n.children, id, updater) };
    });
  }

  function removeNode(list, id) {
    return list
      .filter((n) => n.id !== id)
      .map((n) => ({ ...n, children: removeNode(n.children, id) }));
  }

  // Jodit config
  const config = {
    readonly: false,
    height: 600,
    uploader: { insertImageAsBase64URI: true },
  };

  return (
    <div style={{ display: "flex", height: "92vh" }}>

      {/* LEFT SIDE */}
      <div style={{ width: "28%", borderRight: "1px solid #ccc", padding: 10 }}>

        {/* Toolbar */}
        <div style={{ marginBottom: 10 }}>
          <input type="file" accept=".docx" onChange={uploadWord} />

          <div style={{ marginTop: 10 }}>
            <button onClick={addSection}>+ Section</button>
            <button onClick={addSubSection} style={{ marginLeft: 8 }}>
              + Sub
            </button>
            <button onClick={exportWord} style={{ marginLeft: 8 }}>
              ⬇ Export
            </button>
          </div>

          <hr />

          {/* operations */}
          {/* --- Operations Toolbar (Micro) --- */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: 8,
              alignItems: "center",
              padding: "4px 0",
            }}
          >
            {[
              { icon: "✂", label: "Cut", func: cut },
              { icon: "📄", label: "Copy", func: copy },
              { icon: "📌", label: "Paste", func: paste },
              { icon: "✏", label: "Rename", func: rename },
              { icon: "🗑", label: "Delete", func: deleteNode },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.func}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "11px",
                  color: "#333",
                  transition: "0.2s",
                  padding: 0,
                }}
                onMouseEnter={(e) => (e.target.style.background = "#f1f1f1")}
                onMouseLeave={(e) => (e.target.style.background = "#fff")}
              >
                <span style={{ fontSize: "15px", marginBottom: "1px" }}>{btn.icon}</span>
                <span style={{ fontSize: "9px" }}>{btn.label}</span>
              </button>
            ))}
          </div>


          {renameMode && (
            <div style={{ marginTop: 10 }}>
              <input
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
              />
              <button onClick={applyRename}>Save</button>
            </div>
          )}

        </div>

        <Tree
          treeData={treeData}
          defaultExpandAll
          onSelect={onSelect}
          draggable
        />
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
              <JoditEditor
                value={selectedNode.contentHtml}
                config={config}
                onBlur={(content) => updateContent(content)}
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
