var s = function( sketch ) {
var map = {
  width: 100,
  height: 100,
  grid: {
    spacing: 5
  },
  wall: {
    spacing: 5,
    width: 1
  },
  walls: [],
  objects: []
};

var view = {
  width: 680,
  height: 480,
  x: 50,
  y: 50,
  zoom: 10,
  mx: 50,
  my: 50,
  wx: 50,
  wy: 50
};

var mode = {
  set: 0, // default to MAP

  MAP:    0, // Move map
  WALL:   1, // Modify walls
  OBJECT: 2, // Modify objects
  ERASE:  3,
  COUNT:  4
}

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
  //noLoop();
};

sketch.draw = function () {
  sketch.background(235);
  sketch.fill(0);
  sketch.text(view.x, 2, 10);
  sketch.text(view.y, 2, 20);
  sketch.text(view.zoom, 2, 30);
  sketch.text(sketch.mouseY, 2, 40);
  sketch.text(sketch.mouseY, 2 ,50);

  // sketch.rectMode(sketch.CENTER);
  // sketch.fill(0, 0, 255);
  // var x = sketch.mouseX;
  // var y = sketch.mouseY;
	// sketch.rect(x, y, 10, 10);

  //sketch.push();
  sketch.translate(-view.x * view.zoom, -view.y * view.zoom);
  sketch.scale(view.zoom);
  sketch.translate(sketch.width/(2 * view.zoom), sketch.height/(2 * view.zoom));
  draw_map();

  //sketch.pop();
  draw_cursor();
};

sketch.mousePressed = function() {
  if (!onCanvas) return;
  switch (mode.set) {
    case mode.WALL:
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
      break;
    case mode.ERASE:
      // Find wall/object below cursor
      for (var i = map.walls.length - 1; i >= 0; --i) {
        if (map.walls[i].contains(view.mx, view.my)) {
          map.walls.splice(i, 1);
          i = 0;
        }
      }
      break;
  }
};

sketch.mouseDragged = function() {
  if (!onCanvas) return;
  switch (mode.set) {
    case mode.MAP:
      view.x += (sketch.pmouseX - sketch.mouseX) / view.zoom;
      view.y += (sketch.pmouseY - sketch.mouseY) / view.zoom;
      break;
  }
};

sketch.mouseWheel = function(event) {
  if (!onCanvas) return;
  view.zoom -= 0.1 * event.delta;
  view.zoom = sketch.constrain(view.zoom, 1, 10);
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
  }
}

sketch.setMode = function(m) {
  if (m >= 0 && m < mode.COUNT) {
    wall = null;
    mode.set = m;
  }
}

function draw_map() {
  draw_grid();
  draw_walls();
  draw_objects();
  draw_players();
}

function draw_grid() {
  sketch.strokeWeight(1/view.zoom);
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
  view.mx = (sketch.mouseX - sketch.width/2) / view.zoom + view.x;
  view.my = (sketch.mouseY - sketch.height/2) / view.zoom + view.y;
  sketch.rectMode(sketch.CENTER);

  switch (mode.set) {
    case mode.MAP:
      sketch.fill(0);
      sketch.rect(view.mx, view.my, 10 / view.zoom, 10 / view.zoom);
      break;
    case mode.WALL:
      view.wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
      view.wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;
      sketch.fill(0, 255, 255);
      sketch.rect(view.wx, view.wy, 10 / view.zoom, 10 / view.zoom);
      sketch.fill(0);
      sketch.rect(view.mx, view.my, 10 / view.zoom, 10 / view.zoom);
      break;
    case mode.ERASE:
      view.wx = Math.round(view.mx / map.wall.spacing) * map.wall.spacing;
      view.wy = Math.round(view.my / map.wall.spacing) * map.wall.spacing;
      sketch.fill(255, 0, 0);
      sketch.rect(view.mx, view.my, 10 / view.zoom, 10 / view.zoom);
      break;
  }
}
}; // End of sketch

var myp5 = new p5(s);