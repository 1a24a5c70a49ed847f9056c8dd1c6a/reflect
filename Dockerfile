FROM debian:11

# install tools
RUN apt-get update
RUN apt-get install -y curl

# install nodejs
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
RUN /bin/bash -c "source /root/.nvm/nvm.sh && nvm install 18.13"

RUN mkdir reflect
COPY server.js /reflect/server.js
COPY client /reflect/client

# start node server with host 0.0.0.0 and port 3000
CMD cd /reflect && /root/.nvm/versions/node/v18.13.0/bin/node /reflect/server.js 0.0.0.0 3000 
