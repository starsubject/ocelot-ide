window.blockDefinitions = {
  print: {
    block_type: "normal",
    format: ["Print", "input1"],
    input1_default: "Hello World!",
    execute: (inputs, childData, depth) => {
      const code = `console.log(${JSON.stringify(inputs.input1)});`;
      return {
        realCode: code,
        displayCode: code
      };
    },
  },
  alert: {
    block_type: "normal",
    format: ["Alert", "input1"],
    input1_default: "Hi!",
    execute: (inputs, childData, depth) => {
      return {
        realCode: `(() => alert(${JSON.stringify(inputs.input1)}))();`, 
        displayCode: `alert(${JSON.stringify(inputs.input1)});`
      };
    },
  },

  alert2: {
    block_type: "reporter",
    format: ["Value", "input1"],
    input1_default: 5,
    execute: (inputs, childData, depth) => {
      return {
        realCode: String(inputs.input1),
        displayCode: String(inputs.input1),
      };
    },
  },

  confirm: {
    block_type: "normal",
    format: ["Confirm", "input1"],
    input1_default: "Hi!",
    execute: (inputs, childData, depth) => {
      const code = `window.confirm(${JSON.stringify(inputs.input1)});`;
      return {
        realCode: code,
        displayCode: code
      };
    },
  },

  prompt: {
    block_type: "normal",
    format: ["Prompt", "input1"],
    input1_default: "Hello world!",
    execute: (inputs, childData, depth) => {
      const code = `window.prompt(${JSON.stringify(inputs.input1)});`;
      return {
        realCode: code,
        displayCode: code
      };
    },
  },

  repeat: {
    block_type: "c-block",
    // We'll explicitly show the input with "Repeat", "input1", "times"
    format: ["Repeat", "input1", "times"],
    input1_default: "3",
    execute: (inputs, childData, depth) => {
      let count = parseInt(inputs.input1, 10);
      if (isNaN(count)) count = 0; 
      const iVar = "i" + depth;
      const childReal = childData.map(cd => cd.realCode).join("\n");

      const realCode = `
{
  let __globalSafetyCount = 0; 
  for (let ${iVar} = 0; ${iVar} < ${count}; ${iVar}++) {
    __globalSafetyCount++;
    if (__globalSafetyCount > 5000) {
      console.warn("Global safety break triggered in repeat");
      break;
    }
    ${childReal}
  }
}
      `.trim();

      return {
        realCode,
        displayCode: realCode
      };
    },
  },

  forever: {
    block_type: "c-block",
    format: ["Forever do"],
    execute: (inputs, childData, depth) => {
      const childReal = childData.map(cd => cd.realCode).join("\n");

      const realCode = `
while (true) {
  __globalSafetyCount++;
  if (__globalSafetyCount > 5000) {
    console.warn("Global safety break triggered in forever");
    break;
  }
  ${childReal}
}
      `.trim();

      return {
        realCode,
        displayCode: realCode
      };
    },
  },

  add_sprite: {
    block_type: "normal",
    format: ["Add Sprite", "imageinput1"],
    imageinput1_default: "No costume selected",
    execute: (inputs, childData, depth) => {
      return {
        realCode: `
{
  let found = costumes.find(ct => ct.name === ${JSON.stringify(inputs.imageinput1)});
  if (!found) {
    console.warn("Costume not found:", ${JSON.stringify(inputs.imageinput1)});
  } else {
    let canvas = document.getElementById("graphics-canvas");
    if (canvas) {
      let ctx = canvas.getContext("2d");
      let imageObj = new Image();
      imageObj.src = found.data;

      imageObj.onload = function() {
        let x = Math.max(10, Math.random() * (canvas.width - 110));
        let y = Math.max(10, Math.random() * (canvas.height - 110));
        ctx.drawImage(imageObj, x, y, 100, 100);
      };

      imageObj.onerror = function() {
        console.warn("Failed to load image:", ${JSON.stringify(inputs.imageinput1)});
      };
    } else {
      console.warn("Canvas not found! Cannot draw sprite.");
    }
  }
}
        `.trim(),
        displayCode: `(() => {
let found = costumes.find(ct => ct.name === ${JSON.stringify(inputs.imageinput1)});
if (!found) {
  console.warn("Costume not found:", ${JSON.stringify(inputs.imageinput1)});
} else {
  let canvas = document.getElementById("graphics-canvas");
  if (canvas) {
    let ctx = canvas.getContext("2d");
    let imageObj = new Image();
    imageObj.src = found.data;

    imageObj.onload = function() {
      let x = Math.max(10, Math.random() * (canvas.width - 110));
      let y = Math.max(10, Math.random() * (canvas.height - 110));
      ctx.drawImage(imageObj, x, y, 100, 100);
    };

    imageObj.onerror = function() {
      console.warn("Failed to load image:", ${JSON.stringify(inputs.imageinput1)});
    };
  } else {
    console.warn("Canvas not found! Cannot draw sprite.");
  }
}
})();`
      };
    }
  },
};