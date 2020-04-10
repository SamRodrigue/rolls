const roomsArray = rooms => {
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

const roomArray = (room, user) => {
  const data = {
    name: room.name,
    users: [],
    time: Date.now()
  };

  // Data is not specific to a user
  let userID = null;
  if (typeof user !== 'undefined') {
    userID = user.id;
  }

  room.users.forEach(aUser => {
    const out = {
      id: aUser.id,
      name: aUser.name,
      color: aUser.color,
      dice: [],
      share: aUser.share,
      counter: aUser.counter,
      updated: aUser.updated
    };

    if (aUser.share || aUser.id === userID) {
      out.dice = aUser.dice;
    }

    data.users.push(out);
  });

  return data;
};

const removeUser = (sid, rooms, roomID, sockets) => {
  let user = null;
  let userIndex = -1;
  let room = null;
  if (typeof roomID == 'undefined') {
    // Find room with sid
    for (const [id, aRoom] of rooms) {
      aRoom.users.some((aUser, index) => {
        if (aUser.socket.handshake.sessionID === sid) {
          userIndex = index;
          user = aUser;
          roomID = id;
          room = aRoom;
          return true;
        }
      });
    }
  } else {
    if (!rooms.has(roomID)) {
      console.log(`ERROR: a user requested an unregistered room ${roomID}`);
      return;
    }
    room = rooms.get(roomID);
    room.users.some((aUser, index) => {
      if (aUser.socket.handshake.sessionID === sid) {
        userIndex = index;
        user = aUser;
        return true;
      }
    });
  }

  if (room && user) {
    console.log(`removing user ${user.name} from ${roomID}`);

    // Send user leave message
    user.socket.emit('alert', 'You have been removed from the room');
    user.socket.leave(roomID);
    if (user.role === 'admin') user.socket.leave(`${roomID}-admin`);
    room.users.splice(userIndex, 1);
    user.socket.in(roomID).emit('room-data', roomArray(room));
    console.log(`users remaining ${room.users.length}`);

    if (room.users.length === 0) {
      room.timeout = setTimeout(() => {
        removeRoom(rooms, roomID, sockets)},
        global.ROOM_TIMEOUT);
      console.log(`room is empty ${roomID}`);
    }

    user.socket.in('index').emit('update-rooms', roomsArray(rooms));
  }
};

const removeRoom = (rooms, roomID, sockets) => {
  if (!rooms.has(roomID)) {
    console.log(`ERROR: trying to remove an unregistered room ${roomID}`);
    return;
  }
  const room = rooms.get(roomID);
  if (room.users.length === 0) {
    rooms.delete(roomID);
    console.log(`removing room ${roomID}`);
    sockets.in('index').emit('update-rooms', roomsArray(rooms));
  }
};

const createID = (type, arr) => {
  const getID = () => { return Math.random().toString(36).substr(2, 9); };
  let id = getID();
  // check if id colides with existing array of id
  // No checking required if type not specified.
  switch (type) {
    case 'room':
      while (arr.has(id)) {
        console.log('ABN: Room ID collision');
        id = getID();
      }
      break;
    case 'user':
      while (arr.filter(user => {
        return user.id === id;
      }).length) {
        console.log('ABN: User ID collision');
        id = getID();
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
        id = getID();
      }
      break;
  }

  return id;
};

const getUpdated = () => {
  return Date.now().toString(36);
};

const setUpdated = user => {
  user.updated = getUpdated();
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

  let lastDie = die.value;
  for (let i = 20; i > 0; i--) {
    let val;
    let count = 10;
    do {
      val = Math.floor(Math.random() * floor) + offset;
    } while (val === lastDie && --count > 0);

    if (--count <= 0) {
      console.log('ABN: Unable to get unique value for roll animation');
    }

    die.anime[i - 1] = val;
    lastDie = val;
  }
};

const diceStatus = (dice, counter) => {
  let out = '';
  const total = new Map();
  total.set('total', 0);
  dice.forEach(die => {
    if (die.value > -1) {
      let oldValue = 0;
      let oldCount = 0;
      if (total.has(die.type)) {
        oldValue = total.get(die.type).value;
        oldCount = total.get(die.type).count;
      }
      const newTotal = {
        value: oldValue + die.value,
        count: oldCount + 1
      };
      total.set(die.type, newTotal);
      total.set('total', total.get('total') + die.value);
    }
  });
  ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'].forEach(dieType => {
    if (total.has(dieType)) {
      const curr = total.get(dieType);
      out += `<p class="${dieType}-label">${curr.count}${dieType}:${curr.value}</p>&nbsp;`;
    }
  });
  out += `Total: ${total.get('total')}`;
  if (counter !== 0) {
    out += ` (${total.get('total') + counter})`;
  }

  return out;
};

const findRoom = (rooms, id, socket) => {
  if (!rooms.has(id)) {
    console.log('ERROR: a user requested an unregistered room');

    // Send response to user
    socket.emit('alert', { kick: true, alert: 'Error: Unknown room' });
    return null;
  }

  return rooms.get(id);
};

const findUserSession = (room, session) => {
  let user = null;
  room.users.some(aUser => {
    if (session === aUser.socket.handshake.sessionID) {
      user = aUser;
      return true;
    }
  });

  return user;
}

const findUserSocket = (room, socket) => {
  return findUserSession(room, socket.handshake.sessionID);
};

const findUserName = (room, name) => {
  let targetUser = null;
  let targetUserIndex = -1;
  room.users.some((aUser, index) => {
    if (aUser.name === name) {
      targetUser = aUser;
      targetUserIndex = index;
      return true;
    }
  });

  return [targetUser, targetUserIndex];
};

// User Colors
const colorFromString = str => {
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

const colorToArray = colorString => {
  if (!colorString) {
    return;
  }

  let out = [0, 0, 0];

  const regex = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
  if (regex.test(colorString)) {
    const outString = colorString.match(regex);
    out = [
      parseInt(outString[1]),
      parseInt(outString[2]),
      parseInt(outString[3])
    ];
  }

  return out;
};

module.exports = {
  roomsArray,
  roomArray,
  removeUser,
  removeRoom,
  createID,
  getUpdated,
  setUpdated,
  roll,
  diceStatus,
  findRoom,
  findUserSession,
  findUserSocket,
  findUserName,
  colorFromString,
  colorToArray
};