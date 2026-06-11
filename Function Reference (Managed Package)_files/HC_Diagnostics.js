'use strict';

//H&T Community Diagnostics Script

(function (win) {
    if (!win.path) {
        win.path = win;
    }

    if (win.isCDSetUp === undefined) {
        win.isCDSetUp = false;
    }

    /**
     * listener for 'setConfigNS' event
     * It initialises a namespace to keep diagnostic data from LWCs
     */
    win.addEventListener('setConfigNS', function (event) {
        if (!event || !event.detail || !event.detail.configNS) {
            return;
        }
        try {
            let configNS = event.detail.configNS.split('.');

            configNS.forEach((property) => {
                win.path[property.trim()] = {};
                win.path = win.path[property.trim()];
            });
            win.isCDSetUp = true;
            win.diagnoseLWC();
        } catch (e) {
            //
        }
    });

    /**
     * listener for 'pushDiagnosticData' event
     * It populates the namespace with the data from LWCs
     */
    win.addEventListener('pushDiagnosticData', function (event) {
        if (!win.isCDSetUp || !event || !event.detail) {
            return;
        }
        try {
            event.detail.forEach((diagnosticData) => {
                win.path[diagnosticData.name] = diagnosticData.value;
            });
        } catch (e) {
            //
        }
    });

    /**
     * Requests diagnostics data from LWCs
     */
    win.diagnoseLWC = function () {
        if (win.isCDSetUp) {
            let requestDiagnosticDataEvent = new CustomEvent('sendDiagnosticData');
            win.dispatchEvent(requestDiagnosticDataEvent);
        }
    };

    /**
     * listener for 'load' event
     * requests diagnostics data from LWCs once the page is loaded
     */
    win.addEventListener('load', function (event) {
        win.diagnoseLWC();
    });
})(window);
