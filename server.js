const http = require('http');
const url = require('url');
const fs = require('fs');

const DEFAULT_HOST = "127.0.0.1"; 
const DEFAULT_PORT = 3000;

const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

class ReflectParser {
  static generateFullReflect() {
    return {
      statusCode : 200,
      headers : [],
      data : {
        htmlTemplate : {
          reflectReqHeaders : true,
          headContent : [],
          bodyContent : []
        },
        literalString : "",
        literalBinaryB64 : ""
      },
      defaultResp : {
        action : "",
        method : ""
      }
    }
  }

  static generateHtmlTemplateReflect() {
    const full = ReflectParser.generateFullReflect();
    return {
      statusCode : full.statusCode,
      headers : full.header,
      data : {
        htmlTemplate : full.data.htmlTemplate
      }
    };
  }

  static generateStringReflect() {
    const full = ReflectParser.generateFullReflect();
    return {
      statusCode : full.statusCode,
      headers : full.headers,
      data : {
        literalString : full.data.literalString 
      }
    };
  }

  static generateBinaryReflect() {
    const full = ReflectParser.generateFullReflect();
    return {
      statusCode : full.statusCode,
      headers : full.headers,
      data : {
        literalBinaryB64 : full.data.literalBinaryB64
      }
    };
  }

  static generateDefaultReflect() {
    return ReflectParser.generateHtmlTemplateReflect();
  }


  /* data is handled as follows:
   * if htmlTemplate is present, that takes precenence and other fields are ignored
   * otherwise, if literalString is present, that is used
   * otherwise, if literalBinaryB64 is present, that is used
   */
  static parseReflectJSON(reflectJSON) {
    /* copy headers over to target (only strings are permitted) */
    function copyHeaders(target, src) {
      target.headers = [];
      if (!Array.isArray(src?.headers)) {
        return;
      }

      let pairs = toPairs(src.headers, true, (key, val) => {
        return typeof key === "string" && typeof val === "string";
      });

      for (let pair of pairs) {
        target.headers.push(pair);
      }
    }

    /* copy status code over to target (only numbers are permitted) */
    function copyStatusCode(target, src) {
      if (typeof src.statusCode === "string") {
        target.statusCode = Number(src.statusCode); 
      }
    }
      
    /* copy the data object over to target, (htmlTemplate, literalStrig or literalBinaryB64) */
    function copyData(target, src) {
      if (! (src?.data instanceof Object)) {
        target.data = ReflectParser.generateDefaultReflect().data;  
        return;
      }

      if (src.data?.htmlTemplate instanceof Object) {
        console.log("html");
        target.data = ReflectParser.generateHtmlTemplateReflect().data;
        let tHtmlTemplate = target.data.htmlTemplate;
        let template = src.data.htmlTemplate;
        if (typeof template?.reflectReqHeaders === "boolean") {
          tHtmlTemplate.reflectReqHeaders = template.reflectReqHeaders;
        }

        let headContent = template.headContent;
        if (Array.isArray(headContent)) {
           tHtmlTemplate.headContent = headContent.filter((elem) => typeof elem === "string");
        }

        let bodyContent = template.bodyContent;
        if (bodyContent && Array.isArray(bodyContent)) {
          tHtmlTemplate.bodyContent = bodyContent.filter((elem) => typeof elem === "string");
        }
      } else if (typeof src.data?.literalString === "string") {
        target.data = ReflectParser.generateStringReflect().data;
        target.data.literalString = src.data.literalString;
      } else if (typeof src.data?.literalBinaryB64 === "string") {
        target.data = ReflectParser.generateBinaryReflect().data;
        target.data.literalBinaryB64 = src.data.literalBinaryB64;
      } else {
        target.data = Object.create(null);
      }
    }

    /* copy defaultResp object over to target */
    function copyDefaultResp(target, src) {
      if (! (src?.defaultResp instanceof Object)) {
        return;
      }
      if (! (typeof src.defaultResp?.action === "string" && typeof src.defaultResp?.method === "string")) {
        return;
      }
      target.defaultResp = Object.create(null);
      let actionStr = src.defaultResp.action.trim().toLowerCase();
      target.defaultResp.action = actionStr;
      target.defaultResp.method = src.defaultResp.method;
    }

    function copyFields(target, src) {
      copyHeaders(target, src);
      copyStatusCode(target, src);
      copyData(target, src);
      copyDefaultResp(target, src);
    }

    if (typeof reflectJSON != "string") {
      return null;
    }

    try {
      let reflectObj = JSON.parse(reflectJSON);

      let reflect = Object.create(null);
      reflect.statusCode = 200;
      copyFields(reflect, reflectObj);
      return reflect;
    } catch (err) {
      debugLog(`Error (1): ${err.message}`);
      return null;
    }
  }
}

function toPairs(arr, trim, filter) {
  let n = Math.floor(arr.length / 2);
  let result = [];
    for (let i = 0; i < n; ++i) {
      let key = arr[2 * i];
      let val = arr[2 * i + 1];
      if (filter(key, val)) {
        if (trim) {
          key = key.trim();
          val = val.trim();
        }
        result.push({key, val});
      }
    }
    return result;
  }

  function computeKey(req, method) {
    const reqUrl = url.parse(req.url, false);
    const host = req.headers.host;
    return `${host}:${reqUrl.pathname}:${method}`;
  }

  /* returns default response if set, null otherwise */
  function retrieveDefaultReflect(cache, req) {
    if (! cache) {
      return null;
    }

    const key = computeKey(req, req.method);  
    return cache.has(key) ? cache.get(key) : null;
  }


  function updateCache(cache, req, reflect) {
    if (! (cache && req && reflect?.defaultResp?.action && reflect?.defaultResp?.method)) {
      return;
    }
    
    const key = computeKey(req, reflect.defaultResp.method)
    switch (reflect.defaultResp.action) {
      case  "clear":
        cache.delete(key);
        debugLog(`cleared entry for ${key}`);
        return;
      case "set":
        let cachedReflect = structuredClone(reflect);
        delete cachedReflect.defaultResp;
        cache.set(key, cachedReflect);
        debugLog(`set entry for ${key}`);
        return;
    }
  }

  function reflect(req, body, res, cache) {
    /* we assume the reflect object is URL-encoded twice */
    function decode(encodedReflect) {
      try {
        return decodeURIComponent(decodeURIComponent(encodedReflect));
      } catch (err) {
        debugLog(`Error (2): ${err}`);
        return null;
      }
    }

    debugLog(body);
    body = decode(body);

    let reflectStr;
    if (req.method.toUpperCase() === "GET") {
      const query = url.parse(req.url, true).query;
      if (query.reflect) { 
        reflectStr = decode(query.reflect);
      }
    } else if (body) {
      const splitIdx = body.indexOf("=");
      reflectStr = body.substring(splitIdx + 1); 
    }
    debugLog(`${req.method}: ${reflectStr}`);
    retrieveDefaultReflect(cache, req);

    let reflect = ReflectParser.parseReflectJSON(reflectStr);
    reflect = reflect ?? retrieveDefaultReflect(cache, req);
    if (! reflect) {
      setHeaders(res, null);
      setStatusCode(res, 200);
      res.end();
      return;
    }

    updateCache(cache, req, reflect);

    debugLog(`using reflect object: ${JSON.stringify(reflect)}`);
    if ("htmlTemplate" in reflect.data) {
      reflectHtmlTemplate(req, res, reflect); 
    } else if ("literalString" in reflect.data) {
      reflectLiteralString(req, res, reflect);
    } else if ("literalBinaryB64)" in reflect.data) {
      reflectLiteralBinaryB64(req, res, reflect);
    } else {
      setHeaders(res, reflect.headers);
      setStatusCode(res, reflect.statusCode);
      res.end();
    }
  }

  function reflectHtmlTemplate(req, res, reflect) {
    const htmlTemplate = reflect.data.htmlTemplate;
    let bodyStr = "<!DOCTYPE html>\n";
    bodyStr += "<html>\n";
    bodyStr += "<head>\n";
    if (htmlTemplate.headContent) {
      for (str of htmlTemplate.headContent) {
        str = str.endsWith("\n") ? str : str + "\n";
        bodyStr += str;
      }
    }
    bodyStr += "</head>\n";
    bodyStr += "<body>\n";
    if (htmlTemplate.reflectReqHeaders) {
      bodyStr += "<pre>";
      bodyStr += "#### Headers of the request ####\n";

      let pairs = toPairs(req.rawHeaders, true, (key, val) => true);

    for (const pair of pairs) {
      bodyStr += `${pair.key}: ${pair.val}\n`;
    }
    bodyStr += "################################";
    bodyStr += "</pre>";
  }
  if (htmlTemplate.bodyContent) {
    for (str of htmlTemplate.bodyContent) {
      str = str.endsWith("\n") ? str : str + "\n";
      bodyStr += str;
    }
  }
  bodyStr += "</body>\n";
  bodyStr += "</html>\n";

  setHeaders(res, reflect.headers);
  setStatusCode(res, reflect.statusCode);
  res.end(bodyStr);
}

function reflectLiteralString(req, res, reflect) {
  setHeaders(res, reflect.headers);
  setStatusCode(res, reflect.statusCode);
  res.end(reflect.data.literalString);
}

function reflectLiteralBinaryB64(req, res, reflect) {
  res.end("Not implemented.");
}

function setHeaders(res, headers) {
  // remove default headers
  res.removeHeader("Date");
  res.removeHeader("Connection");
  res.removeHeader("Keep-Alive");

  if (!headers) {
    return;
  }
  for (let header of headers) {
    try {
      res.appendHeader(header.key, header.val);
    } catch (err) {
      debugLog(`Invalid header: ${header.key}: ${header.val}`);
    }
  }
}

function setStatusCode(res, statusCode, defaultStatusCode = 200) {
  if (Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 999) {
    res.statusCode = statusCode;
  } else {
    res.statusCode = defaultStatusCode;
  }
}

function serveSite(req, res, siteContent, contentType = "text/plain") {
  res.setHeader("Content-Type", contentType);
  res.end(siteContent);
}

/* start the server */
const fsPrefix = "client/";
const pathHTML = "html-template.html";
const pathCSS = "style/html-template.css";
const pathJS = "js/client.js";
const clientHTML = fs.readFileSync(fsPrefix + pathHTML, "utf8");
const clientCSS = fs.readFileSync(fsPrefix + pathCSS, "utf8");
const clientJS = fs.readFileSync(fsPrefix + pathJS, "utf8");

const defaultRespCache = new Map();

const server = http.createServer((req, res) => {
  var body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => {
    
    const pathname = url.parse(req.url).pathname.substring(1);
    if (pathname === "index.html" || pathname == pathHTML) {
      serveSite(req, res, clientHTML, "text/html");
      return;
    } else if (pathname === pathCSS) {
      serveSite(req, res, clientCSS, "text/css");
      return;
    } else if (pathname === pathJS) {
      serveSite(req, res, clientJS, "text/javascript");
      return;
    }

    let host = req.headers.host;
    if (host.includes("reflect")) {
      reflect(req, body, res, defaultRespCache);
      return;
    }
    setStatusCode(res, 200);
    res.setHeader('Content-Type', 'text/plain');
    res.end('Reflecting only implemented for hosts containing the string "reflect"\n');
  });
});

const host = process.argv[2] || DEFAULT_HOST;
const port = process.argv[3] || DEFAULT_PORT;

server.listen(port, host, () => {
  debugLog(`Server running at http://${host}:${port}/`);
});
