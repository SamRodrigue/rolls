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

  res.render('room', { room: rooms.get(id) });
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
        console.log('user is authorized');
        user.socket = socket;
        authorized = true;
        return true;
      }
    });

    if (!authorized) {
      console.log('ERROR: an unauthorized user attempted to enter ' + room.name);
      return;
    }

    // Send room data
    socket.emit('user-data', { name: user.name });
    io.sockets.in(data).emit('room-data', func.room_array(room));
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
    console.log('a user removed a ' + data.type);
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
      user.dice.some((die, index) => {
        if (die.type === data.type) {
          user.dice.pop(index);
          changed = true;
        }
      });

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
      user.dice.forEach((die) => {
        func.roll(die);
      });

      io.sockets.in(data.room_id).emit('room-data', func.room_array(room));
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