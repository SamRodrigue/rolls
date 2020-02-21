const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/:id', (req, res, next) => {
  const id = req.params.id;
  const rooms = req.app.rooms;

  if (!rooms.has(id)) {
    console.log(`ERROR: a user tried to access an unavailable room: ${id}`);

    // Reroute to error
    res.render('error', { error: { status: 'This room does not exist'}});
    return;
  }

  res.render('room', { title: `Room: ${rooms.get(id).name}`, room: rooms.get(id), show_debug: global.DEBUG ? 'true' : 'false' });
});

router.sockets = (io, socket, rooms, func) => {
  socket.on('enter-room', data => {
    const room = func.find_room(rooms, data, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (!user) {
      console.log(`ERROR: an unauthorized user attempted to enter ${room.name}`);
      // Send response to user
      socket.emit('alert', { kick: true, alert: 'Error: You do not have permission to join this room or your session has expired. Please try again'});
      return;
    }
    // Stop user timeout
    clearTimeout(user.timeout);

    // Update user socket
    user.socket = socket;

    // Assign all entities that previously belonged to a user with the same name
    let changed = false;
    room.map.entities.forEach(entity => {
      if (entity.user.name == user.name) {
        entity.user = {
          id: user.id,
          name: user.name,
          role: user.role
        };
        entity.color = user.color;
        changed = true;
      }
    });

    // Send room data
    socket.emit('user-data', { name: user.name, role: user.role, id: user.id, color: user.color, preset: user.preset });
    socket.broadcast.to(data).emit('room-data', func.room_array(room));

    // Send updated entities
    if (changed) {
      const out = { entities: room.map.entities };

      if (room.map.share) {
        socket.broadcast.to(data).emit('map-data-type', { type: 'entities', data: out});
      } else {
        // Send data to admin
        socket.broadcast.to(`${data}-admin`).emit('map-data-type', { type: 'entities', data: out });

        // Filter entity updates if map is not shared
        room.users.forEach(a_user => {
          // Admin do not have to have data filtered
          if (a_user.role === 'admin') return;

          out.entities = room.map.entities.filter(entity => {
            return entity.user.id === a_user.id;
          });
            
          a_user.socket.emit('map-data-type', { type: 'entities', data: out });
        });
      }
    }
  });

  socket.on('get-room', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user) { 
      socket.emit('room-data', func.room_array(room));
    }
  });

  socket.on('get-map', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user) {
      room.map.update = {
        walls:    true,
        entities: true,
        assets:   true,
        texture:  true,
        fog:      true
      };

      // Send map data to single user
      if (room.map.share || user.role === 'admin') {
        socket.emit('map-data', room.map);
      } else {
        const entities = room.map.entities.filter(entity => {
          return entity.user.id === user.id;
        });
        const out = {
          share:    false,
          walls:    [],
          entities,
          assets:   [],
          texture:  null,
          fog:      null
        };
        socket.emit('map-data', out);
      }
    }
  });
  
  socket.on('update-map', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    // Admin only
    if (user && (user.role === 'admin')) {
      console.log(`Admin ${user.name} update the map`);
      room.map.share = data.map.share;
      room.map.walls = data.map.walls;
      room.map.entities = data.map.entities;
      room.map.assets = data.map.assets;
      room.map.texture = data.map.texture;
      room.map.fog = data.map.fog;

      // Send map data to all other users
      if (room.map.share) {
        socket.broadcast.to(data.room_id).emit('map-data', room.map);
      } else {
        socket.broadcast.to(`${data.room_id}-admin`).emit('map-data', room.map);
      }
    }
  });

  socket.on('update-map-type', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);

    if (user) {
    let out = null;
      const newData = data.data;
      
      switch (data.type) {
        case 'walls':
          if (user.role === 'admin') {
            room.map.walls = newData.walls;

            out = {
              walls: newData.walls
            }
          }
          break;

        case 'entities':
          if (user.role === 'admin') {
            room.map.entities = newData.entities;

            out = { entities: room.map.entities };
          } else {
            let verify = true;
            // Data from role user must only contain own data
            for (e of newData.entities) {
              if (e.user.name !== user.name) {
                verify = false;
                break;
              }
            }

            if (verify) {
              for (let i = room.map.entities.length - 1; i >= 0; --i) {
                // Remove all data that will be updated
                if (user.id === room.map.entities[i].user.id) {
                  room.map.entities.splice(i, 1);
                }
              }

              // Add data
              Array.prototype.push.apply(room.map.entities, newData.entities);

              out = { 
                entities: room.map.entities
              };
            }
          }
          break;

        case 'assets':
          if (user.role === 'admin') {
            room.map.assets = newData.assets;
            out = { assets: newData.assets };
          }
          break;

        case 'lines':
          // Must only contain own data
          if (user.id === newData.id && newData.lines.length !== 0) {
            out = {
              lines: newData.lines,
              id: newData.id
            };
          }
          break;

        case 'texture':
          if (user.role === 'admin') {
            room.map.texture = newData.texture;
            out = { texture: newData.texture };
          }
          break;

        case 'fog':
          if (user.role === 'admin') {
            room.map.fog = newData.fog;
            out = { fog: newData.fog };
          }
          break;
      }

      if (out !== null) {
        if (room.map.share) {
          socket.broadcast.to(data.room_id).emit('map-data-type', { type: data.type, data: out });
        } else {
          // Send data to admin
          socket.broadcast.to(`${data.room_id}-admin`).emit('map-data-type', { type: data.type, data: out });

          // Filter entity updates if map is not shared
          if (data.type === 'entities') {
            room.users.forEach(a_user => {
              // Admin do not have to have data filtered
              if (a_user.role === 'admin') return;

              out.entities = room.map.entities.filter(entity => {
                return entity.user.id === a_user.id;
              });
                
              a_user.socket.emit('map-data-type', { type: data.type, data: out });
            });
          }
        }
      }
    }
  });

  socket.on('remove-user', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    const [target_user, target_user_index] = func.find_user_name(room, data.name);
    if (user && target_user && 
        (user.role === 'admin' || user.name === data.name)) {
      func.remove_user(target_user.socket.handshake.sessionID, rooms, data.room_id, io.sockets);
    }
  });

  socket.on('add-dice', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user) {
      const dice = {
        id: '',
        type: '',
        value: -1,
        time: Date.now(),
        anime: []
      };
  
      // Check dice type
      if (['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].includes(data.type)) {
        dice.type = data.type;
      } else {
        console.log(`ERROR: user ${user.name} tried to add an unknown die ${data.type}`);
        return;
      }

      // Get dice id
      dice.id = func.create_id('dice', room.users);
      console.log(`user ${user.name} added a ${data.type}`);

      if (user.dice.length >= global.MAX_DICE) {
        socket.emit('alert', { kick: false, alert: `Error: You are unable to add more dice (max:${global.MAX_DICE})`});
      } else {
        user.dice.push(dice);
        func.set_updated(user);
        socket.emit('room-data', func.room_array(room, user));
        socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
      }
    }
  });

  socket.on('remove-dice', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user) { 
      // Remove dice
      let changed = false;
      if (data.hasOwnProperty('index')) {
        user.dice.splice(data.index, 1);
        changed = true;
      } else if (data.hasOwnProperty('type')) {
        user.dice.some((die, index) => {
          if (die.type === data.type) {
            console.log(`user ${user.name} removed a ${data.type}${die.type}`);
            user.dice.splice(index, 1);
            changed = true;
            return true;
          }
        });
      }

      if (changed) {
        func.set_updated(user);
        socket.emit('room-data', func.room_array(room, user));
        socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
      }
    }
  });

  socket.on('roll-dice', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user) { 
      // Roll dice
      let changed = false;
      if (data.hasOwnProperty('id')) { // Roll single dice
        const dice = user.dice.filter(a_dice => {
          return a_dice.id === data.id; // TODO: Allow data.id to be array to select/roll multiple dice
        });

        if (dice.length > 0) {
          changed = true;
          for (die of dice) {
            func.roll(die);
          }
        }
      } else  { // Roll all dice
        user.dice.forEach(die => {
          changed = true;
          func.roll(die);
        });
      }

      if (changed) {
        console.log(`user ${user.name} is rolling`);
        func.set_updated(user);
        socket.emit('room-data', func.room_array(room, user));
        socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
        
        const date = new Date();
        const out = { 
          user: user.name,
          time: date.getTime(),
          share: user.share,
          log: func.dice_status(user.dice, user.counter)
        };
        
        // Delay log by animation time
        setTimeout(() => {
          if (user.share) {
            io.sockets.in(data.room_id).emit('room-log', out);
          } else {
            socket.emit('room-log', out);
          }
        }, 3000); // TODO: Move to constant set int server settings
      }
    }
  });

  socket.on('clear-dice', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user) {
      console.log(`user ${user.name} is clearing dice`);
      // Clear dice
      user.dice = [];

      func.set_updated(user);
      socket.emit('room-data', func.room_array(room, user));
      socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
    }
  });

  socket.on('share-dice', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user) {
      console.log(`user ${user.name} is ${data.share ? 'sharing' : 'hiding'} dice`);
      // Share/Hide dice
      user.share = Boolean(data.share);

      func.set_updated(user);
      socket.emit('room-data', func.room_array(room, user)); // TODO: is needed?
      socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
    }
  })

  socket.on('share-map', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (user && user.role === 'admin') {
      console.log(`user ${user.name} is ${data.share ? 'sharing' : 'hiding'} the map`);
      // Share/Hide map
      room.map.share = Boolean(data.share);

      if (room.map.share) {
        socket.broadcast.to(data.room_id).emit('map-data', room.map);
      } else {
        const out = {
          share:    false,
          walls:    [],
          entities: [],
          assets:   [],
          texture:  null,
          fog:      null
        };

        // Send map data to admin only and and empty map to users
        room.users.forEach(a_user => {
          // Modification is made client side for originating admin
          if (a_user.id === user.id) return;

          if (a_user.role === 'admin') {
            a_user.socket.emit('map-data', room.map);
          } else {
            out.entities = room.map.entities.filter(entity => {
              return entity.user.id === a_user.id;
            });
            
            a_user.socket.emit('map-data', out);
          }
        });
      }
    }
  })

  socket.on('counter', data => {
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    const [target_user, target_user_index] = func.find_user_name(room, data.name);
    if (user && target_user && 
        (user.role === 'admin' || user.name === data.name)) {
      if (user.role === 'admin' && user.name !== target_user.name) {
        console.log(`admin ${user.name} is changing user ${target_user.name} counter (${data.counter})`);
      } else {
        console.log(`user ${user.name} is changing a counter (${data.counter})`);
      }

      const old_counter = target_user.counter;
      // Change counter
      if (data.counter === 0) {
        target_user.counter = 0;
      } else {
        target_user.counter += data.counter;
      }
      if (target_user.counter !== old_counter) { // Only update on change
        func.set_updated(target_user);
        socket.emit('room-data', func.room_array(room, user));
        socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
      }
    }
  });

  const PRESET = { SAVE: 0, LOAD: 1 };
  socket.on('preset', data => {
    if (data.preset < 0 || data.preset > 1) {
      console.log('ERROR: a user is using an unsupported preset number');
      return;
    }
    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (!user) return;

    if (data.type === PRESET.SAVE) console.log(`user ${user.name} is saving a preset`);
    else if (data.type === PRESET.LOAD) console.log(`user ${user.name} is loading a preset`);
    else {
      console.log(`user ${user.name} is using an unsupported preset type`);
      return;
    }

    switch (data.type) {
      case PRESET.SAVE: // Save
        user.preset[data.preset].used = true;
        user.preset[data.preset].dice = [];
        user.dice.forEach(die => {
          user.preset[data.preset].dice.push({
            type: die.type,
            value: -1,
            time: Date.now()
          });
        });
        user.preset[data.preset].counter = user.counter;
        socket.emit('user-data', { name: user.name, role: user.role, id: user.id, preset: user.preset });
        break;
      case PRESET.LOAD: // Load
        user.dice = [];
        user.preset[data.preset].dice.forEach(die => {
          user.dice.push({
            id: func.create_id('dice', room.users),
            type: die.type,
            value: -1,
            time: Date.now(),
            anime: []
          });
        });
        user.counter = user.preset[data.preset].counter;
        func.set_updated(user);
        socket.emit('room-data', func.room_array(room, user));
        socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
        break;
    }
  });

  socket.on('change-color', data => {
    if (data.color.length !== 3) {
      console.log('ERROR: a user is attempting to change to an invalid color');
      return;
    }

    const room = func.find_room(rooms, data.room_id, socket);
    if (!room) return;
    const user = func.find_user_socket(room, socket);
    if (!user) return;

    console.log(`user ${user.name} is changing color`);

    user.color = data.color;
    func.set_updated(user);
    socket.emit('room-data', func.room_array(room, user));
    socket.broadcast.to(data.room_id).emit('room-data', func.room_array(room));
  });
};

module.exports = router;