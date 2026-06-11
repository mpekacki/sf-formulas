'use strict';

/**
 * external scripts loader
 * to load scripts that require operation in the global scope
 * and are not fully funtional inside an LWC component
 * @author Andrey Novikov
 */
window.addEventListener('loadScript', function (event) {
    if (!event || !event.detail) {
        return;
    }
    let src = event.detail.src;
    let responceEvent = event.detail.responceEvent;
    let loadMode = event.detail.loadMode;
    let reference2Return = event.detail.reference2Return;

    let externalScript = document.createElement('script');
    externalScript.onload = () => {
        if (responceEvent) {
            let replyEvent;
            if (reference2Return) {
                replyEvent = new CustomEvent(responceEvent, {
                    detail: {
                        reference: window[reference2Return],
                        success: true
                    }
                });
            } else {
                replyEvent = new CustomEvent(responceEvent, {
                    detail: {
                        success: true
                    }
                });
            }
            window.dispatchEvent(replyEvent);
        }
    };
    externalScript.onerror = () => {
        replyEvent = new CustomEvent(responceEvent, {
            detail: {
                errorMessage: 'Error loading ' + src,
                success: false
            }
        });
        window.dispatchEvent(replyEvent);
    };
    if (loadMode) {
        externalScript.async = loadMode;
        externalScript.defer = loadMode;
    }
    externalScript.src = src;
    document.head.appendChild(externalScript);
});

/**
 * listener for 'getModule' event
 * provides a requester with the necessary reference
 * from the global scope
 * @author Andrey Novikov
 */
window.addEventListener('getModule', function (event) {
    if (!event || !event.detail || !event.detail.responceEvent || !event.detail.reference2Return) {
        return;
    }
    let responceEvent = event.detail.responceEvent;
    let reference2Return = event.detail.reference2Return;

    window.dispatchEvent(
        new CustomEvent(responceEvent, {
            detail: {
                reference: window[reference2Return]
            }
        })
    );
});
