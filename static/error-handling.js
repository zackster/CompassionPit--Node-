(function ($, undefined) {
    window.onerror = function (errorMsg, url, lineNumber) {
        $.post('/log-error', {
            errorMsg: errorMsg,
            url: url,
            location: location.toString(),
            lineNumber: lineNumber
        });
        return false;
    };
}(jQuery));