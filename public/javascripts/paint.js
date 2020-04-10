const paint = {
  texture: 0,
  mode: 'fog',
  type: 'brush',
  size: {
    val: 10,
    MIN: 2,
    MAX: 100,
    set(v) { this.val = Math.min(Math.max(v, this.MIN), this.MAX); }
  },
  blend: {
    val: 100,
    MIN: 0,
    MAX: 100,
    set(v) { this.val = Math.min(Math.max(v, this.MIN), this.MAX); }
  }
};

function setPaint(primary, secondary) {
  mapP5.setSpecificMode('paint');

  switch (primary) {
    case 'texture':
      if (paint.mode === 'fog' && secondary > 1) {
        paint.texture = 1;
      } else {
        paint.texture = secondary;
      }

      document.getElementById(`texture-${paint.texture}`).checked = true;
      break;
    case 'mode': // fog texture
      switch (secondary) {
        case 'fog':
          if (paint.texture !== 0) setPaint('texture', 1);
        case 'texture':
          paint.mode = secondary;
          $('select#paint-mode').val(secondary);
          break;
      }
      break;
    case 'type': // brush fill
      paint.type = secondary;
      $('select#paint-type').val(secondary);
      break;
    case 'size':
      paint.size.set(secondary);
      $('input#brush-size').val(paint.size.val);
      $('label#brush-size-label').text(paint.size.val);
      break;
    case 'blend':
      paint.blend.set(secondary);
      $('input#brush-blend').val(paint.blend.val);
      $('label#brush-blend-label').text(paint.blend.val);
      break;
  }
}

const paintP5 = new p5(sketch => {
  const view = {
    width: 200,
    height: 200,
    spacing: 10 // TODO: reference map view spacing
  };

  const textures = {
    COUNT: 0,
    names: [],
    images: []
  };

  sketch.preload = () => {
    // Load media
    // Textures
    sketch.loadJSON(`${MEDIA_MAPS}textures/textures.json`,   data => {
      const dataKeys = Object.keys(data);
  
      textures.COUNT = dataKeys.length;
      textures.names = new Array(dataKeys.length);
      textures.images = new Array(dataKeys.length);
  
      for (key of dataKeys) {
        textures[key] = data[key][0];
        textures.names[textures[key]] = data[key][1];
        if (data[key][2] === null) {
          textures.images[textures[key]] = null;
        } else {
          if (DEBUG) console.log(`paint loading ${data[key][2]}`);
          textures.images[textures[key]] = sketch.loadImage(MEDIA_MAPS + 'textures/' + data[key][2]);
        }
      }
    });
  }

  sketch.setup = () => {
    const canvas = sketch.createCanvas(view.width, view.height);
    canvas.parent('#paint');
    canvas.class('mx-auto');
  };

  // TODO: Use calls to draw instead of loop
  sketch.draw = () => {
    sketch.clear();

    // Grid
    const offset = paint.type === 'fill' ? view.spacing / 2 : 0;
    sketch.strokeWeight(1);
    sketch.stroke(0, 0, 0);
    for (let i = offset; i <= view.width; i += view.spacing) {
      sketch.line(i, 0, i, view.height);
    }
    for (let j = offset; j <= view.height; j += view.spacing) {
      sketch.line(0, j, view.width, j);
    }

    // Texture
    const texture = sketch.createImage(view.width, view.height);
    const paintSize = paint.size.val * 2;
    const blendSize = paint.blend.val / 100 * paintSize;
    const image = textures.images[paint.texture];

    texture.loadPixels();
    image.loadPixels();

    if (paint.type === 'brush') {
      sketch.randomSeed(blendSize);

      for (let x = 0; x < texture.width; ++x) {
        for (let y = 0; y < texture.height; ++y) {
          const index = 4 * (y * texture.width + x);
          const dist = Math.sqrt((x - texture.width / 2) ** 2 + (y - texture.height / 2) ** 2) * 2;
          if (dist <= paintSize) {
            if (paint.mode === 'texture' && dist > blendSize) {
              const prob = (dist - blendSize) / (paintSize - blendSize);
              if (sketch.random() < prob) continue;
            }
            const tx = x % image.width;
            const ty = y % image.height;
            const tindex = 4 * (ty * image.width + tx);

            texture.pixels[index] = image.pixels[tindex];
            texture.pixels[index + 1] = image.pixels[tindex + 1];
            texture.pixels[index + 2] = image.pixels[tindex + 2];
            texture.pixels[index + 3] = image.pixels[tindex + 3];
          } else {
            texture.pixels[index] = 0;
            texture.pixels[index + 1] = 0;
            texture.pixels[index + 2] = 0;
            texture.pixels[index + 3] = 0;
          }
        }
      }
    } else if (paint.type === 'fill') {
      for (let x = texture.width / 2 - 5; x < texture.width / 2 + 5; ++x) {
        for (let y = texture.height / 2 - 5; y < texture.height / 2 + 5; ++y) {
          const index = 4 * (y * texture.width + x);
          const tx = x % image.width;
          const ty = y % image.height;
          const tindex = 4 * (ty * image.width + tx);

          texture.pixels[index] = image.pixels[tindex];
          texture.pixels[index + 1] = image.pixels[tindex + 1];
          texture.pixels[index + 2] = image.pixels[tindex + 2];
          texture.pixels[index + 3] = image.pixels[tindex + 3];
        }
      }
    }

    texture.updatePixels();

    sketch.image(texture, 0, 0);

    if (paint.type === 'brush') {
      if (paint.mode === 'texture') {
        // Blend
        sketch.ellipseMode(sketch.CENTER);
        sketch.noFill();
        sketch.stroke(0, 0, 255);
        sketch.strokeWeight(2);
        sketch.circle(view.width / 2, view.height / 2, blendSize);
      }

      // Brush
      sketch.ellipseMode(sketch.CENTER);
      sketch.noFill();
      sketch.stroke(0);
      sketch.strokeWeight(2);
      sketch.circle(view.width / 2, view.height / 2, paintSize);
    }
  };
});