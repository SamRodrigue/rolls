var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Rolls' });
});

router.sockets = (socket, rooms, func) => {
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
    var id = func.create_id();
    while (rooms.has(id)) {
      console.log('ABN: Room ID collision');
      id = func.create_id();
    }

    // Create user
    var user = {
      socket: socket,
      name: data.user_name,
      role: 'admin'
    };
    
    var room = {
      name: data.room_name,
      locked: (data.user_password ? true : false),
      password: {
        admin: data.admin_password,
        user: data.user_password
      },
      users: [user]
    };
    rooms.set(id, room);

    // Update all other index clients
    socket.broadcast.to('index').emit('update-rooms', func.rooms_array(rooms));

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
    if (!rooms.has(data.room_id)) {
      console.log('ERROR: a user requested an unregistered room');
      
      // Send response to user
      socket.emit('alert', 'Error: Unknow room');
      return;
    }

    // Get room
    var id = data.room_id;
    var room = rooms.get(id);

    // Create user
    var user = {
      socket: socket,
      name: data.user_name,
      role: ''
    };

    // Check password
    if (data.password == room.password.admin) {
      user.role = 'admin';
      socket.emit('alert', 'DEBUG: ADMIN');
    } else if (data.password == room.password.user) {
      user.role = 'user';
      socket.emit('alert', 'DEBUG: USER');
    } else {
      socket.emit('alert', 'Error: Incorrect password');
      return;
    }

    // Check if user name is unique in room
    for (var i = 0; i < room.users.length; i++) {
      if (user.name == room.users[i].name) {
        socket.emit('alert', 'Error: A user with that name is already in the room');
        return;
      }
    }

    // Add user to room_meta and recalculate number of users
    room.users.push(user);

    // Move to room
    socket.emit('join-room', id);
  });

  // Main
  console.log('a user connected');

  // Emit socket room redirect
  socket.emit('join-io', 'index');
}

module.exports = router;
