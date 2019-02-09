var s = function( sketch ) {

var data = {
  // All data that is transferred over socket
  walls:    [],
  entities: [],
  assets:   [],
  texture: null
};

var update = {
  get: function() {
    return (this.walls ||
            this.entities ||
            this.assets ||
            this.texture);
  },
  set: function(t, m) {
    this[t] = m;

    $('#update-button').removeClass('btn-secondary');
    $('#update-button').addClass('btn-primary');
  },
  reset: function() {
    this.walls = false;
    this.entities = false;
    this.assets = false;
    this.texture = false;

    $('#update-button').removeClass('btn-primary');
    $('#update-button').addClass('btn-secondary');
  },
  data: function() {
    return {
      walls: this.walls,
      entities: this.entities,
      assets: this.assets,
      texture: this.texture
    };
  },
  copy: function(v) {
    this.walls = v.walls;
    this.entities = v.entities;
    this.assets = v.assets;
    this.texture = v.texture;
  },
  last: false,
  walls: false,
  entities: false,
  assets: false,
  texture: false
};

var map = {
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

  walls:    [],
  entities: [],
  assets:   []
};

var view = {
  width: 680,
  height: 480,
  x: 0,
  y: 0,
  grid: true,
  zoom: {
    val: 10,
    MIN: 0.5,
    MAX: 20,
    set: function(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
  },
  mx: 0,
  my: 0,
  brush: {
    val: 10,
    MIN: 2,
    MAX: 100,
    set: function(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
  },
  asset: {
    zoom: {
      val: 1,
      MIN: 1, // 0.5 - disable asset scaling
      MAX: 1, // 4
      set: function(v) {
        this.val = sketch.constrain(v, this.MIN, this.MAX);
      },
      reset: function() { this.val = 1; }
    },
    rot: {
      val: 0,
      MIN: 0,
      MAX: 360,
      set: function(v) {
        while (v < this.MIN) v += this.MAX;
        while (v > this.MAX) v -= this.MAX;
        this.val = v;
      },
      reset: function() { this.val = 0; }
    }
  }
};

var mode = {
  loaded: false,
  ctrl: false,
  cursor: 0,
  oldCursor: 0,
  texture: 0,
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
    map: function() { // Drag
      view.x += (sketch.pmouseX - sketch.mouseX) / view.zoom.val;
      view.y += (sketch.pmouseY - sketch.mouseY) / view.zoom.val;
      view.x = sketch.constrain(view.x, 0, map.width);
      view.y = sketch.constrain(view.y, 0, map.height);
    },

    wall: function() { // Press
      if (mode.wall < 0 || mode.wall >= walls.COUNT) return;

      var wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
      var wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

      if (mode.walling === null) { // Start new wall
        mode.walling = new Wall(mode.wall, wx, wy);

      } else {
        // TODO: Make .end return true if new wall is valid
        // TODO: Possibly remove mode from wall
        mode.walling.end(wx, wy);

        if (mode.walling.mode === 2) { // End of wall is at new location
          // Add new wall
          update.set('walls', true);
          map.walls.push(mode.walling.copy());

          if (mode.ctrl) { // Start new wall
            mode.walling = new Wall(mode.wall, wx, wy);

          } else {
            mode.walling = null;

            if (!mode.ctrl) {
              sketch.setMode(cursors.MOVE);
            }
          }

        } else {
          mode.walling = null;

          if (!mode.ctrl) {
            sketch.setMode(cursors.MOVE);
          }
        }
      }
    },

    entity: function() { // Press
      if (mode.entity < 0 || mode.entity >= entities.COUNT) return;

      var ex = view.mx / map.entity.scale;
      var ey = view.my / map.entity.scale;

      var newEntity;
      update.set('entities', true);
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
    },

    asset: function() { // Press
      if (mode.asset < 0 || mode.asset >= assets.COUNT) return;

      var ax = view.mx / map.asset.scale;
      var ay = view.my / map.asset.scale;

      update.set('assets', true);
      map.assets.push(new Asset(mode.asset, ax, ay, view.asset.zoom.val, view.asset.rot.val));
      if (!mode.ctrl) {
        view.asset.zoom.reset();
        view.asset.rot.reset();
        sketch.setMode(cursors.MOVE);
      }
    },

    move: function() { // Press
      var found = false;

      // Move Entity
      var ex = view.mx / map.entity.scale;
      var ey = view.my / map.entity.scale;

      for (var i = map.entities.length - 1; i >= 0; --i) {
        if (map.entities[i].contains(ex, ey)) {
          if (user.role === 'admin' ||
              (user.role === 'user' && user.name === map.entities[i].user.name)) {
            update.set('entities', true);
            var oldEntity = map.entities.splice(i, 1)[0];
            mode.entity = oldEntity.type;
            mode.moving.val = true;
            mode.moving.user = oldEntity.user;

            sketch.setMode(cursors.ENTITY);

            found = true;
            break;
          }
        }
      }

      if (found) return;

      if (user.role === 'admin') {
        // Move Asset
        var ax = view.mx / map.asset.scale;
        var ay = view.my / map.asset.scale;

        for (var i = map.assets.length - 1; i >= 0; --i) {
          if (map.assets[i].contains(ax, ay)) {
            update.set('assets', true);
            var oldAsset = map.assets.splice(i, 1)[0];
            mode.asset = oldAsset.type;
            view.asset.zoom.set(oldAsset.zoom);
            view.asset.rot.set(oldAsset.rot);

            sketch.setMode(cursors.ASSET);

            found = true;
            break;
          }
        }

        if (found) return;

        // Move Wall
        var wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
        var wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

        for (var i = map.walls.length - 1; i >= 0; --i) {
          if (map.walls[i].contains(wx, wy)) {
            update.set('walls', true);

            // Determin what end is closer
            var selected = map.walls.splice(i, 1)[0];
            mode.wall = selected.type;

            var d0 = Math.pow(wx - selected.x[0], 2) + Math.pow(wy - selected.y[0], 2);
            var d1 = Math.pow(wx - selected.x[1], 2) + Math.pow(wy - selected.y[1], 2);

            if (d0 > d1) {
              mode.walling = new Wall(mode.wall, selected.x[0], selected.y[0]);
            } else {
              mode.walling = new Wall(mode.wall, selected.x[1], selected.y[1]);
            }

            sketch.setMode(cursors.WALL, false);

            found = true;
            break;
          }
        }
      }
    },

    erase: function() { // Press
      var found = false;

      // Erase Entity
      var ex = view.mx / map.entity.scale;
      var ey = view.my / map.entity.scale;
      for (var i = map.entities.length - 1; i >= 0; --i) {
        if (map.entities[i].contains(ex, ey)) {
          update.set('entities', true);

          map.entities.splice(i, 1);
          found = true;
          break;
        }
      }

      // Erase Asset
      var ax = view.mx / map.asset.scale;
      var ay = view.my / map.asset.scale;

      for (var i = map.assets.length - 1; i >= 0; --i) {
        if (map.assets[i].contains(ax, ay)) {
          update.set('assets', true);

          map.assets.splice(i, 1);
          break;
        }
      }

      if (found) return;

      // Erase Wall
      var wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
      var wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

      for (var i = map.walls.length - 1; i >= 0; --i) {
        if (map.walls[i].contains(wx, wy)) {
          update.set('walls', true);

          map.walls.splice(i, 1);
          found = true;
          break;
        }
      }

      if (found) return;
    },

    texture: function() { // Press/Drag
      if (mode.texture < 0 || mode.texture >= textures.COUNT) return;

      update.set('texture', true);

      // Update map texture
      map.texture.image.loadPixels();

      if (!mode.fill) {
        var dLimit = view.brush.val * view.brush.val / 4;
        for (var i = -view.brush.val / 2; i < view.brush.val / 2; i += map.texture.scale) {
          var x = Math.floor((view.mx + i) / map.texture.scale);

          if (x < 0 || x >= map.texture.width) continue;
          var di = i * i;

          for (var j = -view.brush.val / 2; j < view.brush.val / 2; j += map.texture.scale) {
            var y = Math.floor((view.my + j) / map.texture.scale);

            if (y < 0 || y >= map.texture.height) continue;
            var d = di + j * j;

            if (d < dLimit) {
              map.texture.val[x][y] = mode.texture;

              if (map.texture.val[x][y] === 0) {
                map.texture.image.set(x, y, [0, 0, 0, 0]);

              } else {
                var tx = x % textures.images[map.texture.val[x][y]].width;
                var ty = y % textures.images[map.texture.val[x][y]].height;
                var tex = textures.images[map.texture.val[x][y]].get(tx, ty);
                map.texture.image.set(x, y, tex);
              }
            }
          }
        }
      } else {
        var x = Math.floor(view.mx / map.texture.scale);
        if (x < 0 || x >= map.texture.width) return;
        var y = Math.floor(view.my / map.texture.scale);
        if (y < 0 || y >= map.texture.height) return;

        var gx = map.grid.spacing * map.texture.width / map.width;
        var gy = map.grid.spacing * map.texture.height / map.height;
        // Get top left corner of current grid
        var fx = Math.floor(x / gx) * gx;
        var fy = Math.floor(y / gy) * gy;

        for (var i = 0; i < gx; ++i) {
          x = fx + i;
          for (var j = 0; j < gy; ++j) {
            y = fy + j;

            map.texture.val[x][y] = mode.texture;

            if (map.texture.val[x][y] === 0) {
              map.texture.image.set(x, y, [0, 0, 0, 0]);

            } else {
              var tx = x % textures.images[map.texture.val[x][y]].width;
              var ty = y % textures.images[map.texture.val[x][y]].height;
              var tex = textures.images[map.texture.val[x][y]].get(tx, ty);
              map.texture.image.set(x, y, tex);
            }
          }
        }
      }

      map.texture.image.updatePixels();
    }
  },

  done: {
    map: function() { },

    wall: function() { // Press
      // Stop creating wall
      mode.walling = null;
    },

    entity: function() { // Press
      // Set mode to move
      sketch.setMode(cursors.MOVE);
    },

    asset: function() { // Press
      if (mode.ctrl) {
        // Set asset to move mode
        sketch.setMode(cursors.MOVE);
      } else {
        view.asset.rot.set(view.asset.rot.val + 45);
      }
    },

    move: function() { // Press
      var found = false;
      if (user.role === 'admin') {
        // Rotate assets
        var ax = view.mx / map.asset.scale;
        var ay = view.my / map.asset.scale;
        // Rotate asset if mouse is over
        for (var i = map.assets.length - 1; i >= 0; --i) {
          if (map.assets[i].contains(ax, ay)) {
            update.set('assets', true);
            map.assets[i].rotate(45);

            //found = true;
            break;
          }
        }

        //if (found) break;
      }
    },

    erase: function() { },

    texture: function() { }
  }
};

const MEDIA_MAPS = '/media/maps/';

var cursors = {
  COUNT: 0,
  names: [],
  images: []
};

var textures = {
  COUNT:0,
  names: [],
  images: []
};

var walls = {
  COUNT: 0,
  names: [],
  images: []
};

var entities = {
  COUNT: 0,
  names: [],
  images: []
};

var assets = {
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
    var out = new Wall();
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
        var par = {
          x: this.x[1] - this.x[0],
          y: this.y[1] - this.y[0]
        };
        var mag = Math.sqrt(par.x * par.x + par.y * par.y);
        par.x /= mag;
        par.y /= mag;
        var per = {
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
      var par = {
        x: this.x[1] - this.x[0],
        y: this.y[1] - this.y[0]
      };

      if (this.points === null) { // Could be done in end or copy constructor
        var mag = Math.sqrt(par.x * par.x + par.y * par.y);
        var ppar = {
          x: par.x / mag,
          y: par.y / mag
        };
        var per = {
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
        var tex = walls.images[this.type];

        var mag = Math.round(Math.sqrt(par.x * par.x + par.y * par.y) / map.wall.scale + tex.height);

        this.image = sketch.createImage(mag, tex.height);

        tex.loadPixels();
        this.image.loadPixels();
        for (var i = 0; i < this.image.width; ++i) {
          var tx = i % tex.width;
          for (var j = 0; j < this.image.height; ++j) {
            this.image.set(i, j, tex.get(tx, j));
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
      sketch.noStroke();
      sketch.fill(0);

      var par = {
        x: x - this.x[0],
        y: y - this.y[0]
      };
      var mag = Math.sqrt(par.x * par.x + par.y * par.y);
      par.x /= mag;
      par.y /= mag;
      var per = {
        x: -par.y * map.wall.width / 2,
        y:  par.x * map.wall.width / 2
      };

      var points = [
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
      // Create image
      var par = {
        x: x - this.x[0],
        y: y - this.y[0]
      };
      if (par.x !== 0 || par.y !== 0) {
        var tex = walls.images[this.type];

        var mag = Math.round(Math.sqrt(par.x * par.x + par.y * par.y) / map.wall.scale + tex.height);

        var img = sketch.createImage(mag, tex.height);

        tex.loadPixels();
        img.loadPixels();
        for (var i = 0; i < img.width; ++i) {
          var tx = i % tex.width;
          for (var j = 0; j < img.height; ++j) {
            img.set(i, j, tex.get(tx, j));
          }
        }
        img.updatePixels();

        sketch.push();
          sketch.scale(map.wall.scale);
          sketch.translate(this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
          sketch.rotate(Math.PI / 2 - Math.atan2(par.x, par.y));
          sketch.translate(-this.x[0] / map.wall.scale, -this.y[0] / map.wall.scale);
          sketch.translate(img.height / -2, img.height / -2);
          sketch.image(img, this.x[0] / map.wall.scale, this.y[0] / map.wall.scale);
        sketch.pop();
      }
    }
  }

  contains(x, y) {
    var v0 = {
      x: this.points[1].x - this.points[0].x,
      y: this.points[1].y - this.points[0].y
    };
    var v1 = {
      x: this.points[3].x - this.points[0].x,
      y: this.points[3].y - this.points[0].y
    };

    if ((x - this.points[0].x) * v0.x + (y - this.points[0].y) * v0.y < 0) return false;
    if ((x - this.points[1].x) * v0.x + (y - this.points[1].y) * v0.y > 0) return false;
    if ((x - this.points[0].x) * v1.x + (y - this.points[0].y) * v1.y < 0) return false;
    if ((x - this.points[3].x) * v1.x + (y - this.points[3].y) * v1.y > 0) return false;

    return true;
  }
}

class Entity {
  // Todo: add asset rotation
  constructor(first, x, y, usr) {
    switch (arguments.length) {
      case 1:
        this.type = first.type;
        this.x = first.x;
        this.y = first.y;
        if (typeof first.user === 'undefined') {
          this.user = { name:'', role:'admin' };
        } else {
          this.user = first.user;
        }
        this.color = first.color;
        break;
      case 3:
        this.type = first;
        this.x = x;
        this.y = y;
        this.user = user;
        this.color = colorString(user.name);
        break;
      case 4:
        this.type = first;
        this.x = x;
        this.y = y;
        this.user = usr;
        this.color = colorString(usr.name);
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

    sketch.ellipseMode(sketch.CENTER);
    sketch.noStroke();
    sketch.fill(this.color[0], this.color[1], this.color[2], 255);
    sketch.ellipse(x, y, entities.images[this.type].width + 50, entities.images[this.type].height + 50);

    sketch.imageMode(sketch.CENTER);
    sketch.image(entities.images[this.type], x, y);
  }

  contains(x, y) {
    var dx = Math.abs(x - this.x) * 2.5;
    var dy = Math.abs(y - this.y) * 2.5;

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
    var dx = Math.abs(x / this.zoom - this.x) * 2.5;
    var dy = Math.abs(y / this.zoom - this.y) * 2.5;

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

var onCanvas = false;

sketch.preload = function() {
  // Load media
  // Cursors
  sketch.loadJSON(MEDIA_MAPS + 'cursors/cursors.json', loadCursors);
  // Textures
  sketch.loadJSON(MEDIA_MAPS + 'textures/textures.json', loadTextures);
  // Walls
  sketch.loadJSON(MEDIA_MAPS + 'walls/walls.json', loadWalls);
  // Entities
  sketch.loadJSON(MEDIA_MAPS + 'entities/entities.json', loadEntities);
  // Assets
  sketch.loadJSON(MEDIA_MAPS + 'assets/assets.json', loadAssets);
}

// TODO: Canvas is not focued after loading resulting in key presses being ignored until the canvas is clicked
sketch.setup = function() {
  var canvas = sketch.createCanvas(view.width, view.height);
  canvas.parent('#map');
  $(canvas.canvas).hide();
  canvas.mouseOver(function () { onCanvas = true; });
  canvas.mouseOut(function () { onCanvas = false; });

  map.texture.width = map.width / map.texture.scale;
  map.texture.height = map.height / map.texture.scale;
  map.texture.image = sketch.createImage(map.texture.width, map.texture.height);

  for (var i = 0; i < map.texture.width; ++i) {
    map.texture.val[i] = [];
    for (var j = 0; j < map.texture.height; ++j) {
      map.texture.val[i][j] = 0;
    }
  }

  view.x = map.width / 2;
  view.y = map.height / 2;
  var zx = view.width / map.width;
  var zy = view.height / map.height;
  view.zoom.MIN = Math.min(zx, zy) * 0.8;
  view.zoom.set(0);

  // Request map data
  mode.loaded = true;
};

sketch.draw = function () {
  // Update mouse position on map
  view.mx = (sketch.mouseX - sketch.width/2) / view.zoom.val + view.x;
  view.my = (sketch.mouseY - sketch.height/2) / view.zoom.val + view.y;

  //sketch.background(235);
  sketch.clear();
  sketch.fill(0);
  switch (mode.cursor) {
    case cursors.TEXTURE:
      sketch.text("Texture: " + textures.names[mode.texture], 2, 10);
      break;
    case cursors.ASSET:
      sketch.text("Asset: " + assets.names[mode.asset], 2, 10);
      break;
    case cursors.ENTITY:
      sketch.text("Entity: " + entities.names[mode.entity], 2, 10);
      break;
  }

  sketch.translate(-view.x * view.zoom.val, -view.y * view.zoom.val);
  sketch.scale(view.zoom.val);
  sketch.translate(sketch.width/(2 * view.zoom.val), sketch.height/(2 * view.zoom.val));

  sketch.push();
    sketch.scale(map.texture.scale);
    draw_texture();
  sketch.pop();

  draw_map();
  draw_cursor();
};

sketch.resize = function() {
  view.width = $('#map').width(); // Remove padding and boarder
  view.height = $(window).height() - 160; // Todo: make more dynamic
  $('#map').height(view.height);
  sketch.resizeCanvas(view.width, view.height);

  var zx = view.width / map.width;
  var zy = view.height / map.height;
  view.zoom.MIN = Math.min(zx, zy) * 0.8;
  view.zoom.set(view.zoom.val);
}

sketch.load = function(newData, updated) {
  if (typeof updated === 'undefined') updated = true;
  if (typeof newData.texture === 'undefined' || newData.texture === null) {
    newData.texture = {
      width: map.texture.width,
      height: map.texture.height,
      val: [[0, map.texture.width * map.texture.height]]
    }
  }

  data = {
    walls: newData.walls,
    entities: newData.entities,
    assets: newData.assets,
    texture: decompress_texture(newData.texture)
  };

  if (newData.update.walls) {
    update.set('walls', true);
    map.walls = [];
    for (w of data.walls) {
      map.walls.push(new Wall(w));
    }
  }

  if (newData.update.entities) {
    update.set('entities', true);
    map.entities = [];
    for (e of data.entities) {
      map.entities.push(new Entity(e));
    }
  }

  if (newData.update.assets) {
    update.set('assets', true);
    map.assets = [];
    for (a of data.assets) {
      map.assets.push(new Asset(a));
    }
  }

  if (newData.update.texture) {
    update.set('texture', true);
    if (data.texture.width !== map.texture.width || data.texture.height !== map.texture.height) {
      alert('Map will be resized from ' +
        data.texture.width + 'x' + data.texture.height +
        ' to ' + map.texture.width + 'x' + map.texture.height);
    }

    map.texture.image.loadPixels();
    for (tex of textures.images) {
      if (tex !== null) {
        tex.loadPixels();
      }
    }

    for (var i = 0; i < map.texture.width; ++i) {
      for (var j = 0; j < map.texture.height; ++j) {
        var curr = 0;
        if (i < data.texture.width && j < data.texture.height) {
          var curr = data.texture.val[i][j];
        }

        map.texture.val[i][j] = curr;
        if (curr === 0) {
          map.texture.image.set(i, j, [0, 0, 0, 0]);
        } else {
          var ti = i % textures.images[curr].width;
          var tj = j % textures.images[curr].height;
          var tex = textures.images[curr].get(ti, tj);
          map.texture.image.set(i, j, tex);
        }
      }
    }

    map.texture.image.updatePixels();
  }

  // TODO: Ensure that this not overwrite user's changes
  // BUG: update can not be sent to server if another user sends update until another change is made
  if (updated) update.reset();
};

sketch.save = function() {
  data = {
    walls:    [],
    entities: [],
    assets:   [],
    texture:  null,
    update: update.data()
  };

  if (update.walls) {
    for (w of map.walls) {
      data.walls.push(w.data());
    }
  }

  if (update.entities) {
    for (e of map.entities) {
      data.entities.push(e.data());
    }
  }

  if (update.assets) {
    for (a of map.assets) {
      data.assets.push(a.data());
    }
  }

  if (update.texture) {
    data.texture = compress_texture();
  }

  return data;
};

// TODO: replace with per entity get/set
sketch.client_load = function(newData) {
  for (var i = map.entities.length - 1; i >= 0; --i) {
    if (newData.user.role === 'admin' ||
       (newData.user.role === 'user' && newData.user.name === map.entities[i].user.name)) {
      map.entities.splice(i, 1)[0];
    }
  }

  for (e of newData.entities) {
    map.entities.push(new Entity(e));
  }
};

sketch.client_save = function() {
  var out = [];
  for (e of map.entities) {
    if (user.role === 'admin' ||
       (user.role === 'user' && user.name === e.user.name)) {
      out.push(e.data());
    }
  }

  return out;
};

sketch.reset_update = function() {
  update.reset();
}

sketch.mousePressed = function() {
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

  switch (mode.cursor) {
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
  }
};

function mouseRight() {
  switch (mode.cursor) {
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

sketch.mouseDragged = function() {
  if (!onCanvas) return;

  switch (mode.cursor) {
    case cursors.MAP:
      mode.do.map();
      break;
    case cursors.TEXTURE:
      mode.do.texture();
      break;
  }
};

sketch.mouseWheel = function(event) {
  if (!onCanvas) return;

  switch (mode.cursor) {
    case cursors.MAP:
    case cursors.WALL:
    case cursors.ERASE:
      view.zoom.set(view.zoom.val - 0.2 * Math.sign(event.delta));
      break;
    case cursors.ASSET:
      view.asset.zoom.set(view.asset.zoom.val - 0.1 * Math.sign(event.delta));
      break;
    case cursors.TEXTURE:
      view.brush.set(view.brush.val - Math.sign(event.delta));
      break;
  }
};

sketch.keyPressed = function() {
  if (sketch.key === 'Control') mode.ctrl = true;

  if (sketch.key === 'Shift') {
    mode.oldCursor = mode.cursor;
    mode.cursor = cursors.MAP;
  }

  if (!onCanvas) return;
  switch (sketch.key) {
    case 'o':
      view.grid = !view.grid;
      break;
    case 'm':
      sketch.setMode(cursors.MAP);
      break;
    case 'w':
      sketch.setMode(cursors.WALL);
      break;
    case 'e':
      sketch.setMode(cursors.ENTITY);
      break;
    case 'a':
      sketch.setMode(cursors.ASSET);
      break;
    case 'g':
      sketch.setMode(cursors.MOVE);
      break;
    case 'd':
      sketch.setMode(cursors.ERASE);
      break;
    case 't':
      mode.fill = false;
      sketch.setMode(cursors.TEXTURE);
      break;
    case 'f':
      mode.fill = true;
      sketch.setMode(cursors.TEXTURE);
      break;
    case '=':
    case '+':
      switch (mode.cursor) {
        case cursors.MAP:
        case cursors.WALL:
        case cursors.MOVE:
        case cursors.ERASE:
          view.zoom.set(view.zoom.val * 1.1);
          break;
        case cursors.ASSET:
          view.asset.zoom.set(view.asset.zoom.val * 1.1);
          break;
        case cursors.TEXTURE:
          view.brush.set(view.brush.val * 1.1);
          break;
      }
      break;
    case '-':
    case '_':
      switch (mode.cursor) {
        case cursors.MAP:
        case cursors.WALL:
        case cursors.MOVE:
        case cursors.ERASE:
          view.zoom.set(view.zoom.val * 0.9);
          break;
        case cursors.ASSET:
          view.asset.zoom.set(view.asset.zoom.val * 0.9);
          break;
        case cursors.TEXTURE:
          view.brush.set(view.brush.val * 0.9);
          break;
      }
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
      var key = sketch.key - '0';
      switch (mode.cursor) {
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
};

sketch.keyReleased = function() {
  if (sketch.key === "Control") mode.ctrl = false;

  if (sketch.key === 'Shift' &&
      mode.cursor !== mode.oldCursor) {
    mode.cursor = mode.oldCursor;
  }
}

sketch.setMode = function(m, reset) {
  if (typeof reset === 'undefined') reset = true;
  if (m >= 0 && m < cursors.COUNT) {
    if (reset) mode.walling = null;

    mode.oldCursor = m;
    mode.cursor = m;
  }
};

// TODO: merge with keypress to use single function
sketch.setSpecificMode = function(name, key) {
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
    case 'erase':
      sketch.setMode(cursors.ERASE);
      break;
  }
};

sketch.isLoaded = function() {
  return mode.loaded;
}

function loadMedia(data, folder) {
  var dataKeys = Object.keys(data);

  var target = {
    COUNT: dataKeys.length,
    names: new Array(dataKeys.length),
    images: new Array(dataKeys.length)
  };

  for (key of dataKeys) {
    target[key] = data[key][0];
    target.names[target[key]] = data[key][1];
    if (data[key][2] === null) {
      target.images[target[key]] = null;
    } else {
      console.log('loading '+ data[key][2]);
      target.images[target[key]] = sketch.loadImage(MEDIA_MAPS + folder + data[key][2]);
    }
  }

  console.log('Loaded ' + folder);

  return target;
}

function loadCursors(data) {
  cursors = loadMedia(data, 'cursors/');
  sketch.setMode(cursors.MAP);
}
function loadTextures(data) {
  textures = loadMedia(data, 'textures/');
}
function loadWalls(data) {
  walls = loadMedia(data, 'walls/');
}
function loadEntities(data) {
  entities = loadMedia(data, 'entities/');
}
function loadAssets(data) {
  assets = loadMedia(data, 'assets/');
}

function draw_map() {
  if (view.grid) draw_grid();
  draw_walls();
  draw_assets();
  draw_entities();
  draw_hover();
}

function draw_texture() {
  sketch.imageMode(sketch.CORNER);
  sketch.image(map.texture.image, 0, 0);
}

function draw_grid() {
  sketch.strokeWeight(1/view.zoom.val);
  sketch.stroke(0, 0, 0);
  for (var i = 0; i <= map.width; i += map.grid.spacing) {
    sketch.line(i, 0, i, map.height);
  }
  for (var j = 0; j <= map.height; j += map.grid.spacing) {
    sketch.line(0, j, map.width, j);
  }
}

function draw_walls() {
  for (wall of map.walls) {
    wall.draw();
  }

  if (mode.walling !== null && mode.walling.mode === 1) {
    var wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
    var wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

    mode.walling.drawToMouse(wx, wy);
  }
}

function draw_entities() {
  sketch.push();
    sketch.scale(map.entity.scale);
    for (entity of map.entities) {
      entity.draw();
    }
  sketch.pop();
}

function draw_hover() {
  if (mode.cursor === cursors.MOVE ||
      mode.cursor === cursors.ERASE) {
    var scale = view.zoom.MAX / view.zoom.val;
    var ex = view.mx / map.entity.scale;
    var ey = view.my / map.entity.scale;
    for (entity of map.entities) {
      if (entity.contains(ex, ey)) {
        sketch.push();
          sketch.scale(scale * map.entity.scale);
          sketch.translate(-entity.x +  entity.x / scale, -entity.y + entity.y / scale);
          entity.draw();
        sketch.pop();
      }
    }
  }
}

function draw_assets() {
  sketch.push();
    sketch.scale(map.asset.scale);
    for (asset of map.assets) {
      asset.draw();
    }
  sketch.pop();
}

function draw_cursor() {
  if (!onCanvas) return;

  sketch.rectMode(sketch.CENTER);

  switch (mode.cursor) {
    case cursors.MAP:
      draw_cursor_image();
      sketch.fill(0);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.WALL:
      var wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
      var wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

      sketch.fill(0, 255, 255);
      sketch.rect(wx, wy, 10 / view.zoom.val, 10 / view.zoom.val);

      draw_cursor_image();
      sketch.fill(0);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.ENTITY:
      if (mode.entity >= 0 && mode.entity < entities.COUNT) {
        sketch.push();
          sketch.scale(map.entity.scale);

          var ex = view.mx / map.entity.scale;
          var ey = view.my / map.entity.scale;

          sketch.ellipseMode(sketch.CENTER);
          sketch.noStroke();
          sketch.fill(255, 0, 0, 255);
          sketch.ellipse(ex, ey, entities.images[mode.entity].width + 50, entities.images[mode.entity].height + 50);

          sketch.imageMode(sketch.CENTER);
          sketch.image(entities.images[mode.entity], ex, ey);
        sketch.pop();
      }

      draw_cursor_image();
      sketch.fill(0, 0, 255);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.ASSET:
      if (mode.asset >= 0 && mode.asset < assets.COUNT) {
        var ax = view.mx / view.asset.zoom.val / map.asset.scale;
        var ay = view.my / view.asset.zoom.val / map.asset.scale;
        sketch.imageMode(sketch.CENTER);
        sketch.push();
          sketch.translate(view.mx, view.my);
          sketch.rotate(sketch.radians(view.asset.rot.val));
          sketch.translate(-view.mx, -view.my);
          sketch.scale(map.asset.scale * view.asset.zoom.val);
          sketch.image(assets.images[mode.asset], ax, ay);
        sketch.pop();
      }

      draw_cursor_image();
      sketch.fill(0, 0, 255);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.MOVE:
      draw_cursor_image();
      sketch.fill(0, 255, 0);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.ERASE:
      draw_cursor_image();
      sketch.fill(255, 0, 0);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.TEXTURE:
      var radius = view.brush.val;
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

function draw_cursor_image() {
  sketch.imageMode(sketch.CORNER);
  sketch.push();
    sketch.scale(map.cursor.scale / view.zoom.val);
    sketch.image(cursors.images[mode.cursor], view.mx * view.zoom.val / map.cursor.scale, view.my * view.zoom.val / map.cursor.scale);
  sketch.pop();
}

function compress_texture() {
  var tex = {
    width: map.texture.width,
    height: map.texture.height,
    val: []
  };

  var count = 0;
  var val = map.texture.val[0][0];
  for (var i = 0; i < tex.width; ++i) {
    for (var j = 0; j < tex.height; ++j) {
      var curr = map.texture.val[i][j];
      if (val === curr) {
        count++;
      } else {
        tex.val.push([val, count]);
        val = curr;
        count = 1;
      }
    }
  }
  tex.val.push([val, count]);

  return tex;
}

function decompress_texture(tex) {
  var out = {
    width: tex.width,
    height: tex.height,
    val: null
  };

  var i = 0;
  var j = 0;
  out.val = new Array(tex.width);
  out.val[0] = new Array(tex.height);
  for (val of tex.val) {
    for (var v = 0; v < val[1]; ++v) {
      out.val[i][j] = val[0];
      if (++j === tex.height) {
        j = 0;
        if (++i !== tex.width) {
          out.val[i] = new Array(tex.height);
        }
      }
    }
  }

  return out;
}
}; // End of sketch

var myp5 = new p5(s);