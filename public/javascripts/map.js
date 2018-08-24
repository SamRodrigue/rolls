var s = function( sketch ) {

var data = {
  // All data that is transfered over socket
  walls:    [],
  entities: [],
  assets:   [],
  texture: null
};

var map = {
  width: 150,
  height: 100,
  grid: {
    spacing: 5
  },
  wall: {
    spacing: 2.5,
    width: 1
  },
  entity: {
    spacing: 5/200
  },
  asset: {
    spacing: 0.5
  },

  cursor: {
    spacing: 1.9
  },

  walls:    [],
  entities: [],
  assets:   [],

  texture: {
    width: null, // to be calculated
    height: null, // to be calculated
    val: [[]],
    image: {},
    spacing: 0.5
  }
};

var view = {
  width: 680,
  height: 480,
  x: 0,
  y: 0,
  zoom: {
    val: 10,
    MIN: 1,
    MAX: 10,
    set: function(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
  },
  mx: 0,
  my: 0,
  wx: 0,
  wy: 0,
  brush: {
    val: 10,
    MIN: 2,
    MAX: 20,
    set: function(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
  },
  asset: {
    val: 1,
    MIN: 0.5,
    MAX: 4,
    set: function(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
  }
};

var mode = {
  cursor: 0,
  texture: 0,
  wall: null,
  asset: 0,
  entity: 0,
  moving: {
    val: false,
    user: null
  },

  do: {
    map: function() { // Drag
      view.x += (sketch.pmouseX - sketch.mouseX) / view.zoom.val;
      view.y += (sketch.pmouseY - sketch.mouseY) / view.zoom.val;
      view.x = sketch.constrain(view.x, 0, map.width);
      view.y = sketch.constrain(view.y, 0, map.height);
    },

    wall: function() { // Press
      if (mode.wall === null) {
        mode.wall = new Wall(view.wx, view.wy);

      } else {
        mode.wall.end(view.wx, view.wy);

        if (mode.wall.mode === 2) {
          map.walls.push(mode.wall.copy());
          mode.wall = new Wall(view.wx, view.wy);

        } else {
          mode.wall = null;
        }
      }
    },

    entity: function() { // Press
      if (mode.entity < entities.NONE || mode.entity >= entities.COUNT) return;

      var ex = view.mx / map.entity.spacing;
      var ey = view.my / map.entity.spacing;

      if (mode.entity === entities.NONE) { // Move mode
        for (var i = map.entities.length - 1; i >= 0; --i) {
          if (map.entities[i].contains(ex, ey)) {
            if (user.role === 'admin' || 
               (user.role === 'user' && user.name === map.entities[i].user.name)) {
              var oldEntity = map.entities.splice(i, 1)[0];
              mode.entity = oldEntity.type;
              mode.moving.val = true;
              mode.moving.user = oldEntity.user;
              break;
            }
          }
        }

      } else {
        var newEntity = new Entity(mode.entity, ex, ey, [255, 0, 0]);
        if (mode.moving.val) {
          mode.moving.val = false;
          mode.entity = entities.NONE;
          newEntity.user = mode.moving.user;
        }
        map.entities.push(newEntity);
      }
    },

    asset: function() { // Press
      if (mode.asset < assets.NONE || mode.asset >= assets.COUNT) return;

      var ax = view.mx / map.asset.spacing;
      var ay = view.my / map.asset.spacing;

      if (mode.asset === assets.NONE) { // Move mode
        for (var i = map.assets.length - 1; i >= 0; --i) {
          if (map.assets[i].contains(ax, ay)) {
            var oldAsset = map.assets.splice(i, 1)[0];
            mode.asset = oldAsset.type;
            view.asset.set(oldAsset.zoom);
            break;
          }
        }

      } else {
        map.assets.push(new Asset(mode.asset, ax, ay, view.asset.val));
      }
    },

    // TODO: Add move tool for walls, entities and assets
    move: function() { // Drag

    },

    erase: function() { // Press/Drag
      var found = false;
      for (var i = map.walls.length - 1; i >= 0; --i) {
        if (map.walls[i].contains(view.mx, view.my)) {
          map.walls.splice(i, 1);
          found = true;
          break;
        }
      }

      if (found) return;

      var ex = view.mx / map.entity.spacing;
      var ey = view.my / map.entity.spacing;
      for (var i = map.entities.length - 1; i >= 0; --i) {
        if (map.entities[i].contains(ex, ey)) {
          map.entities.splice(i, 1);
          found = true;
          break;
        }
      }

      if (found) return;

      var ax = view.mx / map.asset.spacing;
      var ay = view.my / map.asset.spacing;
      for (var i = map.assets.length - 1; i >= 0; --i) {
        if (map.assets[i].contains(ax, ay)) {
          map.assets.splice(i, 1);
          break;
        }
      }
    },

    texture: function() { // Press/Drag
      if (mode.texture < 0 || mode.texture >= textures.COUNT) return;

      // Update map texture
      map.texture.image.loadPixels(); 

      var dLimit = view.brush.val * view.brush.val / 4;
      for (var i = -view.brush.val / 2; i < view.brush.val / 2; i += map.texture.spacing) {
        var x = Math.floor((view.mx + i) / map.texture.spacing);

        if (x >= 0 && x < map.texture.width) {
          var di = i * i;

          for (var j = -view.brush.val / 2; j < view.brush.val / 2; j += map.texture.spacing) {
            var y = Math.floor((view.my + j) / map.texture.spacing);

            if (y >= 0 && y < map.texture.height) {
              var d = di + j * j;
              
              if (d < dLimit) {
                map.texture.val[x][y] = mode.texture;

                if (map.texture.val[x][y] === 0) {
                  map.texture.image.set(x, y, [0, 0, 0, 0]);

                } else {
                  var tx = x % textures.width;
                  var ty = y % textures.height;
                  var tex = textures.images[map.texture.val[x][y]].get(tx, ty);
                  map.texture.image.set(x, y, tex);
                }
              }
            }
          }
        }
      }

      map.texture.image.updatePixels();
    }
  }
};

var cursors = {
  NONE:    0,
  MAP:     1, // Move map
  WALL:    2, // Add walls
  ENTITY:  3, // Add entity
  ASSET:   4, // Add assets
  ERASE:   5, // Remove walls and assets
  TEXTURE: 6,
  COUNT:   7,

  images: [
    null,
    sketch.loadImage('/images/cursors/map.png'),
    sketch.loadImage('/images/cursors/wall.png'),
    sketch.loadImage('/images/cursors/asset.png'),
    sketch.loadImage('/images/cursors/asset.png'),
    sketch.loadImage('/images/cursors/erase.png'),  
    null  
  ],
  
  names: [
    'None',
    'Map',
    'Wall',
    'Entiies',
    'Assets',
    'Erase',
    'Texture'
  ]
}

var textures = {
  NONE:  0,
  GRASS: 1,
  STONE: 2,
  WOOD:  3,
  COUNT: 4,

  images: [
    null,
    sketch.loadImage('/images/textures/grass.png'),
    sketch.loadImage('/images/textures/stone.png'),
    sketch.loadImage('/images/textures/wood.png')
  ],

  names: [
    '',
    'Grass',
    'Stone',
    'Wood'
  ],
  
  width: 24,
  height: 24
};

var entities = {
  NONE:       0,
  AARAKOCRA:  1,
  AASIMAR:    2,
  DRAGONBORN: 3,
  ELF:        4,
  ELF_1:      5,
  FIRBOLG:    6,
  HALF_ELF:   7,
  KENKU:      8,
  COUNT:      9,

  images: [
    null,
    sketch.loadImage('/images/entities/Aarakocra.png'),
    sketch.loadImage('/images/entities/Aasimar.png'),
    sketch.loadImage('/images/entities/Dragonborn.png'),
    sketch.loadImage('/images/entities/Elf.png'),
    sketch.loadImage('/images/entities/Elf_1.png'),
    sketch.loadImage('/images/entities/Firbolg.png'),
    sketch.loadImage('/images/entities/Half-Elf.png'),
    sketch.loadImage('/images/entities/Kenku.png')
  ],

  names: [
    'Move Tool',
    'Aarakocra',
    'Aasimar',
    'Dragonborn',
    'Elf',
    'Elf_1',
    'Firbolg',
    'Half-Elf',
    'Kenku'
  ]
};

var assets = {
  NONE:    0,
  BOULDER: 1,
  CHEST:   2,
  COUNT:   3,

  images: [
    null,
    sketch.loadImage('/images/assets/boulder.png'),
    sketch.loadImage('/images/assets/chest.png')
  ],

  names: [
    'Move Tool',
    'Boulder',
    'Chest'
  ]
};

class Wall {
  constructor(first, second) { // (x0, y0), (wall)
    this.x = [];
    this.y = [];
    this.points = null;
    switch (arguments.length) {
      case 0:
        this.mode = 0;
        break;
      case 1:
        this.x = first.x;
        this.y = first.y;
        this.mode = 2;
        break;
      case 2:
        this.start(first, second);
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
    out.x[0] = this.x[0];
    out.x[1] = this.x[1];
    out.y[0] = this.y[0];
    out.y[1] = this.y[1];
    out.mode = this.mode;
    return out;
  }

  data() {
    if (this.mode !== 2) return null;
    return {
      x: this.x,
      y: this.y
    };
  }

  draw() {
    if (this.mode !== 2) return;
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
  }

  drawToMouse(x, y) {
    if (this.mode !== 1) return;
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
  constructor(first, x, y, color) {
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
      case 4:
        this.type = first;
        this.x = x;
        this.y = y;
        this.user = user;
        this.color = color;
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

  draw() {
    sketch.ellipseMode(sketch.CENTER);
    sketch.noStroke();
    sketch.fill(this.color[0], this.color[1], this.color[2], 255);
    sketch.ellipse(this.x, this.y, entities.images[this.type].width + 50, entities.images[this.type].height + 50);

    sketch.imageMode(sketch.CENTER);
    sketch.image(entities.images[this.type], this.x, this.y);
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
  // Todo: add asset rotation
  constructor(first, x, y, zoom) {
    switch (arguments.length) {
      case 1:
        this.type = first.type;
        this.x = first.x;
        this.y = first.y;
        this.zoom = first.zoom;
        break;
      case 4:
        this.type = first;
        this.x = x / zoom;
        this.y = y / zoom;
        this.zoom = zoom;
        break;
    }
  }

  data() {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      zoom: this.zoom
    };
  }

  draw() {
    sketch.imageMode(sketch.CENTER);
    sketch.push();
      sketch.scale(this.zoom);
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
}


var onCanvas = false;

sketch.setup = function() {
  var canvas = sketch.createCanvas(view.width, view.height);
  canvas.parent('#map');
  canvas.mouseOver(function () {
    onCanvas = true;
  });
  canvas.mouseOut(function () {
    onCanvas = false;
  });

  map.texture.width = map.width / map.texture.spacing;
  map.texture.height = map.height / map.texture.spacing;
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
  mode.cursor = cursors.MAP;
  //noLoop();
};

sketch.draw = function () {
  sketch.background(235);
  sketch.fill(0);
  switch (mode.cursor) {
    case cursors.TEXTURE:
      sketch.text(textures.names[mode.texture], 2, 10);
      break;
    case cursors.ASSET:
      sketch.text(assets.names[mode.asset], 2, 10);
      break;
    case cursors.ENTITY:
      sketch.text(entities.names[mode.entity], 2, 10);
      break;
  }

  sketch.translate(-view.x * view.zoom.val, -view.y * view.zoom.val);
  sketch.scale(view.zoom.val);
  sketch.translate(sketch.width/(2 * view.zoom.val), sketch.height/(2 * view.zoom.val));

  sketch.push();
    sketch.scale(map.texture.spacing);
    draw_texture();
  sketch.pop();

  draw_map();

  draw_cursor();
};

sketch.resize = function() {
  view.width = $('#map').width();
  view.height = $(window).height() - 160; // Todo: make more dynamic
  sketch.resizeCanvas(view.width, view.height);

  var zx = view.width / map.width;
  var zy = view.height / map.height;
  view.zoom.MIN = Math.min(zx, zy) * 0.8;
  view.zoom.set(view.zoom.val);
}

sketch.load = function(newData) {
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

  map.walls = [];
  for (w of data.walls) {
    map.walls.push(new Wall(w));
  }

  map.entities = [];
  for (e of data.entities) {
    map.entities.push(new Entity(e));
  }

  map.assets = [];
  for (a of data.assets) {
    map.assets.push(new Asset(a));
  }

  if (data.texture.width !== map.texture.width || data.texture.height !== map.texture.height) {
    alert('Resizing of texture not supported');
    return;
  }

  map.texture.width = data.texture.width;
  map.texture.height = data.texture.height;
  map.texture.val = data.texture.val;
  map.texture.image.loadPixels();

  for (var i = 0; i < data.texture.width; ++i) {
    for (var j = 0; j < data.texture.height; ++j) {
      var curr = data.texture.val[i][j];
      if (curr === 0) {
        map.texture.image.set(i, j, [0, 0, 0, 0]);
      } else {
        var ti = i % textures.width;
        var tj = j % textures.height;
        var tex = textures.images[curr].get(ti, tj);
        map.texture.image.set(i, j, tex);
      }
    }
  }

  map.texture.image.updatePixels();
};

sketch.save = function() {
  data = {
    walls:    [],
    entities: [],
    assets:   [],
    texture:  [[]]
  };
  for (w of map.walls) {
    data.walls.push(w.data());
  }
  for (e of map.entities) {
    data.entities.push(e.data());
  }
  for (a of map.assets) {
    data.assets.push(a.data());
  }
  data.texture = compress_texture();
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

sketch.mousePressed = function() {
  if (!onCanvas) return;
  
  var oldCursor = mode.cursor;
  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    mode.cursor = cursors.MAP;
  }

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
    case cursors.ERASE:
      mode.do.erase();
      break;
    case cursors.TEXTURE:
      mode.do.texture();
      break;
  }

  mode.cursor = oldCursor;
};

sketch.mouseDragged = function() {
  if (!onCanvas) return;

  var oldCursor = mode.cursor;
  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    mode.cursor = cursors.MAP;
  }

  switch (mode.cursor) {
    case cursors.MAP:
      mode.do.map();
      break;
    case cursors.TEXTURE:
      mode.do.texture();
      break;
  }
  
  mode.cursor = oldCursor;
};

sketch.mouseWheel = function(event) {
  if (!onCanvas) return;

  var oldCursor = mode.cursor;
  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    mode.cursor = cursors.MAP;
  }

  switch (mode.cursor) {
    case cursors.MAP:
    case cursors.WALL:
    case cursors.ERASE:
      view.zoom.set(view.zoom.val - 0.1 * event.delta);
      break;
    case cursors.ASSET:
      view.asset.set(view.asset.val - 0.05 * event.delta);
      break;
    case cursors.TEXTURE:
      view.brush.set(view.brush.val - 0.5 * event.delta);
      break;
  }
  
  mode.cursor = oldCursor;
};

sketch.keyPressed = function() {
  switch (sketch.key) {
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
    case 'd':
      sketch.setMode(cursors.ERASE);
      break;
    case 't':
      sketch.setMode(cursors.TEXTURE);
      break;
    case '+':
      view.zoom.set(view.zoom.val * 1.1);
      break;
    case '_':
      view.zoom.set(view.zoom.val * 0.9);
      break;
    case '=':
      view.brush.set(view.brush.val * 1.1);
      break;
    case '-':
      view.brush.set(view.brush.val * 0.9);
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
        case cursors.ENTITY:
          mode.entity = key;
          break;
        case cursors.ASSET:
          mode.asset = key;
          break;
        case cursors.TEXTURE:
          mode.texture = key;
          break;
      }
      break;
  }
};

sketch.setMode = function(m) {
  if (m >= 0 && m < cursors.COUNT) {
    mode.wall = null;
    mode.cursor = m;
  }
};

function draw_map() {
  draw_grid();
  draw_walls();
  draw_assets();
  draw_entities();
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

  if (mode.wall !== null && mode.wall.mode === 1) {
    mode.wall.drawToMouse(view.wx, view.wy);
  }
}

function draw_entities() {
  sketch.push();
    sketch.scale(map.entity.spacing);
    for (entity of map.entities) {
      entity.draw();
    }
  sketch.pop();
}

function draw_assets() {
  sketch.push();
    sketch.scale(map.asset.spacing);
    for (asset of map.assets) {
      asset.draw();
    }
  sketch.pop();
}

function draw_cursor() {
  if (!onCanvas) return;
  
  view.mx = (sketch.mouseX - sketch.width/2) / view.zoom.val + view.x;
  view.my = (sketch.mouseY - sketch.height/2) / view.zoom.val + view.y;
  view.wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
  view.wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

  sketch.rectMode(sketch.CENTER);

  var oldCursor = mode.cursor;
  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    mode.cursor = cursors.MAP;
  }

  switch (mode.cursor) {
    case cursors.MAP:
      draw_cursor_image();
      sketch.fill(0);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.WALL:
      sketch.fill(0, 255, 255);
      sketch.rect(view.wx, view.wy, 10 / view.zoom.val, 10 / view.zoom.val);

      draw_cursor_image();
      sketch.fill(0);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.ENTITY:
      if (mode.entity > 0 && mode.entity < entities.COUNT) {
        sketch.push();
          sketch.scale(map.entity.spacing);

          var ex = view.mx / map.entity.spacing;
          var ey = view.my / map.entity.spacing;

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
      if (mode.asset > 0 && mode.asset < assets.COUNT) {
        sketch.imageMode(sketch.CENTER);
        sketch.push();
          sketch.scale(map.asset.spacing * view.asset.val);
          sketch.image(assets.images[mode.asset], view.mx / view.asset.val / map.asset.spacing, view.my / view.asset.val / map.asset.spacing);
        sketch.pop();
      } 
      
      draw_cursor_image();
      sketch.fill(0, 0, 255);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.ERASE:
      draw_cursor_image();
      sketch.fill(255, 0, 0);
      sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
      break;

    case cursors.TEXTURE:
      sketch.ellipseMode(sketch.CENTER);
      sketch.noFill();
      sketch.stroke(0);
      sketch.strokeWeight(2/view.zoom.val);
      sketch.ellipse(view.mx, view.my, view.brush.val, view.brush.val);
      break;
  }

  mode.cursor = oldCursor;
}

function draw_cursor_image() {
  sketch.imageMode(sketch.CORNER);
  sketch.push();
    sketch.scale(map.cursor.spacing / view.zoom.val);
    sketch.image(cursors.images[mode.cursor], view.mx * view.zoom.val / map.cursor.spacing, view.my * view.zoom.val / map.cursor.spacing);
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