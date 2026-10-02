#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { handleRequest, errorResponse } = require('./core');

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch (_) {
    send(errorResponse(null, -32700, 'Invalid JSON.'));
    return;
  }
  const response = handleRequest(message);
  if (response) send(response);
});

// Fatal errors terminate the process; never log user-supplied prose.
