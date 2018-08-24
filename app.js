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
var users = require('./routes/users');
var room  = require('./routes/room.js');

// Express
var app = express();
app.server = http.createServer(app);
app.io = socketio();
app.io.attach(app.server);
app.use(session);
app.io.use(sharedsession(session, { autoSave: true }));

global.DEBUG = true;
global.JOIN_TIMEOUT = 10 * 1000; // 10 seconds
global.ROOM_TIMEOUT = 5 * 60 * 1000; // 5 min
global.MAX_DICE = 20;

// Rooms
app.rooms = new Map();

if (global.DEBUG) {
  app.rooms.set('debug', {
    name: 'Debug',
    locked: false,
    password: {
      admin: '1',
      user: ''
    },
    users: [],
    timeout: null,
    map: {
      walls:    [],
      entities: [],
      assets:   [],
      texture: null
    }
  });
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'images/favicon.ico')));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev')); //!!!

app.use('/', index);
//app.use('/users', users);
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

// cli
var stdin = process.stdin;
var stdout = process.stdout;
stdin.resume();
stdin.setEncoding('utf8');
 
stdin.on('data', function (cmd) {
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
    app.io.sockets.in(id).emit('alert', 'This room has been closed');
    app.io.sockets.in('index').emit('update-rooms', app.func.rooms_array(app.rooms));
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
      default:
        stdout.write('Unknown command: ' + args[0] + '\n');
    }
  }
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
    users: [],
    time: Date.now()
  };
  room.users.forEach((user) => {
    data.users.push({
      name: user.name,
      dice: user.dice,
      counter: user.counter
    });
  });
  return data;
}

app.func.remove_user = (sid, func, rooms, room_id) => {
  var user = null;
  var user_index = -1;
  var room = null;
  if (typeof room_id == 'undefined') {
    // Find room with sid
    for (var [id, a_room] of app.rooms) {
      a_room.users.some((a_user, index) => {
        if (a_user.socket.handshake.sessionID === sid) {
          user_index = index;
          user = a_user;
          room_id = id;
          room = a_room;
          return true;
        }
      });
    }
  } else {
    if (!rooms.has(room_id)) {
      console.log('ERROR: a user requested an unregistered room ' + room_id);
      return;
    }
    room = rooms.get(room_id);
    room.users.some((a_user, index) => {
      if (a_user.socket.handshake.sessionID === sid) {
        user_index = index;
        user = a_user;
        return true;
      }
    });
  }

  if (room && user) {
    console.log('removing user ' + user.name + ' from ' + room_id);
    user.socket.emit('alert', 'You have been removed from the room');
    user.socket.leave(room_id);
    room.users.splice(user_index, 1);
    user.socket.in(room_id).emit('room-data', func.room_array(room));
    console.log('users remaining ' + room.users.length);
    if (room.users.length === 0) {
      room.timeout = setTimeout(() => {
        app.func.remove_room(func, rooms, room_id)}, 
        global.ROOM_TIMEOUT);
      console.log('room is empty ' + room_id);
      
    }
    user.socket.in('index').emit('update-rooms', func.rooms_array(rooms));
  }
}

app.func.remove_room = (func, rooms, room_id) => {
  if (!rooms.has(room_id)) {
    console.log('ERROR: trying to remove an unregistered room ' + room_id);
    return;
  }
  var room = rooms.get(room_id);
  if (room.users.length === 0) {
    rooms.delete(room_id);
    console.log('removing room ' + room_id);
    app.io.sockets.in('index').emit('update-rooms', app.func.rooms_array(app.rooms));
  }
}

app.func.create_id = () => {
  return Math.random().toString(36).substr(2, 9);
}

app.func.roll = (die) => {
  var floor = 0;
  var offset = 0;
  switch (die.type) {
    case 'd4':  floor = 4;  offset = 1; break; 
    case 'd6':  floor = 6;  offset = 1; break; 
    case 'd8':  floor = 8;  offset = 1; break; 
    case 'd10': floor = 10; offset = 0; break; 
    case 'd12': floor = 12; offset = 1; break; 
    case 'd20': floor = 20; offset = 1; break; 
  }
  die.value = Math.floor(Math.random() * floor) + offset;
  die.time = Date.now();
}

app.func.dice_status = (dice, counter) => {
  var out = '';
  var total = new Map();
  total.set('total', 0);
  dice.forEach((die) => {
    if (die.value > -1) {
      var old_value = 0;
      var old_count = 0;
      if (total.has(die.type)) {
        var old_value = total.get(die.type).value;
        var old_count = total.get(die.type).count;
      }
      var new_total = {
        value: old_value + die.value,
        count: old_count + 1
      };
      total.set(die.type, new_total);
      total.set('total', total.get('total') + die.value);
    }
  });
  ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].forEach((die_type) => {
    if (total.has(die_type)) {
      var curr = total.get(die_type);
      out += '<p class="' + die_type + '-label">' + curr.count + die_type + ':' + curr.value + '</p>&nbsp;';
    }
  });
  out += 'Total: ' + total.get('total');
  if (counter !== 0) {
    out += ' (' + (total.get('total') + counter) + ')';
  }
  return out;
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
      //if (typeof socket.current_room == 'undefined' || socket.current_room != id) { // Users will be removed from all rooms they are in
        a_room.users.forEach((a_user, index) => {
          if (a_user.socket.handshake.sessionID === socket.handshake.sessionID) {
            a_user.timeout = setTimeout(() => {app.func.remove_user(socket.handshake.sessionID, app.func, app.rooms, id)}, global.JOIN_TIMEOUT);
            return true;
          }
        });
      //}
    }
  });
});

module.exports = app;