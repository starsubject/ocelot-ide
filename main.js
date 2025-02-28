// main.js

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
  clonedWorkspace.querySelectorAll("img").forEach(img => {
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
const openManagerBtn = document.getElementById("open-costume-manager");
const costumeManager = document.getElementById("costume-manager");
const costumeList = document.getElementById("costume-list");
const addCostumeBtn = document.getElementById("add-costume-btn");
const closeCostumeBtn = document.getElementById("close-costume-btn");

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

function pickCostume(c) {
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
}

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
  // Instead of "list" top-level blocks, we’ll find any block with no parent stack
  // i.e., not nested inside another block
  const workspace = document.getElementById("workspace");
  const allBlocks = workspace.querySelectorAll(".workspace-block, .c-block");

  // We'll gather "root blocks" that are at top-level
  const rootBlocks = [];
  allBlocks.forEach(block => {
    // If it doesn't have a parent .workspace-block or .c-block, it's a root
    const parentStack = block.closest(".workspace-block, .c-block");
    if (!parentStack || parentStack === block) {
      rootBlocks.push(block);
    }
  });

  // Now each rootBlock is effectively a "thread"
  let realCodeAll = "let __globalSafetyCount = 0;\n";
  let displayCodeAll = "";

  // Clear the canvas if any
  const canvas = document.getElementById("graphics-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Build up the code from each root block
  rootBlocks.forEach(block => {
    const { realCode, displayCode } = executeBlock(block, 0);
    // We'll do them "in parallel" by simply concatenating code. 
    // Another approach is to wrap each in a function and call them asynchronously.
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
}

/* =============================
   2D DRAG & SNAP LOGIC
   ============================= */

/*
   We'll track current drag state. 
   - dragBlock: the element being dragged
   - offsetX/offsetY: the pointer offset inside block
*/
let dragBlock = null;
let offsetX = 0;
let offsetY = 0;

function onMouseMove(e) {
  if (!dragBlock) return;

  // Move the block with the mouse
  const workspaceRect = document.getElementById("workspace").getBoundingClientRect();
  const x = e.clientX - workspaceRect.left - offsetX;
  const y = e.clientY - workspaceRect.top - offsetY;

  // Set block's position
  dragBlock.style.left = x + "px";
  dragBlock.style.top = y + "px";

  // Possibly highlight potential snap targets
  highlightSnapTarget(dragBlock);
}

function onMouseUp() {
  if (dragBlock) {
    // Attempt to snap
    snapToClosest(dragBlock);
    dragBlock = null;
  }
}

document.addEventListener("mousemove", onMouseMove);
document.addEventListener("mouseup", onMouseUp);

function makeBlockDraggable(block) {
  // Because we use absolute positioning in #workspace
  // we ensure the block is position:absolute
  block.style.position = "absolute";

  // If block doesn't have a stored position yet, place it randomly
  if (!block.style.left) {
    block.style.left = "50px";
    block.style.top = "50px";
  }

  block.addEventListener("mousedown", (e) => {
    // Only start drag if user isn't clicking an input, button, etc.
    // We'll skip drag if e.target is a form element or the delete button
    if (e.target.tagName === "INPUT" || e.target.classList.contains("delete-button")) {
      return;
    }
    // Start dragging
    dragBlock = block;
    const blockRect = block.getBoundingClientRect();
    offsetX = e.clientX - blockRect.left;
    offsetY = e.clientY - blockRect.top;
  });
}

/* 
   highlightSnapTarget: show a slight highlight on the block
   that this block is near enough to snap onto 
   (In real Scratch, you'd handle multiple potential connection points.)
*/
function highlightSnapTarget(movingBlock) {
  // We do a simple approach: 
  // look for the closest block below the moving block
  const workspace = document.getElementById("workspace");
  const blocks = workspace.querySelectorAll(".workspace-block, .c-block");
  
  let bestTarget = null;
  let bestDist = 99999;

  const mbRect = movingBlock.getBoundingClientRect();

  blocks.forEach(b => {
    if (b === movingBlock) return; // skip self
    const rect = b.getBoundingClientRect();
    // We'll consider "snap" if the bottom of b is near the top of movingBlock
    // or vice versa. This is naive but demonstrates the idea.

    const dy = (rect.bottom) - mbRect.top; 
    // if the block's bottom is near the top of the moving block
    const dx = Math.abs((rect.left + rect.width/2) - (mbRect.left + mbRect.width/2));

    // If they're roughly aligned horizontally and close vertically
    if (dy > -20 && dy < 20 && dx < 50) {
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = b;
      }
    }
  });

  // remove old highlight
  blocks.forEach(b => b.classList.remove("snap-highlight"));

  if (bestTarget) {
    bestTarget.classList.add("snap-highlight");
  }
}

/* 
   snapToClosest: finalize the snap once user mouseups
*/
function snapToClosest(movingBlock) {
  const workspace = document.getElementById("workspace");
  const blocks = workspace.querySelectorAll(".workspace-block, .c-block");
  
  let bestTarget = null;
  let bestDist = 99999;
  const mbRect = movingBlock.getBoundingClientRect();
  const wsRect = workspace.getBoundingClientRect();

  blocks.forEach(b => {
    if (b === movingBlock) return;
    const rect = b.getBoundingClientRect();
    const dy = (rect.bottom) - mbRect.top;
    const dx = Math.abs((rect.left + rect.width/2) - (mbRect.left + mbRect.width/2));

    if (dy > -20 && dy < 20 && dx < 50) {
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = b;
      }
    }
  });

  // remove highlight
  blocks.forEach(b => b.classList.remove("snap-highlight"));

  if (bestTarget) {
    // Snap the top of movingBlock to the bottom of bestTarget
    const tRect = bestTarget.getBoundingClientRect();
    const newLeft = (tRect.left + tRect.width/2) - (mbRect.width/2);
    const newTop  = tRect.bottom; 
    // convert from screen coords to workspace coords
    const finalLeft = newLeft - wsRect.left;
    const finalTop = newTop - wsRect.top;

    movingBlock.style.left = finalLeft + "px";
    movingBlock.style.top  = finalTop + "px";

    // Optionally you could re-parent the block in DOM under the target 
    // if you want to show them connected, etc.
    // But for a "scratch-like" approach, 
    // you'd do a more advanced approach with child-lists, etc.
  }
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
    // ... (unchanged from your original logic) ...
    // For brevity, we skip the reporter code listing
    // (the old code remains the same)
    // We'll just keep the relevant part about returning the block
    block.className = isWorkspaceBlock ? "workspace-reporter" : "reporter-block";
    // (rest of your existing reporter logic)
    // ...
    return block; // after building inputs, etc.
  }

  // If it's a C-block (like "repeat" or "forever")
  if (blockData.block_type === "c-block") {
    // ... (unchanged from your original logic) ...
    // We still set block.className = "c-block"
    // build input area, .inner container, etc.
    block.className = "c-block";
    // ...
    return block;
  }

  // Otherwise, it's a normal (stack) block
  block.className = isWorkspaceBlock ? "workspace-block" : "block";

  // Build the inputs (same as original)
  const inputArea = document.createElement("div");
  inputArea.classList.add("block-inputs");
  // ... build each input according to blockData.format ...
  // ... identical to your original approach ...
  block.appendChild(inputArea);

  // If it's in the workspace, add a delete button if not reporter
  if (isWorkspaceBlock && blockData.block_type !== "reporter") {
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.innerText = "X";
    deleteButton.onclick = () => block.remove();
    block.appendChild(deleteButton);

    // The new part: make it draggable in 2D
    makeBlockDraggable(block);
  } else if (!isWorkspaceBlock) {
    // Toolbox version: draggable only, but we have a special approach:
    // We'll let the user drag from the toolbox to the workspace
    block.draggable = true;
    block.ondragstart = (ev) => {
      ev.dataTransfer.setData("blockType", blockType);
    };
  }

  return block;
}

/* =============================
   Drop handler for workspace
   Now we place the block at the mouse position in #workspace
   ============================= */
function dropBlock(event, dropTarget) {
  event.preventDefault();
  const blockType = event.dataTransfer.getData("blockType");
  if (blockType) {
    const newBlock = createBlockElement(blockType, true);
    dropTarget.appendChild(newBlock);

    // Position it at drop location
    // We must convert pageX/Y to #workspace coordinates
    const wsRect = dropTarget.getBoundingClientRect();
    const x = event.clientX - wsRect.left;
    const y = event.clientY - wsRect.top;

    newBlock.style.position = "absolute";
    newBlock.style.left = x + "px";
    newBlock.style.top = y + "px";
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
    absolute positioning, drag+drop, etc.)
   ============================= */
function reinitLoadedBlocks(container) {
  container.querySelectorAll(".workspace-block, .c-block, .workspace-reporter").forEach(block => {
    const blockType = block.dataset.blockType;
    if (!blockType || !blockDefinitions[blockType]) return;

    const def = blockDefinitions[blockType];

    if (def.block_type === "c-block") {
      block.classList.add("c-block");
      // Re-enable drag-drop on the .inner container
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
            // Place at 0,0 or so
            newChildBlock.style.position = "relative";
            newChildBlock.style.left = "0px";
            newChildBlock.style.top = "0px";
          }
        };
        reinitLoadedBlocks(inner);
      }
    } else if (def.block_type === "reporter") {
      block.classList.add("workspace-reporter");
    } else {
      block.classList.add("workspace-block");
      makeBlockDraggable(block);
    }

    // If it's in the workspace, add a delete button if missing (but not for reporters)
    if (!block.querySelector(".delete-button") && def.block_type !== "reporter") {
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.innerText = "X";
      deleteButton.onclick = () => block.remove();
      block.appendChild(deleteButton);
    }
  });
}