var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Rolls' });

  io = req.app.get('socket');
  rooms = req.app.get('rooms');
  rooms_meta = req.app.get('rooms_meta');

  // Sockets
  // User connects
  io.on('connection', function(socket) {
    console.log('a user connected');
    socket.join('index');

    // Send rooms list
    socket.emit('rooms', Array.from(rooms));

    // Added room
    socket.on('create', function(create_req) {
      // Check room name
      if (!create_req.room_name || !create_req.room_name.trim()) {
        socket.emit('alert', 'Error: New room requires a name');
        return;
      }

      // Chech user name
      if (!create_req.username || !create_req.username.trim()) {
        socket.emit('alert', 'Error: Ivalide user name');
        return;
      }

      // Check admin password
      if (!create_req.admin_password) {
        socket.emit('alert', 'Error: An admin password is required');
        return;
      }

      // Check if room exists
      for (var [id, room] in rooms) {
        if (room.name == create_req.room_name) {
          socket.emit('alert', 'Error: A room with the same name already exists');
          return;
        }
      }

      // Add room
      var id = create_id();
      while (rooms.has(id)) {
        console.log('ABN: Room ID collision');
        id = create_id();
      }

      // Create user
      var user = {
        socket: socket,
        name: create_req.username,
        role: 'admin'
      };
      
      var room = {
        name: create_req.room_name,
        users: 1,
        locked: (create_req.user_password ? true : false)
      };

      var room_meta = {
        password: {
          admin: create_req.admin_password,
          user: create_req.user_password
        },
        users: [user]
      };

      console.log('new room ' + JSON.stringify(room_meta.users[0].name));

      rooms.set(id, room);
      rooms_meta.set(id, room_meta);

      socket.emit('alert', 'Room added');

      // Update all other index clients
      socket.broadcast.to('index').emit('rooms', Array.from(rooms));

      // Move to new room
      socket.emit('join', id);
      socket.leave('index');
    });

    // Join request
    socket.on('join', function(join_req) {
      console.log('a user requested to join room ' + join_req.room_id);
      // Chech user name
      if (!join_req.username || !join_req.username.trim()) {
        socket.emit('alert', 'Error: Ivalide user name');
        return;
      }

      // Find requested room
      if (!rooms.has(join_req.room_id) || !rooms_meta.has(join_req.room_id)) {
        console.log('ERROR: a user requested an unregistered room');
        
        // Send response to user
        socket.emit('alert', 'Error: Unknow room');
        return;
      }

      // Get room
      var id = join_req.room_id;
      var room = rooms.get(id);
      var room_meta = rooms_meta.get(id);

      // Create user
      var user = {
        socket: socket,
        name: join_req.username,
        role: ''
      };

      // Check password
      if (join_req.password == room_meta.password.admin) {
        user.role = 'admin';
        socket.emit('alert', 'DEBUG: ADMIN');
      } else if (join_req.password == room_meta.password.user) {
        user.role = 'user';
        socket.emit('alert', 'DEBUG: USER');
      } else {
        socket.emit('alert', 'Error: Incorrect password');
        return;
      }

      // Check if user name is unique in room
      for (var i = 0; i < room_meta.users.length; i++) {
        if (user.name == room_meta.users[i].name) {
          socket.emit('alert', 'Error: A user with that name is already in the room');
          return;
        }
      }

      // Add user to room_meta and recalculate number of users
      room_meta.users.push(user);
      room.users = room_meta.users.length;

      // Move to room
      socket.emit('join', id);
      socket.leave('index');
    });

    // User disconnects
    socket.on('disconnect', function() {
      console.log('a user disconnected');
      socket.leave('index');

      // Remove user from any connected room
      for (var [id, room_meta] in rooms_meta) {
        for (var i = 0; i < room_meta.length; i++) {
          if (socket == user.socket) {
            room_meta.users.pop(i);
            rooms.get(id).users = room_meta.users.length;
          }
        }
      }
    });
  });

  // Helper functions
  function create_id() {
    return Math.random().toString(36).substr(2, 9);
  }
});

module.exports = router;
