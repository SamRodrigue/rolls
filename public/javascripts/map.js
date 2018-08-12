var s = function( sketch ) {
var map = {
  width: 100,
  height: 100,
  objects: [
  ]
};

var view = {
  width: 680,
  height: 480,
  x: 50,
  y: 50,
  zoom: 10
};

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
  sketch.text(view.x, 2, 10);
  sketch.text(view.y, 2, 20);
  sketch.text(view.zoom, 2, 30);

  //sketch.translate(-map.width/2, -map.height/2);
  sketch.translate(-view.x * view.zoom, -view.y * view.zoom);
  sketch.scale(view.zoom);
  sketch.translate(sketch.width/(2 * view.zoom), sketch.height/(2 * view.zoom));
  draw_map();
  sketch.rectMode(sketch.CENTER);
  sketch.fill(0);
	sketch.rect(view.x, view.y, 2, 2);
};

sketch.mousePressed = function() {
  //draw();
};

sketch.mouseDragged = function() {
  if (!onCanvas) return;
  view.x += (sketch.pmouseX - sketch.mouseX) / view.zoom;
  view.y += (sketch.pmouseY - sketch.mouseY) / view.zoom;
};

sketch.mouseWheel = function(event) {
  if (!onCanvas) return;
  view.zoom -= 0.1 * event.delta;
  view.zoom = sketch.constrain(view.zoom, 1, 10);
};

function draw_map() {
  sketch.strokeWeight(1/view.zoom);
  sketch.stroke(0, 0, 0);
  for (var i = 0; i <= map.width; i += 5) {
    sketch.line(i, 0, i, map.height);
  }
  for (var j = 0; j <= map.height; j += 5) {
    sketch.line(0, j, map.width, j);
  }
}
}; // End of sketch

var myp5 = new p5(s);