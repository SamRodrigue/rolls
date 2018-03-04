var express = require('express');
var path = require('path');
var socket = require('socket.io');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');
var room  = require('./routes/room.js');

var app = express();
app.socket = socket();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);
app.use('/room', room);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// Rooms
var rooms = new Map();

// Temp fill romms
rooms.set('AA11', 
{
  name: 'ROOM NAME1',
  users: 0,
  locked: true
});
rooms.set('BB22',
{
  name: 'ROOM NAME2',
  users: 1,
  locked: false
});

var rooms_meta = [

]

// Sockets
// User connects
app.socket.on('connection', function(socket) {
  console.log('a user connected');

  // Send room list
  socket.emit('room-list', Array.from(rooms));

  // Added room
  socket.on('new', function(room) {
    console.log('new room')
  });

  // Join request
  socket.on('join', function(join_req) {
    console.log('a user requested to join room ' + join_req.room_id);
  });

  // User disconnects
  socket.on('disconnect', function() {
    console.log('a user disconnected');
  });
});

module.exports = app;
