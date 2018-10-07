var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Rolls' });
});

router.sockets = (io, socket, rooms, func) => {
  // Added rolls room
  socket.on('create-room', (data) => {
    console.log('creating new room ' + data.room_name);
    // Check room name
    if (!data.room_name || !data.room_name.trim()) {
      socket.emit('alert', 'Error: New room requires a name');
      return;
    }

    // Check user name
    if (!data.user_name || !data.user_name.trim() || data.user_name.length > 32) {
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
    console.log('created a new room ' + id);

    // Create user
    var user = {
      socket: socket,
      timeout: null,
      name: data.user_name,
      role: 'admin',
      dice: [],
      counter: 0,
      preset: [{
        dice: [],
        counter: 0
      }, {
        dice: [],
        counter: 0
      }]
    };
    
    var room = {
      name: data.room_name,
      locked: (data.user_password ? true : false),
      password: {
        admin: data.admin_password,
        user: data.user_password
      },
      users: [],
      timeout: null,
      map: {
        walls:    [],
        entities: [],
        assets:   [],
        texture: null
      }
    };
    room.users.push(user);
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
    if (!data.user_name || !data.user_name.trim() || data.user_name.length > 32) {
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
    var room = rooms.get(data.room_id);

    // Create user
    var user = {
      socket: socket,
      timeout: null,
      name: data.user_name,
      role: '',
      dice: [],
      counter: 0,
      preset: [{
        dice: [],
        counter: 0
      }, {
        dice: [],
        counter: 0
      }]
    };

    // Check password
    if (data.password === room.password.admin) {
      user.role = 'admin';
      //socket.emit('alert', 'DEBUG: ADMIN');
    } else if (data.password === room.password.user) {
      user.role = 'user';
      //socket.emit('alert', 'DEBUG: USER');
    } else {
      socket.emit('alert', 'Error: Incorrect password');
      return;
    }

    // Check if user is already in room
    var user_error = false;
    var new_user = true;
    room.users.some((a_user, index) => {
      if (user.socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
        console.log('a user rejoined room ' + room.name);
        // Check if user name is unique in room
        room.users.some((another_user) => {
          if (user.name === another_user.name && 
              user.socket.handshake.sessionID !== another_user.socket.handshake.sessionID) {
            socket.emit('alert', 'Error: A user with that name is already in the room');
            user_error = true;
            return true;
          }
        });
        if (user_error) return true;

        new_user = false;
        room.users[index] = user;
        return true;
      }
    });

    if (!user_error) {
      // New user
      if (new_user) {
        // Check if user name is unique in room
        room.users.some((a_user) => {
          if (user.name === a_user.name) {
            socket.emit('alert', 'Error: A user with that name is already in the room');
            user_error = true;
            return true;
          }
        });

        if (!user_error) {
          // Add user to room
          console.log('adding user to ' + room.name);
          room.users.push(user);
          console.log('Room Size ' + rooms.get(data.room_id).users.length);
        } else {
          return;
        }
      } 
      // Move to room
      socket.emit('join-room', data.room_id);
    }
  });
}

module.exports = router;
