const s = sketch => {
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
      scale: 0.033
    },
    cursor: {
      scale: 1.9
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
      set(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
    },
    mx: 0,
    my: 0,
    brush: {
      val: 10,
      MIN: 2,
      MAX: 100,
      set(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
    },
    asset: {
      zoom: {
        val: 1,
        MIN: 1, // 0.5 - disable asset scaling
        MAX: 1, // 4
        set(v) {
          this.val = sketch.constrain(v, this.MIN, this.MAX);
        },
        reset() { this.val = 1; }
      },
      rot: {
        val: 0,
        MIN: 0,
        MAX: 360,
        step: 45,
        set(v) {
          while (v < this.MIN) v += this.MAX;
          while (v > this.MAX) v -= this.MAX;
          this.val = v;
        },
        reset() { this.val = 0; }
      }
    }
  };

  const mode = {
    loaded: false,
    ctrl: false,
    cursor: {
      val: 0,
      old: 0
    },
    dragging: {
      val: false,
      old: null,
      time: 0,
      rate: {
        slow: 50, // ms
        fast: 10 // ms
      }
    },
    texture: 0,
    fog: 0,
    wall: 0,
    walling: null,
    entity: 0,
    asset: 0,
    moving: {
      val: false,
      user: null
    },
    fill: false,

    do: {
      map() { // Drag
        view.x += (sketch.pmouseX - sketch.mouseX) / view.zoom.val;
        view.y += (sketch.pmouseY - sketch.mouseY) / view.zoom.val;
        view.x = sketch.constrain(view.x, 0, map.width);
        view.y = sketch.constrain(view.y, 0, map.height);
      },

      wall() { // Press
        if (mode.wall < 0 || mode.wall >= walls.COUNT) return;

        const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
        const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

        if (mode.walling === null) { // Start new wall
          mode.walling = new Wall(mode.wall, wx, wy);
        } else {
          // TODO: Make .end return true if new wall is valid
          // TODO: Possibly remove mode from wall
          mode.walling.end(wx, wy);

          if (mode.walling.mode === 2) { // End of wall is at new location
            // Add new wall
            map.walls.push(mode.walling.copy());

            if (mode.ctrl) { // Start new wall
              mode.walling = new Wall(mode.wall, wx, wy);

            } else {
              mode.walling = null;

              if (!mode.ctrl) {
                sketch.setMode(cursors.MOVE);
              }
            }

            update.set('walls');

          } else {
            mode.walling = null;

            if (!mode.ctrl) {
              sketch.setMode(cursors.MOVE);
            }
          }
        }
      },

      entity() { // Press
        if (mode.entity < 0 || mode.entity >= entities.COUNT) return;

        const ex = view.mx / map.entity.scale;
        const ey = view.my / map.entity.scale;

        let newEntity;
        if (mode.moving.val) { // Moving mode
          newEntity = new Entity(mode.entity, ex, ey, mode.moving.user);
          mode.moving.val = false;

        } else { // Creating mode
          newEntity = new Entity(mode.entity, ex, ey);
        }

        map.entities.push(newEntity);

        if (!mode.ctrl) {
          sketch.setMode(cursors.MOVE);
        }

        update.set('entities');
      },

      asset() { // Press
        if (mode.asset < 0 || mode.asset >= assets.COUNT) return;

        const ax = view.mx / map.asset.scale;
        const ay = view.my / map.asset.scale;

        map.assets.push(new Asset(mode.asset, ax, ay, view.asset.zoom.val, view.asset.rot.val));
        if (!mode.ctrl) {
          view.asset.zoom.reset();
          view.asset.rot.reset();
          sketch.setMode(cursors.MOVE);
        }

        update.set('assets');
      },

      move() { // Press
        let found = false;

        // Move Entity
        const ex = view.mx / map.entity.scale;
        const ey = view.my / map.entity.scale;

        for (let i = map.entities.length - 1; i >= 0; --i) {
          if (map.entities[i].contains(ex, ey)) {
            if (user.role === 'admin' ||
               (user.role === 'user' && user.id === map.entities[i].user.id)) {
              const oldEntity = map.entities.splice(i, 1)[0];
              mode.entity = oldEntity.type;
              mode.moving.val = true;
              mode.moving.user = oldEntity.user;

              sketch.setMode(cursors.ENTITY);

              found = true;
              update.set('entities');

              break;
            }
          }
        }

        if (found) return;

        if (user.role === 'admin') {
          // Move Asset
          const ax = view.mx / map.asset.scale;
          const ay = view.my / map.asset.scale;

          for (let i = map.assets.length - 1; i >= 0; --i) {
            if (map.assets[i].contains(ax, ay)) {
              const oldAsset = map.assets.splice(i, 1)[0];
              mode.asset = oldAsset.type;
              view.asset.zoom.set(oldAsset.zoom);
              view.asset.rot.set(oldAsset.rot);

              sketch.setMode(cursors.ASSET);

              found = true;
              update.set('assets');

              break;
            }
          }

          if (found) return;

          // Move Wall
          const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
          const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

          for (let i = map.walls.length - 1; i >= 0; --i) {
            if (map.walls[i].contains(wx, wy)) {
              // Determin what end is closer
              const selected = map.walls.splice(i, 1)[0];
              mode.wall = selected.type;

              const d0 = (wx - selected.x[0]) ** 2 + (wy - selected.y[0]) ** 2;
              const d1 = (wx - selected.x[1]) ** 2 + (wy - selected.y[1]) ** 2;

              if (d0 > d1) {
                mode.walling = new Wall(mode.wall, selected.x[0], selected.y[0]);
              } else {
                mode.walling = new Wall(mode.wall, selected.x[1], selected.y[1]);
              }

              sketch.setMode(cursors.WALL, false);

              found = true;
              update.set('walls');

              break;
            }
          }
        }
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

      erase() { // Press
        let found = false;

        // Erase Entity
        const ex = view.mx / map.entity.scale;
        const ey = view.my / map.entity.scale;
        for (let i = map.entities.length - 1; i >= 0; --i) {
          if (map.entities[i].contains(ex, ey)) {
            map.entities.splice(i, 1);

            found = true;
            update.set('entities');

            break;
          }
        }

        if (found) return;

        // Erase Asset
        const ax = view.mx / map.asset.scale;
        const ay = view.my / map.asset.scale;

        for (let i = map.assets.length - 1; i >= 0; --i) {
          if (map.assets[i].contains(ax, ay)) {
            map.assets.splice(i, 1);

            found = true;
            update.set('assets');

            break;
          }
        }

        if (found) return;

        // Erase Wall
        const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
        const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

        for (let i = map.walls.length - 1; i >= 0; --i) {
          if (map.walls[i].contains(wx, wy)) {
            map.walls.splice(i, 1);

            found = true;
            update.set('walls');

            break;
          }
        }
      },

      texture() { // Press/Drag
        // TODO: Use new render object to modify texture using p5 lines/elipses
        //       https://p5js.org/examples/structure-create-graphics.html
        if (mode.texture < 0 || mode.texture >= textures.COUNT) return;

        // Update map texture
        map.texture.image.loadPixels();

        if (!mode.fill) { // Brush mode
          const dLimit = view.brush.val * view.brush.val / 4;
          for (let i = -view.brush.val / 2; i < view.brush.val / 2; i += map.texture.scale) {
            const x = Math.floor((view.mx + i) / map.texture.scale);

            if (x < 0 || x >= map.texture.width) continue;
            const di = i * i;

            for (let j = -view.brush.val / 2; j < view.brush.val / 2; j += map.texture.scale) {
              const y = Math.floor((view.my + j) / map.texture.scale);

              if (y < 0 || y >= map.texture.height) continue;
              const d = di + j * j;

              if (d < dLimit) {
                const index = 4 * (y * map.texture.width + x);
                map.texture.val[x][y] = mode.texture;

                if (mode.texture === 0) {
                  map.texture.image.pixels[index]     = 0;
                  map.texture.image.pixels[index + 1] = 0;
                  map.texture.image.pixels[index + 2] = 0;
                  map.texture.image.pixels[index + 3] = 0;
                } else {
                  const image = textures.images[mode.texture];
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
        } else { // Fill mode
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
              map.texture.val[x][y] = mode.texture;

              if (mode.texture === 0) {
                map.texture.image.pixels[index]     = 0;
                map.texture.image.pixels[index + 1] = 0;
                map.texture.image.pixels[index + 2] = 0;
                map.texture.image.pixels[index + 3] = 0;
              } else {
                const image = textures.images[mode.texture];
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
        if (mode.fog < 0 || mode.fog > 1) return;

        // Update map texture
        const image = textures.images[textures.FOG];
        map.fog.image.loadPixels();

        if (!mode.fill) { // Brush mode
          const dLimit = view.brush.val * view.brush.val / 4;
          for (let i = -view.brush.val / 2; i < view.brush.val / 2; i += map.fog.scale) {
            const x = Math.floor((view.mx + i) / map.fog.scale);

            if (x < 0 || x >= map.fog.width) continue;
            const di = i * i;

            for (let j = -view.brush.val / 2; j < view.brush.val / 2; j += map.fog.scale) {
              const y = Math.floor((view.my + j) / map.fog.scale);

              if (y < 0 || y >= map.fog.height) continue;
              const d = di + j * j;

              if (d < dLimit) {
                const index = 4 * (y * map.fog.width + x);
                map.fog.val[x][y] = mode.fog;

                if (mode.fog === 0) {
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
        } else { // Fill mode
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
              map.fog.val[x][y] = mode.fog;

              if (mode.fog === 0) {
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
        mode.walling = null;
      },

      entity() { // Press
        // Set mode to move
        sketch.setMode(cursors.MOVE);
      },

      asset() { // Press
        if (mode.ctrl) {
          // Set asset to move mode
          sketch.setMode(cursors.MOVE);
        } else {
          view.asset.rot.set(view.asset.rot.val + view.asset.rot.step);
        }
      },

      move() { // Press
        if (user.role === 'admin') {
          // Rotate assets
          const ax = view.mx / map.asset.scale;
          const ay = view.my / map.asset.scale;
          // Rotate asset if mouse is over
          for (let i = map.assets.length - 1; i >= 0; --i) {
            if (map.assets[i].contains(ax, ay)) {
              map.assets[i].rotate(view.asset.rot.step);
              update.set('assets');
              break;
            }
          }
        }
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
    COUNT:0,
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
      this.points = null;
      this.image = null;
      switch (arguments.length) {
        case 0:
          this.mode = 0;
          break;
        case 1:
          this.type = first.type;
          this.x = first.x;
          this.y = first.y;
          this.mode = 2;
          break;
        case 3:
          this.type = first;
          this.start(second, third);
          break;
      }
    }

    start(x0, y0) {
      this.x[0] = x0;
      this.y[0] = y0;
      this.mode = 1;
    }

    end(x1, y1) {
      if (x1 === this.x[0] && y1 === this.y[0]) return;
      this.x[1] = x1;
      this.y[1] = y1;
      this.mode = 2;
    }

    copy() {
      const out = new Wall();
      out.type = this.type;
      out.mode = this.mode;
      out.x[0] = this.x[0];
      out.x[1] = this.x[1];
      out.y[0] = this.y[0];
      out.y[1] = this.y[1];
      out.image = this.image;

      return out;
    }

    data() {
      if (this.mode !== 2) return null;
      return {
        type: this.type,
        x: this.x,
        y: this.y
      };
    }

    draw() {
      if (this.mode !== 2) return;

      if (this.type === walls.NONE) { // Solid wall
        sketch.noStroke();
        sketch.fill(0);

        if (this.points === null) { // Could be done in end or copy constructor
          let par = {
            x: this.x[1] - this.x[0],
            y: this.y[1] - this.y[0]
          };
          let mag = Math.sqrt(par.x * par.x + par.y * par.y);
          par.x /= mag;
          par.y /= mag;
          let per = {
            x: -par.y * map.wall.width / 2,
            y:  par.x * map.wall.width / 2
          };

          this.points = [{
            x: this.x[0] + per.x,
            y: this.y[0] + per.y
          }, {
            x: this.x[0] - per.x,
            y: this.y[0] - per.y
          }, {
            x: this.x[1] - per.x,
            y: this.y[1] - per.y
          }, {
            x: this.x[1] + per.x,
            y: this.y[1] + per.y
          }];
        }

        sketch.quad(
          this.points[0].x, this.points[0].y,
          this.points[1].x, this.points[1].y,
          this.points[2].x, this.points[2].y,
          this.points[3].x, this.points[3].y
        );

        sketch.ellipseMode(sketch.CENTER);
        sketch.ellipse(this.x[0], this.y[0], map.wall.width, map.wall.width);
        sketch.ellipse(this.x[1], this.y[1], map.wall.width, map.wall.width);

      } else {
        const par = {
          x: this.x[1] - this.x[0],
          y: this.y[1] - this.y[0]
        };

        if (this.points === null) { // Could be done in end or copy constructor
          const mag = Math.sqrt(par.x * par.x + par.y * par.y);
          const ppar = {
            x: par.x / mag,
            y: par.y / mag
          };
          let per = {
            x: -ppar.y * map.wall.width / 2,
            y:  ppar.x * map.wall.width / 2
          };

          this.points = [{
            x: this.x[0] + per.x,
            y: this.y[0] + per.y
          }, {
            x: this.x[0] - per.x,
            y: this.y[0] - per.y
          }, {
            x: this.x[1] - per.x,
            y: this.y[1] - per.y
          }, {
            x: this.x[1] + per.x,
            y: this.y[1] + per.y
          }];
        }

        if (this.image === null) {
          const image = walls.images[this.type];
          const mag = Math.round(Math.sqrt(par.x * par.x + par.y * par.y) / map.wall.scale + image.height);

          this.image = sketch.createImage(mag, image.height);
          this.image.loadPixels();
          image.loadPixels();

          for (let i = 0; i < this.image.width; ++i) {
            const tx = i % image.width;
            for (let j = 0; j < this.image.height; ++j) {
              const index = 4 * (j * this.image.width + i);
              const tindex = 4 * (j * image.width + tx);

              this.image.pixels[index] = image.pixels[tindex];
              this.image.pixels[index + 1] = image.pixels[tindex + 1];
              this.image.pixels[index + 2] = image.pixels[tindex + 2];
              this.image.pixels[index + 3] = image.pixels[tindex + 3];
            }
          }
          this.image.updatePixels();
        }

        sketch.push();
          sketch.scale(map.wall.scale);
          sketch.translate(this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
          sketch.rotate(Math.PI / 2 - Math.atan2(par.x, par.y));
          sketch.translate(-this.x[0] / map.wall.scale, -this.y[0] / map.wall.scale);
          sketch.translate(this.image.height / -2, this.image.height / -2);
          sketch.image(this.image, this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
        sketch.pop();
      }
    }

    drawToMouse(x, y) {
      if (this.mode !== 1) return;

      if (this.type === walls.NONE) { // Solid wall
        const par = {
          x: x - this.x[0],
          y: y - this.y[0]
        };
        const mag = Math.sqrt(par.x * par.x + par.y * par.y);
        par.x /= mag;
        par.y /= mag;
        const per = {
          x: -par.y * map.wall.width / 2,
          y:  par.x * map.wall.width / 2
        };

        const points = [
        {
          x: this.x[0] + per.x,
          y: this.y[0] + per.y
        }, {
          x: this.x[0] - per.x,
          y: this.y[0] - per.y
        }, {
          x: x - per.x,
          y: y - per.y
        }, {
          x: x + per.x,
          y: y + per.y
        }];

        sketch.noStroke();
        sketch.fill(0);
        sketch.quad(
          points[0].x, points[0].y,
          points[1].x, points[1].y,
          points[2].x, points[2].y,
          points[3].x, points[3].y
        );

        sketch.ellipseMode(sketch.CENTER);
        sketch.ellipse(this.x[0], this.y[0], map.wall.width, map.wall.width);
        sketch.ellipse(x, y, map.wall.width, map.wall.width);

      } else {
        const par = {
          x: x - this.x[0],
          y: y - this.y[0]
        };
        if (par.x !== 0 || par.y !== 0) {
          const image = walls.images[this.type];
          const mag = Math.round(Math.sqrt(par.x * par.x + par.y * par.y) / map.wall.scale) + image.height;

          this.image = sketch.createImage(mag, image.height);
          this.image.loadPixels();
          image.loadPixels();

          for (let i = 0; i < this.image.width; ++i) {
            const tx = i % image.width;
            for (let j = 0; j < this.image.height; ++j) {
              const index = 4 * (j * this.image.width + i);
              const tindex = 4 * (j * image.width + tx);

              this.image.pixels[index] = image.pixels[tindex];
              this.image.pixels[index + 1] = image.pixels[tindex + 1];
              this.image.pixels[index + 2] = image.pixels[tindex + 2];
              this.image.pixels[index + 3] = image.pixels[tindex + 3];
            }
          }
          this.image.updatePixels();

          sketch.push();
            sketch.scale(map.wall.scale);
            sketch.translate(this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
            sketch.rotate(Math.PI / 2 - Math.atan2(par.x, par.y));
            sketch.translate(-this.x[0] / map.wall.scale, -this.y[0] / map.wall.scale);
            sketch.translate(this.image.height / -2, this.image.height / -2);
            sketch.image(this.image, this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
          sketch.pop();
        }
      }
    }

    contains(x, y) {
      const buf = 1;
      const v0 = {
        x: this.points[1].x - this.points[0].x,
        y: this.points[1].y - this.points[0].y
      };
      const v1 = {
        x: this.points[3].x - this.points[0].x,
        y: this.points[3].y - this.points[0].y
      };

      if ((x - this.points[0].x) * v0.x + (y - this.points[0].y) * v0.y < -buf) return false;
      if ((x - this.points[1].x) * v0.x + (y - this.points[1].y) * v0.y >  buf) return false;
      if ((x - this.points[0].x) * v1.x + (y - this.points[0].y) * v1.y < -buf) return false;
      if ((x - this.points[3].x) * v1.x + (y - this.points[3].y) * v1.y >  buf) return false;

      return true;
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

    draw(x, y) {
      if (arguments.length !== 2) {
        x = this.x;
        y = this.y;
      }

      // Update user color
      this.color = getUserColor(this.user);

      sketch.ellipseMode(sketch.CENTER);
      sketch.noStroke();
      sketch.fill(this.color[0], this.color[1], this.color[2], 255);
      sketch.ellipse(x, y, entities.images[this.type].width + 50, entities.images[this.type].height + 50);

      sketch.imageMode(sketch.CENTER);
      sketch.image(entities.images[this.type], x, y);
    }

    contains(x, y) {
      const dx = Math.abs(x - this.x) * 2.5;
      const dy = Math.abs(y - this.y) * 2.5;

      if (dx <= entities.images[this.type].width &&
          dy <= entities.images[this.type].height) return true;
      return false;
    }
  }

  class Asset {
    constructor(first, x, y, zoom, rot) {
      switch (arguments.length) {
        case 1:
          this.type = first.type;
          this.x = first.x;
          this.y = first.y;
          this.zoom = first.zoom;
          this.rot = first.rot;
          break;
        case 5:
          this.type = first;
          this.x = x / zoom;
          this.y = y / zoom;
          this.zoom = zoom;
          this.rot = rot;
          break;
      }
    }

    data() {
      return {
        type: this.type,
        x: this.x,
        y: this.y,
        zoom: this.zoom,
        rot: this.rot
      };
    }

    draw() {
      sketch.imageMode(sketch.CENTER);
      sketch.push();
        sketch.scale(this.zoom);
        sketch.translate(this.x, this.y);
        sketch.rotate(sketch.radians(this.rot));
        sketch.translate(-this.x, -this.y);
        sketch.image(assets.images[this.type], this.x, this.y);
      sketch.pop();
    }

    contains(x, y) {
      const dx = Math.abs(x / this.zoom - this.x) * 2.5;
      const dy = Math.abs(y / this.zoom - this.y) * 2.5;

      if (dx <= assets.images[this.type].width &&
          dy <= assets.images[this.type].height) return true;
      return false;
    }

    rotate(rot) {
      this.rot += rot;
      while (this.rot > 360) this.rot -= 360;
      while (this.rot < 0) this.rot += 360;
    }
  }

  let onCanvas = false;
  let totalLoading = 0;
  let loading = 0;

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
    view.x = map.width / 2;
    view.y = map.height / 2;
    const zx = view.width / map.width;
    const zy = view.height / map.height;
    view.zoom.MIN = Math.min(zx, zy) * 0.8;
    view.zoom.set(0);

    // Request map data
    mode.loaded = true;
  };

  sketch.draw = () => {
    // Update mouse position on map
    view.mx = (sketch.mouseX - sketch.width/2) / view.zoom.val + view.x;
    view.my = (sketch.mouseY - sketch.height/2) / view.zoom.val + view.y;

    //sketch.background(235);
    sketch.clear();
    sketch.fill(0);
    switch (mode.cursor.val) {
      case cursors.FOG:
        sketch.text(`Fog: ${mode.fog === 0 ? 'Erase' : 'Draw'}`, 2, 10);
        break;
      case cursors.TEXTURE:
        sketch.text(`Texture: ${textures.names[mode.texture]}`, 2, 10);
        break;
      case cursors.ASSET:
        sketch.text(`Asset: ${assets.names[mode.asset]}`, 2, 10);
        break;
      case cursors.ENTITY:
        sketch.text(`Entity: ${entities.names[mode.entity]}`, 2, 10);
        break;
      case cursors.WALL:
        sketch.text(`Wall: ${walls.names[mode.wall]}`, 2, 10);
        break;
    }

    // TODO: Move canvas manipulation into drawMap. Possibly remove some transforms from hover and cursor.
    sketch.translate(-view.x * view.zoom.val, -view.y * view.zoom.val);
    sketch.scale(view.zoom.val);
    sketch.translate(sketch.width/(2 * view.zoom.val), sketch.height/(2 * view.zoom.val));

    drawMap();
    drawHover();
    drawCursor();
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
    if (view.mx < 0 || view.mx > map.width ||
        view.my < 0 || view.my > map.height) return;

    switch (mode.cursor.val) {
      case cursors.MAPS:
        mode.do.map();
        break;
      case cursors.WALL:
        mode.do.wall();
        break;
      case cursors.ENTITY:
        mode.do.entity();
        break;
      case cursors.ASSET:
        mode.do.asset();
        break;
      case cursors.MOVE:
        mode.do.move();
        break;
      case cursors.ERASE:
        mode.do.erase();
        break;
      case cursors.TEXTURE:
        mode.do.texture();
        break;
      case cursors.FOG:
        mode.do.fog();
        break;
    }
  };

  function mouseRight() {
    switch (mode.cursor.val) {
      // case cursors.MAPS:
      //   mode.done.map();
      //   break;
      case cursors.WALL:
        mode.done.wall();
        break;
      case cursors.ENTITY:
        mode.done.entity();
        break;
      case cursors.ASSET:
        mode.done.asset();
        break;
      case cursors.MOVE:
        mode.done.move();
        break;
      // case cursors.ERASE:
      //   mode.done.erase();
      //   break;
      // case cursors.TEXTURE:
      //   mode.done.texture();
      //   break;
    }
  }

  sketch.mouseDragged = () => {
    if (!onCanvas) return;

    const time = new Date().getTime();
    const dt = time - mode.dragging.time;

    switch (mode.cursor.val) {
      case cursors.MAP:
        if (dt >= mode.dragging.rate.fast) {
          mode.dragging.time = time;
          mode.do.map();
        }
        break;
      case cursors.TEXTURE:
        if (dt >= mode.dragging.rate.fast) {
          mode.dragging.time = time;
          mode.do.texture(true);
        }
        break;
      case cursors.FOG:
        if (dt >= mode.dragging.rate.fast) {
          mode.dragging.time = time;
          mode.do.fog(true);
        }
        break;
      case cursors.DRAW:
        if (dt >= mode.dragging.rate.slow) {
          mode.dragging.time = time;
          mode.do.draw(true);
        }
        break;
    }
  };

  sketch.mouseReleased = () => {
    if (!onCanvas) return;

    switch (mode.cursor.val) {
      case cursors.DRAW:
        mode.do.draw(false);
        break;
    }

    mode.dragging.time = 0;
  }

  sketch.mouseWheel = event => {
    if (!onCanvas) return;

    switch (mode.cursor.val) {
      case cursors.MAP:
      case cursors.WALL:
      case cursors.ERASE:
        view.zoom.set(view.zoom.val - 0.2 * Math.sign(event.delta));
        break;
      case cursors.ASSET:
        view.asset.zoom.set(view.asset.zoom.val - 0.1 * Math.sign(event.delta));
        break;
      case cursors.TEXTURE:
      case cursors.FOG:
        view.brush.set(view.brush.val - Math.sign(event.delta));
        break;
    }
  };

  sketch.keyPressed = () => {
    if (sketch.key === 'Control') mode.ctrl = true;

    if (sketch.key === 'Shift') {
      mode.cursor.old = mode.cursor.val;
      mode.cursor.val = cursors.MAP;
    }

    if (!onCanvas) return;
    switch (sketch.key) {
      case 'm': // Map Mode
        sketch.setMode(cursors.MAP);
        break;
      case 'g': // Move Mode
        sketch.setMode(cursors.MOVE);
        break;
      case 'd': // Draw Mode
        sketch.setMode(cursors.DRAW);
        break;
      case 'x': // Erase Mode
        sketch.setMode(cursors.ERASE);
        break;
      case 'o': // Grid Overlay
        view.grid = !view.grid;
        break;
      case '=':
      case '+':
        switch (mode.cursor.val) {
          case cursors.ASSET:
            view.asset.zoom.set(view.asset.zoom.val * 1.1);
            break;
          case cursors.TEXTURE:
            view.brush.set(view.brush.val * 1.1);
            break;
          default:
            view.zoom.set(view.zoom.val * 1.1);
        }
        break;
      case '-':
      case '_':
        switch (mode.cursor.val) {
          case cursors.ASSET:
            view.asset.zoom.set(view.asset.zoom.val * 0.9);
            break;
          case cursors.TEXTURE:
            view.brush.set(view.brush.val * 0.9);
            break;
          default:
            view.zoom.set(view.zoom.val * 0.9);
        }
        break;
    }

    if (user.role === 'admin') {
      switch (sketch.key) {
        case 'w':
          sketch.setMode(cursors.WALL);
          break;
        case 'e':
          sketch.setMode(cursors.ENTITY);
          break;
        case 'a':
          sketch.setMode(cursors.ASSET);
          break;
        case 'b': // Texture Mode (brush)
          mode.fill = false;
          sketch.setMode(cursors.TEXTURE);
          break;
        case 'f': // Texture Mode (fill)
          mode.fill = true;
          sketch.setMode(cursors.TEXTURE);
          break;
        case 'h': // Fog Mode
          //mode.fill = true;
          sketch.setMode(cursors.FOG);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          const key = sketch.key - '0';
          switch (mode.cursor.val) {
            case cursors.FOG:
              mode.fog = key;
              if (key === 1) {
                textures.images[textures.FOG].loadPixels();
              }
              break;
            case cursors.TEXTURE:
              mode.texture = key;
              if (key > 0 && key < textures.COUNT) {
                textures.images[key].loadPixels();
              }
            break;
            case cursors.WALL:
              mode.wall = key;
            break;
            case cursors.ENTITY:
              // Temp fix for Entity 9 (colors)
              if (key === 9) {
                if (mode.entity > 8 && mode.entity < 12) {
                  mode.entity++;
                  if (mode.entity > 11) {
                    mode.entity = 9;
                  }
                } else {
                  mode.entity = key;
                }
              } else {
                mode.entity = key;
              }
              break;
            case cursors.ASSET:
              mode.asset = key;
              break;
          }
          break;
      }
    }
  };

  sketch.keyReleased = () => {
    if (sketch.key === "Control") mode.ctrl = false;

    if (sketch.key === 'Shift' &&
        mode.cursor.val !== mode.cursor.old) {
      mode.cursor.val = mode.cursor.old;
    }
  }

  sketch.setMode = (m, reset = true) => {
    if (m >= 0 && m < cursors.COUNT) {
      if (reset) mode.walling = null;

      mode.cursor.old = m;
      mode.cursor.val = m;
    }
  };

  // TODO: merge with keypress to use single function
  sketch.setSpecificMode = (name, key) => {
    switch(name) {
      case 'texture':
        mode.fill = false;
        sketch.setMode(cursors.TEXTURE);
        mode.texture = key;
        if (key > 0 && key < textures.COUNT) {
          textures.images[key].loadPixels();
        }
        break;
      case 'fill':
        mode.fill = true;
        sketch.setMode(cursors.TEXTURE);
        mode.texture = key;
        if (key > 0 && key < textures.COUNT) {
          textures.images[key].loadPixels();
        }
        break;
      case 'fog':
        mode.fill = false;
        sketch.setMode(cursors.FOG);
        mode.fog = key;
        if (key === 1) {
          textures.images[textures.FOG].loadPixels();
        }
        break;
      case 'wall':
        sketch.setMode(cursors.WALL);
        mode.wall = key;
        break;
      case 'entity':
        sketch.setMode(cursors.ENTITY);
        mode.entity = key;
        break;
      case 'asset':
        sketch.setMode(cursors.ASSET);
        mode.asset = key;
        break;
      case 'map':
        sketch.setMode(cursors.MAP);
        break;
      case 'move':
        sketch.setMode(cursors.MOVE);
        break;
      case 'draw':
        sketch.setMode(cursors.DRAW);
        break;
      case 'erase':
        sketch.setMode(cursors.ERASE);
        break;
    }
  };

  sketch.isLoaded = () => {
    return mode.loaded;
  }

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
        target.images[target[key]] = sketch.loadImage(MEDIA_MAPS + folder + data[key][2], mediaLoading);
      }
    }

    if (DEBUG) console.log(`Loaded ${folder}`);

    return target;
  }

  function mediaLoading() {
    loading++;

    if (loading > totalLoading) loading = totalLoading;

    const perc = loading / totalLoading * 100;
    const percStr = `${perc.toString()}%`;
    $('#loader-bar').css('width', percStr);
    $('#loader-status').html(`Loading (${loading}/${totalLoading})`);
  }

  function loadCursors(data) {
    loadMedia(cursors, data, 'cursors/');
    sketch.setMode(cursors.MAP);
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
    drawTexture();
    drawGrid();
    drawWalls();
    drawAssets();
    drawEntities();
    drawFog();
    drawLines();
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

    if (mode.walling !== null && mode.walling.mode === 1) {
      const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
      const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

      mode.walling.drawToMouse(wx, wy);
    }
  }

  function drawAssets() {
    sketch.push();
      sketch.scale(map.asset.scale);
      for (asset of map.assets) {
        asset.draw();
      }
    sketch.pop();
  }

  function drawEntities() {
    sketch.push();
      sketch.scale(map.entity.scale);
      for (entity of map.entities) {
        entity.draw();
      }
    sketch.pop();
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
      sketch.push();
      sketch.scale(map.entity.scale);
      for (entity of map.entities) {
        if (entity.user.id === user.id) {
          entity.draw();
        }
      }
    sketch.pop();
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
    if (mode.cursor.val === cursors.MOVE ||
        mode.cursor.val === cursors.ERASE) {
      const ex = view.mx / map.entity.scale;
      const ey = view.my / map.entity.scale;
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

        if (entity.contains(ex, ey)) {
          const size = 16;
          const corWidth = Math.min(256, sketch.width / 3);
          const corHeight = corWidth + 2.75 * size;
          const scale = corWidth / 6 * map.entity.scale;

          sketch.push();
            sketch.translate(-sketch.width/(2 * view.zoom.val), -sketch.height/(2 * view.zoom.val));
            sketch.scale(1/view.zoom.val);
            sketch.translate(view.x * view.zoom.val, view.y * view.zoom.val);

            sketch.rectMode(sketch.CORNER);
            sketch.strokeWeight(6);
            sketch.stroke(entity.color[0], entity.color[1], entity.color[2], 255);
            sketch.fill(255);

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

    sketch.rectMode(sketch.CENTER);
    sketch.strokeWeight(1 / view.zoom.val);
    sketch.stroke(0, 0, 0);

    switch (mode.cursor.val) {
      case cursors.MAP:
        drawCursorImage();
        sketch.fill(0);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;

      case cursors.WALL:
        const wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
        const wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

        sketch.fill(0, 255, 255);
        sketch.rect(wx, wy, 10 / view.zoom.val, 10 / view.zoom.val);

        drawCursorImage();
        sketch.fill(0);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;

      case cursors.ENTITY:
        if (mode.entity >= 0 && mode.entity < entities.COUNT) {
          sketch.push();
            sketch.scale(map.entity.scale);

            const ex = view.mx / map.entity.scale;
            const ey = view.my / map.entity.scale;

            sketch.ellipseMode(sketch.CENTER);
            sketch.noStroke();
            sketch.fill(255, 0, 0, 255);
            sketch.ellipse(ex, ey, entities.images[mode.entity].width + 50, entities.images[mode.entity].height + 50);

            sketch.imageMode(sketch.CENTER);
            sketch.image(entities.images[mode.entity], ex, ey);
          sketch.pop();
        }

        drawCursorImage();
        sketch.fill(0, 0, 255);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;

      case cursors.ASSET:
        if (mode.asset >= 0 && mode.asset < assets.COUNT) {
          const ax = view.mx / view.asset.zoom.val / map.asset.scale;
          const ay = view.my / view.asset.zoom.val / map.asset.scale;
          sketch.imageMode(sketch.CENTER);
          sketch.push();
            sketch.translate(view.mx, view.my);
            sketch.rotate(sketch.radians(view.asset.rot.val));
            sketch.translate(-view.mx, -view.my);
            sketch.scale(map.asset.scale * view.asset.zoom.val);
            sketch.image(assets.images[mode.asset], ax, ay);
          sketch.pop();
        }

        drawCursorImage();
        sketch.fill(0, 0, 255);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;

      case cursors.MOVE:
        drawCursorImage();
        sketch.fill(0, 255, 0);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;

      case cursors.DRAW:
        drawCursorImage();
        color = getUserColor(user);
        sketch.fill(color[0], color[1], color[2]);
        sketch.ellipse(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;

      case cursors.ERASE:
        drawCursorImage();
        sketch.fill(255, 0, 0);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;

      case cursors.TEXTURE:
      case cursors.FOG:
        let radius = view.brush.val;
        if (mode.fill) {
          radius = view.brush.MIN;
        }

        sketch.ellipseMode(sketch.CENTER);
        sketch.noFill();
        sketch.stroke(0);
        sketch.strokeWeight(2 / view.zoom.val);
        sketch.ellipse(view.mx, view.my, radius, radius);
        break;
    }
  }

  function drawCursorImage() {
    sketch.imageMode(sketch.CORNER);
    sketch.push();
      sketch.scale(map.cursor.scale / view.zoom.val);
      sketch.image(cursors.images[mode.cursor.val], view.mx * view.zoom.val / map.cursor.scale, view.my * view.zoom.val / map.cursor.scale);
    sketch.pop();
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
          out.val.push([val, count]);
          val = curr;
          count = 1;
        }
      }
    }
    out.val.push([val, count]);

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
      for (let v = 0; v < val[1]; ++v) {
        out.val[i][j] = val[0];
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
  }; // End of sketch

  const myp5 = new p5(s);