$(document).ready(function() {
  // Load Socket
  var socket = io();

  socket.on('room-list', function(rooms) {
    var room_table = '';
    for (var [id, room] of rooms) {
      room_table += '<tr>';
      room_table += '<td class="room-id d-none">' + id + '</td>';
      room_table += '<td class="room-name">' + room.name + '</td>';
      room_table += '<td class="room-users text-center">' + room.users.toString() + '</td>';
      room_table += '<td class="room-locked d-none">' + (room.locked ? "1" : "0") + '</td>';
      room_table += '<td class="text-center"><span class="oi" data-glyph="' + (room.locked ? "lock-locked" : "lock-unlocked") + '"></span></td>';
      room_table += '</tr>';
    }

    $('#room-list tbody').html(room_table);
  });

  $('#room-list').on('click', 'tbody tr', function(event) {
    var room_name = $(this).find('td.room-name').html();
    var room_id = $(this).find('td.room-id').html();
    
    $('#form-title').html(room_name);
    $('#room-id').val(room_id);

    $('#connect-modal').modal();
  });

  $('form#connect-form').submit(function() {
    var join_req = {
      room_id: $('input#room-id').val(),
      username: $('input#username').val(),
      password: $('input#password').val()
    };

    alert(JSON.stringify(join_req));
    socket.emit('join', join_req);
    return false;
  });
});