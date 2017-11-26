#!/bin/bash

if [[ $TRAVIS_OS_NAME == 'osx' ]]; then
    npm run dist-mac
else
    sudo apt-get install --no-install-recommends -y icnsutils graphicsmagick
    npm run dist-linux
fi