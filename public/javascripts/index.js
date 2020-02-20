// Elements
var create = {
  modal: '#create-modal',
  form: 'form#create',
  inputs: {
    user_name: '#create-user-name',
    room_name: '#create-room-name',
    admin_password: '#create-admin-password',
    user_password: '#create-user-password'
  },
  submit: '#create-submit'
};
var join = {
  modal: '#join-modal',
  form: 'form#join',
  title: '#join-title',
  inputs: {
    room_id: '#join-room-id',
    user_name: '#join-user-name',
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
var rooms = {
  table: 'table#rooms',
  body: '#rooms-body'
};

$(document).ready(function() {
  // Load web socket
  var socket = io();
  
  socket.on('connect', function() {
    if (DEBUG) console.log('connected');
    socket.emit('join', 'index'); socket.send('');
  });
  socket.on('alert',        show_alert);
  socket.on('update-rooms', update_rooms);
  socket.on('join-room',    join_room);
  socket.on('disconnect', function() { 
    if (DEBUG) console.log('disconnected');
  });

  function show_alert(data) {
    $('#alert-message').html('<span>' + data + '</span>');
    $('#alert').modal();
  }

  function update_rooms(data) {
    if (DEBUG) console.log('updating rooms');
    var room_table = '';
    if (data.length == 0) {
      room_table = `
<tr scope="row" id="no-rooms">
  <td colspan="5" class="text-center"><div><span>No rooms, create a new one!</span></div></td>
</tr>`;
    } else {
      for (var [id, room] of data) {
        room_table += `
  <tr scope="row">
    <td class="room-id d-none" scope="col">` + id + `</td>
    <td class="room-name" scope="col">` + room.name + `</td>
    <td class="room-users text-center" scope="col">` + room.users.toString() + `</td>
    <td class="room-locked d-none" scope="col">` + (room.locked ? "1" : "0") + `</td>
    <td class="text-center"><span class="oi" data-glyph="` + (room.locked ? "lock-locked" : "lock-unlocked") + `"></span></td>
  </tr>`;
      }
    }
    $(rooms.body).html(room_table);
  }

  function join_room(data) {
    if (DEBUG) console.log('joining ' + data);
    window.location.href = '/room/' + data;
  }

  // Form: Create Room
  $('button#create-button').on('click', (event) => {
    $(create.modal).modal();
  });

  $(create.form).submit(function() {
    var data = {
      user_name: $(create.inputs.user_name).val(),
      room_name: $(create.inputs.room_name).val(),
      admin_password: $(create.inputs.admin_password).val(),
      user_password: $(create.inputs.user_password).val()
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
    var room_name = $(this).find('td.room-name').html();
    var room_id = $(this).find('td.room-id').html();
    var room_locked = ($(this).find('td.room-locked').html() == 1);
    
    $(join.title).html('Join: ' + room_name);
    $(join.inputs.room_id).val(room_id);

    if (room_locked) {
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
  $(join.buttons.password).on('click', function(event) {
    $(join.buttons.password).addClass('d-none');
    $(join.labels.password).removeClass('d-none');
    $(join.inputs.password).removeClass('d-none');
  });

  $(join.form).submit(function() {
    var data = {
      room_id: $(join.inputs.room_id).val(),
      user_name: $(join.inputs.user_name).val(),
      password: $(join.inputs.password).val()
    };
    socket.emit('join-room', data); socket.send('');
    if (DEBUG) console.log('Connecting ' + JSON.stringify(data));
    return false;
  });
});