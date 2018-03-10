var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/:id', function(req, res, next) {
  var id = req.params.id;
  var rooms = req.app.rooms;

  if (!rooms.has(id)) {
    console.log('A user tried to access an unavailable room: ' + id);

    // Reroute to error
    res.render('error', { error: { status: 'This room does not exist'}});
    return;
  }

  res.render('room', { room: rooms.get(id) });
});

router.sockets = (socket, rooms, func) => {
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
    room.users.forEach((a_user) => {
      console.log('compare ' + socket.handshake.sessionID + ' ' + a_user.socket.handshake.sessionID);
      if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        user = a_user;
        // Update socket if session id matches
        console.log('user is authorized');
        user.socket = socket;
        authorized = true;
      }
    });

    if (!authorized) {
      console.log('ERROR: an unauthorized user attempted to enter ' + room.name);
      return;
    }

    // Send room data
    var room_data = func.room_array(room);
    room_data.user = { name: user.name };

    socket.emit('room-data', room_data);
  });

  socket.on('dice', (data) => {

  });

  socket.on('roll', (data) => {

  });
};

module.exports = router;