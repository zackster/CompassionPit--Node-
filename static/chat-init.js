(function($,undefined) {

    "use strict";
    var updateHUD = function() {
        var docready = this;
        docready.comm.request("updateHUD", paintUserLeaderboard);

        setTimeout(function() {
            updateHUD.call(docready, null);
        }, 1000*60);
    };

    var paintUserLeaderboard = function(userLeaderboard) {
		$("#score").text('You have ' + userLeaderboard.score + ' points');
		$("#diff").text('But you only need ' + userLeaderboard.diff + ' points ');
		$("#rank").text('So your rank is currently #' + userLeaderboard.rank);
    };


  $(document).ready(function() {
	var docready = this;

    $("div#Chatmain, div#loggedInAs, div#reputationLogin, div#listenerFeedback, a#meant_to_login, button#register").hide();
    window.LISTENER_LOGGED_IN = false;

    var comm = window.Comm.create();
    comm.register();
    window.Chat.create();
    updateHUD.call(docready, null);



  });


}(jQuery));
