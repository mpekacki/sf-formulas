const mfeScripts = [
    {
        id: 'page-builder-miaw-ui',
        src: document.querySelector(`meta[name="miaw-module:${window.location.hostname}"]`).content || 'https://c.salesforce.com/digital/@sfdc-www-emu/page-builder-miaw-ui/v1-stable/page-builder-miaw-ui.js'
    },
    {
        id: 'af-input-and-prompts',
        src: document.querySelector(`meta[name="input-module:${window.location.hostname}"]`).content || 'https://c.salesforce.com/digital/@sfdc-www-emu/page-builder-miaw-ui/v1-stable/af-input-and-prompts.js'
    }
];

window.asaMfeModuleLoadState = {
    loaded: false,
    isLoading: true,
    isError: false,
    error: null
};

window.asaInputModuleLoadState = {
    loaded: false,
    isLoading: true,
    isError: false,
    error: null
};

window.addEventListener('helpagentmfemoduleloadingcomplete', function() {
    setMiawLoadHandler();
});

window.addEventListener('helpagentinputmoduleloadingcomplete', function() {
    setInputLoadHandler();
});

function loadScript(scriptConfig) {
    return new Promise(function(resolve, reject) {
        // Create script element
        const script = document.createElement('script');
        script.type = 'module';
        script.src = scriptConfig.src;
        script.onload = () => {
            if (scriptConfig.id === 'page-builder-miaw-ui') {
                window.asaMfeModuleLoadState.loaded = true;
                window.asaMfeModuleLoadState.isLoading = false;
                setMiawLoadHandler();
            } else if (scriptConfig.id === 'af-input-and-prompts') {
                window.asaInputModuleLoadState.loaded = true;
                window.asaInputModuleLoadState.isLoading = false;
                setInputLoadHandler();
            }

            resolve(scriptConfig);
        };

        // Handle errors
        script.onerror = (event) => {
            console.error(`Failed to load script: ${scriptConfig.id}`, event);
            if (scriptConfig.id === 'page-builder-miaw-ui') {
                window.asaMfeModuleLoadState.isError = true;
                window.asaMfeModuleLoadState.error = event;
                window.asaMfeModuleLoadState.isLoading = false;
                setMiawLoadHandler();
            } else if (scriptConfig.id === 'af-input-and-prompts') {
                window.asaInputModuleLoadState.isError = true;
                window.asaInputModuleLoadState.error = event;
                window.asaInputModuleLoadState.isLoading = false;
                setInputLoadHandler();
            }
            reject(new Error(`Failed to load ${scriptConfig.id}`));
        };

        // Append to document head
        document.head.appendChild(script);
    });
}

/**
 * Inject a style element to override body styles applied by Agentforce MFE when the fullscreen modal is hidden.
 */
function injectBodyStyleOverride() {
    if (document.getElementById('asa-body-style-override')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'asa-body-style-override';
    style.textContent = 'body[data-asa-suppress-body-styles="true"]{top:0!important;overflow:auto!important;width:auto!important}';
    document.head.appendChild(style);
}

function init() {
    injectBodyStyleOverride();
    mfeScripts.forEach(script => loadScript(script));
}

function setMiawLoadHandler() {
    window.dispatchEvent(new CustomEvent('helpagentmfemoduleloaded', { detail: { mfe: 'page-builder-miaw-ui', loadState: window.asaMfeModuleLoadState } }));
}

function setInputLoadHandler() {
    window.dispatchEvent(new CustomEvent('helpagentinputmoduleloaded', { detail: { input: 'af-input-and-prompts', loadState: window.asaInputModuleLoadState } }));
}

//load the scripts
init();