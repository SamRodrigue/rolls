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
  socket.on('dice', (data) => {

  });

  socket.on('roll', (data) => {

  });
};

module.exports = router;