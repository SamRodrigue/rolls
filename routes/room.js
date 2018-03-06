var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/:id', function(req, res, next) {
  var id = req.params.id;
  rooms = req.app.get('rooms');
  rooms_meta = req.app.get('rooms_meta');

  if (!rooms.has(id) || !rooms_meta.has(id)) {
    console.log('A user tried to access an unavailable room: ' + id);

    // Reroute to error
    res.render('error', { error: { status: 'This room does not exist'}});
    return;
  }

  var room = rooms.get(id);
  var room_meta = rooms_meta.get(id);

  res.render('room', { room: room, room_meta: room_meta });

  // Web sockets
  // User connects
  req.app.wss.on('connection', (ws) => {
    // Check user
    room_meta.users.forEach(function(a_user) {

    });

    console.log('a user connected to room: ' + id);
    //socket.join(id);

    // User disconnects
    /*socket.on('disconnect', function() {
      console.log('a user disconnected');
      socket.leave(id);

      // Remove user from connected room
      for (var i = 0; i < room_meta.length; i++) {
        if (socket == user.socket) {
          room_meta.users.pop(i);
          rooms.get(id).users = room_meta.users.length;
        }
      }
    });*/
  });
});

module.exports = router;