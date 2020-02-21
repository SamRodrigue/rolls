const rooms_array = rooms => {
  const data = [];

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

const room_array = (room, user) => {
  const data = {
    name: room.name,
    users: [],
    time: Date.now()
  };

  // Data is not specific to a user
  let user_id = null;
  if (typeof user !== 'undefined') {
    user_id = user.id;
  }

  room.users.forEach(a_user => {
    const out = {
      id: a_user.id,
      name: a_user.name,
      color: a_user.color,
      dice: [],
      share: a_user.share,
      counter: a_user.counter,
      updated: a_user.updated
    };

    if (a_user.share || a_user.id === user_id) {
      out.dice = a_user.dice;
    }

    data.users.push(out);
  });

  return data;
};

const remove_user = (sid, rooms, room_id, sockets) => {
  let user = null;
  let user_index = -1;
  let room = null;
  if (typeof room_id == 'undefined') {
    // Find room with sid
    for (const [id, a_room] of rooms) {
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
      console.log(`ERROR: a user requested an unregistered room ${room_id}`);
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
    console.log(`removing user ${user.name} from ${room_id}`);

    // Send user leave message
    user.socket.emit('alert', 'You have been removed from the room');
    user.socket.leave(room_id);
    if (user.role === 'admin') user.socket.leave(`${room_id}-admin`);
    room.users.splice(user_index, 1);
    user.socket.in(room_id).emit('room-data', room_array(room));
    console.log(`users remaining ${room.users.length}`);

    if (room.users.length === 0) {
      room.timeout = setTimeout(() => {
        remove_room(rooms, room_id, sockets)}, 
        global.ROOM_TIMEOUT);
      console.log(`room is empty ${room_id}`);
    }

    user.socket.in('index').emit('update-rooms', rooms_array(rooms));
  }
};

const remove_room = (rooms, room_id, sockets) => {
  if (!rooms.has(room_id)) {
    console.log(`ERROR: trying to remove an unregistered room ${room_id}`);
    return;
  }
  const room = rooms.get(room_id);
  if (room.users.length === 0) {
    rooms.delete(room_id);
    console.log(`removing room ${room_id}`);
    sockets.in('index').emit('update-rooms', rooms_array(rooms));
  }
};

const create_id = (type, arr) => {
  const get_id = () => { return Math.random().toString(36).substr(2, 9); };
  let id = get_id();
  // check if id colides with existing array of id
  // No checking required if type not specified.
  switch (type) {
    case 'room':
      while (arr.has(id)) {
        console.log('ABN: Room ID collision');
        id = get_id();
      }
      break;
    case 'user':
      while (arr.filter(user => {
        return user.id === id;
      }).length) {
        console.log('ABN: User ID collision');
        id = get_id();
      }
      break;
    case 'dice':
      while (arr.filter(user => {
        for (const die of user.dice) {
          if (die.id === id) {
            return true;
          }
        }
        return false;
      }).length) {
        console.log('ABN: Dice ID collision');
        id = get_id();
      }
      break;
  }

  return id;
};

const get_updated = () => {
  return Date.now().toString(36);
};

const set_updated = user => {
  user.updated = get_updated();
};

const roll = die => {
  let floor = 0;
  const offset = 1;

  switch (die.type) {
    case 'd4':  floor = 4;  break;
    case 'd6':  floor = 6;  break;
    case 'd8':  floor = 8;  break;
    case 'd10': floor = 10; break; // 10 is displayed as 0 in client
    case 'd12': floor = 12; break;
    case 'd20': floor = 20; break;
  }

  die.value = Math.floor(Math.random() * floor) + offset;
  die.time = Date.now();
  die.anime = [];

  let last_die = die.value;
  for (let i = 20; i > 0; i--) {
    let val;
    let count = 10;
    do {
      val = Math.floor(Math.random() * floor) + offset;
    } while (val === last_die && --count > 0);

    if (--count <= 0) {
      console.log('ABN: Unable to get unique value for roll animation');
    }

    die.anime[i - 1] = val;
    last_die = val;
  }
};

const dice_status = (dice, counter) => {
  let out = '';
  const total = new Map();
  total.set('total', 0);
  dice.forEach(die => {
    if (die.value > -1) {
      let old_value = 0;
      let old_count = 0;
      if (total.has(die.type)) {
        old_value = total.get(die.type).value;
        old_count = total.get(die.type).count;
      }
      const new_total = {
        value: old_value + die.value,
        count: old_count + 1
      };
      total.set(die.type, new_total);
      total.set('total', total.get('total') + die.value);
    }
  });
  ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].forEach(die_type => {
    if (total.has(die_type)) {
      const curr = total.get(die_type);
      out += `<p class="${die_type}-label">${curr.count}${die_type}:${curr.value}</p>&nbsp;`;
    }
  });
  out += `Total: ${total.get('total')}`;
  if (counter !== 0) {
    out += ` (${total.get('total') + counter})`;
  }

  return out;
};

const find_room = (rooms, id, socket) => {
  if (!rooms.has(id)) {
    console.log('ERROR: a user requested an unregistered room');
    
    // Send response to user
    socket.emit('alert', { kick: true, alert: 'Error: Unknown room' });
    return null;
  }

  return rooms.get(id);
};

const find_user_socket = (room, socket) => {
  let user = null;
  room.users.some(a_user => {
    if (socket.handshake.sessionID === a_user.socket.handshake.sessionID) {
      user = a_user;
      return true;
    }
  });

  return user;
};

const find_user_name = (room, name) => {
  let target_user = null;
  let target_user_index = -1;
  room.users.some((a_user, index) => {
    if (a_user.name === name) {
      target_user = a_user;
      target_user_index = index;
      return true;
    }
  });

  return [target_user, target_user_index];
};

// User Colors
const color_from_string = str => {
  let hash = 5381;
  let i = str.length;

  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }
  hash = hash >>> 0;

  const out = [
    (((hash & 0xFF000000) >> 24) % 8) * 32,
    (((hash & 0x00FF0000) >> 16) % 8) * 32,
    (((hash & 0x0000FF00) >> 8) % 8) * 32
  ];

  return out;
};

const color_to_array = color_string => {
  if (!color_string) {
    return;
  }

  let out = [0, 0, 0];

  const regex = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
  if (regex.test(color_string)) {
    const out_string = color_string.match(regex);
    out = [
      parseInt(out_string[1]),
      parseInt(out_string[2]),
      parseInt(out_string[3])
    ];
  }

  return out;
};

module.exports = {
  rooms_array,
  room_array,
  remove_user,
  remove_room,
  create_id,
  get_updated,
  set_updated,
  roll,
  dice_status,
  find_room,
  find_user_socket,
  find_user_name,
  color_from_string,
  color_to_array
};