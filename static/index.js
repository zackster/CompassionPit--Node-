(function ($, undefined) {
    $(function () {
        if ($("#listener-count").length === 0) {
            return;
        }
        
        var comm = Comm.create();
        comm.start();

        var hasFocus = true;
        
        var updateCounts = function(data) {
            console.log(data);
            var listeners = data.l;
            var venters = data.v;
            
            $('#listener-count').text(listeners);
            $('#venter-count').text(venters);

            $('#counts').hide();
            $('#need-listeners').hide();
            $('#need-venters').hide();
            $('#need-anyone').hide();

            if (listeners || venters) {
                $('#counts').show();
                if (listeners > venters) {
                    $('#need-venters').show();
                }
                else if (venters > listeners) {
                    $('#need-listeners').show();
                }
            }
            else {
                $('#need-anyone').show();
            }
        };
        if (window.startingRoomCounts) {
            updateCounts(window.startingRoomCounts);
            delete window.startingRoomCounts;
        }
        
        var timeoutId = null;
        var requestCounts = function() {
            timeoutId = null;
            comm.request("counts", null, updateCounts);
            
            if (hasFocus) {
                timeoutId = setTimeout(requestCounts, 10 * 1000);
            }
        }
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