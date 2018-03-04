$(document).ready(function() {
  $('#room-list').on('click', 'tbody tr', function(event) {
    var room_name = $(this).find("td.room-name").html();
    $('#form-title').html(room_name);
    $('#connect').modal();
    console.log(room_name);
  });
});