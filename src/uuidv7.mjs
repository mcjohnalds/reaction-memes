// Adapted from https://github.com/uuidjs/uuid

// The MIT License (MIT)
//
// Copyright (c) 2010-2020 Robert Kieffer and other contributors
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const state = {};
const rnds8 = new Uint8Array(16);

function uuidv7() {
  const rnds = crypto.getRandomValues(rnds8);
  updateState(Date.now(), rnds);
  return v7Bytes(rnds, state.msecs, state.seq);
}

function updateState(now, rnds) {
  state.msecs ??= -Infinity;
  state.seq ??= 0;
  if (now > state.msecs) {
    // Time has moved on! Pick a new random sequence number
    state.seq = (rnds[6] << 23) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];
    state.msecs = now;
  } else {
    // Bump sequence counter w/ 32-bit rollover
    state.seq = (state.seq + 1) | 0;
    // In case of rollover, bump timestamp to preserve monotonicity. This is
    // allowed by the RFC and should self-correct as the system clock catches
    // up. See https://www.rfc-editor.org/rfc/rfc9562.html#section-6.2-9.4
    if (state.seq === 0) {
      state.msecs++;
    }
  }
}

function v7Bytes(rnds, msecs, seq) {
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }

  const buf = new Uint8Array(16);
  let offset = 0;

  // Defaults
  msecs ??= Date.now();
  seq ??= ((rnds[6] * 0x7f) << 24) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];

  // byte 0-5: timestamp (48 bits)
  buf[offset++] = (msecs / 0x10000000000) & 0xff;
  buf[offset++] = (msecs / 0x100000000) & 0xff;
  buf[offset++] = (msecs / 0x1000000) & 0xff;
  buf[offset++] = (msecs / 0x10000) & 0xff;
  buf[offset++] = (msecs / 0x100) & 0xff;
  buf[offset++] = msecs & 0xff;

  // byte 6: `version` (4 bits) | sequence bits 28-31 (4 bits)
  buf[offset++] = 0x70 | ((seq >>> 28) & 0x0f);

  // byte 7: sequence bits 20-27 (8 bits)
  buf[offset++] = (seq >>> 20) & 0xff;

  // byte 8: `variant` (2 bits) | sequence bits 14-19 (6 bits)
  buf[offset++] = 0x80 | ((seq >>> 14) & 0x3f);

  // byte 9: sequence bits 6-13 (8 bits)
  buf[offset++] = (seq >>> 6) & 0xff;

  // byte 10: sequence bits 0-5 (6 bits) | random (2 bits)
  buf[offset++] = ((seq << 2) & 0xff) | (rnds[10] & 0x03);

  // bytes 11-15: random (40 bits)
  buf[offset++] = rnds[11];
  buf[offset++] = rnds[12];
  buf[offset++] = rnds[13];
  buf[offset++] = rnds[14];
  buf[offset++] = rnds[15];

  return buf;
}

export default uuidv7;
