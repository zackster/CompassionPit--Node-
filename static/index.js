(function ($, undefined) {
    $(function () {
        if ($("#listener-count").length === 0) {
            return;
        }
        


        var hasFocus = true;
        
        var updateCounts = function(data) {
            var listeners = data.l;
            var venters = data.v;
            
            $('#listener-count').text(listeners);
            $('#venter-count').text(venters);
            $('#counts').removeClass("loading");
            $('#counts').show();
        };

        if (window.startingRoomCounts) {
            updateCounts(window.startingRoomCounts);
            window.startingRoomCounts = undefined;
        }
        
        var timeoutId = null;
        var requestCounts = function() {
            timeoutId = null;
            $.getJSON('/counts', updateCounts);

            $('#counts').addClass("loading");
            if (hasFocus) {
                timeoutId = setTimeout(requestCounts, 10 * 1000);
            }
        };
        requestCounts();
        $(window).bind("blur", function() {
          hasFocus = false;
        });
        $(window).bind("focus", function() {
          hasFocus = true;

          if (!timeoutId) {
            requestCounts();
          }
        });
    });
}(jQuery));