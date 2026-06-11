window.addEventListener('tableuscriptlazyload', function (e) {
    try {
        if (
            typeof __tableauApiServiceRegistry == 'undefined' ||
            document.getElementById('tableaucustomersuccessscorescript') == null
        ) {
            const hostname = window.location.host;
            const tableasuCSSHostname = document.querySelector(`meta[name="tableau-css:${hostname}"]`);
            let s = document.createElement('script');
            s.id = 'tableaucustomersuccessscorescript';
            s.defer = true;
            s.type = 'module';
            const tableauScriptUrl =
                tableasuCSSHostname != null && tableasuCSSHostname != 'undefined'
                    ? tableasuCSSHostname
                    : document.querySelector('meta[name="tableau-css:default"]');
            s.src = tableauScriptUrl != null ? (tableauScriptUrl.getAttribute('content') != null ? tableauScriptUrl.getAttribute('content') : 'https://us-west-2b.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js') : 'https://us-west-2b.online.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js';
            s.onload = dispatchTableauScriptLoaded;
            document.head.appendChild(s);
        } else {
            dispatchTableauScriptLoaded();
        }
    } catch (ex) {
        console.warn(ex);
    }
});

function dispatchTableauScriptLoaded() {
    let event = new CustomEvent('tableauscriptloaded');
    window.dispatchEvent(event);
}
