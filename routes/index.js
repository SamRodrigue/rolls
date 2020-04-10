const express = require('express');
const router = express.Router();
const version = require('../package.json').version;

/* GET home page. */
router.get('/', (req, res, next) => {
  const debugMode = global.DEBUG ? 'true' : 'false';

  res.render('index', {
    title: 'Rolls',
    version,
    debugMode
  });
});

router.sockets = (io, socket, rooms, func) => {
  // Added rolls room
  socket.on('create-room', data => {
    console.log(`creating new room ${data.roomName}`);
    // Check room name
    if (!data.roomName || !data.roomName.trim()) {
      socket.emit('alert', 'Error: New room requires a name');
      return;
    }

    // Check user name
    if (!data.userName || !data.userName.trim() || data.userName.length > 32) {
      socket.emit('alert', 'Error: Invalid user name');
      return;
    }

    // Check admin password
    if (!data.adminPassword) {
      socket.emit('alert', 'Error: An admin password is required');
      return;
    }

    // Check that admin and user passwords are different
    if (data.userPassword && data.userPassword === data.adminPassword) {
      socket.emit('alert', 'Error: Admin and user passwords cannot match');
      return;
    }

    // Check if room exists
    for (var [id, room] in rooms) {
      if (room.name == data.roomName) {
        socket.emit('alert', 'Error: A room with the same name already exists');
        return;
      }
    }

    // Add room
    var id = func.createID('room', rooms);
    console.log(`created a new room ${id}`);

    // Create user
    const user = {
      socket,
      timeout: null,
      id: func.createID(),
      name: data.userName,
      role: 'admin',
      color: [0, 0, 0],
      dice: [],
      share: true,
      counter: 0,
      preset: [{
        used: false,
        dice: [],
        counter: 0
      }, {
        used: false,
        dice: [],
        counter: 0
      }],
      updated: func.getUpdated()
    };

    // Update default color to one based on user id
    user.color = func.colorFromString(user.id);

    var room = {
      name: data.roomName,
      locked: (data.userPassword ? true : false),
      password: {
        admin: data.adminPassword,
        user: data.userPassword
      },
      users: [],
      timeout: null,
      map: {
        share:    true,
        walls:    [],
        entities: [],
        assets:   [],
        texture:  null,
        fog:      null
      }
    };
    room.users.push(user);
    rooms.set(id, room);

    // Update all other index clients
    socket.broadcast.to('index').emit('update-rooms', func.roomsArray(rooms));

    // Move to new room
    socket.emit('join-room', id);
  });

  // Join request
  socket.on('join-room', data => {
    console.log(`a user requested to join room ${data.roomID}`);
    // Trim username
    data.userName = data.userName.trim();
    // Check user name
    if (!data.userName || data.userName.length > 32) {
      socket.emit('alert', 'Error: Invalid user name');
      return;
    }

    // Find requested room
    if (!rooms.has(data.roomID)) {
      console.log('ERROR: a user requested an unregistered room');

      // Send response to user
      socket.emit('alert', 'Error: Unknown room');
      return;
    }

    // Get room
    const room = rooms.get(data.roomID);

    // Create user
    const user = {
      socket,
      timeout: null,
      id: func.createID('user', room.users),
      name: data.userName,
      role: '',
      color: [0, 0, 0],
      dice: [],
      share: true,
      counter: 0,
      preset: [{
        used: false,
        dice: [],
        counter: 0
      }, {
        used: false,
        dice: [],
        counter: 0
      }],
      updated: func.getUpdated()
    };

    user.color = func.colorFromString(user.id);

    // Check password
    if (data.password === room.password.admin) {
      user.role = 'admin';
    } else if (data.password === room.password.user) {
      user.role = 'user';
    } else {
      socket.emit('alert', 'Error: Incorrect password');
      return;
    }

    // Check if user is already in room
    let userError = false;
    let newUser = true;
    room.users.some((aUser, index) => {
      if (user.socket.handshake.sessionID === aUser.socket.handshake.sessionID) {
        console.log(`a user rejoined room ${room.name}`);
        // Remove old timeout
        clearTimeout(aUser.timeout);

        // Check if user name is unique in room
        room.users.some(bUser => {
          if (user.name === bUser.name &&
              user.socket.handshake.sessionID !== bUser.socket.handshake.sessionID) {
            socket.emit('alert', 'Error: A user with that name is already in the room');
            userError = true;
            return true;
          }
        });
        if (userError) return true;

        newUser = false;
        room.users[index] = user;
        return true;
      }
    });

    if (!userError) {
      // New user
      if (newUser) {
        // Check if user name is unique in room
        room.users.some(aUser => {
          if (user.name === aUser.name) {
            socket.emit('alert', 'Error: A user with that name is already in the room');
            userError = true;
            return true;
          }
        });

        if (!userError) {
          // Add user to room
          console.log(`adding user to ${room.name}`);
          room.users.push(user);
          console.log(`Room Size ${rooms.get(data.roomID).users.length}`);
        } else {
          return;
        }
      }
      // Move to room
      socket.emit('join-room', data.roomID);

      // Update all other index clients
      socket.broadcast.to('index').emit('update-rooms', func.roomsArray(rooms));
    }
  });
}

module.exports = router;