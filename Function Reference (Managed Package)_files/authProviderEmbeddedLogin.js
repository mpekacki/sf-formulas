"use strict";
(() => {
  // packages/embeddedlogin/src/authProviderEmbeddedLogin.ts
  var SFIDWidget_loginHandler;
  var SFIDWidget_logoutHandler;
  var SFIDWidget_initHandler;
  var IIS_SESSION_STORAGE_KEY = "iis_data";
  var SFIDWidget = function() {
    const SESSION_STORAGE_TTL = 30 * 60 * 1e3;
    let config;
    let authconfig;
    let openid;
    let openid_response;
    let lastLoggedInFrom;
    let logoutIframe;
    let response_ts;
    let isAliveInitialized = false;
    let isLogoutInitiated = false;
    let retryAfterLoginCount = 0;
    function addButton(targetDiv) {
      targetDiv.innerHTML = "";
      const button = document.createElement("button");
      button.id = "sfid-login-button";
      button.className = "sfid-button";
      button.innerHTML = "Log in";
      button.setAttribute("onClick", "SFIDWidget.login()");
      if (SFIDWidget.config.useCommunityPrimaryColor) {
        button.style.backgroundColor = SFIDWidget.authconfig.LoginPage.PrimaryColor;
      }
      targetDiv.appendChild(button);
    }
    function addCurrentPathAndSearchAsStartUrl(url) {
      return addQueryParamToUrl(url, "startURL", location.pathname + location.search);
    }
    function addQueryParamToUrl(url, queryParamKey, queryParamValue) {
      if (queryParamValue) {
        if (url.indexOf("?") === -1) {
          url += "?" + queryParamKey + "=" + encodeURIComponent(queryParamValue);
        } else {
          url += "&" + queryParamKey + "=" + encodeURIComponent(queryParamValue);
        }
      }
      return url;
    }
    function addExpIdToUrl(url) {
      if (SFIDWidget.config.expid) {
        if (url.indexOf("?") === -1) {
          url += "?expid=" + encodeURIComponent(SFIDWidget.config.expid);
        } else {
          url += "&expid=" + encodeURIComponent(SFIDWidget.config.expid);
        }
      }
      return url;
    }
    function addBrandToUrl(url) {
      if (SFIDWidget.config.brand) {
        url += (url.indexOf("?") === -1 ? "?" : "&") + "brand=" + encodeURIComponent(SFIDWidget.config.brand);
      }
      return url;
    }
    function addLogin(targetDiv) {
      if (targetDiv != null)
        targetDiv.innerHTML = "";
      const content = document.createElement("div");
      if (SFIDWidget.config.mode === "modal") {
        content.id = "sfid-content";
      } else if (SFIDWidget.config.mode === "inline")
        content.id = "sfid-inline-content";
      if (SFIDWidget.config.mode === "modal") {
        if (SFIDWidget.authconfig.LoginPage.LogoUrl != null) {
          const logowrapper = document.createElement("div");
          logowrapper.id = "sfid-logo_wrapper";
          logowrapper.className = "sfid-standard_logo_wrapper sfid-mt12";
          const img = document.createElement("img");
          img.src = SFIDWidget.authconfig.LoginPage.LogoUrl;
          img.className = "sfid-standard_logo";
          img.alt = "Salesforce";
          logowrapper.appendChild(img);
          const dialogTitle = document.createElement("h2");
          dialogTitle.id = "dialogTitle";
          const textNode = document.createTextNode("Salesforce Login");
          dialogTitle.appendChild(textNode);
          content.setAttribute("role", "dialog");
          content.setAttribute("aria-labelledby", dialogTitle.id);
          content.tabIndex = -1;
          content.addEventListener(
            "keydown",
            function(event) {
              if (event.keyCode === 27) {
                SFIDWidget.cancel();
              }
            },
            true
          );
          content.appendChild(logowrapper);
        }
      }
      const error = document.createElement("div");
      error.className = "sfid-mb1";
      error.id = "sfid-error";
      error.innerHTML = "We can't log you in. Make sure your username and password are correct.";
      error.style.display = "none";
      error.setAttribute("role", "alert");
      content.appendChild(error);
      if (SFIDWidget.authconfig.LoginPage.UsernamePasswordEnabled) {
        const form = document.createElement("form");
        form.setAttribute("onSubmit", "SFIDWidget.authenticate();return false;");
        const un = document.createElement("input");
        un.className = "sfid-wide sfid-mb12";
        un.type = "text";
        un.name = "username";
        un.id = "sfid-username";
        un.setAttribute("autofocus", "autofocus");
        const labelEmail = document.createElement("LABEL");
        labelEmail.htmlFor = un.id;
        labelEmail.className = "sfid-button-label";
        labelEmail.innerText = "Username";
        const pw = document.createElement("input");
        pw.className = "sfid-wide sfid-mb12";
        pw.type = "password";
        pw.name = "password";
        pw.id = "sfid-password";
        const labelPw = document.createElement("LABEL");
        labelPw.innerText = "Password";
        labelPw.htmlFor = pw.id;
        labelPw.className = "sfid-button-label";
        const button = document.createElement("input");
        button.className = "sfid-button sfid-wide sfid-mb16";
        button.type = "submit";
        button.id = "sfid-submit";
        button.value = "Log In";
        form.appendChild(labelEmail);
        form.appendChild(un);
        form.appendChild(labelPw);
        form.appendChild(pw);
        form.appendChild(button);
        content.appendChild(form);
      }
      const divForgotPswdSelfReg = document.createElement("div");
      divForgotPswdSelfReg.id = "sfid-selfreg-password";
      if (SFIDWidget.config.forgotPasswordEnabled === "true") {
        const fp = document.createElement("a");
        fp.id = "sfid-forgot-password";
        fp.href = decodeURIComponent(addExpIdToUrl(SFIDWidget.authconfig.LoginPage.ForgotPasswordUrl));
        fp.text = "Forgot your password?";
        divForgotPswdSelfReg.appendChild(fp);
      }
      if (SFIDWidget.authconfig.LoginPage.SelfRegistrationEnabled && SFIDWidget.config.selfRegistrationEnabled === "true") {
        const sr = document.createElement("a");
        sr.id = "sfid-self-registration";
        sr.href = decodeURIComponent(addExpIdToUrl(SFIDWidget.authconfig.LoginPage.SelfRegistrationUrl));
        sr.text = "Not a member?";
        divForgotPswdSelfReg.appendChild(sr);
      }
      if (divForgotPswdSelfReg.children.length > 0) {
        content.appendChild(divForgotPswdSelfReg);
      }
      const isUsernamePassEnabled = SFIDWidget.authconfig.LoginPage.UsernamePasswordEnabled;
      const numOfAuthProv = SFIDWidget.authconfig.AuthProviders.length;
      const numOfSamlProv = SFIDWidget.authconfig.SamlProviders.length;
      if (isUsernamePassEnabled && (numOfAuthProv > 0 || numOfSamlProv > 0)) {
        const orloginwithspace = document.createElement("br");
        const orloginwith = document.createElement("p");
        orloginwith.className = "sfid-small";
        orloginwith.innerHTML = "or log in using";
        content.appendChild(orloginwithspace);
        content.appendChild(orloginwith);
      } else if (!isUsernamePassEnabled && (numOfAuthProv > 0 || numOfSamlProv > 0)) {
        const orloginwith = document.createElement("p");
        orloginwith.className = "sfid-small sfid-mb16";
        orloginwith.innerHTML = "Choose an authentication provider.";
        content.appendChild(orloginwith);
      }
      if (SFIDWidget.authconfig.AuthProviders.length > 0) {
        const social = document.createElement("div");
        social.id = "sfid-social";
        const socialul = document.createElement("ul");
        for (const i in SFIDWidget.authconfig.AuthProviders) {
          const socialli = document.createElement("li");
          const iconUrl = SFIDWidget.authconfig.AuthProviders[i].IconUrl;
          const hrefUrl = SFIDWidget.authconfig.AuthProviders[i].SsoUrl + "&startURL=" + encodeURIComponent(SFIDWidget.config.authorizeURL);
          const authProvName = SFIDWidget.authconfig.AuthProviders[i].Name;
          socialli.className = "sfid-button-ap";
          socialli.id = "sfid-button-ap-" + authProvName;
          if (iconUrl != null) {
            const icon = document.createElement("img");
            icon.className = "sfid-social-buttonimg";
            icon.src = iconUrl;
            icon.alt = "Login with " + authProvName;
            const a = document.createElement("a");
            a.href = hrefUrl;
            a.appendChild(icon);
            a.title = authProvName;
            socialli.appendChild(a);
          } else {
            const button = document.createElement("button");
            button.setAttribute("onclick", "location.href='" + hrefUrl + "';");
            const t = document.createTextNode(authProvName);
            button.appendChild(t);
            socialli.appendChild(button);
          }
          socialul.appendChild(socialli);
        }
        social.appendChild(socialul);
        content.appendChild(social);
      }
      if (SFIDWidget.authconfig.SamlProviders.length > 0) {
        const social = document.createElement("div");
        social.id = "sfid-social";
        const socialul = document.createElement("ul");
        for (const samlProv in SFIDWidget.authconfig.SamlProviders) {
          const socialli = document.createElement("li");
          const button = document.createElement("button");
          const ssoProvUrlRemoveWrongRelay = removeUrlParam(
            SFIDWidget.authconfig.SamlProviders[samlProv].SsoUrl,
            "RelayState"
          );
          const relayStateParam = "&RelayState=" + encodeURIComponent(SFIDWidget.config.authorizeURL);
          const SamlName = SFIDWidget.authconfig.SamlProviders[samlProv].Name;
          socialli.className = "sfid-button-saml";
          socialli.id = "sfid-button-saml-" + SamlName;
          button.setAttribute("onclick", "location.href='" + ssoProvUrlRemoveWrongRelay + relayStateParam + "';");
          const t = document.createTextNode(SamlName);
          button.appendChild(t);
          socialli.appendChild(button);
          socialul.appendChild(socialli);
        }
        social.appendChild(socialul);
        content.appendChild(social);
      }
      if (SFIDWidget.config.mode === "modal") {
        const lightbox = document.createElement("div");
        lightbox.className = "sfid-lightbox";
        lightbox.id = "sfid-login-overlay";
        lightbox.setAttribute("onClick", "SFIDWidget.cancel()");
        const wrapper = document.createElement("div");
        wrapper.id = "sfid-wrapper";
        wrapper.onclick = function(event) {
          const myEvent = event || window.event;
          if (myEvent.stopPropagation) {
            myEvent.stopPropagation();
          } else {
            myEvent.cancelBubble = true;
          }
        };
        wrapper.appendChild(content);
        lightbox.appendChild(wrapper);
        document.body.appendChild(lightbox);
      } else {
        targetDiv.appendChild(content);
      }
    }
    function closeLogin() {
      const lightbox = document.getElementById("sfid-login-overlay");
      lightbox.style.display = "none";
      const button = document.getElementById("sfid-login-button");
      if (lightbox.parentNode) {
        lightbox.parentNode.removeChild(lightbox);
      }
      if (button) {
        button.focus();
      }
    }
    function removeUrlParam(url, parameter) {
      const urlparts = url.split("?");
      if (urlparts.length >= 2) {
        const prefix = encodeURIComponent(parameter) + "=";
        const pars = urlparts[1].split(/[&;]/g);
        for (let i = pars.length; i-- > 0; ) {
          if (pars[i].lastIndexOf(prefix, 0) !== -1) {
            pars.splice(i, 1);
          }
        }
        url = urlparts[0] + (pars.length > 0 ? "?" + pars.join("&") : "");
        return url;
      } else {
        return url;
      }
    }
    function callRetrieve(args, isUserAuthenticated = false) {
      if (!args) {
        args = {};
      }
      let tbidSessionPresent = isUserAuthenticated;
      if (!tbidSessionPresent) {
        isAuthenticated((result) => {
          tbidSessionPresent = !!result;
        });
      }
      const sessionStorage = window.sessionStorage.getItem(IIS_SESSION_STORAGE_KEY);
      if (sessionStorage && tbidSessionPresent) {
        const iisData = JSON.parse(sessionStorage);
        const lastFetch = iisData.timeSetAt || 0;
        if (args.callback && SESSION_STORAGE_TTL > Date.now() - lastFetch) {
          args.callback(iisData);
          return;
        }
      }
      fetchUserInfo(args.callback);
    }
    function callExtend() {
      console.warn("set token operation is deprecated.");
    }
    function callExpire() {
      console.warn("expire token operation is deprecated.");
    }
    function callAlive(args) {
      if (retryAfterLoginCount === 0 || retryAfterLoginCount > 4) {
        if (!args) {
          args = {};
        }
        const callback = args.callback || aliveCallback;
        const internalCallback = (result) => {
          callback({ alive: !!result });
        };
        isAuthenticated(internalCallback);
        retryAfterLoginCount = 0;
      } else {
        retryAfterLoginCount++;
      }
    }
    function aliveCallback(response) {
      if (response.alive && !SFIDWidget.openid_response) {
        isLogoutInitiated = false;
        fetch();
      } else if (!response.alive && (SFIDWidget.openid_response || window.sessionStorage.getItem(IIS_SESSION_STORAGE_KEY))) {
        SFIDWidget.logout();
      } else if (response.alive) {
        callRetrieve(
          {
            callback: checkForUpdates
          },
          true
        );
      }
    }
    function checkForUpdates(response) {
      const openIdResponse = response;
      if (openIdResponse) {
        const updatedAt = Date.parse(openIdResponse.userInfo.updated_at);
        if (!SFIDWidget.response_ts || SFIDWidget.response_ts < updatedAt) {
          SFIDWidget.response_ts = updatedAt;
          setup(openIdResponse);
        }
      }
    }
    function getSessionHintCookie(hostname) {
      const cookieMap = {
        localhost: "q",
        "-dev": "d",
        "-qa": "q",
        "-stage": "s",
        stage1: "s",
        "-perf": "pf",
        "-hotfix": "h",
        "-onboard": "o"
      };
      const subdomain = hostname.split(".")[0];
      const key = Object.keys(cookieMap).find((el) => subdomain.indexOf(el) > -1);
      const suffix = cookieMap[key] ?? "p";
      return `iis_${suffix}t`;
    }
    function isAuthenticated(callback) {
      const hostname = window.location.hostname;
      if (hostname.endsWith(".salesforce.com")) {
        const iisHost = SFIDWidget.config.communityURL;
        const hintCookie = getSessionHintCookie(iisHost);
        callback(document.cookie.indexOf(hintCookie) > -1);
      } else {
        fetchUserInfo(callback);
      }
    }
    function formatResponse(response) {
      const parsedResponse = response;
      if (parsedResponse) {
        const formatted = parsedResponse.userInfo;
        SFIDWidget.openid_response = formatted;
        SFIDWidget.lastLoggedInFrom = formatted.custom_attributes.LastLoggedInFrom;
        SFIDWidget.response_ts = Date.parse(formatted.updated_at);
      }
    }
    function getIISDomain(hostname) {
      const iis = {
        localhost: "iis-qa",
        "-dev": "iis-dev",
        "-qa": "iis-qa",
        "-stage": "iis-stage",
        stage1: "iis-stage",
        "-perf": "iis-perf",
        "-hotfix": "iis-hotfix",
        "-onboard": "iis-onboard"
      };
      const subdomain = hostname.split(".")[0];
      const key = Object.keys(iis).find((el) => subdomain.indexOf(el) > -1);
      const sub = iis[key] ?? "iis";
      return `${sub}.digital.salesforce.com`;
    }
    function fetchUserInfo(callback) {
      const hostname = SFIDWidget.config.communityURL;
      const iisDomain = getIISDomain(hostname);
      window.fetch(`https://${iisDomain}/services/api/user`, {
        credentials: "include"
      }).then((response) => {
        return response.json();
      }).then((result) => {
        result.timeSetAt = Date.now();
        window.sessionStorage.setItem(IIS_SESSION_STORAGE_KEY, JSON.stringify(result));
        if (callback)
          callback(result);
      }).catch(() => {
        if (callback)
          callback(false);
      });
    }
    function setup(response) {
      formatResponse(response);
      if (SFIDWidget.openid_response) {
        retryAfterLoginCount = 1;
        window[SFIDWidget_loginHandler](SFIDWidget.openid_response);
      } else if (SFIDWidget.config.mode === "modal" || SFIDWidget.config.mode === "inline" || SFIDWidget.config.mode === "popup") {
        const request = new XMLHttpRequest();
        request.onreadystatechange = function() {
          const DONE = this.DONE || 4;
          if (this.readyState === DONE) {
            SFIDWidget.authconfig = JSON.parse(this.responseText);
            processConfig();
          }
        };
        const wellKnownUrl = addExpIdToUrl(SFIDWidget.config.communityURL + "/.well-known/auth-configuration");
        request.open("GET", wellKnownUrl, true);
        request.send(null);
      } else if (SFIDWidget.config.mode === "authprovider" || SFIDWidget.config.mode === "idp") {
        if (!SFIDWidget_initHandler) {
          alert("Requires Button Callback");
        }
        window[SFIDWidget_initHandler]();
      }
    }
    function initPolling() {
      if (!isAliveInitialized) {
        isAliveInitialized = true;
        setInterval(callAlive, 3e3);
      }
    }
    function iframePostMessageHandler(event) {
      const data = event.data;
      if (data.type === "logout") {
        isLogoutInitiated = false;
        SFIDWidgetHandleExpireCallback();
      }
    }
    function processConfig() {
      let state = "";
      if (SFIDWidget.config.mode === "popup") {
        state = encodeURIComponent(SFIDWidget_loginHandler);
      } else {
        state = SFIDWidget.config.startURL ? encodeURIComponent(SFIDWidget.config.startURL) : "";
      }
      let responseType = "token";
      if (SFIDWidget.config.serverCallback)
        responseType = "code";
      SFIDWidget.config.authorizeURL = addExpIdToUrl("/services/oauth2/authorize");
      SFIDWidget.config.authorizeURL += "?response_type=" + responseType;
      SFIDWidget.config.authorizeURL += "&client_id=" + SFIDWidget.config.client_id;
      SFIDWidget.config.authorizeURL += "&redirect_uri=" + encodeURIComponent(SFIDWidget.config.redirect_uri);
      SFIDWidget.config.authorizeURL += "&state=" + state;
      let targetDiv;
      if (SFIDWidget.config.mode === "inline") {
        targetDiv = document.querySelector(SFIDWidget.config.target);
        addLogin(targetDiv);
      } else {
        targetDiv = document.querySelector(SFIDWidget.config.target);
        addButton(targetDiv);
      }
    }
    function showError() {
      const e = document.getElementById("sfid-error");
      e.style.display = "inline";
    }
    function hideError() {
      const e = document.getElementById("sfid-error");
      e.style.display = "none";
    }
    const ready = function(a) {
      if (document && document.addEventListener) {
        document.addEventListener("DOMContentLoaded", a);
      }
    };
    function fetch() {
      SFIDWidget.getToken({
        callback: setup
      });
    }
    return {
      // properties accessed outside of the iife
      openid,
      openid_response,
      config,
      authconfig,
      response_ts,
      lastLoggedInFrom,
      disabled: false,
      // public functions
      init: function() {
        SFIDWidget.config = {};
        SFIDWidget.config.startURL = location.toString();
        const brandTag = document.querySelector('meta[name="salesforce-brand"]');
        if (brandTag !== null) {
          SFIDWidget.config.brand = brandTag.content;
        }
        const expidTag = document.querySelector('meta[name="salesforce-expid"]');
        if (expidTag !== null) {
          SFIDWidget.config.expid = expidTag.content;
        }
        const minJsTag = document.querySelector('meta[name="salesforce-use-min-js"]');
        if (minJsTag !== null) {
          SFIDWidget.config.nonMinifiedJS = "false" === minJsTag.content;
        }
        const salesforceCacheMaxAge = document.querySelector(
          'meta[name="salesforce-cache-max-age"]'
        );
        if (salesforceCacheMaxAge !== null) {
          SFIDWidget.config.salesforceCacheMaxAge = salesforceCacheMaxAge.content;
        }
        SFIDWidget.config.logoutOnBrowserClose = true;
        const logoutOnBrowserCloseTag = document.querySelector(
          'meta[name="salesforce-logout-on-browser-close"]'
        );
        if (logoutOnBrowserCloseTag !== null) {
          SFIDWidget.config.logoutOnBrowserClose = "true" === logoutOnBrowserCloseTag.content;
        }
        const useCommunityBackgroundColorTag = document.querySelector(
          'meta[name="salesforce-use-login-page-background-color"]'
        );
        if (useCommunityBackgroundColorTag !== null) {
          SFIDWidget.config.useCommunityBackgroundColor = "true" === useCommunityBackgroundColorTag.content;
        }
        const useCommunityPrimaryColorTag = document.querySelector(
          'meta[name="salesforce-use-login-page-login-button"]'
        );
        if (useCommunityPrimaryColorTag !== null) {
          SFIDWidget.config.useCommunityPrimaryColor = "true" === useCommunityPrimaryColorTag.content;
        }
        const communityURLTag = document.querySelector('meta[name="salesforce-community"]');
        if (communityURLTag === null) {
          alert("Enter the URL for your Salesforce community for the salesforce-community metatag.");
          return;
        } else {
          SFIDWidget.config.communityURL = communityURLTag.content;
          SFIDWidget.config.domain = SFIDWidget.config.communityURL.split("://")[1].split("/")[0];
        }
        const callbackMethodTag = document.querySelector(
          'meta[name="salesforce-server-callback"]'
        );
        if (callbackMethodTag === null || callbackMethodTag.content === "false") {
          SFIDWidget.config.serverCallback = false;
        } else if (callbackMethodTag.content === "true") {
          SFIDWidget.config.serverCallback = true;
        }
        const allowedDomainsTag = document.querySelector(
          'meta[name="salesforce-allowed-domains"]'
        );
        if (allowedDomainsTag !== null) {
          SFIDWidget.config.allowedDomains = allowedDomainsTag.content.split(",");
        }
        const modeTag = document.querySelector('meta[name="salesforce-mode"]');
        if (modeTag === null) {
          alert("Enter the mode for the salesforce-mode metatag, either inline, modal, popup, or authprovider.");
          return;
        } else {
          SFIDWidget.config.mode = modeTag.content;
          if (SFIDWidget.config.mode === "popup-callback" || SFIDWidget.config.mode === "modal-callback" || SFIDWidget.config.mode === "inline-callback" || SFIDWidget.config.mode === "idp-callback") {
            if (allowedDomainsTag === null) {
              alert("Enter the trusted domains, for example, localhost, @.somedomain.com.");
              return;
            }
            const saveTokenTag = document.querySelector(
              'meta[name="salesforce-save-access-token"]'
            );
            if (saveTokenTag === null || saveTokenTag.content === "false") {
              SFIDWidget.config.saveToken = false;
            } else if (saveTokenTag.content === "true") {
              SFIDWidget.config.saveToken = true;
            }
            SFIDWidget.handleLoginCallback();
            return;
          }
        }
        if (SFIDWidget.config.mode === "authprovider") {
          const authProviderLoginTag = document.querySelector(
            'meta[name="salesforce-authprovider-login"]'
          );
          if (authProviderLoginTag === null) {
            alert("Enter the AuthProvider Login SSO URL.");
            return;
          } else {
            SFIDWidget.config.authProviderLogin = authProviderLoginTag.content;
          }
          const authProviderSignupTag = document.querySelector(
            'meta[name="salesforce-authprovider-signup"]'
          );
          if (authProviderSignupTag) {
            SFIDWidget.config.authProviderSignup = authProviderSignupTag.content;
          }
        } else if (SFIDWidget.config.mode === "idp") {
          const idpUrlTag = document.querySelector('meta[name="salesforce-idp-url"]');
          if (idpUrlTag === null) {
            alert("Enter the IDP Login URL.");
            return;
          } else {
            SFIDWidget.config.idpUrl = idpUrlTag.content;
          }
          const idpLoginQueryParamTag = document.querySelector(
            'meta[name="salesforce-idp-login-queryparam"]'
          );
          if (idpLoginQueryParamTag) {
            SFIDWidget.config.idpLoginQueryParam = idpLoginQueryParamTag.content;
          }
          const idpSignupQueryParamTag = document.querySelector(
            'meta[name="salesforce-idp-signup-queryparam"]'
          );
          if (idpSignupQueryParamTag) {
            SFIDWidget.config.idpSignupQueryParam = idpSignupQueryParamTag.content;
          }
        } else {
          const client_idTag = document.querySelector('meta[name="salesforce-client-id"]');
          if (client_idTag === null) {
            alert("Enter the Consumer Key of the OAuth connected app which issues the access token.");
            return;
          } else {
            SFIDWidget.config.client_id = client_idTag.content;
          }
        }
        const maskRedirectsTag = document.querySelector(
          'meta[name="salesforce-mask-redirects"]'
        );
        if (maskRedirectsTag) {
          SFIDWidget.config.maskRedirects = maskRedirectsTag.content;
        } else {
          SFIDWidget.config.maskRedirects = "true";
        }
        const redirect_uriTag = document.querySelector('meta[name="salesforce-redirect-uri"]');
        if (redirect_uriTag === null) {
          alert(
            "Enter the Callback URL for your client-side callback page, for example, https://:logindemo.herokuapp.com/_callback.php."
          );
          return;
        } else {
          SFIDWidget.config.redirect_uri = redirect_uriTag.content;
        }
        const forgotPasswordEnabledTag = document.querySelector(
          'meta[name="salesforce-forgot-password-enabled"]'
        );
        if (forgotPasswordEnabledTag) {
          SFIDWidget.config.forgotPasswordEnabled = forgotPasswordEnabledTag.content;
        } else {
          SFIDWidget.config.forgotPasswordEnabled = false;
        }
        const selfRegistrationEnabledTag = document.querySelector(
          'meta[name="salesforce-self-register-enabled"]'
        );
        if (selfRegistrationEnabledTag) {
          SFIDWidget.config.selfRegistrationEnabled = selfRegistrationEnabledTag.content;
        } else {
          SFIDWidget.config.selfRegistrationEnabled = false;
        }
        const loginHandlerTag = document.querySelector('meta[name="salesforce-login-handler"]');
        if (loginHandlerTag === null) {
          alert(
            "Enter the name of the JavaScript function to call on a successful login event for the salesforce-login-handler metatag."
          );
          return;
        } else {
          SFIDWidget_loginHandler = loginHandlerTag.content;
        }
        const targetTag = document.querySelector('meta[name="salesforce-target"]');
        if (targetTag === null) {
          if (SFIDWidget.config.mode !== "idp" && SFIDWidget.config.mode !== "authprovider") {
            alert("Enter the target on the webpage, for example, a sign-in link, to perform the login.");
            return;
          }
        } else {
          SFIDWidget.config.target = targetTag.content;
        }
        const logoutHandlerTag = document.querySelector(
          'meta[name="salesforce-logout-handler"]'
        );
        if (logoutHandlerTag !== null) {
          SFIDWidget_logoutHandler = logoutHandlerTag.content;
        }
        if (SFIDWidget.config.mode === "idp" || SFIDWidget.config.mode === "authprovider") {
          const initHandlerTag = document.querySelector(
            'meta[name="salesforce-init-handler"]'
          );
          if (initHandlerTag === null) {
            alert("Init handler required for the IDP or Auth Provider configuration modes");
            return;
          } else {
            SFIDWidget_initHandler = initHandlerTag.content;
          }
        }
        if (SFIDWidget.config.mode === "popup" || SFIDWidget.config.mode === "modal" || SFIDWidget.config.mode === "inline" || SFIDWidget.config.mode === "authprovider" || SFIDWidget.config.mode === "idp") {
          if (document.body === null) {
            ready(function() {
              fetch();
            });
          } else {
            fetch();
          }
          initPolling();
          window.addEventListener("message", iframePostMessageHandler, false);
        }
      },
      login: function() {
        if (SFIDWidget.config != null) {
          if (SFIDWidget.config.mode === "popup") {
            const loginWindow = window.open(
              SFIDWidget.config.communityURL + SFIDWidget.config.authorizeURL,
              "Login Window",
              "height=580,width=450"
            );
            if (window.focus) {
              loginWindow.focus();
            }
            return false;
          } else if (SFIDWidget.config.mode === "modal") {
            addLogin();
          } else if (SFIDWidget.config.mode === "authprovider") {
            const redirectUrl = addCurrentPathAndSearchAsStartUrl(SFIDWidget.config.authProviderLogin);
            window.location = redirectUrl;
          } else if (SFIDWidget.config.mode === "idp") {
            let redirectUrl = addCurrentPathAndSearchAsStartUrl(SFIDWidget.config.idpUrl);
            if (SFIDWidget.config.idpLoginQueryParam) {
              const splitz = SFIDWidget.config.idpLoginQueryParam.split("=");
              redirectUrl = addQueryParamToUrl(redirectUrl, splitz[0], splitz[1]);
            }
            window.location = redirectUrl;
          }
        }
      },
      signup: function() {
        if (SFIDWidget.config != null) {
          if (SFIDWidget.config.mode === "authprovider") {
            const redirectUrl = addCurrentPathAndSearchAsStartUrl(SFIDWidget.config.authProviderSignup);
            window.location = redirectUrl;
          } else if (SFIDWidget.config.mode === "idp") {
            let redirectUrl = addCurrentPathAndSearchAsStartUrl(SFIDWidget.config.idpUrl);
            if (SFIDWidget.config.idpSignupQueryParam) {
              const splitz = SFIDWidget.config.idpSignupQueryParam.split("=");
              redirectUrl = addQueryParamToUrl(redirectUrl, splitz[0], splitz[1]);
            }
            window.location = redirectUrl;
          }
        }
      },
      authenticate: function() {
        hideError();
        document.getElementById("sfid-submit").disabled = true;
        document.getElementById("sfid-submit").className = "sfid-disabled sfid-wide sfid-mb16";
        const un = document.getElementById("sfid-username").value;
        const pw = document.getElementById("sfid-password").value;
        if (un && pw) {
          const xhr = new XMLHttpRequest();
          const controller_url = SFIDWidget.config.communityURL + "/servlet/servlet.loginwidgetcontroller?type=login";
          xhr.open("POST", addBrandToUrl(controller_url), true);
          xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
          xhr.onreadystatechange = function() {
            const DONE = this.DONE || 4;
            if (this.readyState === DONE) {
              const apiResponse = JSON.parse(xhr.responseText);
              if (apiResponse.result === "invalid") {
                showError();
                document.getElementById("sfid-submit").disabled = false;
                document.getElementById("sfid-submit").className = "sfid-button sfid-wide sfid-mb16";
                document.getElementById("sfid-password").value = "";
              } else {
                if (SFIDWidget.config.maskRedirects === "true") {
                  const ifrm = document.createElement("iframe");
                  ifrm.setAttribute("src", apiResponse.result);
                  ifrm.className = "sfid-callback";
                  ifrm.id = "sfid-callback";
                  document.body.appendChild(ifrm);
                } else {
                  window.location.replace(apiResponse.result);
                }
              }
            }
          };
          xhr.send(
            "username=" + un + "&password=" + pw + "&startURL=" + encodeURIComponent(SFIDWidget.config.authorizeURL)
          );
        } else {
          showError();
          document.getElementById("sfid-submit").className = "sfid-button sfid-wide sfid-mb16";
          document.getElementById("sfid-submit").disabled = false;
        }
      },
      cancel: function() {
        closeLogin();
      },
      handleLoginCallback: function() {
        if (SFIDWidget.config.serverCallback) {
          const redirectToStartURLTag = document.querySelector(
            'meta[name="salesforce-server-redirect-to-starturl"]'
          );
          if (redirectToStartURLTag === null || redirectToStartURLTag.content === "false") {
            SFIDWidget.config.redirectToStartURL = false;
          } else if (redirectToStartURLTag.content === "true") {
            SFIDWidget.config.redirectToStartURL = true;
          }
          const serverProcessedStartURLTag = document.querySelector(
            'meta[name="salesforce-server-starturl"]'
          );
          if (serverProcessedStartURLTag === null) {
            SFIDWidget.config.startURL = "/";
          } else {
            SFIDWidget.config.startURL = serverProcessedStartURLTag.content;
          }
          const serverProcessedResponseTag = document.querySelector(
            'meta[name="salesforce-server-response"]'
          );
          if (serverProcessedResponseTag === null) {
            alert("The server didn't provide a response to the callback.");
            return;
          } else {
            SFIDWidgetHandleOpenIDCallback(JSON.parse(serverProcessedResponseTag.content));
          }
        } else if (window.location.hash) {
          const message = window.location.hash.substr(1);
          const nvps = message.split("&");
          for (const nvp in nvps) {
            const parts = nvps[nvp].split("=");
            if (parts[0] === "id") {
              SFIDWidget.openid = decodeURIComponent(parts[1]);
            } else if (parts[0] === "state") {
              if (parts[1] !== null) {
                if (SFIDWidget.config.mode === "popup-callback") {
                  if (parts[1] != null)
                    SFIDWidget_loginHandler = decodeURIComponent(parts[1]);
                } else {
                  SFIDWidget.config.startURL = decodeURIComponent(parts[1]);
                }
              }
            }
          }
          const openIdParts = SFIDWidget.openid.split("/");
          let openIdUrl = SFIDWidget.config.communityURL;
          for (let i = 3; i < openIdParts.length; i += 1) {
            openIdUrl += "/" + openIdParts[i];
          }
          SFIDWidget.openid = openIdUrl;
          const openidScript = document.createElement("script");
          openidScript.setAttribute(
            "src",
            SFIDWidget.openid + "?version=latest&format=jsonp&callback=SFIDWidgetHandleOpenIDCallback"
          );
          document.head.appendChild(openidScript);
        }
      },
      redirectToStartURL: function() {
        if (SFIDWidget.config.mode === "popup-callback") {
          window.close();
        } else if (SFIDWidget.config.mode === "modal-callback" || SFIDWidget.config.mode === "inline-callback" || SFIDWidget.config.mode === "idp-callback") {
          const redirectMessage = {
            cmd: "sfdcCallback::extendDone",
            redirectUri: SFIDWidget.config.startURL
          };
          window.parent.postMessage(
            JSON.stringify(redirectMessage),
            location.protocol + "//" + location.host + "/"
          );
        }
      },
      logout: function() {
        if (!isLogoutInitiated) {
          isLogoutInitiated = true;
          const hostname = SFIDWidget.config.communityURL;
          const iisDomain = getIISDomain(hostname);
          const iframe = document.getElementById("iis-auth-logout");
          if (iframe !== logoutIframe) {
            logoutIframe = document.createElement("iframe");
            logoutIframe.id = "iis-auth-logout";
            logoutIframe.style.display = "none";
            document.body.appendChild(logoutIframe);
          }
          logoutIframe.src = `https://${iisDomain}/services/auth/logout`;
          setTimeout(() => {
            SFIDWidgetHandleExpireCallback();
            isLogoutInitiated = false;
          }, 5e3);
        }
      },
      handleUpdate: function(response) {
        SFIDWidgetHandleOpenIDCallback(response);
      },
      setToken: callExtend,
      getToken: callRetrieve,
      expireToken: callExpire,
      updateToken: fetch,
      isAlive: callAlive
    };
  }();
  function SFIDWidgetHandleOpenIDCallback(response) {
    const parsedResponse = response;
    if (parsedResponse) {
      const formatted = parsedResponse.userInfo;
      SFIDWidget.openid_response = formatted;
      SFIDWidget.lastLoggedInFrom = formatted.custom_attributes.LastLoggedInFrom;
      SFIDWidget.response_ts = Date.parse(formatted.updated_at);
    }
  }
  function SFIDWidgetHandleRevokeCallback(response) {
    if (response.error != null) {
      console.log("access token was already invalid");
    } else {
      console.log("access token was revoked");
    }
  }
  function SFIDWidgetHandleExpireCallback() {
    SFIDWidget.openid = null;
    SFIDWidget.openid_response = null;
    SFIDWidget.authconfig = null;
    window.sessionStorage.removeItem(IIS_SESSION_STORAGE_KEY);
    window[SFIDWidget_logoutHandler]();
  }
  window.SFIDWidget = SFIDWidget;
  window.SFIDWidgetHandleExpireCallback = SFIDWidgetHandleExpireCallback;
  window.SFIDWidgetHandleRevokeCallback = SFIDWidgetHandleRevokeCallback;
  window.SFIDWidgetHandleOpenIDCallback = SFIDWidgetHandleOpenIDCallback;
  SFIDWidget.init();
})();
