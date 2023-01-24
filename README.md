# reflect
A Node.js server that can be made to respond in ways specified by the request.
This can be useful for easily experimenting with HTTP headers and how they affect the behaviour of a browser.

# Installation
## Option 1: via Docker
1. Install Docker
2. Build image using the provided Dockerfile: <br>
  `docker build .` (from the directory of this repo)
3. Run image: <br>
  `docker run docker run -p <port>:3000 <image>`

## Option 2: directly via Node.js
1. Install Node.js (tested with version 18.13.0)
2. Start server: `node server.js`

## Access it
Make the domain `reflect` (or any domain containing the word *relect*) resolve to localhost: <br>
  e.g. add this line to `/etc/hosts`:  `127.0.0.1 reflect`

## Verify installation 
Verify by accessing `http://reflect:<port>/index.html`

# How it works
TODO
