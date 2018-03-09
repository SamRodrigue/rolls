var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Rolls' });
});

router.sockets = (io, rooms, rooms_meta) => {
  // Websockets
  // User connects
  io.on('connect', (socket) => {
    socket.on('join-io', (data) => {
      // Confirm room
      if (data == 'index') {
        console.log('a user joined index');
        socket.join('index');
        // Send rooms list
        socket.emit('update-rooms', Array.from(rooms));  
      } else {
        console.log('a user tried to join ' + data);
        return;
      }
    });

    // Added rolls room
    socket.on('create-room', (data) => {
      console.log(JSON.stringify(data));
      // Check room name
      if (!data.room_name || !data.room_name.trim()) {
        socket.emit('alert', 'Error: New room requires a name');
        return;
      }

      // Check user name
      if (!data.user_name || !data.user_name.trim()) {
        socket.emit('alert', 'Error: Invalid user name');
        return;
      }

      // Check admin password
      if (!data.admin_password) {
        socket.emit('alert', 'Error: An admin password is required');
        return;
      }

      // Check if room exists
      for (var [id, room] in rooms) {
        if (room.name == data.room_name) {
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
        name: data.user_name,
        role: 'admin'
      };
      
      var room = {
        name: data.room_name,
        users: 1,
        locked: (data.user_password ? true : false)
      };

      var room_meta = {
        password: {
          admin: data.admin_password,
          user: data.user_password
        },
        users: [user]
      };

      rooms.set(id, room);
      rooms_meta.set(id, room_meta);

      socket.emit('alert', 'Room added');

      // Update all other index clients
      socket.broadcast.to('index').emit('rooms', Array.from(rooms));

      // Move to new room
      socket.emit('join-room', id);
    });

    // Join request
    socket.on('join-room', function(data) {
      console.log('a user requested to join room ' + data.room_id);
      // Chech user name
      if (!data.user_name || !data.user_name.trim()) {
        socket.emit('alert', 'Error: Invalid user name');
        return;
      }

      // Find requested room
      if (!rooms.has(data.room_id) || !rooms_meta.has(data.room_id)) {
        console.log('ERROR: a user requested an unregistered room');
        
        // Send response to user
        socket.emit('alert', 'Error: Unknow room');
        return;
      }

      // Get room
      var id = data.room_id;
      var room = rooms.get(id);
      var room_meta = rooms_meta.get(id);

      // Create user
      var user = {
        socket: socket,
        name: data.user_name,
        role: ''
      };

      // Check password
      if (data.password == room_meta.password.admin) {
        user.role = 'admin';
        socket.emit('alert', 'DEBUG: ADMIN');
      } else if (data.password == room_meta.password.user) {
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
      socket.emit('join-room', id);
    });

    // User disconnects
    socket.on('disconnect', function() {
      console.log('a user disconnected');

      // Remove user from any connected room
      for (var [id, room_meta] in rooms_meta) {
        room_meta.users.forEach(function(a_user, i) {
          console.log("HEREHERE" + a_user.name);
          if (socket.id == a_user.socket.id) {
            room_meta.users.pop(i);
            rooms.get(id).users = room_meta.users.length;
          }
        });
      }

      // Update all other index clients
      socket.broadcast.to('index').emit('rooms', Array.from(rooms));

      // Remove from index
      socket.leave('index');
    });

    // Main
    console.log('a user connected');

    // Emit socket room redirect
    socket.emit('join-io', 'index');  
  });

  // Helper functions
  function create_id() {
    return Math.random().toString(36).substr(2, 9);
  }
}

module.exports = router;
