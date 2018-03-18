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
    // Check if room exists
    if (!rooms.has(data)) {
      console.log('ERROR: a user requested an unregistered room');
      
      // Send response to user
      socket.emit('alert', 'Error: Unknow room');
      return;
    }
    var room = rooms.get(data);
    var user;

    // Check if user is authorized to enter room
    var authorized = false;
    room.users.some((a_user) => {
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        // Update socket if session id matches
        user.socket = socket;
        authorized = true;
        return true;
      }
    });

    if (!authorized) {
      console.log('ERROR: an unauthorized user attempted to enter ' + room.name);
      // Send response to user
      socket.emit('alert', 'Error: You do not have permission to join this room');
      return;
    }

    // Send room data
    socket.emit('user-data', { name: user.name, role: user.role });
    socket.broadcast.to(data).emit('room-data', func.room_array(room));
  });

  socket.on('get-room', (data) => {
    // Check if room exists
    if (!rooms.has(data.room_id)) {
      console.log('ERROR: a user requested an unregistered room');
      
      // Send response to user
      socket.emit('alert', 'Error: Unknow room');
      return;
    }
    var room = rooms.get(data.room_id);
    var user;
    room.users.some((a_user) => {
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        return true;
      }
    });
    if (user) { 
      socket.emit('room-data', func.room_array(room));
    }
  });

  socket.on('remove_user', (data) => {
    // Check if room exists
    if (!rooms.has(data.room_id)) {
      console.log('ERROR: a user requested an unregistered room');
      
      // Send response to user
      socket.emit('alert', 'Error: Unknow room');
      return;
    }
    var room = rooms.get(data.room_id);
    var user;
    var in_room = false;
    var found_user = false;
    var target_user;
    room.users.some((a_user, index) => {
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        in_room = true;
      }
      if (a_user.name === data.name) {
        target_user = index;
        found_user = true;
      }
      if (in_room && found_user) return true;
    });
    if (user && found_user && 
        (user.role === 'admin' || user.name === data.name)) {
      console.log('removing user ' + room.users[target_user].name + ' from ' + data.room_id);
      room.users[target_user].socket.emit('alert', 'You have been removed from the room');
      room.users[target_user].socket.leave(data.room_id);
      room.users.splice(target_user, 1);
      io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
      console.log('users remaining ' + room.users.length);
      if (room.users.length === 0) {
        console.log('removing room ' + data.room_id);
        rooms.delete(data.room_id);
        io.sockets.in('index').emit('update-rooms', func.rooms_array(rooms));
      }
    }
  });

  socket.on('add-dice', (data) => {
    console.log('a user added a ' + data.type);
    var dice = { type: '', value: -1 };
    if (['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].includes(data.type)) {
      dice.type = data.type;
    } else {
      console.log('ERROR: a user tried to add an unknown die ' + data.type);
      return;
    }
    // Check if room exists
    if (!rooms.has(data.room_id)) {
      console.log('ERROR: a user requested an unregistered room');
      
      // Send response to user
      socket.emit('alert', 'Error: Unknow room');
      return;
    }
    var room = rooms.get(data.room_id);
    var user;
    room.users.some((a_user) => {
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        return true;
      }
    });
    if (user) { 
      user.dice.push(dice);
      io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
    }
  });

  socket.on('remove-dice', (data) => {
    // Check if room exists
    if (!rooms.has(data.room_id)) {
      console.log('ERROR: a user requested an unregistered room');
      
      // Send response to user
      socket.emit('alert', 'Error: Unknow room');
      return;
    }
    var room = rooms.get(data.room_id);
    var user;
    room.users.some((a_user) => {
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        return true;
      }
    });
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
    var room = rooms.get(data.room_id);
    var user;
    room.users.some((a_user) => {
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        return true;
      }
    });
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
          log: func.dice_status(user.dice)
        });
      }
    }
  });

  socket.on('clear-dice', (data) => {
    console.log('a user is clearing dice');
    var room = rooms.get(data.room_id);
    var user;
    room.users.some((a_user) => {
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        return true;
      }
    });
    if (user) { 
      // Clear dice
      user.dice = [];

      io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
    }
  });
};

module.exports = router;