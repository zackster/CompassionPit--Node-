(function ($, undefined) {
    $(function () {
        if ($("#listener-count").length === 0) {
            return;
        }
        
        var comm = Comm.create();
        comm.start();
        
        var updateCounts = function(data) {
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
        
        var requestCounts = function() {
            comm.request("counts", null, updateCounts);
            setTimeout(requestCounts, 10 * 1000);
        }
        requestCounts();
    });
}(jQuery));