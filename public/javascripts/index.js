// Elements
const create = {
  modal: '#create-modal',
  form: 'form#create',
  inputs: {
    userName: '#create-user-name',
    roomName: '#create-room-name',
    adminPassword: '#create-admin-password',
    userPassword: '#create-user-password'
  },
  submit: '#create-submit'
};
const join = {
  modal: '#join-modal',
  form: 'form#join',
  title: '#join-title',
  inputs: {
    roomID: '#join-room-id',
    userName: '#join-user-name',
    password: '#join-password'
  },
  submit: '#join-submit',
  labels: {
    password: '#join-label-password'
  },
  buttons: {
    password: '#join-button-password'
  }
};
const rooms = {
  table: 'table#rooms',
  body: '#rooms-body'
};

$(document).ready(() => {
  // Load web socket
  const socket = io();

  socket.on('connect', () => {
    if (DEBUG) console.log('connected');
    socket.emit('join', 'index'); socket.send('');
  });
  socket.on('alert',        showAlert);
  socket.on('update-rooms', updateRooms);
  socket.on('join-room',    joinRoom);
  socket.on('disconnect', () => {
    if (DEBUG) console.log('disconnected');
  });

  function showAlert(data) {
    $('#alert-message').html(`<span>${data}</span>`);
    $('#alert').modal();
  }

  function updateRooms(data) {
    if (DEBUG) console.log('updating rooms');
    let roomTable = '';
    if (data.length == 0) {
      roomTable = `
<tr scope="row" id="no-rooms">
  <td colspan="5" class="text-center"><div><span>No rooms, create a new one!</span></div></td>
</tr>`;
    } else {
      for (const [id, room] of data) {
        roomTable += `
  <tr scope="row">
    <td class="room-id d-none" scope="col">` + id + `</td>
    <td class="room-name" scope="col">` + room.name + `</td>
    <td class="room-users text-center" scope="col">` + room.users.toString() + `</td>
    <td class="room-locked d-none" scope="col">` + (room.locked ? "1" : "0") + `</td>
    <td class="text-center"><span class="oi" data-glyph="` + (room.locked ? "lock-locked" : "lock-unlocked") + `"></span></td>
  </tr>`;
      }
    }
    $(rooms.body).html(roomTable);
  }

  function joinRoom(data) {
    if (DEBUG) console.log(`joining ${data}`);
    window.location.href = `/room/${data}`;
  }

  // Form: Create Room
  $('button#create-button').on('click', event => {
    $(create.modal).modal();
  });

  $(create.form).submit(() => {
    const data = {
      userName: $(create.inputs.userName).val(),
      roomName: $(create.inputs.roomName).val(),
      adminPassword: $(create.inputs.adminPassword).val(),
      userPassword: $(create.inputs.userPassword).val()
    };
    socket.emit('create-room', data); socket.send('');
    return false;
  });

  // Table: Room-List
  $(rooms.body).on('click', 'tr', function() {
    if ($(this).is('#no-rooms')) {
      $(create.modal).modal();
      return;
    }
    const roomName = $(this).find('td.room-name').html();
    const roomID = $(this).find('td.room-id').html();
    const roomLocked = ($(this).find('td.room-locked').html() == 1);

    $(join.title).html(`Join: ${roomName}`);
    $(join.inputs.roomID).val(roomID);

    if (roomLocked) {
      $(join.labels.password).removeClass('d-none');
      $(join.inputs.password).removeClass('d-none');
      $(join.buttons.password).addClass('d-none');
    } else {
      $(join.inputs.password).val('');
      $(join.labels.password).addClass('d-none');
      $(join.inputs.password).addClass('d-none');
      $(join.buttons.password).removeClass('d-none');
    }
    $(join.modal).modal();
  });

  // Form: Join Room
  $(join.buttons.password).on('click', event => {
    $(join.buttons.password).addClass('d-none');
    $(join.labels.password).removeClass('d-none');
    $(join.inputs.password).removeClass('d-none');
  });

  $(join.form).submit(() => {
    const data = {
      roomID: $(join.inputs.roomID).val(),
      userName: $(join.inputs.userName).val(),
      password: $(join.inputs.password).val()
    };
    socket.emit('join-room', data); socket.send('');
    if (DEBUG) console.log(`Connecting ${JSON.stringify(data)}`);
    return false;
  });
});