# reflect
A Node.js server that can be made to respond in ways specified by the request.
This can be useful for easily experimenting with HTTP headers and how they affect the behaviour of a browser.

# Installation
## Option 1: via Docker
1. Install Docker
2. Build image using the provided Dockerfile: <br>
  `docker build .` (from the directory of this repo)
3. Run image: <br>
  `docker run -p <port>:3000 <image>`

## Option 2: directly via Node.js
1. Install Node.js (tested with version 18.13.0)
2. Start server: `node server.js`

## Access it
Make the domain `reflect` (or any domain containing the word *reflect*) resolve to localhost: <br>
  e.g. add this line to `/etc/hosts`:  `127.0.0.1 reflect`

## Verify installation 
Verify by accessing `http://reflect:<port>/index.html`

# How it works
The server looks for a JSON-object in the request that specifies the response bahavior.
For GET requests, this object is expected in the GET parameter `reflect`.
For other HTTP request methods, the server expects a body of the format
`reflect=<double-URL-encoded-JSON>`.

## Structure of the expected JSON object
```
{
  statusCode : number,              // integer in range [100,999]
  headers : Array,                  // contains header names and values consecutively 
                                    // (e.g. ["hname","hvalue"] represents 'hname: hvalue' header line)
  data : {                          // object that defines the body of the request
    htmlTemplate : {                // object that simplifies returning HTML documents
      reflectReqHeaders : boolean,  // if true, headers of the reqest are included in the respone body
      headContent: Array,           // each string represents one line in the <head>...</head> element of the response
      bodyContent: Array            // each string represents one line in the <body>...</body> element of the response
    },
    literalString : String,         // string to return in the body of the response
    literalBinaryB64: String,       // not properly implemented!
  },
  
  defaultResp : {                   // object that allows to define default responses
    action : String,                // clear or set default response (with action of 'clear' or 'set' respectively)
    method : String                 // for which HTTP request method the default response should apply (no wildcards supported)
  }
}
```

The properties must have the types given above, otherwise they will be ignored.
Additional properties are ignored.

### Some details regarding the JSON object
The properties of the `data` object are prioritized in this order: 
1. If `htmlTemplate` is present, use this and ignore other porperties of `data`, otherwise:
2. If `literalString` is present, use this and ignore other properties of `data`, otherwise:
3. If `literalBinaryB64` is present, user this
