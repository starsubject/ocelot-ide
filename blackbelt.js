// blackbelt.js

/**
 * Overriding the old legacy dropBlock by the same name in HTML:
 *   ondrop="dropBlock(event, document.getElementById('workspace'))"
 * We'll do a grid snap approach.
 */
function dropBlock(event, dropTarget) {
    event.preventDefault();
    const blockType = event.dataTransfer.getData("blockType");
    if (!blockType) return;
  
    const newBlock = createBlockElement(blockType, true);
    dropTarget.appendChild(newBlock);
  
    // Place at mouse coords
    const wsRect = dropTarget.getBoundingClientRect();
    const x = event.clientX - wsRect.left;
    const y = event.clientY - wsRect.top;
  
    // Snap to 40px grid
    const [gx, gy] = snapToGrid(x, y);
    newBlock.style.position = "absolute";
    newBlock.style.left = gx + "px";
    newBlock.style.top = gy + "px";
  }
  
  /**
   * snapToGrid(x, y) returns [snapX, snapY]
   */
  function snapToGrid(x, y) {
    const grid = 40;
    const sx = Math.round(x / grid) * grid;
    const sy = Math.round(y / grid) * grid;
    return [sx, sy];
  }
  
  /**
   * Called from main.js reinitLoadedBlocks() if it sees "typeof blackbeltReinit2D === 'function'".
   * We'll iterate all workspace-blocks, and make them absolutely positioned with pointer-based dragging.
   */
  function blackbeltReinit2D(container) {
    // We'll find all .workspace-block, .c-block that do not have a parent .c-block
    // and make them absolutely positioned. Then we add pointerdown logic for dragging.
    const blocks = container.querySelectorAll(".workspace-block, .c-block");
    blocks.forEach(block => {
      // If block is nested inside another block, skip or handle differently
      // For simplicity, let's do it for all:
      block.style.position = "absolute";
  
      // If no left/top set, place them at 0,0 or keep them where they are
      if (!block.style.left) block.style.left = "0px";
      if (!block.style.top)  block.style.top = "0px";
  
      makeBlockDraggable(block);
    });
  }
  
  /**
   * Basic pointer-based drag approach with grid snap on pointerup.
   */
  function makeBlockDraggable(block) {
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
  
    block.addEventListener("pointerdown", (ev) => {
      // skip if user clicked an input, button, or delete button
      const tag = ev.target.tagName.toLowerCase();
      if (tag === "input" || ev.target.classList.contains("delete-button")) return;
  
      dragging = true;
      block.setPointerCapture(ev.pointerId);
  
      const rect = block.getBoundingClientRect();
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
    });
  
    block.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const workspace = document.getElementById("workspace");
      const wsRect = workspace.getBoundingClientRect();
  
      const x = ev.clientX - wsRect.left - offsetX;
      const y = ev.clientY - wsRect.top - offsetY;
  
      block.style.left = x + "px";
      block.style.top  = y + "px";
    });
  
    block.addEventListener("pointerup", (ev) => {
      if (!dragging) return;
      dragging = false;
      block.releasePointerCapture(ev.pointerId);
  
      // Snap
      const left = parseInt(block.style.left, 10) || 0;
      const top  = parseInt(block.style.top, 10) || 0;
      const [gx, gy] = snapToGrid(left, top);
      block.style.left = gx + "px";
      block.style.top  = gy + "px";
    });
  }