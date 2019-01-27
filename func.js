var rooms_array = (rooms) => {
  var data = [];
  rooms.forEach((room, id) => {
    data.push([ id, 
    {
      name: room.name,
      users: room.users.length,
      locked: room.locked
    }]);
  });
  return data;
};

var room_array = (room) => {
  var data = {
    name: room.name,
    users: [],
    time: Date.now()
  };
  room.users.forEach((user) => {
    data.users.push({
      id: user.id,
      name: user.name,
      dice: user.dice,
      counter: user.counter,
      updated: user.updated
    });
  });
  return data;
};

var remove_user = (sid, rooms, room_id, sockets) => {
  var user = null;
  var user_index = -1;
  var room = null;
  if (typeof room_id == 'undefined') {
    // Find room with sid
    for (var [id, a_room] of rooms) {
      a_room.users.some((a_user, index) => {
        if (a_user.socket.handshake.sessionID === sid) {
          user_index = index;
          user = a_user;
          room_id = id;
          room = a_room;
          return true;
        }
      });
    }
  } else {
    if (!rooms.has(room_id)) {
      console.log('ERROR: a user requested an unregistered room ' + room_id);
      return;
    }
    room = rooms.get(room_id);
    room.users.some((a_user, index) => {
      if (a_user.socket.handshake.sessionID === sid) {
        user_index = index;
        user = a_user;
        return true;
      }
    });
  }

  if (room && user) {
    console.log('removing user ' + user.name + ' from ' + room_id);

    // Send user leave message
    user.socket.emit('alert', 'You have been removed from the room');
    user.socket.leave(room_id);
    room.users.splice(user_index, 1);
    user.socket.in(room_id).emit('room-data', room_array(room));
    console.log('users remaining ' + room.users.length);

    if (room.users.length === 0) {
      room.timeout = setTimeout(() => {
        remove_room(rooms, room_id, sockets)}, 
        global.ROOM_TIMEOUT);
      console.log('room is empty ' + room_id);
    }

    user.socket.in('index').emit('update-rooms', rooms_array(rooms));
  }
};

var remove_room = (rooms, room_id, sockets) => {
  if (!rooms.has(room_id)) {
    console.log('ERROR: trying to remove an unregistered room ' + room_id);
    return;
  }
  var room = rooms.get(room_id);
  if (room.users.length === 0) {
    rooms.delete(room_id);
    console.log('removing room ' + room_id);
    sockets.in('index').emit('update-rooms', rooms_array(rooms));
  }
};

var create_id = (type, arr) => {
  var get_id = () => { return Math.random().toString(36).substr(2, 9); };
  var id = get_id();
  // check if id colides with existing array of id
  switch (type) {
    case 'room':
      while (arr.has(id)) {
        console.log('ABN: Room ID collision');
        id = get_id();
      }
      break;
    case 'user':
      while (arr.filter((user) => {
        return user.id === id;
      }).length) {
        console.log('ABN: User ID collision');
        id = get_id();
      }
      break;
  }

  return id;
};

var get_updated = () => {
  var hash = Date.now().toString(36);
  return hash;
};

var set_updated = (user) => {
  user.updated = get_updated();
};

var roll = (die) => {
  var floor = 0;
  var offset = 0;
  switch (die.type) {
    case 'd4':  floor = 4;  offset = 1; break; 
    case 'd6':  floor = 6;  offset = 1; break; 
    case 'd8':  floor = 8;  offset = 1; break; 
    case 'd10': floor = 10; offset = 0; break; 
    case 'd12': floor = 12; offset = 1; break; 
    case 'd20': floor = 20; offset = 1; break; 
  }
  die.value = Math.floor(Math.random() * floor) + offset;
  die.time = Date.now();
};

var dice_status = (dice, counter) => {
  var out = '';
  var total = new Map();
  total.set('total', 0);
  dice.forEach((die) => {
    if (die.value > -1) {
      var old_value = 0;
      var old_count = 0;
      if (total.has(die.type)) {
        var old_value = total.get(die.type).value;
        var old_count = total.get(die.type).count;
      }
      var new_total = {
        value: old_value + die.value,
        count: old_count + 1
      };
      total.set(die.type, new_total);
      total.set('total', total.get('total') + die.value);
    }
  });
  ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].forEach((die_type) => {
    if (total.has(die_type)) {
      var curr = total.get(die_type);
      out += '<p class="' + die_type + '-label">' + curr.count + die_type + ':' + curr.value + '</p>&nbsp;';
    }
  });
  out += 'Total: ' + total.get('total');
  if (counter !== 0) {
    out += ' (' + (total.get('total') + counter) + ')';
  }
  return out;
};

var find_room = (rooms, id, socket) => {
  if (!rooms.has(id)) {
    console.log('ERROR: a user requested an unregistered room');
    
    // Send response to user
    socket.emit('alert', { kick: true, alert: 'Error: Unknown room' });
    return null;
  }
  return rooms.get(id);
};

var find_user_socket = (room, socket) => {
  var user = null;
  room.users.some((a_user) => {
    if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
      user = a_user;
      return true;
    }
  });
  return user;
};

var find_user_name = (room, name) => {
  var target_user = null;
  var target_user_index = -1;
  room.users.some((a_user, index) => {
    if (a_user.name === name) {
      target_user = a_user;
      target_user_index = index;
      return true;
    }
  });
  return [target_user, target_user_index];
};

module.exports = {
  rooms_array: rooms_array,
  room_array: room_array,
  remove_user: remove_user,
  remove_room: remove_room,
  create_id: create_id,
  get_updated: get_updated,
  set_updated: set_updated,
  roll: roll,
  dice_status: dice_status,
  find_room: find_room,
  find_user_socket: find_user_socket,
  find_user_name: find_user_name
};