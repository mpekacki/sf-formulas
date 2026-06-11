var coveoCookieCheck = setInterval(function () {
    handleCoveoCookies();
}, 3000);
function handleCoveoCookies() {
    let currentCoveoVisitorId = _getCookie('LSKey-CoveoV2$coveo_visitorId');
    let currentAuraCoveoVisitorId = _getCookie('LSKey-c$coveo_visitorId');

    if (currentCoveoVisitorId) {
        _setCookie('LSKey-c$coveo_visitorId', currentCoveoVisitorId, null, null);
    } else if (currentAuraCoveoVisitorId) {
        _setCookie('LSKey-CoveoV2$coveo_visitorId', currentAuraCoveoVisitorId, null);
    }

    currentCoveoVisitorId = _getCookie('LSKey-CoveoV2$coveo_visitorId');
    currentAuraCoveoVisitorId = _getCookie('LSKey-c$coveo_visitorId');

    if (currentCoveoVisitorId !== currentAuraCoveoVisitorId) {
        _setCookie('LSKey-c$coveo_visitorId', currentCoveoVisitorId, null, null);
    } else if (!!_getCookie('LSKey-CoveoV2$coveo_visitorId')) {
        clearInterval(coveoCookieCheck);
    }

    const coveoV2visitorIdIndex = getStorageIndexForName('LSSIndex:LOCAL{"namespace":"CoveoV2"}');
    const headlessVisitorIndex = getStorageIndexForName('LSSIndex:LOCAL{"namespace":"c"}');
    const coveov2visitorId = localStorage.getItem(coveoV2visitorIdIndex);
    const coveoHeadlessVisitorId = localStorage.getItem(headlessVisitorIndex);
    if (coveov2visitorId && coveov2visitorId != 'null' && coveov2visitorId != 'undefined') {
        window.localStorage.setItem(headlessVisitorIndex, coveov2visitorId);
    } else if (coveoHeadlessVisitorId && coveoHeadlessVisitorId != 'null' && coveoHeadlessVisitorId != 'undefined') {
        window.localStorage.setItem(coveoV2visitorIdIndex, coveoHeadlessVisitorId);
    }

    if (coveov2visitorId || coveoHeadlessVisitorId) {
        clearInterval(coveoCookieCheck);
    }

    if (
        _getCookie('LSKey-CoveoV2$coveo_visitorId') &&
        _getCookie('LSKey-c$coveo_visitorId') === _getCookie('LSKey-CoveoV2$coveo_visitorId')
    ) {
        clearInterval(coveoCookieCheck);
    }
}

function getStorageIndexForName(name) {
    let storageVal = localStorage.getItem(name);
    let currentCoveoV2values = storageVal ? JSON.parse(storageVal) : null;
    let visitorIdIndex;
    if (currentCoveoV2values) {
        visitorIdIndex = currentCoveoV2values.visitorId;
    }
    return visitorIdIndex;
}

handleCoveoCookies();

window.addEventListener('case-view-comment-attachment', function (e) {
    try {
        let attachmentInputEl = document
            .querySelector('c-hc-case-view-form')
            .shadowRoot.querySelector('c-hc-case-comment-submission')
            .shadowRoot.querySelector('lightning-file-upload')
            .shadowRoot.querySelector('lightning-input');
            
        const attachmentInputFileEl = attachmentInputEl.shadowRoot.querySelector('lightning-primitive-input-file');
        attachmentInputEl = attachmentInputFileEl ? attachmentInputFileEl : attachmentInputEl;
    
        attachmentInputEl.shadowRoot.querySelector('lightning-primitive-file-droppable-zone')
            .shadowRoot.querySelector('slot')
            .assignedNodes()[1]
            .click();
    } catch (ex) {
        console.error(ex);
    }
});
