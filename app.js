var express = require('express');
var http = require('http');
var path = require('path');
var socketio = require('socket.io');
var session = require('express-session')({
  secret: 'letsroll',
  resave: true,
  saveUninitialized: true
});
var sharedsession = require('express-socket.io-session');
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
app.use(session);
app.io.use(sharedsession(session, { autoSave: true }));

// Rooms
app.rooms = new Map();

// Temp room
app.rooms.set('A1', {
  name: 'TEST ROOM',
  locked: false,
  password: {
    admin: 'a',
    user: ''
  },
  users: []
});

// set globals
//app.set('rooms', rooms);
//app.set('rooms_meta', rooms_meta);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev')); //!!!

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

// helper functions
app.func = {};

app.func.rooms_array = (rooms) => {
  var data = [];
  rooms.forEach((room, id) => {
    data.push([ id, 
    {
      name: room.name,
      users: room.users.length,
      locked: room.locked
    }]);
  });
  return data;
}

app.func.room_array = (room) => {
  var data = {
    name: room.name,
    users: []
  };
  room.users.forEach((user) => {
    data.users.push({
      name: user.name
    });
  });
  return data;
}

app.func.create_id = () => {
  return Math.random().toString(36).substr(2, 9);
}

// sockets
app.io.on('connect', (socket) => {
  // Register route sockets
  index.sockets(socket, app.rooms, app.func);
  room.sockets(socket, app.rooms, app.func);

  socket.on('join', (data) => {
    // Confirm room
    if (data == 'index') { // anyone can join index
      console.log('a user joined index');
      socket.join('index');
      // Send rooms list
      socket.emit('update-rooms', app.func.rooms_array(app.rooms));  
    } else {
      // Check if user has access to room
      if (!app.rooms.has(data)) {
        console.log('A user tried to access an unavailable room: ' + data);
        return;
      }
      var room = app.rooms.get(data);
      for (var user in room.users) {
        if (user.socket.id == socket.id) {
          console.log('a user joined ' + data);
          socket.join(data);
        }
      }
      console.log('a user tried to join ' + data);
      return;
    }
  });

  socket.on('disconnect', () => {
    // Remove user from room
  });
});
module.exports = app;
