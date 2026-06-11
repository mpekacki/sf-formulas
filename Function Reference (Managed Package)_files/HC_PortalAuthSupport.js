'use strict';

(function () {
    function setAutoLoginCookie(idp, domain) {
        if (getAutoLoginCookie()) document.cookie = `idp=${idp}; path=/; domain=${domain}; secure; samesite=strict`;
    }

    function getAutoLoginCookie() {
        let idp = document.cookie.split(';').find((cookie) => cookie.trim().startsWith('idp='));
        return idp !== 'idp=' ? true : false;
    }

    window.addEventListener('autoLogin', function (event) {
        if ((event.detail && event.detail.idp, event.detail.domain)) {
            setAutoLoginCookie(event.detail.idp, event.detail.domain);
        }
    });
})();
