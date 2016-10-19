"use strict";

const test = require("sdk/test");
const {ExperimentProvider} = require("addon/ExperimentProvider");
const {getTestActivityStream} = require("./lib/utils");

exports["test ActivityStreams has experimentProvider instance"] = assert => {
  const as = getTestActivityStream();
  assert.ok(as._experimentProvider instanceof ExperimentProvider, "should have _experimentProvider");
  as.unload("uninstall");
};

test.run(exports);
