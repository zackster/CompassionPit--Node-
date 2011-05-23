(function ($, undefined) {
    $(function () {
        if ($("#listener-count").length === 0) {
            return;
        }
        
        function updateCounts() {
            $.get('/counts', function (data) {
                var listeners = data.listeners;
                var venters = data.venters;

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
            });
            setTimeout(updateCounts, 10 * 1000);
        }
        updateCounts();
    });
}(jQuery));