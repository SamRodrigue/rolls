const mapP5 = new p5(sketch => {
  const update = {
    texture: null,
    fog: null,

    set(trgt) {
      switch (trgt) {
        case 'walls':
        case 'entities':
        case 'assets':
        case 'lines':
          send(trgt);
          return;
        case 'texture':
        case 'fog':
          clearTimeout(this[trgt]);
          this[trgt] = setTimeout(send, 1000, trgt);
          return;
      }
    }
  };

  const map = {
    width: 150,
    height: 150,
    grid: {
      spacing: 5
    },
    texture: {
      width: null, // to be calculated
      height: null, // to be calculated
      val: [[]],
      image: {},
      scale: 0.25
    },
    fog: {
      width: null, // to be calculated
      height: null, // to be calculated
      val: [[]],
      image: {},
      scale: 0.25
    },
    wall: {
      spacing: 2.5,
      width: 1,
      scale: 0.05
    },
    entity: {
      scale: 0.025
    },
    asset: {
      scale: 0.033,
      step: 45
    },
    cursor: {
      scale: 1.75
    },

    share:    true,
    walls:    [],
    entities: [],
    assets:   [],
    lines:    {}
  };

  const view = {
    width: 680,
    height: 480,
    x: 0,
    y: 0,
    grid: true,
    zoom: {
      val: 10,
      MIN: 0.5,
      MAX: 20,
      set(v) {
        const prev = this.val;
        this.val = sketch.constrain(v, this.MIN, this.MAX);

        if (prev !== this.val) {
          const ratio = prev / this.val;
          view.x = (view.x - view.mx) * ratio + view.mx;
          view.y = (view.y - view.my) * ratio + view.my;
        }
      }
    },
    mx: 0,
    my: 0
  };

  const modes = {
    NONE:   0,
    WALL:   1,
    ENTITY: 2,
    ASSET:  3,
    DRAW:   4,
    ERASE:  5,
    PAINT:  6,
    COUNT:  7
  };

  const mode = {
    loaded: false,
    primary: modes.NONE,
    secondary: null,
    ctrl: false,
    shift: false,
    dragging: {
      val: false,
      old: null,
      time: 0,
      rate: {
        slow: 50, // ms
        fast: 10 // ms
      }
    },
    moving: null,

    do: {
      map() { // Drag
        view.x += (sketch.pmouseX - sketch.mouseX) / view.zoom.val;
        view.y += (sketch.pmouseY - sketch.mouseY) / view.zoom.val;
        view.x = sketch.constrain(view.x, 0, map.width);
        view.y = sketch.constrain(view.y, 0, map.height);
      },

      wall() { // Press
        if (mode.secondary < 0 || mode.secondary >= walls.COUNT) return;

        const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
        const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

        if (mode.moving instanceof Wall) { // Complete wall
          if (mode.moving.end(wx, wy)) {
            // Add new wall
            map.walls.push(mode.moving);

            if (mode.ctrl) { // Start new wall
              mode.moving = new Wall(mode.secondary, wx, wy);
            } else {
              sketch.setMode(modes.NONE);
              mode.moving = null;
            }

            update.set('walls');
          }
        } else { // Start new wall
          mode.moving = new Wall(mode.secondary, wx, wy);
        }
      },

      entity() { // Press
        if (!(mode.moving instanceof Entity)) return;

        const entity = mode.moving;
        entity.x = view.mx;
        entity.y = view.my;

        map.entities.push(entity);

        // Create new entity
        if (mode.ctrl) {
          mode.moving = new Entity(entity);
        } else {
          sketch.setMode(modes.NONE);
          mode.moving = null;
        }

        update.set('entities');
      },

      asset() { // Press
        if (!(mode.moving instanceof Asset)) return;

        const asset = mode.moving;
        asset.x = view.mx;
        asset.y = view.my;

        map.assets.push(asset);

        if (mode.ctrl) {
          mode.moving = new Asset(asset);
        } else {
          sketch.setMode(modes.NONE);
          mode.moving = null;
        }

        update.set('assets');
      },

      hover() {
        // Entity
        for (let i = map.entities.length - 1; i >= 0; --i) {
          if (user.id === map.entities[i].user.id) {
            if (map.entities[i].contains(view.mx, view.my)) {
              return { type: modes.ENTITY, index: i };
            }
          }
        }

        if (user.role === 'admin') {
          // Entity
          for (let i = map.entities.length - 1; i >= 0; --i) {
            if (map.entities[i].contains(view.mx, view.my)) {
              return { type: modes.ENTITY, index: i };
            }
          }

          // Asset
          for (let i = map.assets.length - 1; i >= 0; --i) {
            if (map.assets[i].contains(view.mx, view.my)) {
              return { type: modes.ASSET, index: i };
            }
          }

          // Wall
          for (let i = map.walls.length - 1; i >= 0; --i) {
            if (map.walls[i].contains(view.mx, view.my)) {
              return { type: modes.WALL, index: i };
            }
          }
        }

        return null;
      },

      move(hover = this.hover()) { // Press
        if (hover === null) return;

        let selected = null;
        switch (hover.type) {
          case modes.ENTITY:
            selected = map.entities.splice(hover.index, 1)[0];
            update.set('entities');
            break;
          case modes.ASSET:
            selected = map.assets.splice(hover.index, 1)[0];
            update.set('assets');
            break;
          case modes.WALL:
            // Determine which end is closest
            selected = map.walls.splice(hover.index, 1)[0];

            const d0 = (view.mx - selected.x[0]) ** 2 + (view.my - selected.y[0]) ** 2;
            const d1 = (view.mx - selected.x[1]) ** 2 + (view.my - selected.y[1]) ** 2;

            if (d0 > d1) {
              selected = new Wall(selected.type, selected.x[0], selected.y[0]);
            } else {
              selected = new Wall(selected.type, selected.x[1], selected.y[1]);
            }

            update.set('walls');
            break;
        }

        mode.secondary = selected.type;
        mode.moving = selected;
        sketch.setMode(hover.type, hover.type !== modes.WALL);
      },

      draw(dragging) { // Drag
        // TODO: Implemente polyline simplification
        //       https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm
        if (dragging) {
          if (!mode.dragging.val) {
            // First point
            mode.dragging.val = true;
            mode.dragging.old = { x: view.mx, y: view.my }
          } else { // Add point
            const time = new Date().getTime();

            // Send new line to server
            if (!map.lines.hasOwnProperty(user.id)) {
              map.lines[user.id] = [];
            }

            map.lines[user.id].push({
              prev: mode.dragging.old,
              curr: { x: view.mx, y: view.my },
              time
            });

            update.set('lines');

            mode.dragging.old = { x: view.mx, y: view.my };
          }
        } else {
          if (mode.dragging.val) { // Last point
            const time = new Date().getTime();

            // Send new line to server
            if (!map.lines.hasOwnProperty(user.id)) {
              map.lines[user.id] = [];
            }

            map.lines[user.id].push({
              prev: mode.dragging.old,
              curr: { x: view.mx, y: view.my },
              time
            });

            update.set('lines');

            mode.dragging.val = false;
            mode.dragging.old = null;
            mode.dragging.time = 0;
          }
        }

        // Remove lines if number of lines exceeds the limit
        if (map.lines.hasOwnProperty(user.id)) {
          const len = map.lines[user.id].length;
          if (len > MAX_LINE_COUNT) {
            map.lines[user.id].splice(0, len - MAX_LINE_COUNT);
          }
        }
      },

      erase(hover = this.hover()) { // Press
        if (hover === null) return;

        switch (hover.type) {
          case modes.ENTITY:
            map.entities.splice(hover.index, 1);
            update.set('entities');
            break;
          case modes.ASSET:
            map.assets.splice(hover.index, 1);
            update.set('assets');
            break;
          case modes.WALL:
            // Determine which end is closest
            map.walls.splice(hover.index, 1);
            update.set('walls');
            break;
        }
      },

      texture() { // Press/Drag
        // TODO: Use new render object to modify texture using p5 lines/elipses
        //       https://p5js.org/examples/structure-create-graphics.html
        if (paint.texture < 0 || paint.texture >= textures.COUNT) return;

        const image = textures.images[paint.texture];

        // Update map texture
        map.texture.image.loadPixels();
        if (paint.texture !== 0) image.loadPixels();
        

        if (paint.type === 'brush') { // Brush mode
          const paintLimit = paint.size.val ** 2 / 4;
          const blendLimit = (paint.blend.val / paint.blend.MAX) ** 2 * paintLimit;

          for (let i = -paint.size.val / 2; i < paint.size.val / 2; i += map.texture.scale) {
            const x = Math.floor((view.mx + i) / map.texture.scale);

            if (x < 0 || x >= map.texture.width) continue;
            const di = i * i;

            for (let j = -paint.size.val / 2; j < paint.size.val / 2; j += map.texture.scale) {
              const y = Math.floor((view.my + j) / map.texture.scale);

              if (y < 0 || y >= map.texture.height) continue;
              const d = di + j * j;

              if (d < paintLimit) {
                const index = 4 * (y * map.texture.width + x);

                if (d > blendLimit) {
                  const r = Math.random();
                  const s = (d - blendLimit) / (paintLimit - blendLimit);
                  if (r < s) continue;
                }

                map.texture.val[x][y] = paint.texture;

                if (paint.texture === 0) {
                  map.texture.image.pixels[index]     = 0;
                  map.texture.image.pixels[index + 1] = 0;
                  map.texture.image.pixels[index + 2] = 0;
                  map.texture.image.pixels[index + 3] = 0;
                } else {
                  const tx = x % image.width;
                  const ty = y % image.height;
                  const tindex = 4 * (ty * image.width + tx);

                  map.texture.image.pixels[index] = image.pixels[tindex];
                  map.texture.image.pixels[index + 1] = image.pixels[tindex + 1];
                  map.texture.image.pixels[index + 2] = image.pixels[tindex + 2];
                  map.texture.image.pixels[index + 3] = image.pixels[tindex + 3];
                }
              }
            }
          }
        } else if (paint.type === 'fill') { // Fill mode
          const x = Math.floor(view.mx / map.texture.scale);
          if (x < 0 || x >= map.texture.width) return;
          const y = Math.floor(view.my / map.texture.scale);
          if (y < 0 || y >= map.texture.height) return;

          const gx = map.grid.spacing * map.texture.width / map.width;
          const gy = map.grid.spacing * map.texture.height / map.height;
          // Get top left corner of current grid
          const fx = Math.floor(x / gx) * gx;
          const fy = Math.floor(y / gy) * gy;

          for (let i = 0; i < gx; i++) {
            const x = fx + i;
            for (let j = 0; j < gy; j++) {
              const y = fy + j;

              const index = 4 * (y * map.texture.width + x);
              map.texture.val[x][y] = paint.texture;

              if (paint.texture === 0) {
                map.texture.image.pixels[index]     = 0;
                map.texture.image.pixels[index + 1] = 0;
                map.texture.image.pixels[index + 2] = 0;
                map.texture.image.pixels[index + 3] = 0;
              } else {
                const tx = x % image.width;
                const ty = y % image.height;
                const tindex = 4 * (ty * image.width + tx);

                map.texture.image.pixels[index] = image.pixels[tindex];
                map.texture.image.pixels[index + 1] = image.pixels[tindex + 1];
                map.texture.image.pixels[index + 2] = image.pixels[tindex + 2];
                map.texture.image.pixels[index + 3] = image.pixels[tindex + 3];
              }
            }
          }
        }

        map.texture.image.updatePixels();
        update.set('texture');
      },

      fog() { // Press/Drag
        // TODO: Use new render object to modify texture using p5 lines/elipses
        //       https://p5js.org/examples/structure-create-graphics.html
        if (paint.texture < 0 || paint.texture > 1) return;

        const image = textures.images[textures.FOG];

        // Update map texture
        map.fog.image.loadPixels();
        if (paint.texture !== 0) image.loadPixels();

        if (paint.type === 'brush') { // Brush mode
          const dLimit = paint.size.val * paint.size.val / 4;
          for (let i = -paint.size.val / 2; i < paint.size.val / 2; i += map.fog.scale) {
            const x = Math.floor((view.mx + i) / map.fog.scale);

            if (x < 0 || x >= map.fog.width) continue;
            const di = i * i;

            for (let j = -paint.size.val / 2; j < paint.size.val / 2; j += map.fog.scale) {
              const y = Math.floor((view.my + j) / map.fog.scale);

              if (y < 0 || y >= map.fog.height) continue;
              const d = di + j * j;

              if (d < dLimit) {
                const index = 4 * (y * map.fog.width + x);
                map.fog.val[x][y] = paint.texture;

                if (paint.texture === 0) {
                  map.fog.image.pixels[index]     = 0;
                  map.fog.image.pixels[index + 1] = 0;
                  map.fog.image.pixels[index + 2] = 0;
                  map.fog.image.pixels[index + 3] = 0;
                } else {
                  const tx = x % image.width;
                  const ty = y % image.height;
                  const tindex = 4 * (ty * image.width + tx);

                  map.fog.image.pixels[index]     = image.pixels[tindex];
                  map.fog.image.pixels[index + 1] = image.pixels[tindex + 1];
                  map.fog.image.pixels[index + 2] = image.pixels[tindex + 2];
                  map.fog.image.pixels[index + 3] = image.pixels[tindex + 3];
                }
              }
            }
          }
        } else if (paint.type === 'fill') { // Fill mode
          const x = Math.floor(view.mx / map.fog.scale);
          if (x < 0 || x >= map.fog.width) return;
          const y = Math.floor(view.my / map.fog.scale);
          if (y < 0 || y >= map.fog.height) return;

          const gx = map.grid.spacing * map.fog.width / map.width;
          const gy = map.grid.spacing * map.fog.height / map.height;
          // Get top left corner of current grid
          const fx = Math.floor(x / gx) * gx;
          const fy = Math.floor(y / gy) * gy;

          for (let i = 0; i < gx; i++) {
            const x = fx + i;
            for (let j = 0; j < gy; j++) {
              const y = fy + j;

              const index = 4 * (y * map.fog.width + x);
              map.fog.val[x][y] = paint.texture;

              if (paint.texture === 0) {
                map.fog.image.pixels[index]     = 0;
                map.fog.image.pixels[index + 1] = 0;
                map.fog.image.pixels[index + 2] = 0;
                map.fog.image.pixels[index + 3] = 0;
              } else {
                const tx = x % image.width;
                const ty = y % image.height;
                const tindex = 4 * (ty * image.width + tx);

                map.fog.image.pixels[index]     = image.pixels[tindex];
                map.fog.image.pixels[index + 1] = image.pixels[tindex + 1];
                map.fog.image.pixels[index + 2] = image.pixels[tindex + 2];
                map.fog.image.pixels[index + 3] = image.pixels[tindex + 3];
              }
            }
          }
        }

        map.fog.image.updatePixels();
        update.set('fog');
      }
    },

    done: {
      map() { },

      wall() { // Press
        // Stop creating wall
        mode.moving = null;
      },

      entity() { // Press
        // Reset mode
        sketch.setMode(modes.NONE);
      },

      asset() { // Press
        if (mode.ctrl) {
          // Reset mode
          sketch.setMode(modes.NONE);
        } else if (mode.moving instanceof Asset) {
          mode.moving.rotate(map.asset.step);
        }
      },

      move(hover = mode.do.hover()) { // Press
        if (hover === null) return;
        if (user.role !== 'admin') return;
        if (hover.type !== modes.ASSET) return;

        // Rotate assets
        map.assets[hover.index].rotate(map.asset.step);
        update.set('assets');
      },

      erase() { },

      texture() { },

      fog() { }
    }
  };

  const MEDIA_MAPS = '/media/maps/';
  const MAX_LINE_TIMEOUT = 10000; // 10 seconds
  const MAX_LINE_COUNT = 64;

  const cursors = {
    COUNT: 0,
    names: [],
    images: []
  };

  const textures = {
    COUNT: 0,
    names: [],
    images: []
  };

  const walls = {
    COUNT: 0,
    names: [],
    images: []
  };

  const entities = {
    COUNT: 0,
    names: [],
    images: []
  };

  const assets = {
    COUNT: 0,
    names: [],
    images: []
  };

  class Wall {
    constructor(first, second, third) { // (type, x0, y0), (wall)
      this.x = [];
      this.y = [];
      this.image = null;
      switch (arguments.length) {
        case 1:
          this.type = first.type;
          this.x = first.x;
          this.y = first.y;
          break;
        case 3:
          this.type = first;
          this.start(second, third);
          break;
      }
    }

    start(x, y) {
      this.x[0] = x;
      this.y[0] = y;
    }

    end(x, y) {
      if (x === this.x[0] && y === this.y[0]) {
        return false;
      }

      this.x[1] = x;
      this.y[1] = y;

      if (this.type !== walls.NONE) {
        this.image = this.createImage();
      }

      return true;
    }

    copy() {
      const out = new Wall();
      out.type = this.type;
      out.x[0] = this.x[0];
      out.x[1] = this.x[1];
      out.y[0] = this.y[0];
      out.y[1] = this.y[1];
      out.image = this.image;

      return out;
    }

    data() {
      return {
        type: this.type,
        x: this.x,
        y: this.y
      };
    }

    draw(x = this.x[1], y = this.y[1]) {
      if (this.type === walls.NONE) { // Solid wall
        sketch.stroke(0);
        sketch.strokeWeight(map.wall.width);

        sketch.line(this.x[0], this.y[0], x, y);

        sketch.noStroke();
        sketch.fill(0);
        sketch.ellipseMode(sketch.CENTER);
        sketch.ellipse(this.x[0], this.y[0], map.wall.width, map.wall.width);
        sketch.ellipse(x, y, map.wall.width, map.wall.width);

      } else {
        const d = {
          x: x - this.x[0],
          y: y - this.y[0]
        };
        const image = this.image !== null ? this.image : this.createImage(x, y);

        sketch.push();
          sketch.scale(map.wall.scale);
          sketch.translate(this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
          sketch.rotate(Math.PI / 2 - Math.atan2(d.x, d.y));
          sketch.translate(-this.x[0] / map.wall.scale, -this.y[0] / map.wall.scale);
          sketch.translate(image.height / -2, image.height / -2);
          sketch.image(image, this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
        sketch.pop();
      }
    }

    contains(x, y) {
      const buf = 2.5;
      const d = {
        x: this.x[1] - this.x[0],
        y: this.y[1] - this.y[0]
      };
      const dp = {
        x: x - this.x[0],
        y: y - this.y[0]
      };
      const c = {
        x: -1,
        y: -1
      };

      const dot = dp.x * d.x + dp.y * d.y;
      const mag2 = d.x ** 2 + d.y ** 2;
      let factor = -1;

      if (mag2 !== 0) {
        factor = dot / mag2;
      }

      if (factor < 0) {
        c.x = this.x[0];
        c.y = this.y[0];
      } else if (factor > 1) {
        c.x = this.x[1];
        c.y = this.y[1];
      } else {
        c.x = this.x[0] + factor * d.x;
        c.y = this.y[0] + factor * d.y;
      }

      const distance = (x - c.x) ** 2 + (y - c.y) ** 2

      return distance < buf;
    }

    createImage(x = this.x[1], y = this.y[1]) {
      const d = {
        x: x - this.x[0],
        y: y - this.y[0]
      };
      const texture = walls.images[this.type];
      const mag = Math.max(1, Math.round(Math.sqrt(d.x * d.x + d.y * d.y) / map.wall.scale + texture.height));
      const image = sketch.createImage(mag, texture.height);

      image.loadPixels();
      texture.loadPixels();

      for (let i = 0; i < image.width; ++i) {
        const tx = i % texture.width;
        for (let j = 0; j < image.height; ++j) {
          const index = 4 * (j * image.width + i);
          const tindex = 4 * (j * texture.width + tx);

          image.pixels[index] = texture.pixels[tindex];
          image.pixels[index + 1] = texture.pixels[tindex + 1];
          image.pixels[index + 2] = texture.pixels[tindex + 2];
          image.pixels[index + 3] = texture.pixels[tindex + 3];
        }
      }
      image.updatePixels();

      return image;
    }
  }

  class Entity {
    constructor(first, x, y, usr) {
      switch (arguments.length) {
        case 1:
          this.type = first.type;
          this.x = first.x;
          this.y = first.y;
          if (typeof first.user === 'undefined') {
            this.user = { id:'', name:'', role:'admin' };
          } else {
            this.user = { id:first.user.id, name:first.user.name, role:first.user.role };
          }
          this.color = first.color;
          break;
        case 3:
          this.type = first;
          this.x = x;
          this.y = y;
          this.user = { id:user.id, name:user.name, role:user.role };
          this.color = getUserColor(user);
          break;
        case 4:
          this.type = first;
          this.x = x;
          this.y = y;
          this.user = { id:usr.id, name:usr.name, role:usr.role };
          this.color = getUserColor(usr);
          break;
      }
    }

    data() {
      return {
        type: this.type,
        x: this.x,
        y: this.y,
        user: this.user,
        color: this.color
      };
    }

    draw(x = this.x, y = this.y) {
      // Update user color
      this.color = getUserColor(this.user);

      sketch.imageMode(sketch.CENTER);
      sketch.ellipseMode(sketch.CENTER);
      sketch.noStroke();
      sketch.fill(this.color[0], this.color[1], this.color[2], 255);

      sketch.push();
        sketch.translate(x, y);
        sketch.scale(map.entity.scale);
        sketch.ellipse(0, 0, entities.images[this.type].width + 50, entities.images[this.type].height + 50);
        sketch.image(entities.images[this.type], 0, 0);
      sketch.pop();
    }

    contains(x, y) {
      const dx = Math.abs(x - this.x) * 2.5 / map.entity.scale;
      const dy = Math.abs(y - this.y) * 2.5 / map.entity.scale;

      if (dx <= entities.images[this.type].width &&
          dy <= entities.images[this.type].height) return true;
      return false;
    }
  }

  class Asset {
    constructor(first, x, y, scale, rot) {
      switch (arguments.length) {
        case 1:
          this.type = first.type;
          this.x = first.x;
          this.y = first.y;
          this.scale = first.scale;
          this.rot = first.rot;
          break;
        case 3:
          this.type = first;
          this.x = x;
          this.y = y;
          this.scale = 1;
          this.rot = 0;
          break;
        case 5:
          this.type = first;
          this.x = x;
          this.y = y;
          this.scale = scale;
          this.rot = rot;
          break;
      }
    }

    data() {
      return {
        type: this.type,
        x: this.x,
        y: this.y,
        scale: this.scale,
        rot: this.rot
      };
    }

    draw(x = this.x, y = this.y) {
      sketch.imageMode(sketch.CENTER);
      sketch.push();
        sketch.translate(x, y);
        sketch.scale(this.scale);
        sketch.scale(map.asset.scale);
        sketch.rotate(sketch.radians(this.rot));
        sketch.image(assets.images[this.type], 0, 0);
      sketch.pop();
    }

    contains(x, y) {
      const dx = Math.abs(x - this.x) * 2.5 / map.asset.scale / this.scale;
      const dy = Math.abs(y - this.y) * 2.5 / map.asset.scale / this.scale;

      if (dx <= assets.images[this.type].width &&
          dy <= assets.images[this.type].height) return true;
      return false;
    }

    rotate(rot) {
      this.rot += rot;
      this.rot = this.rot % 360;
    }

    zoom(scale) {
      this.scale += scale;
      this.scale = Math.min(2, Math.max(0.5, this.scale));
    }
  }

  let onCanvas = false;
  let totalLoading = 0;
  let loaded = 0;

  sketch.preload = () => {
    // Load media
    // Cursors
    sketch.loadJSON(`${MEDIA_MAPS}cursors/cursors.json`, loadCursors);
    // Textures
    sketch.loadJSON(`${MEDIA_MAPS}textures/textures.json`, loadTextures);
    // Walls
    sketch.loadJSON(`${MEDIA_MAPS}walls/walls.json`, loadWalls);
    // Entities
    sketch.loadJSON(`${MEDIA_MAPS}entities/entities.json`, loadEntities);
    // Assets
    sketch.loadJSON(`${MEDIA_MAPS}assets/assets.json`, loadAssets);
  }

  sketch.setup = () => {
    const canvas = sketch.createCanvas(view.width, view.height);
    canvas.parent('#map');
    $(canvas.canvas).hide();
    canvas.mouseOver(() => { onCanvas = true; });
    canvas.mouseOut(() => { onCanvas = false; });

    // Map texture
    map.texture.width = map.width / map.texture.scale;
    map.texture.height = map.height / map.texture.scale;
    map.texture.image = sketch.createImage(map.texture.width, map.texture.height);

    for (let i = 0; i < map.texture.width; ++i) {
      map.texture.val[i] = [];
      for (let j = 0; j < map.texture.height; ++j) {
        map.texture.val[i][j] = 0;
      }
    }

    // Fog overlay
    map.fog.width = map.width / map.fog.scale;
    map.fog.height = map.height / map.fog.scale;
    map.fog.image = sketch.createImage(map.fog.width, map.fog.height);

    for (let i = 0; i < map.fog.width; ++i) {
      map.fog.val[i] = [];
      for (let j = 0; j < map.fog.height; ++j) {
        map.fog.val[i][j] = 0;
      }
    }

    // View
    const zx = view.width / map.width;
    const zy = view.height / map.height;
    view.zoom.MIN = Math.min(zx, zy) * 0.8;
    view.zoom.set(0);
    view.x = map.width / 2;
    view.y = map.height / 2;

    // Request map data
    mode.loaded = true;
  };

  sketch.draw = () => {
    // Update mouse position on map
    view.mx = (sketch.mouseX - sketch.width/2) / view.zoom.val + view.x;
    view.my = (sketch.mouseY - sketch.height/2) / view.zoom.val + view.y;

    sketch.clear();

    drawMap();
    drawHover();
    drawCursor();
    drawText();
  };

  sketch.resize = () => {
    view.width = $('#map').width(); // Remove padding and boarder
    view.height = $(window).height() - 160; // Todo: make more dynamic
    $('#map').height(view.height);
    sketch.resizeCanvas(view.width, view.height);

    const zx = view.width / map.width;
    const zy = view.height / map.height;
    view.zoom.MIN = Math.min(zx, zy) * 0.8;
    view.zoom.set(view.zoom.val);
  }

  sketch.loadAll = data => {
    if (typeof data.texture === 'undefined' || data.texture === null) {
      data.texture = {
        width: map.texture.width,
        height: map.texture.height,
        val: [[0, map.texture.width * map.texture.height]]
      }
    }
    if (typeof data.fog === 'undefined' || data.fog === null) {
      data.fog = {
        width: map.fog.width,
        height: map.fog.height,
        val: [[0, map.fog.width * map.fog.height]]
      }
    }

    map.share = data.share;
    sketch.loadType('walls', { walls: data.walls });
    sketch.loadType('entities', { entities: data.entities });
    sketch.loadType('assets', { assets: data.assets });
    sketch.loadType('texture', { texture: data.texture });
    sketch.loadType('fog', { fog: data.fog });
  };

  sketch.saveAll = () => {
    update.set('all');

    const data = {
      share:    map.share,
      walls:    sketch.saveType('walls').walls,
      entities: sketch.saveType('entities').entities,
      assets:   sketch.saveType('assets').assets,
      texture:  sketch.saveType('texture').texture,
      fog:      sketch.saveType('fog').fog
    };

    return data;
  };

  sketch.loadType = (type, data) => {
    switch (type) {
      case 'walls':
        map.walls = [];

        for (w of data.walls) {
          map.walls.push(new Wall(w));
        }
        break;

      case 'entities':
        map.entities = [];

        for (e of data.entities) {
          map.entities.push(new Entity(e));
        }
        break;

      case 'assets':
        map.assets = [];

        for (a of data.assets) {
          map.assets.push(new Asset(a));
        }
        break;

      case 'lines':
        if (map.lines.hasOwnProperty(data.id)) {
          let len = map.lines[data.id].length;
          const last = map.lines[data.id][len - 1].time;

          for (l of data.lines) {
            if (l.time > last) {
              map.lines[data.id].push(l);
            }
          }

          len = map.lines[data.id].length;
          if (len > MAX_LINE_COUNT) {
            map.lines[data.id].splice(0, len - MAX_LINE_COUNT);
          }
        } else {
          map.lines[data.id] = data.lines;
        }
        break;

      case 'texture':
        loadImage(data.texture, map.texture, textures.images);
        break;

      case 'fog':
        // TODO: Create fog pallet.
        const fogPallet = [ null, textures.images[textures.FOG] ];
        const opaque = (user.role !== 'admin');
        loadImage(data.fog, map.fog, fogPallet, opaque);
    }
  }

  sketch.saveType = type => {
    const out = [];
    switch (type) {
      case 'walls':
        for (w of map.walls) {
          out.push(w.data());
        }
        return { walls: out };
      case 'entities':
        for (e of map.entities) {
          if (user.role === 'admin' || user.id === e.user.id) {
            out.push(e.data());
          }
        }
        return { entities: out };
      case 'assets':
        for (a of map.assets) {
          out.push(a.data());
        }
        return { assets: out };
      case 'lines':
        return { id: user.id, lines: map.lines[user.id] };
      case 'texture':
        return { texture: compress(map.texture) };
      case 'fog':
        return { fog: compress(map.fog) };
    }
  }

  sketch.mousePressed = () => {
    if (!onCanvas) return;
    switch (sketch.mouseButton) {
      case sketch.LEFT:
        mouseLeft();
        break;
      case sketch.RIGHT:
        mouseRight();
        break;
    }
  }

  function mouseLeft() {
    const mod = mode.shift ? modes.NONE: mode.primary;

    switch (mod) {
      case modes.NONE:
      case modes.WALL:
      case modes.ENTITY:
      case modes.ASSET:
      case modes.DRAW:
      case modes.ERASE:
        if (view.mx < 0 || view.mx > map.width ||
          view.my < 0 || view.my > map.height) return;
        break;
    }

    switch (mod) {
      case modes.NONE:
        let hover = null;
        if (mode.shift || (hover = mode.do.hover()) === null) {
          mode.do.map();
        } else {
          mode.do.move(hover);
        }
        break;
      case modes.WALL:
        mode.do.wall();
        break;
      case modes.ENTITY:
        mode.do.entity();
        break;
      case modes.ASSET:
        mode.do.asset();
        break;
      case modes.MOVE:
        mode.do.move();
        break;
      case modes.ERASE:
        mode.do.erase();
        break;
      case modes.PAINT:
        switch (paint.mode) {
          case 'fog':
            mode.do.fog();
            break;
          case 'texture':
            mode.do.texture();
            break;
        }
        break;
    }
  };

  function mouseRight() {
    const mod = mode.shift ? modes.NONE: mode.primary;

    switch (mod) {
      case modes.NONE:
        mode.done.move();
        break;
      case modes.WALL:
        mode.done.wall();
        break;
      case modes.ENTITY:
        mode.done.entity();
        break;
      case modes.ASSET:
        mode.done.asset();
        break;
    }
  }

  sketch.mouseDragged = () => {
    if (!onCanvas) return;

    const time = new Date().getTime();
    const dt = time - mode.dragging.time;
    const mod = mode.shift ? modes.NONE: mode.primary;

    switch (mod) {
      case modes.NONE:
        if (dt >= mode.dragging.rate.fast) {
          mode.dragging.time = time;
          mode.do.map();
        }
        break;
      case modes.PAINT:
        if (dt >= mode.dragging.rate.fast) {
          mode.dragging.time = time;
          switch (paint.mode) {
            case 'fog':
              mode.do.fog(true);
              break;
            case 'texture':
              mode.do.texture(true);
              break;
          }
        }
        break;
      case modes.DRAW:
        if (dt >= mode.dragging.rate.slow) {
          mode.dragging.time = time;
          mode.do.draw(true);
        }
        break;
    }
  };

  sketch.mouseReleased = () => {
    if (!onCanvas) return;

    switch (mode.primary) {
      case modes.DRAW:
        mode.do.draw(false);
        break;
    }

    mode.dragging.time = 0;
  }

  sketch.mouseWheel = event => {
    if (!onCanvas) return;

    const mod = mode.shift ? modes.NONE: mode.primary;

    switch (mod) {
      case modes.NONE:
      case modes.WALL:
      case modes.ERASE:
        view.zoom.set(view.zoom.val - 0.2 * Math.sign(event.delta));
        break;
      case modes.ASSET:
        if (mode.moving instanceof Asset) {
          mode.moving.zoom(-0.1 * Math.sign(event.delta));
        }
        break;
      case modes.PAINT:
        if (mode.ctrl) {
          setPaint('blend', paint.blend.val - Math.sign(event.delta));
        } else {
          setPaint('size', paint.size.val - Math.sign(event.delta));
        }
        break;
    }
  };

  sketch.keyPressed = () => {
    if (sketch.key === 'Control') mode.ctrl = true;

    if (sketch.key === 'Shift') {
      mode.shift = true;
    }

    if (!onCanvas) return;
    switch (sketch.key) {
      case 'm': // Map Mode
        sketch.setMode(modes.NONE);
        break;
      case 'd': // Draw Mode
        sketch.setMode(modes.DRAW);
        break;
      case 'x': // Erase Mode
        sketch.setMode(modes.ERASE);
        break;
      case 'o': // Grid Overlay
        view.grid = !view.grid;
        break;
      case '=':
      case '+':
        switch (mode.primary) {
          case modes.ASSET:
          case modes.PAINT:
            break;
          default:
            view.zoom.set(view.zoom.val * 1.1);
        }
        break;
      case '-':
      case '_':
        switch (mode.primary) {
          case modes.ASSET:
          case modes.PAINT:
            break;
          default:
            view.zoom.set(view.zoom.val * 0.9);
        }
        break;
    }

    if (user.role === 'admin') {
      switch (sketch.key) {
        case 'w':
          sketch.setMode(modes.WALL);
          break;
        case 'e':
          sketch.setMode(modes.ENTITY);
          if (!(mode.moving instanceof Entity)) {
            mode.moving = new Entity(mode.secondary, 0, 0);
          }
          break;
        case 'a':
          sketch.setMode(modes.ASSET);
          if (!(mode.moving instanceof Asset)) {
            mode.moving = new Asset(mode.secondary, 0, 0);
          }
          break;
        case 't': // Texture Mode
          sketch.setMode(modes.PAINT);
          if (paint.mode === 'texture') {
            setPaint('type', paint.type === 'brush' ? 'fill' : 'brush');
          } else {
            paint.mode = 'texture';
          }
          break;
        case 'f': // Fog Mode
          sketch.setMode(modes.PAINT);
          if (paint.mode === 'fog') {
            setPaint('type', paint.type === 'brush' ? 'fill' : 'brush');
          } else {
            paint.mode = 'fog';
          }
          break;
        case '=':
        case '+':
          switch (mode.primary) {
            case modes.ASSET:
              if (mode.moving instanceof Asset) {
                mode.moving.zoom(0.1);
              }
              break;
            case modes.PAINT:
              setPaint('size', paint.size.val * 1.1);
              break;
          }
          break;
        case '-':
        case '_':
          switch (mode.primary) {
            case modes.ASSET:
              if (mode.moving instanceof Asset) {
                mode.moving.zoom(-0.1);
              }
              break;
            case modes.PAINT:
              setPaint('blend', paint.size.val * 0.9);
              break;
          }
          break;
        case '0': case '1': case '2': case '3': case '4':
        case '5': case '6': case '7': case '8': case '9':
          const key = sketch.key - '0';
          switch (mode.primary) {
            case modes.PAINT:
              setPaint('texture', key);
              break;
            case modes.ENTITY:
              if (key < 0 || key >= entities.COUNT) break;

              if (key === 9 && mode.secondary > 8 && mode.secondary < entities.COUNT) {
                if (mode.shift) {
                  if (--mode.secondary < 9) {
                    mode.secondary = entities.COUNT - 1;
                  }
                } else {
                  if (++mode.secondary >= entities.COUNT) {
                    mode.secondary = 9;
                  }
                }
              } else {
                mode.secondary = key;
              }

              if (mode.moving instanceof Entity) {
                mode.moving.type = mode.secondary;
              }
              break;
            case modes.ASSET:
              if (key < 0 || key >= assets.COUNT) break;

              mode.secondary = key;
              if (mode.moving instanceof Entity) {
                mode.moving.type = mode.secondary;
              }
              break;
            case modes.WALL:
              if (key < 0 || key >= walls.COUNT) break;

              mode.secondary = key;
              if (mode.moving instanceof Wall) {
                mode.moving.type = mode.secondary;
              }
          }
          break;
      }
    }
  };

  sketch.keyReleased = () => {
    if (sketch.key === "Control") {
      mode.ctrl = false;
    }

    if (sketch.key === 'Shift') {
      mode.shift = false;
    }
  }

  sketch.setMode = (m, reset = true) => {
    if (m >= 0 && m < modes.COUNT) {
      if (reset) mode.secondary = 0;
      mode.primary = m;
    }
  };

  // TODO: merge with keypress to use single function
  sketch.setSpecificMode = (name, key) => {
    switch(name) {
      case 'paint':
        sketch.setMode(modes.PAINT);
        break;
      case 'wall':
        sketch.setMode(modes.WALL);
        mode.secondary = key;
        break;
      case 'entity':
        sketch.setMode(modes.ENTITY);
        mode.moving = new Entity(key, 0, 0);
        // TODO: is secondary used for entity
        mode.secondary = key;
        break;
      case 'asset':
        sketch.setMode(modes.ASSET);
        mode.moving = new Asset(key, 0, 0);
        // TODO: is secondary used for assets
        mode.secondary = key;
        break;
      case 'draw':
        sketch.setMode(modes.DRAW);
        break;
      case 'erase':
        sketch.setMode(modes.ERASE);
        break;
      case 'none':
        sketch.setMode(modes.NONE);
        break;
    }
  };

  sketch.isLoaded = () => {
    return mode.loaded;
  };

  function loadMedia(target, data, folder) {
    const dataKeys = Object.keys(data);

    target.COUNT = dataKeys.length;
    target.names = new Array(dataKeys.length);
    target.images = new Array(dataKeys.length);

    totalLoading += dataKeys.length;

    for (key of dataKeys) {
      target[key] = data[key][0];
      target.names[target[key]] = data[key][1];
      if (data[key][2] === null) {
        target.images[target[key]] = null;
      } else {
        if (DEBUG) console.log(`loading ${data[key][2]}`);
        target.images[target[key]] = sketch.loadImage(MEDIA_MAPS + folder + data[key][2], mediaLoaded);
      }
    }

    if (DEBUG) console.log(`Loaded ${folder}`);

    return target;
  }

  function mediaLoaded() {
    loaded++;

    if (loaded > totalLoading) loaded = totalLoading;

    const perc = loaded / totalLoading * 100;
    const percStr = `${perc.toString()}%`;
    $('#loader-bar').css('width', percStr);
    $('#loader-status').html(`Loading (${loaded}/${totalLoading})`);
  }

  function loadCursors(data) {
    loadMedia(cursors, data, 'cursors/');
    sketch.setMode(modes.NONE);
  }
  function loadTextures(data) {
    loadMedia(textures, data, 'textures/');
  }
  function loadWalls(data) {
    loadMedia(walls, data, 'walls/');
  }
  function loadEntities(data) {
    loadMedia(entities, data, 'entities/');
  }
  function loadAssets(data) {
    loadMedia(assets, data, 'assets/');
  }

  function drawMap() {
    sketch.push();
      sketch.translate(-view.x * view.zoom.val, -view.y * view.zoom.val);
      sketch.scale(view.zoom.val);
      sketch.translate(sketch.width/(2 * view.zoom.val), sketch.height/(2 * view.zoom.val));

      drawTexture();
      drawGrid();
      drawWalls();
      drawAssets();
      drawEntities();
      drawFog();
      drawLines();
    sketch.pop();
  }

  function drawTexture() {
    sketch.push();
      sketch.scale(map.texture.scale);
      sketch.imageMode(sketch.CORNER);
      sketch.image(map.texture.image, 0, 0);
    sketch.pop();
  }

  function drawGrid() {
    if (!view.grid) return;

    sketch.strokeWeight(1 / view.zoom.val);
    sketch.stroke(0, 0, 0);
    for (let i = 0; i <= map.width; i += map.grid.spacing) {
      sketch.line(i, 0, i, map.height);
    }
    for (let j = 0; j <= map.height; j += map.grid.spacing) {
      sketch.line(0, j, map.width, j);
    }
  }

  function drawWalls() {
    for (wall of map.walls) {
      wall.draw();
    }

    if (mode.moving instanceof Wall) {
      const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
      const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

      mode.moving.draw(wx, wy);
    }
  }

  function drawAssets() {
    for (asset of map.assets) {
      asset.draw();
    }
  }

  function drawEntities() {
    for (entity of map.entities) {
      entity.draw();
    }
  }

  function drawFog() {
    if (!map.share && user.role !== 'admin') {
      sketch.push();
        sketch.scale(map.texture.scale);
        sketch.imageMode(sketch.CORNER);
        sketch.image(textures.images[textures.FOG], 0, 0);
      sketch.pop();
    } else {
      sketch.push();
        sketch.scale(map.fog.scale);
        sketch.imageMode(sketch.CORNER);
        sketch.image(map.fog.image, 0, 0);
      sketch.pop();

      // Redraw user entities over fog
      // TODO: (possibly) Re-add fog effect
      for (entity of map.entities) {
        if (entity.user.id === user.id) {
          entity.draw();
        }
      }
    }
  }

  function drawLines() {
    if (Object.keys(map.lines).length === 0) return;

    // TODO Should only start removing when drag stops up to a certain length
    //      Different drags should not connect.
    const time = new Date().getTime();

    // Per user lines
    Object.keys(map.lines).forEach(id => {
      if (map.lines[id].length === 0) {
        delete map.lines[id];
        return;
      }

      // Remove expired markers
      map.lines[id].some((marker, i, iarr) => {
        if ((time - marker.time) > MAX_LINE_TIMEOUT) {
          iarr.splice(i, 1);
          return true;
        }
      });

      // Remove line array if empty
      if (map.lines[id].length === 0) {
        delete map.lines[id];
        return;
      }

      // Draw remaining markers
      const color = getUserColor(id);
      sketch.strokeWeight(8 / view.zoom.val);
      sketch.stroke(color[0], color[1], color[2]);

      map.lines[id].forEach(marker => {
        sketch.line(marker.prev.x, marker.prev.y, marker.curr.x, marker.curr.y);
      });
    });
  }

  function drawHover() {
    if (mode.primary === modes.NONE ||
        mode.primary === modes.ERASE) {
      const fx = Math.floor(view.mx / map.fog.scale);
      const fy = Math.floor(view.my / map.fog.scale);

      // Cursor is out of map
      if (fx < 0 || fx >= map.fog.width || fy < 0 || fy >= map.fog.height) return;

      for (entity of map.entities) {
        // Do not show hover if entity does not belong to user and is hidden behind fog
        if (user.role !== 'admin' &&
            entity.user.id !== user.id &&
            map.fog.val[fx][fy] === 1)
          continue;

        if (entity.contains(view.mx, view.my)) {
          const size = 16;
          const corWidth = Math.min(256, sketch.width / 3);
          const corHeight = corWidth + 2.75 * size;
          const scale = corWidth / 6;

          sketch.rectMode(sketch.CORNER);
          sketch.strokeWeight(6);
          sketch.stroke(entity.color[0], entity.color[1], entity.color[2], 255);
          sketch.fill(255);

          sketch.push();
            if (sketch.mouseX < sketch.width / 2) {
              sketch.translate(sketch.width - corWidth - 10, 10);
            } else {
              sketch.translate(10, 10);
            }

            sketch.rect(0, 0, corWidth, corHeight);

            sketch.push();
              sketch.translate(corWidth / 2, corWidth / 2);
              sketch.scale(scale);

              entity.draw(0, 0);
            sketch.pop();

            sketch.fill(0);
            sketch.noStroke();
            sketch.textAlign(sketch.CENTER);
            sketch.textSize(size);

            sketch.translate(corWidth / 2, 0);
            sketch.text(entities.names[entity.type], 0, corWidth + 0.75 * size);
            sketch.text(entity.user.name, 0, corWidth + 2 * size);
          sketch.pop();
        }
      }
    }
  }

  function drawCursor() {
    if (!onCanvas) return;

    sketch.push();
      sketch.translate(-view.x * view.zoom.val, -view.y * view.zoom.val);
      sketch.scale(view.zoom.val);
      sketch.translate(sketch.width/(2 * view.zoom.val), sketch.height/(2 * view.zoom.val));

      sketch.rectMode(sketch.CENTER);
      sketch.strokeWeight(1 / view.zoom.val);
      sketch.stroke(0, 0, 0);

      const mod = mode.shift ? modes.NONE: mode.primary;

      switch (mod) {
        case modes.NONE:
          drawCursorImage();
          sketch.fill(0);
          drawCursorMark();
          break;

        case modes.WALL:
          const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
          const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

          sketch.fill(0, 255, 255);
          drawCursorMark(wx, wy);

          drawCursorImage();
          sketch.fill(0);
          drawCursorMark();
          break;

        case modes.ENTITY:
          if (mode.moving instanceof Entity) {
            mode.moving.draw(view.mx, view.my);
          }

          drawCursorImage();
          sketch.fill(0, 0, 255);
          drawCursorMark();
          break;

        case modes.ASSET:
          if (mode.moving instanceof Asset) {
            mode.moving.draw(view.mx, view.my);
          }

          drawCursorImage();
          sketch.fill(0, 0, 255);
          drawCursorMark();
          break;

        case modes.MOVE:
          drawCursorImage();
          sketch.fill(0, 255, 0);
          drawCursorMark();
          break;

        case modes.DRAW:
          drawCursorImage();
          color = getUserColor(user);
          sketch.fill(color[0], color[1], color[2]);
          sketch.ellipse(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
          break;

        case modes.ERASE:
          drawCursorImage();
          sketch.fill(255, 0, 0);
          drawCursorMark();
          break;

        case modes.PAINT:
          let paintSize = paint.size.MIN;
          switch (paint.mode) {
            case 'texture':
              if (paint.type === 'brush') {
                paintSize = paint.size.val;
    
                const blendSize = paint.blend.val / paint.blend.MAX * paintSize;
    
                // Blend
                sketch.ellipseMode(sketch.CENTER);
                sketch.noFill();
                sketch.stroke(0, 0, 255);
                sketch.strokeWeight(2 / view.zoom.val);
                sketch.circle(view.mx, view.my, blendSize);
              }
    
              // Paint
              sketch.ellipseMode(sketch.CENTER);
              sketch.noFill();
              sketch.stroke(0);
              sketch.strokeWeight(2 / view.zoom.val);
              sketch.circle(view.mx, view.my, paintSize);
              break;
    
            case 'fog':    
              if (paint.type === 'brush') {
                paintSize = paint.size.val;
              }
    
              // Paint
              sketch.ellipseMode(sketch.CENTER);
              sketch.noFill();
              sketch.stroke(0);
              sketch.strokeWeight(2 / view.zoom.val);
              sketch.circle(view.mx, view.my, paintSize);
              break;
          }
          break;
      }

    sketch.pop();
  }

  function drawCursorMark(x = view.mx, y = view.my, z = 10 / view.zoom.val) {
    sketch.triangle(x, y, x, y + z, x + z, y);
  }

  function drawCursorImage() {
    let cursor = cursors.DEFAULT;
    const mod = mode.shift ? modes.NONE: mode.primary;

    switch (mod) {
      case modes.NONE:
        // TODO: reduce number of times hover is called
        if (!mode.shift) {
          const hover = mode.do.hover();
          if (hover !== null) {
            cursor = cursors.HOVER;
          }
        }
        break;
      case modes.WALL:
      case modes.ENTITY:
      case modes.ASSET:
        cursor = cursors.HOLD;
        break;
      case modes.DRAW:
        cursor = cursors.DRAW;
        break;
      case modes.ERASE:
        cursor = cursors.ERASE;
        break;
      default:
        return;
    }

    sketch.imageMode(sketch.CORNER);
    sketch.push();
      //sketch.tint(color[0], color[1], color[2]);
      sketch.scale(map.cursor.scale / view.zoom.val);
      sketch.image(cursors.images[cursor], view.mx * view.zoom.val / map.cursor.scale, view.my * view.zoom.val / map.cursor.scale);
    sketch.pop();
  }

  function drawText() {
    sketch.fill(0);
    sketch.stroke(127);
    sketch.strokeWeight(2);

    sketch.textSize(14);
    const offx = 2;
    const offy = 14;

    switch (mode.primary) {
      case modes.PAINT:
        switch (paint.mode) {
          case 'fog':
            sketch.text(`Fog (${paint.type === 'fill' ? 'Fill' : 'Brush'}): ${paint.texture === 0 ? 'Erase' : 'Draw'}`, offx, offy);
            break;
          case 'texture':
            sketch.text(`Texture (${paint.type === 'fill' ? 'Fill' : 'Brush'}): ${textures.names[paint.texture]}`, offx, offy);
            break;
        }
        break;

      case modes.ASSET:
        sketch.text(`Asset: ${assets.names[mode.secondary]}`, offx, offy);
        break;

      case modes.ENTITY:
        sketch.text(`Entity: ${entities.names[mode.secondary]}`, offx, offy);
        break;

      case modes.WALL:
        sketch.text(`Wall: ${walls.names[mode.secondary]}`, offx, offy);
        break;
    }
  }

  function compress(data) {
    const out = {
      width:  data.width,
      height: data.height,
      val: []
    };

    let count = 0;
    let val = data.val[0][0];
    for (let i = 0; i < out.width; ++i) {
      for (let j = 0; j < out.height; ++j) {
        const curr = data.val[i][j];
        if (val === curr) {
          count++;
        } else {
          if (count === 1) {
            out.val.push(val);
          } else {
            out.val.push([val, count]);
          }
          val = curr;
          count = 1;
        }
      }
    }

    if (count === 1) {
      out.val.push(val);
    } else {
      out.val.push([val, count]);
    }

    return out;
  }

  function decompress(data) {
    const out = {
      width:  data.width,
      height: data.height,
      val: null
    };

    let i = 0;
    let j = 0;
    out.val = new Array(data.width);
    out.val[0] = new Array(data.height);
    for (val of data.val) {
      if (Array.isArray(val)) {
        for (let v = 0; v < val[1]; ++v) {
          out.val[i][j] = val[0];

          if (++j === data.height) {
            j = 0;
            if (++i !== data.width) {
              out.val[i] = new Array(data.height);
            }
          }
        }
      } else {
        out.val[i][j] = val;

        if (++j === data.height) {
          j = 0;
          if (++i !== data.width) {
            out.val[i] = new Array(data.height);
          }
        }
      }
    }

    return out;
  }

  function loadImage(from, to, pallet, opaque = false) {
    // TODO: Move values (val/width/height/...) directly from data to 'to'
    const data = decompress(from);

    to.image.loadPixels();
    pallet.forEach(image => {
      if (image !== null) image.loadPixels();
    });

    for (let i = 0; i < to.width; ++i) {
      for (let j = 0; j < to.height; ++j) {
        let index = 4 * (j * to.image.width + i);
        let value = 0;
        if (i < data.width && j < data.height) {
          value = data.val[i][j];
        }

        to.val[i][j] = value;

        if (value === 0) {
          to.image.pixels[index] = 0;
          to.image.pixels[index + 1] = 0;
          to.image.pixels[index + 2] = 0;
          to.image.pixels[index + 3] = 0;
        } else {
          const image = pallet[value];
          const ti = i % image.width;
          const tj = j % image.height;
          const tindex = 4 * (tj * image.width + ti);
          to.image.pixels[index]     = image.pixels[tindex];
          to.image.pixels[index + 1] = image.pixels[tindex + 1];
          to.image.pixels[index + 2] = image.pixels[tindex + 2];
          if (opaque) {
            to.image.pixels[index + 3] = 255;
          } else {
            to.image.pixels[index + 3] = image.pixels[tindex + 3];
          }
        }
      }
    }

    to.image.updatePixels();
  }
});