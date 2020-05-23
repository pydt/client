#!/bin/bash

if [[ $TRAVIS_OS_NAME == 'osx' ]]; then
    npm run dist-mac || travis_terminate 1
else
    sudo apt-get install --no-install-recommends -y icnsutils graphicsmagick
    npm run dist-linux || travis_terminate 1
fi