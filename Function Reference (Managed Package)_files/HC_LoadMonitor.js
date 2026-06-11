window.addEventListener('monitorload', function (e) {

    function loadWESX(url) {

        const jsURL = `${url}/wesx.js`;
        const js = Object.assign(document.createElement('script'), {
            src: `${jsURL}`,
            type: 'module'
        });

        const cssURL = `${url}/wesx.css`;
        const css = Object.assign(document.createElement('link'), {
            href: `${cssURL}`,
            rel: 'stylesheet',
            type: 'text/css'
        });

        const existingScripts = document.querySelectorAll('script[src="' + jsURL + '"]');
        if (existingScripts.length === 0) {
            document.head.appendChild(js);
        }
        
        const existingCss = document.querySelectorAll('script[src="' + cssURL + '"]');
        if (existingCss.length === 0) {
            document.head.appendChild(css);
        }
    }

    const { config, jwt } = e.detail;

    const componentsURL = config.url.replace('/monitor', '/components');
    loadWESX(componentsURL);
    fetch(`${config.url}/bootstrap.js`, {
        headers: {
            Authorization: `Bearer ${jwt}`
        }
    }).then(res => res.text()).then(res => {
        eval(res)({
            url: config.url,
            auth: jwt,
            root: document.querySelector('c-monitor-container')
        });
    });
});
