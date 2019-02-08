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

// Routes
var index = require('./routes/index');
var room  = require('./routes/room.js');

// Express
var app = express();
app.server = http.createServer(app);
app.io = socketio();
app.io.attach(app.server);
app.use(session);
app.io.use(sharedsession(session, { autoSave: true }));

global.DEBUG = ((process.argv[2] !== 'undefined' && process.argv[2] === 'debug') ? process.argv[2] : false);
global.JOIN_TIMEOUT = 30 * 1000; // 30 seconds
global.ROOM_TIMEOUT = 5 * 60 * 1000; // 5 min
global.MAX_DICE = 20;

// Rooms
app.rooms = new Map();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(favicon(path.join(__dirname, 'public', 'media/favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev')); //!!!

app.use('/', index);
app.use('/room', room);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// helper functions
app.func = require('./func.js');

// cli
// TODO: Move to cli module/file
var stdin = process.stdin;
var stdout = process.stdout;
stdin.resume();
stdin.setEncoding('utf8');
 
stdin.on('data', (cmd) => {
  // helper functions
  function display_rooms() {
    stdout.write('number of rooms: ' + app.rooms.size + '\n');
    for (var [id, room] of app.rooms) {
      stdout.write('Room: ' + room.name + ' (' + id + ')\n');
      stdout.write('  Users: ' + room.users.length + '\n');
      room.users.forEach((user) => {
        stdout.write('    User: ' + user.name + '\n');
      });
    }
  }

  function close_room(args) {
    if (args.length < 2) {
      stdout.write('Provide a room id\n');
      return;
    }
    var id = args[1];
    if (!app.rooms.has(id)) {
      console.log('ERROR: a user requested an unregistered room');
      return;
    }
    app.rooms.delete(id);
    app.io.in(id).emit('alert', 'This room has been closed');
    app.io.in('index').emit('update-rooms', app.func.rooms_array(app.rooms));
  }

  function debug_room(args) {
    if (!global.DEBUG || !app.rooms.has('debug')) {
      stdout.write('Not in debug mod or unable to locate debug room');
      return;
    }

    if (args.length < 2) {
      stdout.write('Debug argument required');
      stdout.write('  debug roll: make debug user roll');
      return;
    }

    var room = app.rooms.get('debug');
    var user = app.func.find_user_name(room, 'User1')[0];

    switch (args[1]) {
      case 'roll':
        user.dice.forEach((die) => {
          app.func.roll(die);
        });
        console.log('user ' + user.name + ' is rolling');
        app.func.set_updated(user);
        app.io.sockets.in('debug').emit('room-data', app.func.room_array(room));
        var date = new Date();
        app.io.sockets.in('debug').emit('room-log', 
        {
          user: user.name,
          time: date.getTime(),
          log: app.func.dice_status(user.dice, user.counter)
        });
        break;
      default:
        stdout.write('Unknown command: ' + args[0] + ' ' + args[1] + '\n');
    }
  }

  // Split cmd
  var cmd = cmd.trim();
  var args = cmd.split(' ');
  //stdout.write('Raw: ' + cmd + '\n');
  //stdout.write('Number of args: ' + args.length + '\n');
  if (args.length > 0) {
    //stdout.write('Checking command: ' + args[0] + '\n');
    switch (args[0]) {
      case 'rooms': display_rooms(); break;
      case 'close': close_room(args); break;
      case 'debug': debug_room(args); break;
      default:
        stdout.write('Unknown command: ' + args[0] + '\n');
    }
  }
});

// Debug mode. Enabled by running 'npm test' or 'bin/www debug'
// TODO: Move to debug module/file
if (global.DEBUG) {
  var debug_user1 = {
    socket: { handshake: { sessionID: 0 } },
    timeout: null,
    id: 'ABC1',
    name: 'User1',
    role: 'user',
    dice: [
      { type: 'd4' },
      { type: 'd6' },
      { type: 'd8' },
      { type: 'd10' },
      { type: 'd12' },
      { type: 'd20'}],
    counter: 1,
    preset: [{
      dice: [],
      counter: 0
    }, {
      dice: [],
      counter: 0
    }],
    updated: 0
  };

  debug_user1.dice.forEach((die) => {
    app.func.roll(die);
  });

  var debug_user2 = {
    socket: { handshake: { sessionID: 0 } },
    timeout: null,
    id: 'ABC2',
    name: 'User2',
    role: 'user',
    dice: [
      { type: 'd4' },
      { type: 'd6' },
      { type: 'd8' },
      { type: 'd10' },
      { type: 'd12' },
      { type: 'd20'}],
    counter: 1,
    preset: [{
      dice: [],
      counter: 0
    }, {
      dice: [],
      counter: 0
    }],
    updated: 0
  };

  debug_user2.dice.forEach((die) => {
    app.func.roll(die);
  });

  var debug_room = {
    name: 'Debug',
    locked: false,
    password: {
      admin: '1',
      user: ''
    },
    users: [ debug_user1, debug_user2 ],
    timeout: null,
    map: {
      walls:    [],
      entities: [],
      assets:   [],
      texture: null
    }
  };

  app.rooms.set('debug', debug_room);
  app.use(logger('dev'));
}

// sockets
app.io.on('connect', (socket) => {
  // Register route sockets
  index.sockets(app.io, socket, app.rooms, app.func);
  room.sockets(app.io, socket, app.rooms, app.func);

  // Main
  console.log('a user connected');

  // Join io rooms
  socket.on('join', (data) => {
    socket.current_room = data;
    // Confirm room
    if (data == 'index') { // anyone can join index
      socket.leaveAll();
      console.log('a user joined index');
      socket.join('index');

      // Send rooms list
      socket.emit('update-rooms', app.func.rooms_array(app.rooms));  
    } else {
      // Check if user has access to room
      if (!app.rooms.has(data)) {
        console.log('a user tried to access an unavailable room: ' + data);
        return;
      }
      var room = app.rooms.get(data);
      var user_joined = false;
      room.users.some((user) => {
        if (socket.handshake.sessionID === user.socket.handshake.sessionID) {
          socket.leaveAll();
          console.log('a user joined ' + data);
          socket.join(data);
          user_joined = true;

          // // Disable user timeout
          // clearTimeout(user.timeout);

          return true;
        }
      });
      if (!user_joined) console.log('a user tried to join ' + data);
    }
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
    // Get user from session id
    for (var [id, a_room] of app.rooms) {
      a_room.users.some((a_user, index) => {
        if (a_user.socket.handshake.sessionID === socket.handshake.sessionID) {
          // Clear any existing timeout
          clearTimeout(a_user.timeout);

          // Create new timeout
          a_user.timeout = setTimeout(() => {
            app.func.remove_user(socket.handshake.sessionID, app.rooms, id, app.io.sockets);
          }, global.JOIN_TIMEOUT);

          // Break forEach
          return true;
        }
      });
    }
  });
});

module.exports = app;