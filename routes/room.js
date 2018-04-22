var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/:id', function(req, res, next) {
  var id = req.params.id;
  var rooms = req.app.rooms;

  if (!rooms.has(id)) {
    console.log('ERROR: a user tried to access an unavailable room: ' + id);

    // Reroute to error
    res.render('error', { error: { status: 'This room does not exist'}});
    return;
  }

  res.render('room', { title: 'Room: ' + rooms.get(id).name, room: rooms.get(id) });
});

router.sockets = (io, socket, rooms, func) => {
  socket.on('enter-room', (data) => {
    var room = find_room(rooms, data, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    if (!user) {
      console.log('ERROR: an unauthorized user attempted to enter ' + room.name);
      // Send response to user
      socket.emit('alert', { kick: true, alert: 'Error: You do not have permission to join this room or your session has expired. Please try again'});
      return;
    }
    // Stop user timeout
    clearTimeout(user.timeout);

    // Update user socket
    user.socket = socket;

    // Send room data
    socket.emit('user-data', { name: user.name, role: user.role });
    socket.broadcast.to(data).emit('room-data', func.room_array(room));
  });

  socket.on('get-room', (data) => {
    var room = find_room(rooms, data.room_id, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    if (user) { 
      socket.emit('room-data', func.room_array(room));
    }
  });

  socket.on('remove_user', (data) => {
    var room = find_room(rooms, data.room_id, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    var [target_user, target_user_index] = find_user_name(room, data.name);
    if (user && target_user && 
        (user.role === 'admin' || user.name === data.name)) {
      func.remove_user(target_user.socket.handshake.sessionID, func, rooms, data.room_id);
    }
  });

  socket.on('add-dice', (data) => {
    console.log('a user added a ' + data.type);
    var dice = { type: '', value: -1, time: Date.now() };
    if (['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].includes(data.type)) {
      dice.type = data.type;
    } else {
      console.log('ERROR: a user tried to add an unknown die ' + data.type);
      return;
    }
    var room = find_room(rooms, data.room_id, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    if (user) {
      if (user.dice.length >= global.MAX_DICE) {
        socket.emit('alert', { kick: false, alert: 'Error: You unable to add more dice (max:' + global.MAX_DICE + ')'});
      } else {
        user.dice.push(dice);
        io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
      }
    }
  });

  socket.on('remove-dice', (data) => {
    console.log('a user removed a ' + data.type);
    var room = find_room(rooms, data.room_id, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    if (user) { 
      // Remove dice
      var changed = false;
      if (data.hasOwnProperty('index')) {
        user.dice.splice(data.index, 1);
        changed = true;
      } else if (data.hasOwnProperty('type')) {
        user.dice.some((die, index) => {
          if (die.type === data.type) {
            console.log('a user removed a ' + data.type + die.type);
            user.dice.splice(index, 1);
            changed = true;
            return true;
          }
        });
      }

      if (changed) io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
    }
  });

  socket.on('roll-dice', (data) => {
    console.log('a user is rolling');
    var room = find_room(rooms, data.room_id, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    if (user) { 
      // Roll dice
      var changed = false;
      if (data.hasOwnProperty('index')) {
        changed = true;
        func.roll(user.dice[data.index]);
      } else  {
        user.dice.forEach((die) => {
          changed = true;
          func.roll(die);
        });
      }

      if (changed) {
        io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
        var date = new Date();
        io.sockets.in(data.room_id).emit('room-log', 
        { 
          user: user.name,
          time: date.getTime(),
          log: func.dice_status(user.dice, user.counter)
        });
      }
    }
  });

  socket.on('clear-dice', (data) => {
    console.log('a user is clearing dice');
    var room = find_room(rooms, data.room_id, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    if (user) {
      // Clear dice
      user.dice = [];

      io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
    }
  });

  socket.on('counter', (data) => {
    console.log('a user is changing a counter');
    var room = find_room(rooms, data.room_id, socket);
    if (!room) return;
    var user = find_user_socket(room, socket);
    var [target_user, target_user_index] = find_user_name(room, data.name);
    if (user && target_user && 
        (user.role === 'admin' || user.name === data.name)) {
      // Change counter
      target_user.counter += data.counter;

      io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
    }
  });
};

function find_room(rooms, id, socket) {
  if (!rooms.has(id)) {
    console.log('ERROR: a user requested an unregistered room');
    
    // Send response to user
    socket.emit('alert', { kick: true, alert: 'Error: Unknow room' });
    return null;
  }
  return rooms.get(id);
}

function find_user_socket(room, socket) {
  var user = null;
  room.users.some((a_user) => {
    if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
      user = a_user;
      return true;
    }
  });
  return user;
}

function find_user_name(room, name) {
  var target_user = null;
  var target_user_index = -1;
  room.users.some((a_user, index) => {
    if (a_user.name === name) {
      target_user = a_user;
      target_user_index = index;
      return true;
    }
  });
  return [target_user, target_user_index];
}

module.exports = router;