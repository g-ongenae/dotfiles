#! /bin/bash

# Check Go lang is installed
if [ "$(which go)" ] ; then
  brew install golang
fi

# Check GOPATH is defined
if [ "${GOPATH}" ] ; then
  GOPATH="$(go env GOPATH)"
  export GOPATH
fi

# Installing Keyhole
mkdir -p "${GOPATH}/src/github.com/simagix"
cd "$GOPATH/src/github.com/simagix" || exit 1
git clone --depth 1 https://github.com/simagix/keyhole.git
cd keyhole || exit 1
./build.sh

# Installing 
go mod download github.com/simagix/gox
./keyhole --version

docker run -d -p 3030:3030 simagix/maobi
cd keyhole || exit 1
./keyhole --loginfo "<logfile>"
./keyhole -v --info "mongodb+srv://$USERNAME@yelloan-cluster-prod.mshus.gcp.mongodb.net/test"