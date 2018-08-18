var s = function( sketch ) {
var map = {
  width: 100,
  height: 100,
  grid: {
    spacing: 5
  },
  wall: {
    spacing: 2.5,
    width: 1
  },
  walls: [],
  objects: [],
  texture: {
    width: null, // to be calculated
    height: null, // to be calculated
    val: {},
    image: {},
    spacing: 0.5
  },
  textures: []
};

var view = {
  width: 680,
  height: 480,
  x: 50,
  y: 50,
  zoom: {
    val: 10,
    MIN: 1,
    MAX: 10,
    set: function(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
  },
  mx: 50,
  my: 50,
  wx: 50,
  wy: 50,
  brush: {
    val: 10,
    MIN: 2,
    MAX: 20,
    set: function(v) { this.val = sketch.constrain(v, this.MIN, this.MAX); }
  }
};

var mode = {
  set: 0, // default to MAP

  MAP:     0, // Move map
  WALL:    1, // Modify walls
  OBJECT:  2, // Modify objects
  ERASE:   3, // Remove walls and objects
  TEXTURE: 4,
  COUNT:   5,

  texture: {
    set: 0,

    NONE:  0,
    GRASS: 1,
    STONE: 2,
    WOOD:  3,
    COUNT: 4
  },

  do: {
    map: function() { // Drag
      view.x += (sketch.pmouseX - sketch.mouseX) / view.zoom.val;
      view.y += (sketch.pmouseY - sketch.mouseY) / view.zoom.val;
    },
    wall: function() { // Press
      if (wall === null) {
        wall = new Wall(view.wx, view.wy);
      } else {
        wall.end(view.wx, view.wy);
        if (wall.mode === 2) {
          map.walls.push(wall.copy());
          wall = new Wall(view.wx, view.wy);
        } else {
          wall = null;
        }
      }
    },
    object: function() { // Press

    },
    erase: function() { // Press/Drag
      for (var i = map.walls.length - 1; i >= 0; --i) {
        if (map.walls[i].contains(view.mx, view.my)) {
          map.walls.splice(i, 1);
          break;
        }
      }
    },
    texture: function() { // Press/Drag
      if (mode.texture.set < 0 || mode.texture.set >= mode.texture.COUNT) return;

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
                map.texture.val[x][y] = mode.texture.set;
              }
            }
          }
        }
      }
      // Update map texture
      map.texture.image.loadPixels();
      map.textures[mode.texture.GRASS].loadPixels();
      map.textures[mode.texture.STONE].loadPixels();
      map.textures[mode.texture.WOOD].loadPixels();
      
      for (var i = 0; i < map.texture.width; ++i) {
        for (var j = 0; j < map.texture.height; ++j) {
          if (map.texture.val[i][j] === 0) {
            map.texture.image.set(i, j, [0, 0, 0, 0]);
          } else {
            var x = i % 24;
            var y = j % 24;
            var tex = map.textures[map.texture.val[i][j]].get(x, y);
            map.texture.image.set(i, j, tex);
          }
        }
      }
      map.texture.image.updatePixels();
    }
  }
};

var objects = {
  boulder: {}
};

var wall = null;

class Wall {
  constructor(first, second) { // (x0, y0), (wall)
    this.x = [];
    this.y = [];
    this.points = null;
    switch (arguments.length) {
      case 0:
        this.mode = 0;
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

  map.textures[mode.texture.GRASS] = sketch.loadImage('/images/grass.png');
  map.textures[mode.texture.STONE] = sketch.loadImage('/images/stone.png');
  map.textures[mode.texture.WOOD] = sketch.loadImage('/images/wood.png');

  map.texture.width = map.width / map.texture.spacing;
  map.texture.height = map.height / map.texture.spacing;
  map.texture.image = sketch.createImage(map.texture.width, map.texture.height);

  for (var i = 0; i < map.texture.width; ++i) {
    map.texture.val[i] = [];
    for (var j = 0; j < map.texture.height; ++j) {
      map.texture.val[i][j] = 0;
    }
  }
  //noLoop();
};

sketch.draw = function () {
  sketch.background(235);
  sketch.fill(0);
  // sketch.text(view.x, 2, 10);
  // sketch.text(view.y, 2, 20);
  // sketch.text(view.zoom.val, 2, 30);
  // sketch.text(sketch.mouseY, 2, 40);
  // sketch.text(sketch.mouseY, 2 ,50);

  //sketch.push();
  sketch.translate(-view.x * view.zoom.val, -view.y * view.zoom.val);
  sketch.scale(view.zoom.val);
  sketch.translate(sketch.width/(2 * view.zoom.val), sketch.height/(2 * view.zoom.val));
  sketch.push();
    sketch.scale(map.texture.spacing);
    draw_texture();
  sketch.pop();
  draw_map();

  //sketch.pop();
  draw_cursor();
};

sketch.mousePressed = function() {
  if (!onCanvas) return;
  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    mode.do.map();
  } else {
    switch (mode.set) {
      case mode.WALL:
        mode.do.wall();
        break;
      case mode.ERASE:
        mode.do.erase();
        break;
      case mode.TEXTURE:
        mode.do.texture();
        break;
    }
  }
};

sketch.mouseDragged = function() {
  if (!onCanvas) return;
  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    mode.do.map();
  } else {
    switch (mode.set) {
      case mode.MAP:
        mode.do.map();
        break;
      case mode.TEXTURE:
        mode.do.texture();
        break;
    }
  }
};

sketch.mouseWheel = function(event) {
  if (!onCanvas) return;
  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    view.zoom.set(view.zoom.val - 0.1 * event.delta);
  } else {
    switch (mode.set) {
      case mode.MAP:
      case mode.WALL:
      case mode.OBJECT:
      case mode.ERASE:
        view.zoom.set(view.zoom.val - 0.1 * event.delta);
        break;
      case mode.TEXTURE:
        view.brush.set(view.brush.val - 0.5 * event.delta);
        break;
    }
  }
};

sketch.keyPressed = function() {
  switch (sketch.key) {
    case 'm':
      sketch.setMode(mode.MAP);
      break;
    case 'w':
      sketch.setMode(mode.WALL);
      break;
    case 'e':
      sketch.setMode(mode.ERASE);
      break;
    case 't':
      sketch.setMode(mode.TEXTURE);
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
      mode.texture.set = mode.texture.NONE;
      break;
    case '1':
      mode.texture.set = mode.texture.GRASS;
      break;
    case '2':
      mode.texture.set = mode.texture.STONE;
      break;
    case '3':
      mode.texture.set = mode.texture.WOOD;
      break;
  }
};

sketch.setMode = function(m) {
  if (m >= 0 && m < mode.COUNT) {
    wall = null;
    mode.set = m;
  }
};

function draw_map() {
  draw_grid();
  draw_walls();
  draw_objects();
  draw_players();
}

function draw_texture() {
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
  for (w of map.walls) {
    w.draw();
  }

  if (wall !== null && wall.mode === 1) {
    wall.drawToMouse(view.wx, view.wy);
  }
}

function draw_objects() {

}

function draw_players() {

}

function draw_cursor() {
  view.mx = (sketch.mouseX - sketch.width/2) / view.zoom.val + view.x;
  view.my = (sketch.mouseY - sketch.height/2) / view.zoom.val + view.y;
  view.wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
  view.wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;

  sketch.rectMode(sketch.CENTER);

  if (sketch.keyIsPressed && sketch.keyCode == sketch.SHIFT) {
    sketch.fill(0);
    sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
  } else {
    switch (mode.set) {
      case mode.MAP:
        sketch.fill(0);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;
      case mode.WALL:
        sketch.fill(0, 255, 255);
        sketch.rect(view.wx, view.wy, 10 / view.zoom.val, 10 / view.zoom.val);
        sketch.fill(0);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;
      case mode.ERASE:
        sketch.fill(255, 0, 0);
        sketch.rect(view.mx, view.my, 10 / view.zoom.val, 10 / view.zoom.val);
        break;
      case mode.TEXTURE:
        sketch.noFill();
        sketch.stroke(0);
        sketch.strokeWeight(2/view.zoom.val);
        sketch.ellipse(view.mx, view.my, view.brush.val, view.brush.val);
        break;
    }
  }
}
}; // End of sketch

var myp5 = new p5(s);