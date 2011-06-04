(function ($, undefined) {
    window.onerror = function (errorMsg, url, lineNumber) {
        var loc;
        try {
            loc = location.href || location.toString();
        } catch (err) {
            loc = "";
        }
        $.post('/log-error', {
            errorMsg: errorMsg,
            url: url,
            location: loc,
            lineNumber: lineNumber
        });
        return true;
    };
}(jQuery));