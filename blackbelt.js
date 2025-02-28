// blackbelt.js

/**
 * dropBlock() is called from the HTML: ondrop="dropBlock(event, document.getElementById('workspace'))"
 * We'll place the new block at the mouse location, then snap it to the grid.
 */
function dropBlock(event, dropTarget) {
    event.preventDefault();
    const blockType = event.dataTransfer.getData("blockType");
    if (blockType) {
      // We'll create the block in main.js's createBlockElement
      const newBlock = createBlockElement(blockType, true);
      dropTarget.appendChild(newBlock);
  
      // Figure out where the user dropped it
      const wsRect = dropTarget.getBoundingClientRect();
      const x = event.clientX - wsRect.left;
      const y = event.clientY - wsRect.top;
  
      // Snap to grid
      const [gx, gy] = snapToGrid(x, y);
      newBlock.style.position = "absolute";
      newBlock.style.left = gx + "px";
      newBlock.style.top = gy + "px";
    }
  }
  
  /**
   * snapToGrid(x, y) returns [xSnap, ySnap]
   * If each grid cell is 40px, we compute the nearest multiple of 40
   */
  function snapToGrid(x, y) {
    const gridSize = 40;
    const snapX = Math.round(x / gridSize) * gridSize;
    const snapY = Math.round(y / gridSize) * gridSize;
    return [snapX, snapY];
  }
  
  /**
   * reinitLoadedBlocks(container) – called after loading from URL or whenever
   * we recreate the DOM. We'll make .workspace-block and .c-block draggable
   * with the same grid snapping approach, plus handle mouse events for repositioning.
   */
  function reinitLoadedBlocks(container) {
    // Find all blocks in the workspace
    container.querySelectorAll(".workspace-block, .c-block, .workspace-reporter").forEach(block => {
      const blockType = block.dataset.blockType;
      // If the block has no recognized definition, skip
      if (!blockType || !window.blockDefinitions[blockType]) return;
      
      // We can keep the "delete button if missing" logic if needed,
      // but that's already in main.js.
  
      // Mark them with absolute positioning if not already
      if (!block.style.position) {
        block.style.position = "absolute";
        // Optionally default them to (0,0)
        if (!block.style.left) block.style.left = "0px";
        if (!block.style.top) block.style.top = "0px";
      }
  
      // Make them draggable in a 2D sense via pointer events or a drag library
      // For simplicity, let's rely on the built-in drag & drop approach:
      // block.draggable = true; // We can do it here if we want 2D moves
      // but we want "snap after move"? That requires custom logic or a library.
  
      // Alternatively, we rely on "dragstart" from the code in createBlockElement
      // but we handle 'dragend' here to snap on drop.
      // For a simpler approach, let's do something like pointerdown events:
      makeBlockDraggable(block);
    });
  }
  
  /**
   * makeBlockDraggable(block): A simple custom approach to do a "pointerdown, move around, pointerup" in #workspace
   * Then we snap to grid on release. 
   *
   * This is an alternative to HTML5 drag & drop. 
   * 
   * If you prefer HTML5 drag & drop, you'd rely on ondragstart, ondrag, ondragend. 
   * But it's often tricky to keep the block at the correct position in the workspace.
   */
  function makeBlockDraggable(block) {
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
  
    block.addEventListener("pointerdown", (ev) => {
      // If user clicked on an input field or delete button, skip
      const tag = ev.target.tagName.toLowerCase();
      if (tag === "input" || ev.target.classList.contains("delete-button")) {
        return;
      }
      // Start dragging
      dragging = true;
      block.setPointerCapture(ev.pointerId);
  
      // Calculate offset inside the block
      const rect = block.getBoundingClientRect();
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
    });
  
    block.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const workspace = document.getElementById("workspace");
      const wsRect = workspace.getBoundingClientRect();
  
      // Current mouse position relative to workspace
      const x = ev.clientX - wsRect.left - offsetX;
      const y = ev.clientY - wsRect.top - offsetY;
  
      // Move block instantly (no snap while moving)
      block.style.left = x + "px";
      block.style.top = y + "px";
    });
  
    block.addEventListener("pointerup", (ev) => {
      if (!dragging) return;
      dragging = false;
      block.releasePointerCapture(ev.pointerId);
  
      // Snap to grid
      const currentLeft = parseInt(block.style.left, 10) || 0;
      const currentTop  = parseInt(block.style.top, 10) || 0;
      const [gx, gy] = snapToGrid(currentLeft, currentTop);
      block.style.left = gx + "px";
      block.style.top  = gy + "px";
    });
  }