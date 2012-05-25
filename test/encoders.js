// var util = require("util");
var assert = require('assert');
var encoders = require("../lib/encoders");

describe('Encoders', function() {
  var preencoded = 'foo\\000\\200\\\\\\377';
  var array = [0x66, 0x6f, 0x6f, 0x00, 0x80, 0x5c, 0xff];
  var buffer = new Buffer(array);

  it('should encode an array');

  it('should encode a buffer', function() {
    var encoded = encoders.encodeByteA(buffer);
    encoded.length.should.equal(preencoded.length);
    encoded.should.equal(preencoded);
  });
  it('should decode', function() {
    var decoded = encoders.decodeByteA(preencoded);
    decoded.length.should.equal(buffer.length);
    assert.deepEqual(decoded, buffer);
  });
  it('should decode after encode', function() {
    var encoded = encoders.encodeByteA(buffer);
    var decoded = encoders.decodeByteA(encoded);
    assert.deepEqual(decoded, buffer);
  });
  it('should encode after decode', function() {
    var decoded = encoders.decodeByteA(preencoded);
    var encoded = encoders.encodeByteA(decoded);
    encoded.should.equal(preencoded);
  });
  
});
