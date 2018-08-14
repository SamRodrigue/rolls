var s = function( sketch ) {
var map = {
  width: 100,
  height: 100,
  grid: {
    spacing: 5
  },
  wall: {
    spacing: 2.5,
    width: 2
  },
  walls: [],
  objects: []
};

var view = {
  width: 680,
  height: 480,
  x: 50,
  y: 50,
  zoom: 10
};

var mode = {
  set: 0, // default to MAP

  MAP:    0, // Move map
  WALL:   1, // Modify walls
  OBJECT: 2, // Modify objects
  COUNT:  3
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
    sketch.fill(0);
    if (this.points === null) { // Could be done in end or copy constructor
      this.points = [];
      var par = {
        x: this.x[1] - this.x[0],
        y: this.y[1] - this.y[0]
      };
      var mag = Math.sqrt(par.x * par.x + par.y * par.y);
      par.x /= mag;
      par.y /= mag;
      var pro = {
        x: -par.y,
        y: par.x
      };
      this.points[0] = {
        x: this.x[0] + pro.x,
        y: this.y[0] + pro.y
      };
      this.points[1] = {
        x: this.x[0] - pro.x,
        y: this.y[0] - pro.y
      };
      this.points[2] = {
        x: this.x[1] - pro.x,
        y: this.y[1] - pro.y
      };
      this.points[3] = {
        x: this.x[1] + pro.x,
        y: this.y[1] + pro.y
      };
    }

    sketch.quad(
      this.points[0].x, this.points[0].y,
      this.points[1].x, this.points[1].y,
      this.points[2].x, this.points[2].y,
      this.points[3].x, this.points[3].y
    );
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
  var x = (sketch.mouseX - sketch.width/2) / view.zoom + view.x;
  var y = (sketch.mouseY - sketch.height/2) / view.zoom + view.y;
  x = Math.round(x / map.wall.spacing) * map.wall.spacing;
  y = Math.round(y / map.wall.spacing) * map.wall.spacing;
  switch (mode.set) {
    case mode.WALL:
      if (wall === null) {
        wall = new Wall(x, y);
      } else {
        wall.end(x,y);
        if (wall.mode === 2) {
          map.walls.push(wall.copy());
        }
        wall = null;
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
  }
}

sketch.setMode = function(m) {
  if (m >= 0 && m < mode.COUNT) {
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
}

function draw_objects() {

}

function draw_players() {

}

function draw_cursor() {
  var x = (sketch.mouseX - sketch.width/2) / view.zoom + view.x;
  var y = (sketch.mouseY - sketch.height/2) / view.zoom + view.y;
  sketch.rectMode(sketch.CENTER);

  switch (mode.set) {
    case mode.MAP:
      sketch.fill(0);
      break;
    case mode.WALL:
      sketch.fill(0, 255, 255);
      x = Math.round(x / map.wall.spacing) * map.wall.spacing;
      y = Math.round(y / map.wall.spacing) * map.wall.spacing;
      break;
  }

	sketch.rect(x, y, 10 / view.zoom, 10 / view.zoom);
}
}; // End of sketch

var myp5 = new p5(s);