// We assume "window.blockDefinitions" is already set 
// by blockDefinitions.js (which is loaded first in index.html).
// Let's alias it for convenience:
const blockDefinitions = window.blockDefinitions;

/* ============================
   Improved Project Saving/Loading (Preserves Input Values)
   ============================ */
function saveProject() {
  const workspace = document.querySelector("#workspace");
  
  // Clone workspace to avoid modifying the original
  const clonedWorkspace = workspace.cloneNode(true);

  // Save all input values inside blocks (including text inputs)
  clonedWorkspace.querySelectorAll("input").forEach(input => {
    input.setAttribute("value", input.value); // Store current value as an attribute
  });

  // Save images (compressed)
  const images = {};
  const imagePromises = [];

  // Example: compress each <img> in #workspace to 64x64
  document.querySelectorAll("#workspace img").forEach(img => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 64;
    canvas.height = 64;

    const imageLoadPromise = new Promise(resolve => {
      const imageObj = new Image();
      imageObj.src = img.src;
      imageObj.onload = function () {
        ctx.drawImage(imageObj, 0, 0, 64, 64);
        images[img.src] = canvas.toDataURL("image/jpeg", 0.5);
        resolve();
      };
    });

    imagePromises.push(imageLoadPromise);
  });

  Promise.all(imagePromises).then(() => {
    const projectData = {
      html: clonedWorkspace.innerHTML,
      images: images
    };

    const encodedData = btoa(encodeURIComponent(JSON.stringify(projectData)));
    const url = window.location.origin + window.location.pathname + "?s=" + encodedData;

    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      alert("✅ Project URL copied to clipboard!");
    }).catch(() => {
      alert("❌ Failed to copy project URL.");
    });
  });
}

function loadProjectFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("s")) {
    try {
      const decodedData = JSON.parse(decodeURIComponent(atob(params.get("s"))));
      const workspace = document.querySelector("#workspace");
      // Insert the saved HTML
      workspace.innerHTML = decodedData.html;

      // Restore input values
      workspace.querySelectorAll("input").forEach(input => {
        input.value = input.getAttribute("value") || "";
      });

      // Restore images
      workspace.querySelectorAll("img").forEach(img => {
        if (decodedData.images[img.src]) {
          img.src = decodedData.images[img.src]; // Replace with stored Base64
        }
      });

      // AFTER LOADING: RE-INIT BLOCKS
      // Re-enable drag, drop, delete button, etc.
      reinitLoadedBlocks(workspace);

    } catch (e) {
      console.warn("⚠️ Invalid project data in URL:", e);
    }
  }
}

// Make sure we load the project if there's a ?s= param
window.addEventListener("DOMContentLoaded", loadProjectFromURL);

/* =============================
   Global array to store costumes
   ============================= */
let costumes = [];

// If we're picking a costume for a block
let isPickerMode = false;
let pickingBlock = null;
let pickingInputName = "";

/* ========== Costume Manager Logic ========== */
// Wrap all DOM-dependent costume manager code in DOMContentLoaded
window.addEventListener("DOMContentLoaded", () => {
  const openManagerBtn = document.getElementById("open-costume-manager");
  const costumeManager = document.getElementById("costume-manager");
  const costumeList = document.getElementById("costume-list");
  const addCostumeBtn = document.getElementById("add-costume-btn");
  const closeCostumeBtn = document.getElementById("close-costume-btn");

  // Ensure the costume manager is hidden on site load
  costumeManager.classList.add("hidden");

  // Open Costume Manager
  openManagerBtn.addEventListener("click", () => {
    // Disable picking mode
    isPickerMode = false;
    pickingBlock = null;
    pickingInputName = "";

    renderCostumeList();
    costumeManager.classList.remove("hidden");
  });

  // Close Costume Manager
  closeCostumeBtn.addEventListener("click", () => {
    costumeManager.classList.add("hidden");
    isPickerMode = false;
  });

  // Add a new costume
  addCostumeBtn.addEventListener("click", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataURL = evt.target.result;
        costumes.push({
          name: file.name,
          data: dataURL
        });
        renderCostumeList();
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  });

  // Render the costume list in the manager
  function renderCostumeList() {
    costumeList.innerHTML = "";

    costumes.forEach((c, i) => {
      const costumeItem = document.createElement("div");
      costumeItem.classList.add("costume-item");

      const img = document.createElement("img");
      img.src = c.data;
      img.alt = c.name;

      // Delete button
      const deleteBtn = document.createElement("button");
      deleteBtn.innerText = "X";
      deleteBtn.classList.add("delete-costume-btn");
      deleteBtn.onclick = () => {
        costumes.splice(i, 1);
        renderCostumeList();
      };

      costumeItem.appendChild(img);
      costumeItem.appendChild(deleteBtn);

      // If we're in "picking" mode, allow clicking to choose
      if (isPickerMode) {
        costumeItem.style.cursor = "pointer";
        costumeItem.onclick = () => {
          pickCostume(c);
        };
      }

      costumeList.appendChild(costumeItem);
    });
  }

  // Expose pickCostume globally so other parts of the code can call it
  window.pickCostume = function(c) {
    if (pickingBlock) {
      // Update the appropriate input field in the block
      const inputContainer = pickingBlock.querySelector(".block-inputs");
      if (inputContainer) {
        const field = inputContainer.querySelector(
          `[data-input-name='${pickingInputName}']`
        );
        if (field) {
          field.value = c.name;
        }
      }
    }
    // Reset picking mode
    isPickerMode = false;
    pickingBlock = null;
    pickingInputName = "";
    costumeManager.classList.add("hidden");
  };

  // Expose renderCostumeList if needed elsewhere
  window.renderCostumeList = renderCostumeList;
});

/* =============================
   Extract input fields
   (Supports reporter blocks as well)
   ============================= */
function getInputs(block) {
  const inputs = {};

  // 1) Only get the direct .block-inputs container for this block
  const parentBlockInputs = block.querySelector(":scope > .block-inputs");
  if (!parentBlockInputs) return inputs;

  // 2) Within that container, find all .input-wrapper
  const inputWrappers = parentBlockInputs.querySelectorAll(".input-wrapper");

  inputWrappers.forEach(wrapper => {
    const inputName = wrapper.dataset.inputName;
    if (!inputName) return;

    // If there's a reporter block inside this wrapper
    const reporterBlock = wrapper.querySelector(".workspace-reporter");

    // If there's a normal/c-block in the input wrapper by mistake:
    const nonReporter = wrapper.querySelector(".workspace-block, .c-block");
    const parentDef = blockDefinitions[block.dataset.blockType] || {};

    // If a non-reporter block is in the input wrapper, ignore it & use typed text
    if (nonReporter && !nonReporter.classList.contains("workspace-reporter")) {
      const textInput = wrapper.querySelector("input");
      inputs[inputName] = textInput ? textInput.value : "";
      return;
    }

    // If we found a reporter block
    if (reporterBlock) {
      // If parent is a c-block, ignore reporter
      if (parentDef.block_type === "c-block") {
        const textInput = wrapper.querySelector("input");
        inputs[inputName] = textInput ? textInput.value : "";
      } else {
        const { realCode } = executeBlock(reporterBlock);
        inputs[inputName] = realCode;
      }
    } else {
      // Just a normal input
      const textInput = wrapper.querySelector("input");
      inputs[inputName] = textInput ? textInput.value : "";
    }
  });

  return inputs;
}

/* =============================
   Recursively Build realCode & displayCode
   ============================= */
function executeBlock(block, depth = 0) {
  const type = block.dataset.blockType;
  const def = blockDefinitions[type];
  if (!def) return { realCode: "", displayCode: "" };

  // Gather "this block's" inputs
  const inputs = getInputs(block);

  // Then gather "child blocks" from the .inner container 
  const childBlocks = block.querySelector(".inner")
    ? [...block.querySelector(".inner").children]
    : [];
  const childData = childBlocks.map(cb => executeBlock(cb, depth + 1));

  return def.execute(inputs, childData, depth);
}

/* =============================
   "Run" the blocks
   ============================= */
function executeBlocks() {
  const workspaceBlocks = document.querySelectorAll(
    "#workspace > .workspace-block, #workspace > .c-block"
  );

  // Clear previous execution state
  let realCodeAll = "let __globalSafetyCount = 0;\n";
  let displayCodeAll = "";
  
  // Clear the canvas if any
  const canvas = document.getElementById("graphics-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Build up the code from each top-level block
  workspaceBlocks.forEach(block => {
    const { realCode, displayCode } = executeBlock(block, 0);
    realCodeAll += realCode + "\n";
    displayCodeAll += displayCode + "\n";
  });

  // Show final JS code for debugging
  document.getElementById("generated-code").textContent = displayCodeAll.trim();

  try {
    eval(realCodeAll);
  } catch (e) {
    console.error("Error executing generated code:", e);
  }

  function checkWorkspace() {
    if (!document.getElementById("workspace")) {
      console.warn("Workspace disappeared! Restoring UI...");
      location.reload(); // Reload the page only if workspace vanishes
    }
  }

  // Delay workspace check slightly
  setTimeout(checkWorkspace, 500);
}

/* =============================
   Create DOM element for a block
   ============================= */
function createBlockElement(blockType, isWorkspaceBlock = false) {
  const blockData = blockDefinitions[blockType];
  const block = document.createElement("div");
  block.dataset.blockType = blockType;

  // If there's no definition, just show unknown text
  if (!blockData) {
    block.className = isWorkspaceBlock ? "workspace-block" : "block";
    block.textContent = "Unknown block type: " + blockType;
    return block;
  }

  // If it's a reporter block
  if (blockData.block_type === "reporter") {
    // Use "workspace-reporter" if in workspace, "reporter-block" if in toolbox
    block.className = isWorkspaceBlock ? "workspace-reporter" : "reporter-block";
    
    // Format the reporter pill
    const inputArea = document.createElement("div");
    inputArea.classList.add("block-inputs");

    blockData.format.forEach(part => {
      if (part.startsWith("input")) {
        // Create wrapper for the reporter's possible text input
        const inputWrapper = document.createElement("div");
        inputWrapper.className = "input-wrapper";
        inputWrapper.dataset.inputName = part;
        inputWrapper.style.display = "inline-block";
        inputWrapper.style.margin = "0 4px";

        inputWrapper.ondragover = (e) => e.preventDefault();
        inputWrapper.ondrop = (e) => {
          e.preventDefault();
          const droppedType = e.dataTransfer.getData("blockType");
          // if a reporter is dropped here, nest it
          if (
            blockDefinitions[droppedType] &&
            blockDefinitions[droppedType].block_type === "reporter"
          ) {
            const newReporter = createBlockElement(droppedType, true);
            inputWrapper.innerHTML = "";
            inputWrapper.appendChild(newReporter);
          }
        };

        const field = document.createElement("input");
        field.type = "text";
        field.className = "input-field";
        field.dataset.inputName = part;
        field.value = blockData[part + "_default"] || "";
        inputWrapper.appendChild(field);
        inputArea.appendChild(inputWrapper);
      }
      else {
        // e.g. "Value"
        const labelSpan = document.createElement("span");
        labelSpan.innerText = part + " ";
        inputArea.appendChild(labelSpan);
      }
    });
    block.appendChild(inputArea);

    // Only add delete button if it's in the workspace
    if (isWorkspaceBlock) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.innerText = "X";
      deleteButton.onclick = () => block.remove();
      block.appendChild(deleteButton);
    }

    // Toolbox or workspace, we still want to let you drag the reporter around
    block.draggable = true;
    block.ondragstart = (ev) => {
      ev.dataTransfer.setData("blockType", blockType);
    };

    // Optionally show a “tooltip” on click (example)
    if (isWorkspaceBlock) {
      block.onclick = () => {
        let existing = block.querySelector(".reporter-message");
        if (existing) existing.remove();

        const msg = document.createElement("div");
        msg.className = "reporter-message";
        msg.style.position = "absolute";
        msg.style.bottom = "120%";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#222";
        msg.style.color = "#fff";
        msg.style.padding = "5px 10px";
        msg.style.borderRadius = "5px";
        msg.style.fontSize = "12px";
        msg.style.whiteSpace = "nowrap";
        msg.innerText = "Reporter block";
        block.appendChild(msg);

        setTimeout(() => msg.remove(), 2000);
      };
    }
    return block;
  }

  // If it's a C-block (like "repeat" or "forever")
  if (blockData.block_type === "c-block") {
    block.className = "c-block";
    const inputArea = document.createElement("div");
    inputArea.classList.add("block-inputs");

    if (blockType === "repeat") {
      inputArea.appendChild(document.createTextNode("Repeat "));
      const inputWrapper = document.createElement("div");
      inputWrapper.className = "input-wrapper";
      inputWrapper.dataset.inputName = "input1";
      inputWrapper.style.display = "inline-block";
      inputWrapper.style.margin = "0 4px";

      inputWrapper.ondragover = (e) => e.preventDefault();
      inputWrapper.ondrop = (e) => {
        e.preventDefault();
        const droppedType = e.dataTransfer.getData("blockType");
        if (
          blockDefinitions[droppedType] &&
          blockDefinitions[droppedType].block_type === "reporter"
        ) {
          const newReporter = createBlockElement(droppedType, true);
          inputWrapper.innerHTML = "";
          inputWrapper.appendChild(newReporter);
        }
      };

      const inputField = document.createElement("input");
      inputField.type = "text";
      inputField.className = "input-field";
      // Show default, e.g. "3"
      inputField.value = blockData.input1_default;
      inputField.dataset.inputName = "input1";
      inputWrapper.appendChild(inputField);
      inputArea.appendChild(inputWrapper);

      inputArea.appendChild(document.createTextNode(" times"));
    }
    else if (blockType === "forever") {
      inputArea.appendChild(document.createTextNode("Forever do"));
    }

    block.appendChild(inputArea);

    // Container for nested (child) blocks
    const innerContainer = document.createElement("div");
    innerContainer.className = "inner";
    innerContainer.ondragover = (e) => e.preventDefault();
    innerContainer.ondrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nestedType = e.dataTransfer.getData("blockType");
      if (nestedType) {
        const newChildBlock = createBlockElement(nestedType, true);
        innerContainer.appendChild(newChildBlock);
      }
    };
    block.appendChild(innerContainer);
  } 
  else {
    // Normal (stack) block
    block.className = isWorkspaceBlock ? "workspace-block" : "block";
    const inputArea = document.createElement("div");
    inputArea.classList.add("block-inputs");

    blockData.format.forEach(part => {
      if (part.startsWith("imageinput")) {
        // Provide a text box + "Pick Costume" button
        const inputWrapper = document.createElement("div");
        inputWrapper.className = "input-wrapper";
        inputWrapper.dataset.inputName = part;
        inputWrapper.style.display = "inline-block";
        inputWrapper.style.margin = "0 4px";

        inputWrapper.ondragover = (e) => e.preventDefault();
        inputWrapper.ondrop = (e) => {
          e.preventDefault();
          const droppedType = e.dataTransfer.getData("blockType");
          if (
            blockDefinitions[droppedType] &&
            blockDefinitions[droppedType].block_type === "reporter"
          ) {
            const newReporter = createBlockElement(droppedType, true);
            inputWrapper.innerHTML = "";
            inputWrapper.appendChild(newReporter);
          }
        };

        const field = document.createElement("input");
        field.type = "text";
        field.className = "input-field";
        field.dataset.inputName = part;
        field.value = blockData[part + "_default"] || "";
        inputWrapper.appendChild(field);

        // "Pick Costume" button
        const pickBtn = document.createElement("button");
        pickBtn.className = "costume-picker-button";
        pickBtn.textContent = "Pick Costume";
        pickBtn.onclick = () => {
          isPickerMode = true;
          pickingBlock = block;
          pickingInputName = part;
          renderCostumeList();
          // Note: costumeManager is within the DOMContentLoaded scope so we access it via querySelector
          document.getElementById("costume-manager").classList.remove("hidden");
        };
        inputWrapper.appendChild(pickBtn);

        inputArea.appendChild(inputWrapper);
      }
      else if (part.startsWith("input")) {
        // Regular text input (wrapped so a reporter can be dropped in)
        const inputWrapper = document.createElement("div");
        inputWrapper.className = "input-wrapper";
        inputWrapper.dataset.inputName = part;
        inputWrapper.style.display = "inline-block";
        inputWrapper.style.margin = "0 4px";

        inputWrapper.ondragover = (e) => e.preventDefault();
        inputWrapper.ondrop = (e) => {
          e.preventDefault();
          const droppedType = e.dataTransfer.getData("blockType");
          if (
            blockDefinitions[droppedType] &&
            blockDefinitions[droppedType].block_type === "reporter"
          ) {
            const newReporter = createBlockElement(droppedType, true);
            inputWrapper.innerHTML = "";
            inputWrapper.appendChild(newReporter);
          }
        };

        const field = document.createElement("input");
        field.type = "text";
        field.className = "input-field";
        field.dataset.inputName = part;
        field.value = blockData[part + "_default"] || "";
        inputWrapper.appendChild(field);

        inputArea.appendChild(inputWrapper);
      }
      else {
        // Just static text
        const textSpan = document.createElement("span");
        textSpan.innerText = part + " ";
        inputArea.appendChild(textSpan);
      }
    });
    block.appendChild(inputArea);
  }

  // If it's in the workspace (but not a reporter), add a delete button
  if (isWorkspaceBlock && blockData.block_type !== "reporter") {
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.innerText = "X";
    deleteButton.onclick = () => block.remove();
    block.appendChild(deleteButton);
  }

  // If it's in the toolbox, we set up basic "dragstart" so you can drag it into the workspace
  // If it's in the workspace, we set up the "makeDraggableAndSnappable" so you can reposition it.
  if (isWorkspaceBlock) {
    // Actually let user re-position the block:
    makeDraggableAndSnappable(block);
  } else {
    // Toolbox version:
    block.draggable = true;
    block.ondragstart = (ev) => {
      ev.dataTransfer.setData("blockType", blockType);
    };
  }

  return block;
}

/* =============================
   Drop handler for workspace
   (Used when dragging from toolbox → workspace)
   ============================= */
function dropBlock(event, dropTarget) {
  event.preventDefault();
  const blockType = event.dataTransfer.getData("blockType");
  if (blockType) {
    const newBlock = createBlockElement(blockType, true);
    dropTarget.appendChild(newBlock);
  }
}

/* =============================
   Populate toolbox on load
   ============================= */
window.addEventListener("DOMContentLoaded", () => {
  const blockMenu = document.getElementById("block-menu");
  Object.keys(blockDefinitions).forEach(blockType => {
    const toolboxBlock = createBlockElement(blockType, false /* isWorkspaceBlock */);
    blockMenu.appendChild(toolboxBlock);
  });
});

/* =============================
   RE-INITIALIZE LOADED BLOCKS
   (makes sure all blocks have correct classes, 
    delete buttons, drag+drop, etc.)
   ============================= */
function reinitLoadedBlocks(container) {
  container.querySelectorAll(".workspace-block, .c-block, .workspace-reporter").forEach(block => {
    const blockType = block.dataset.blockType;
    if (!blockType || !blockDefinitions[blockType]) return;

    const def = blockDefinitions[blockType];

    // c-block or reporter or normal?
    if (def.block_type === "c-block") {
      block.classList.add("c-block");
      // Re-enable drag-drop on the inner container
      const inner = block.querySelector(".inner");
      if (inner) {
        inner.ondragover = e => e.preventDefault();
        inner.ondrop = e => {
          e.preventDefault();
          e.stopPropagation();
          const nestedType = e.dataTransfer.getData("blockType");
          if (nestedType) {
            const newChildBlock = createBlockElement(nestedType, true);
            inner.appendChild(newChildBlock);
          }
        };
        reinitLoadedBlocks(inner);
      }
    }
    else if (def.block_type === "reporter") {
      block.classList.add("workspace-reporter");
    } 
    else {
      block.classList.add("workspace-block");
    }

    // If it's in the workspace, add a delete button if missing (but not for reporters)
    if (!block.querySelector(".delete-button") && def.block_type !== "reporter") {
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.innerText = "X";
      deleteButton.onclick = () => block.remove();
      block.appendChild(deleteButton);
    }

    // Re-enable draggable + snapping
    makeDraggableAndSnappable(block);
  });
}

/* =============================
   Make block draggable + snap to grid
   ============================= */
function makeDraggableAndSnappable(block) {
  block.draggable = true;

  let offsetX = 0, offsetY = 0;

  block.addEventListener("dragstart", (e) => {
    // e.offsetX/Y inside the block
    offsetX = e.offsetX;
    offsetY = e.offsetY;
  });

  block.addEventListener("dragend", (e) => {
    const workspace = document.getElementById("workspace");
    
    // Coordinates relative to the workspace container
    const bounds = workspace.getBoundingClientRect();
    let x = e.pageX - bounds.left - offsetX;
    let y = e.pageY - bounds.top - offsetY;
    
    // Snap to 20px grid
    const gridSize = 20;
    x = Math.round(x / gridSize) * gridSize;
    y = Math.round(y / gridSize) * gridSize;

    // Constrain to workspace boundaries (optional)
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    const maxX = workspace.scrollWidth - block.offsetWidth;
    const maxY = workspace.scrollHeight - block.offsetHeight;
    if (x > maxX) x = maxX;
    if (y > maxY) y = maxY;

    // Position absolutely
    block.style.position = "absolute";
    block.style.left = x + "px";
    block.style.top = y + "px";

    // Ensure the block stays a direct child of #workspace
    if (block.parentNode !== workspace) {
      workspace.appendChild(block);
    }
  });
}