var express = require('express');
var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');
var room  = require('./routes/room.js');

var app = express();
app.server = http.createServer(app);
app.io = socketio();
app.io.attach(app.server);

// Rooms
rooms = new Map();
rooms_meta = new Map();

// Temp room
rooms.set('A1', {
  name: 'TEST ROOM',
  users: 0,
  locked: false
});

rooms_meta.set('A1', {
  password: {
    admin: 'a',
    user: ''
  },
  users: []
});

// set globals
app.set('rooms', rooms);
app.set('rooms_meta', rooms_meta);

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

module.exports = app;
