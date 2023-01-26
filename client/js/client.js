// the elements we need to access
const elems = {
  tfTargetURL : document.getElementById("from-tf-targeturl"),
  tfStatusCode : document.getElementById("from-tf-statuscode"),
  taRespHeaders : document.getElementById("from-ta-respheaders"),
  taRespString : document.getElementById("from-ta-stringresp"),
  taHTMLHeadCont : document.getElementById("form-ta-headcontent"),
  taHTMLBodyCont : document.getElementById("form-ta-bodycontent"),
  cbRespHeaders : document.getElementById("form-cb-respheaders"),
  cbHTMLHeadCont : document.getElementById("form-cb-htmlhead"),
  cbHTMLBodyCont : document.getElementById("form-cb-htmlbody"),
  cbIncludeReqHeaders : document.getElementById("form-cb-inclreqheaders"),
  cbDefaultResp :  document.getElementById("form-cb-defaultresp"),
  cbOpenResp : document.getElementById("form-cb-openresp"),
  rbBodyEmpty : document.getElementById("form-rb-body-empty"),
  rbBodyString : document.getElementById("form-rb-body-string"),
  rbBodyHTML : document.getElementById("form-rb-body-html"),
  btnSendReq : document.getElementById("form-button-sendreq"),
  btnGenLink : document.getElementById("form-button-genlink"),
  selReqMetod : document.getElementById("from-select-reqmethod"),
  selDefaultRespMethod : document.getElementById("from-select-defaultresp-method"),
  selOpenOpt : document.getElementById("form-select-openopt"),
  sendform : document.getElementById("sendform"),
  sendformReflect : document.getElementById("sendform-reflect"),
  iframeDummyTarget : document.getElementById("dummy-target"),
  anchorGenLink : document.getElementById("anchor-genlink"),
}

const responseOpenOpts = {
  noOpen : "noOpen",
  newWindow : "newWindow",
  thisWindow : "thisWindow",

  translate(val) {
    switch(val) {
      case "new-wnd":
        return this.newWindow;
      case "this-wnd":
        return this.thisWindow;
      default:
        return this.noOpen;
    }
  }
}

const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) {
      console.log(...args);
  }
}

function init() {
  function updateCbControlled(...controlledElemIDs) {
    for (const controlled of controlledElemIDs) {
      controlled.disabled = !this.checked;
    }
  }

  updateCbControlled.call(elems.cbOpenResp, elems.selOpenOpt);
  updateCbControlled.call(elems.cbRespHeaders, elems.taRespHeaders);
  updateCbControlled.call(elems.cbHTMLHeadCont, elems.taHTMLHeadCont);
  updateCbControlled.call(elems.cbHTMLBodyCont, elems.taHTMLBodyCont);
  updateCbControlled.call(elems.cbDefaultResp, elems.selDefaultRespMethod);

  elems.cbOpenResp.addEventListener("change", function() {
    updateCbControlled.call(this, elems.selOpenOpt)
  });

  elems.cbRespHeaders.addEventListener("change", function() {
    updateCbControlled.call(this, elems.taRespHeaders);
  });

  elems.cbHTMLHeadCont.addEventListener("change", function() {
    updateCbControlled.call(this, elems.taHTMLHeadCont);
  });

  elems.cbHTMLBodyCont.addEventListener("change", function() {
    updateCbControlled.call(this, elems.taHTMLBodyCont);
  });

  elems.cbDefaultResp.addEventListener("change", function() {
    updateCbControlled.call(this, elems.selDefaultRespMethod);
  });

  elems.btnSendReq.addEventListener("click", () => {
    let input = collectInput();
    let reflect = buildReflectJSON(input);
    debugLog(JSON.stringify(reflect, undefined, 2));

    let reqMethod = elems.selReqMetod.value;
    let openOpt = responseOpenOpts.noOpen;
    if (elems.cbOpenResp.checked) {
      let opt = elems.selOpenOpt.value; 
      openOpt = responseOpenOpts.translate(opt);
    }
    sendFormRequest(input.targetURL, reqMethod, openOpt, reflect);
  });

  elems.btnGenLink.addEventListener("click", () => {
    let input = collectInput();
    let reflect = buildReflectJSON(input);
    let targetURL = elems.tfTargetURL.value;
    let link = generateLink(targetURL, reflect);
    elems.anchorGenLink.href = elems.anchorGenLink.innerText = link;
  }); 

  debugLog("Initialization complete.");
}

function collectInput() {
  let input = { 
    targetURL : elems.tfTargetURL.value,
    responseStatusCode : elems.tfStatusCode.value,
    responseHeaders : "",
    responseBody : "",
    responseStr : "",
    responseHTMLHeadContent : "",
    responseHTMLBodyContent : "",
    includeRequestHeaders : elems.cbIncludeReqHeaders.checked,
    defaultRespMethod : null
  }

  if (elems.cbRespHeaders.checked) {
    input.responseHeaders = elems.taRespHeaders.value;
  }
  
  if (elems.rbBodyEmpty.checked) {
    input.responseBody = "empty";
  } else if (elems.rbBodyString.checked) {
    input.responseBody = "string";
    input.responseStr = elems.taRespString.value;
  } else if (elems.rbBodyHTML.checked) {
    input.responseBody = "html";
    if (elems.cbHTMLHeadCont.checked) {
      input.responseHTMLHeadContent = elems.taHTMLHeadCont.value;
    }
    
    if (elems.cbHTMLBodyCont.checked) {
      input.responseHTMLBodyContent = elems.taHTMLBodyCont.value;
    }
  }

  if(elems.cbDefaultResp.checked) {
    input.defaultRespMethod = elems.selDefaultRespMethod.value;
  }

  debugLog(JSON.stringify(input));
  return input;
}

function buildReflectJSON(rawInput) {
  function isStringEmpty(str) {
    return str.replace(/\s/g, "").length == 0;
  }

  let reflect = Object.create(null);
  reflect.statusCode = rawInput.responseStatusCode;
  reflect.headers = [];
  if (rawInput.responseHeaders) {
    let headerLines = rawInput.responseHeaders.split(/\r?\n/);
    for (hLine of headerLines) {
      const splitIdx = hLine.indexOf(":");
      const hName = hLine.substring(0, splitIdx);
      const hVal = hLine.substring(splitIdx + 1);
      if (!hName || isStringEmpty(hName)) {
        debugLog(`skipping: ${hName}`);
        continue;
      }
      reflect.headers.push(hName);
      reflect.headers.push(hVal);
    }
  }

  reflect.data = Object.create(null);
  if (rawInput.responseBody == "emp[ty") {
    // nothing to do
  } else if (rawInput.responseBody == "string") {
    reflect.data.literalString = rawInput.responseStr;
  } else if (rawInput.responseBody == "html") {
    reflect.data.htmlTemplate = Object.create(null);
    let htmlTemplate = reflect.data.htmlTemplate;
    htmlTemplate.reflectReqHeaders = rawInput.includeRequestHeaders;

    htmlTemplate.headContent = [];
    let headCont = rawInput.responseHTMLHeadContent.split(/\r?\n/);
    for (line of headCont) {
      if (!isStringEmpty(line)) {
        htmlTemplate.headContent.push(line);
      }
    }

    htmlTemplate.bodyContent = [];
    let bodyCont = rawInput.responseHTMLBodyContent.split(/\r?\n/);
    for (line of bodyCont) {
      if (!isStringEmpty(line)) {
        htmlTemplate.bodyContent.push(line);
      }
    }
  }

  if (rawInput.defaultRespMethod) {
    reflect.defaultResp = Object.create(null);
    reflect.defaultResp.action = "set";
    reflect.defaultResp.method = rawInput.defaultRespMethod;
  }

  return reflect;
}

function sendFormRequest(targetURL, method, responseOpt, reflect) {
  let sendformReflect = elems.sendformReflect;
  
  let sendform = elems.sendform;
  sendform.action = targetURL;
  sendform.method = method;
  sendformReflect.value = encodeURIComponent(JSON.stringify(reflect));

  switch (responseOpt) {
    case responseOpenOpts.newWindow:
      sendform.target = "_blank";
      break;
    case responseOpenOpts.thisWindow:
      sendform.target = "_self";
      break;
    case responseOpenOpts.noOpen:
    default:
      sendform.target = elems.iframeDummyTarget.name; 
      break;
  }

  sendform.submit();
}

function generateLink(targetURL, reflect) {
  function encode(reflect) {
    return encodeURIComponent(JSON.stringify(reflect)); 
  }

  let url = new URL(targetURL);
  url.searchParams.append("reflect", encode(reflect));
  return url.href;
}

init();
