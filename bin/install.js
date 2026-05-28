#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

process.argv.splice(2, 0, "install");
require("./vibe-with-dashboard.js");
