// main.js

// We assume "window.blockDefinitions" is already set 
// by blockDefinitions.js (which is loaded first in index.html).
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

      // AFTER LOADING: RE-INIT BLOCKS (2D drag logic in blackbelt.js)
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

  // A quick check if #workspace vanished
  setTimeout(() => {
    if (!document.getElementById("workspace")) {
      console.warn("Workspace disappeared! Restoring UI...");
      location.reload();
    }
  }, 500);
}

/* =============================
   Input extraction
   (Supports reporter blocks, etc.)
   ============================= */
function getInputs(block) {
  const inputs = {};

  // Only get the direct .block-inputs container for this block
  const parentBlockInputs = block.querySelector(":scope > .block-inputs");
  if (!parentBlockInputs) return inputs;

  // Within that container, find all .input-wrapper
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
      // Just a normal text input
      const textInput = wrapper.querySelector("input");
      inputs[inputName] = textInput ? textInput.value : "";
    }
  });

  return inputs;
}

/* =============================
   Create DOM element for a block (no 2D drag logic here)
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
    block.className = isWorkspaceBlock ? "workspace-reporter" : "reporter-block";
    block.style.borderRadius = "10px";
    block.style.padding = "5px 10px";
    block.style.backgroundColor = "#3498db";
    block.style.color = "white";
    block.style.cursor = "pointer";
    block.style.display = "inline-block";
    block.style.position = "relative";
    // Build the input placeholders, etc. (unchanged)
    // ...
    // (omitted for brevity – same as your code)
    return block;
  }

  // If it's a C-block (like "repeat" or "forever")
  if (blockData.block_type === "c-block") {
    block.className = "c-block";
    // Build c-block inputs, .inner container, etc. (same as your code)
    // ...
    return block;
  }

  // Otherwise, a normal (stack) block
  block.className = isWorkspaceBlock ? "workspace-block" : "block";

  // Build the input area (same as your code)
  const inputArea = document.createElement("div");
  inputArea.classList.add("block-inputs");
  // ...
  block.appendChild(inputArea);

  // If it's in the workspace, add a delete button if not reporter
  if (isWorkspaceBlock && blockData.block_type !== "reporter") {
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.innerText = "X";
    deleteButton.onclick = () => block.remove();
    block.appendChild(deleteButton);
  } else if (!isWorkspaceBlock) {
    // Toolbox version: just draggable
    // We'll still let blackbelt.js do the real 2D dragging in the workspace
    block.draggable = true;
    block.ondragstart = (ev) => {
      ev.dataTransfer.setData("blockType", blockType);
    };
  }

  return block;
}

/* =============================
   We'll let blackbelt.js handle dropping and 2D re-init
   ============================= */